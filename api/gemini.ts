
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { createClient } from "@libsql/client/web";
import { GeminiRequestSchema } from './_schemas.js';
import { authorize } from './_utils/auth.js'; 

const KEY_PREFIX = 'GEMINI_KEY_';
const REDIS_KEY_USAGE = 'gemini:usage';
const REDIS_KEY_STATUS = 'gemini:status';
const REDIS_KEY_ERRORS = 'gemini:errors';
const REDIS_COOLDOWN_PREFIX = 'gemini:cooldown:';
const REDIS_KEY_DB_KEYS_CACHE = 'gemini:cache:db_keys';
const REDIS_KEY_SYS_SETTINGS = 'gemini:cache:sys_settings';

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

// --- HELPER: GET SYSTEM SETTINGS (With Cache) ---
async function getSystemSettings(redis: Redis | null) {
    if (redis) {
        try {
            const cached = await redis.get(REDIS_KEY_SYS_SETTINGS);
            if (cached) return cached as any;
        } catch {}
    }

    let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
    if (rawUrl && rawUrl.startsWith('libsql://')) rawUrl = rawUrl.replace('libsql://', 'https://');
    const url = rawUrl;
    const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);
    if (!url || !authToken) return null;

    try {
        const client = createClient({ url, authToken, fetch: fetch as any });
        // Handle "no such column" error if migration hasn't run yet
        const result = await client.execute("SELECT ai_provider, ai_base_url, ai_api_key, ai_model FROM system_settings WHERE id = 'global-settings'");
        client.close();
        
        if (result.rows.length > 0) {
            const settings = {
                provider: result.rows[0].ai_provider as string || 'GOOGLE',
                baseUrl: result.rows[0].ai_base_url as string || '',
                apiKey: result.rows[0].ai_api_key as string || '',
                model: result.rows[0].ai_model as string || ''
            };
            if (redis) await redis.set(REDIS_KEY_SYS_SETTINGS, settings, { ex: 300 }); // Cache 5 min
            return settings;
        }
    } catch (e: any) {
        if (e.message && e.message.includes('no such column')) {
            console.warn("Schema outdated (missing AI columns), defaulting to GOOGLE provider.");
            return { provider: 'GOOGLE' };
        }
        console.error("DB Settings Fetch Error:", e);
    }
    return { provider: 'GOOGLE' };
}

// --- HELPER: DATABASE KEYS ---
async function getDatabaseKeys(redis: Redis | null) {
    if (redis) {
        try {
            const cachedKeys = await redis.get(REDIS_KEY_DB_KEYS_CACHE);
            if (cachedKeys) return cachedKeys as { name: string, value: string }[];
        } catch (e) { console.warn("Redis cache fetch failed:", e); }
    }

    let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
    if (rawUrl && rawUrl.startsWith('libsql://')) {
        rawUrl = rawUrl.replace('libsql://', 'https://');
    }
    const url = rawUrl;
    const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);
    if (!url || !authToken) return [];

    try {
        const client = createClient({ url, authToken, fetch: fetch as any });
        const result = await client.execute("SELECT id, key_value FROM api_keys WHERE status = 'ACTIVE'");
        client.close();
        
        const keys = result.rows.map(row => ({ name: `DB_KEY_${row.id}`, value: row.key_value as string }));
        if (redis && keys.length > 0) await redis.set(REDIS_KEY_DB_KEYS_CACHE, keys, { ex: 600 });
        return keys;
    } catch (e) {
        console.error("Failed to fetch keys from DB:", e);
        return [];
    }
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[i], array[i]];
    }
    return array;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let currentUser;
  try {
    currentUser = await authorize(req, ['ADMIN', 'GURU']);
  } catch (err: any) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const parseResult = GeminiRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid Input', details: parseResult.error.format() });
  }

  const { prompt, useSearch } = parseResult.data;

  // 1. Setup Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  let redis: Redis | null = null;

  if (redisUrl && redisToken) {
    try {
      redis = new Redis({ url: redisUrl, token: redisToken });
      
      const ratelimitKey = `ratelimit:gemini:user:${currentUser.userId}`;
      const limit = 20; 
      const window = 60;

      const count = await redis.incr(ratelimitKey);
      if (count === 1) await redis.expire(ratelimitKey, window);
      else {
          const ttl = await redis.ttl(ratelimitKey);
          if (ttl === -1) await redis.expire(ratelimitKey, window);
      }

      if (count > limit) return res.status(429).json({ error: `Terlalu banyak permintaan AI. Tunggu 1 menit.` });
    } catch (e) { console.error("Redis Error:", e); }
  }

  // 2. CHECK PROVIDER SETTINGS
  const settings = await getSystemSettings(redis);

  // --- BRANCH A: CUSTOM GATEWAY (LiteLLM / OpenAI Compatible) ---
  if (settings && settings.provider === 'CUSTOM' && settings.baseUrl && settings.apiKey) {
      try {
          const modelName = settings.model || 'gpt-3.5-turbo'; // Default fallback
          const payload = {
              model: modelName,
              messages: [{ role: 'user', content: prompt }],
              stream: true,
              temperature: 0.7
          };

          // Append /chat/completions if not present (standard OpenAI convention)
          let endpoint = settings.baseUrl;
          if (!endpoint.endsWith('/chat/completions')) {
              endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
          }

          const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${settings.apiKey}`
              },
              body: JSON.stringify(payload)
          });

          if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Custom Gateway Error (${response.status}): ${errText}`);
          }

          if (!response.body) throw new Error("No response body from gateway");

          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed === 'data: [DONE]') continue;
                  if (trimmed.startsWith('data: ')) {
                      try {
                          const json = JSON.parse(trimmed.substring(6));
                          const content = json.choices?.[0]?.delta?.content;
                          if (content) res.write(content);
                      } catch (e) { /* Ignore parse errors for chunks */ }
                  }
              }
          }
          res.end();
          return;

      } catch (error: any) {
          console.error("Custom AI Provider Error:", error);
          return res.status(502).json({ error: "Gagal menghubungi AI Gateway: " + error.message });
      }
  }

  // --- BRANCH B: GOOGLE DIRECT (Default Logic) ---
  
  // Gather Keys
  let allKeys: { name: string, value: string }[] = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith(KEY_PREFIX)) {
      allKeys.push({ name: key, value: process.env[key] as string });
    }
  });
  if (allKeys.length === 0 && process.env.API_KEY) {
    allKeys.push({ name: 'API_KEY', value: process.env.API_KEY });
  }
  
  try {
      const dbKeys = await getDatabaseKeys(redis);
      allKeys = [...allKeys, ...dbKeys];
  } catch(e) {}

  if (allKeys.length === 0) {
      return res.status(500).json({ error: "Sistem AI belum dikonfigurasi (API Key Missing)." });
  }

  allKeys = shuffleArray(allKeys);

  // Smart Sorting
  if (redis) {
    try {
        const statuses = await redis.hgetall(REDIS_KEY_STATUS) || {};
        allKeys.sort((a, b) => {
            const statusA = statuses[a.name] || 'ACTIVE';
            const statusB = statuses[b.name] || 'ACTIVE';
            if (statusA === 'ACTIVE' && statusB !== 'ACTIVE') return -1;
            if (statusA !== 'ACTIVE' && statusB === 'ACTIVE') return 1;
            return 0;
        });
    } catch (e) {}
  }

  let lastError = null;
  let streamStarted = false;

  // Try Keys (Failover Strategy)
  for (const keyObj of allKeys) {
    if (redis) {
       try {
           const isCoolingDown = await redis.exists(REDIS_COOLDOWN_PREFIX + keyObj.name);
           if (isCoolingDown) continue;
       } catch (e) {}
    }

    try {
      const ai = new GoogleGenAI({ apiKey: keyObj.value });
      
      const genConfig: any = {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
      };

      if (useSearch) {
          genConfig.tools = [{ googleSearch: {} }];
      }

      let modelName = 'gemini-3-flash-preview'; 
      let result;

      try {
          result = await ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
            config: genConfig
          });
      } catch (primaryErr: any) {
          console.warn(`Model ${modelName} failed, trying fallback...`);
          modelName = 'gemini-2.0-flash';
          result = await ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
            config: genConfig
          });
      }

      streamStarted = true;
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      for await (const chunk of result) {
        if (chunk.text) res.write(chunk.text);
      }

      if (redis) {
        redis.hincrby(REDIS_KEY_USAGE, keyObj.name, 1).catch(() => {});
        redis.hset(REDIS_KEY_STATUS, { [keyObj.name]: 'ACTIVE' }).catch(() => {});
      }
      
      res.end(); 
      return;

    } catch (error: any) {
      console.error(`Key ${keyObj.name} error:`, error.message);
      lastError = error;
      
      const errorMsg = error.message?.toLowerCase() || '';
      const isRateLimit = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('too many requests');
      const isQuotaExhausted = errorMsg.includes('resource has been exhausted') || errorMsg.includes('quota');
      const isAuthError = error.status === 403 || error.status === 401 || errorMsg.includes('key not valid');

      if (redis) {
         try {
             let cooldownTime = 60; // Default 1 min
             let statusLabel = 'RATE_LIMITED';

             if (isQuotaExhausted) {
                 cooldownTime = 3600 * 12; 
                 statusLabel = 'DEAD_QUOTA';
             } else if (isAuthError) {
                 cooldownTime = 3600 * 24; 
                 statusLabel = 'DEAD_INVALID';
             }

             if (isRateLimit || isQuotaExhausted || isAuthError) {
                 await redis.set(REDIS_COOLDOWN_PREFIX + keyObj.name, '1', { ex: cooldownTime });
                 await redis.hset(REDIS_KEY_STATUS, { [keyObj.name]: statusLabel });
                 await redis.hincrby(REDIS_KEY_ERRORS, keyObj.name, 1);
             }
         } catch(e) {}
      } 
      
      if (!isRateLimit && !isQuotaExhausted && !isAuthError) {
          await new Promise(resolve => setTimeout(resolve, 500)); 
      }
    }
  }

  if (!streamStarted) {
      const isQuota = lastError?.message?.includes('429') || lastError?.status === 429;
      return res.status(isQuota ? 429 : 500).json({ 
        error: isQuota 
            ? "Semua jalur AI sedang sibuk (Kuota Penuh). Mohon tunggu 1 menit lalu coba lagi." 
            : "Gagal menghubungi layanan AI. Cek koneksi internet Anda.",
        ref: Date.now()
      });
  }
}
