
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

  const { prompt } = parseResult.data;

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

      if (count > limit) {
        return res.status(429).json({ error: `Terlalu banyak permintaan AI. Silakan tunggu beberapa saat.` });
      }
    } catch (e) {
      console.error("Redis Connection Error:", e);
    }
  }

  let allKeys: { name: string, value: string }[] = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith(KEY_PREFIX)) {
      allKeys.push({ name: key, value: process.env[key] as string });
    }
  });
  if (allKeys.length === 0 && process.env.API_KEY) {
    allKeys.push({ name: 'API_KEY', value: process.env.API_KEY });
  }
  const dbKeys = await getDatabaseKeys(redis);
  allKeys = [...allKeys, ...dbKeys];

  if (allKeys.length === 0) return res.status(500).json({ error: "No API Keys configured." });

  allKeys = shuffleArray(allKeys);

  if (redis) {
    const statuses = await redis.hgetall(REDIS_KEY_STATUS) || {};
    allKeys.sort((a, b) => {
        const statusA = statuses[a.name] || 'ACTIVE';
        const statusB = statuses[b.name] || 'ACTIVE';
        if (statusA === 'DEAD' && statusB !== 'DEAD') return 1;
        if (statusA !== 'DEAD' && statusB === 'DEAD') return -1;
        return 0;
    });
  }

  let lastError = null;
  let streamStarted = false;

  for (const keyObj of allKeys) {
    if (redis) {
       const isCoolingDown = await redis.exists(REDIS_COOLDOWN_PREFIX + keyObj.name);
       if (isCoolingDown) continue;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: keyObj.value });
      
      const result = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        }
      });

      streamStarted = true;
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      for await (const chunk of result) {
        if (chunk.text) res.write(chunk.text);
      }

      if (redis) {
        await redis.hincrby(REDIS_KEY_USAGE, keyObj.name, 1);
        await redis.hset(REDIS_KEY_STATUS, { [keyObj.name]: 'ACTIVE' });
      }
      
      res.end(); 
      return;

    } catch (error: any) {
      console.warn(`Key ${keyObj.name} failed:`, error.message);
      lastError = error;
      const isKeyIssue = error.message?.includes('429') || error.message?.includes('401') || error.message?.includes('Quota') || error.status === 429;

      if (isKeyIssue && redis) {
         await redis.set(REDIS_COOLDOWN_PREFIX + keyObj.name, '1', { ex: 300 });
         await redis.hset(REDIS_KEY_STATUS, { [keyObj.name]: 'DEAD' });
         await redis.hincrby(REDIS_KEY_ERRORS, keyObj.name, 1);
      } 
      if (error.status === 400) break;
    }
  }

  if (!streamStarted) {
      return res.status(500).json({ 
        error: 'Sistem AI sedang sibuk.',
        details: lastError?.message 
      });
  }
}
