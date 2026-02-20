
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

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

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
        const client = createClient({ 
            url, 
            authToken,
            // @ts-ignore
            fetch: fetch 
        });
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
        [array[i], array[j]] = [array[j], array[i]];
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

  // 1. Setup Redis (Fail-safe)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  let redis: Redis | null = null;

  if (redisUrl && redisToken) {
    try {
      redis = new Redis({ url: redisUrl, token: redisToken });
      
      const ratelimitKey = `ratelimit:gemini:user:${currentUser.userId}`;
      const limit = 20; 
      const window = 60;

      // SOLUSI PENYEBAB 1: Redis Key Nyangkut (Stuck Key)
      // Kita cek TTL. Jika -1 (Persist), kita paksa expire.
      const count = await redis.incr(ratelimitKey);
      
      if (count === 1) {
          await redis.expire(ratelimitKey, window);
      } else {
          // Double check TTL for stuck keys
          const ttl = await redis.ttl(ratelimitKey);
          if (ttl === -1) {
              await redis.expire(ratelimitKey, window);
          }
      }

      if (count > limit) {
        return res.status(429).json({ error: `Terlalu banyak permintaan AI dari akun Anda. Tunggu 1 menit.` });
      }
    } catch (e) {
      console.error("Redis Connection Error (Rate Limit Skipped):", e);
    }
  }

  // 2. Gather Keys
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

  // Smart Sorting based on Redis Status
  if (redis) {
    try {
        const statuses = await redis.hgetall(REDIS_KEY_STATUS) || {};
        allKeys.sort((a, b) => {
            const statusA = statuses[a.name] || 'ACTIVE';
            const statusB = statuses[b.name] || 'ACTIVE';
            // Prioritize ACTIVE keys, push DEAD/LIMITED to bottom
            if (statusA === 'ACTIVE' && statusB !== 'ACTIVE') return -1;
            if (statusA !== 'ACTIVE' && statusB === 'ACTIVE') return 1;
            return 0;
        });
    } catch (e) {}
  }

  let lastError = null;
  let streamStarted = false;

  // 3. Try Keys (Failover Strategy)
  for (const keyObj of allKeys) {
    // Skip if cooling down
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

      // PRIMARY: Gemini 3 Flash
      let modelName = 'gemini-3-flash-preview'; 
      let result;

      try {
          result = await ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
            config: genConfig
          });
      } catch (primaryErr: any) {
          // Fallback: Gemini 2.0 Flash
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
      
      // SOLUSI PENYEBAB 2 & 3: Parsing Error Spesifik
      const errorMsg = error.message?.toLowerCase() || '';
      
      // Cek apakah 429 atau 403 atau Quota
      const isRateLimit = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('too many requests');
      const isQuotaExhausted = errorMsg.includes('resource has been exhausted') || errorMsg.includes('quota');
      const isAuthError = error.status === 403 || error.status === 401 || errorMsg.includes('key not valid');

      if (redis) {
         try {
             let cooldownTime = 60; // Default 1 min
             let statusLabel = 'RATE_LIMITED';

             if (isQuotaExhausted) {
                 // Jika Quota Habis (Resource Exhausted), jangan coba lagi dalam waktu lama (12 jam)
                 cooldownTime = 3600 * 12; 
                 statusLabel = 'DEAD_QUOTA';
             } else if (isAuthError) {
                 // Jika Key Salah/Mati permanen
                 cooldownTime = 3600 * 24; 
                 statusLabel = 'DEAD_INVALID';
             }

             // Set Cooldown
             if (isRateLimit || isQuotaExhausted || isAuthError) {
                 await redis.set(REDIS_COOLDOWN_PREFIX + keyObj.name, '1', { ex: cooldownTime });
                 await redis.hset(REDIS_KEY_STATUS, { [keyObj.name]: statusLabel });
                 await redis.hincrby(REDIS_KEY_ERRORS, keyObj.name, 1);
             }
         } catch(e) {}
      } 
      
      // SOLUSI PENYEBAB 3: Percepat Failover
      // Jika error 429/Quota, KITA TIDAK PERLU DELAY (setTimeout).
      // Langsung coba key berikutnya agar user tidak menunggu lama.
      // Hanya delay sedikit jika ini bukan error rate limit (misal error server 500)
      if (!isRateLimit && !isQuotaExhausted && !isAuthError) {
          // Generic server error, wait briefly
          await new Promise(resolve => setTimeout(resolve, 500)); 
      }
    }
  }

  if (!streamStarted) {
      // SOLUSI PENYEBAB 4: Error Handling yang Jelas
      const isQuota = lastError?.message?.includes('429') || lastError?.status === 429;
      
      // Pastikan pesan error berbeda untuk frontend agar tidak cache
      const uniqueId = Date.now(); 
      
      return res.status(isQuota ? 429 : 500).json({ 
        error: isQuota 
            ? "Semua jalur AI sedang sibuk (Kuota Penuh). Mohon tunggu 1 menit lalu coba lagi." 
            : "Gagal menghubungi layanan AI. Cek koneksi internet Anda.",
        ref: uniqueId // Membantu debugging frontend
      });
  }
}
