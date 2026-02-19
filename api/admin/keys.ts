
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Constants matching gemini.ts
const KEY_PREFIX = 'GEMINI_KEY_';
const REDIS_KEY_USAGE = 'gemini:usage';
const REDIS_KEY_STATUS = 'gemini:status'; 
const REDIS_KEY_ERRORS = 'gemini:errors';
const REDIS_COOLDOWN_PREFIX = 'gemini:cooldown:';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow Admin operations
  // Note: In a real production app, validate session/token here.
  
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: "Redis not configured for key management" });
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });

  // --- GET: Fetch Stats ---
  if (req.method === 'GET') {
    // 1. Identify Keys from Env
    let envKeys: string[] = [];
    Object.keys(process.env).forEach(k => {
        if (k.startsWith(KEY_PREFIX)) envKeys.push(k);
    });
    if (envKeys.length === 0 && process.env.API_KEY) envKeys.push('API_KEY');
    
    // 2. Fetch Redis Data
    const [usageData, statusData, errorData] = await Promise.all([
        redis.hgetall(REDIS_KEY_USAGE) as Promise<Record<string, number>>,
        redis.hgetall(REDIS_KEY_STATUS) as Promise<Record<string, string>>,
        redis.hgetall(REDIS_KEY_ERRORS) as Promise<Record<string, number>>
    ]);

    // 3. Construct Response
    const stats = envKeys.map(keyName => {
        const val = process.env[keyName] || '';
        // Mask: sk-xxxx...1234
        const masked = val.length > 8 
            ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` 
            : '****';

        return {
            keyName,
            maskedKey: masked,
            status: (statusData?.[keyName] || 'ACTIVE'),
            usageCount: usageData?.[keyName] || 0,
            errorCount: errorData?.[keyName] || 0
        };
    });

    return res.status(200).json({ keys: stats });
  }

  // --- POST: Reset Actions ---
  if (req.method === 'POST') {
      const { action, keyName } = req.body;

      if (!keyName) return res.status(400).json({ error: "Key Name required" });

      if (action === 'reset_status') {
          // Set status back to ACTIVE
          await redis.hset(REDIS_KEY_STATUS, { [keyName]: 'ACTIVE' });
          // Remove cooldown lock so it can be used immediately
          await redis.del(REDIS_COOLDOWN_PREFIX + keyName);
          return res.status(200).json({ success: true, message: `Key ${keyName} reactivated.` });
      }

      if (action === 'reset_usage') {
          // Reset usage counter
          await redis.hset(REDIS_KEY_USAGE, { [keyName]: 0 });
          return res.status(200).json({ success: true, message: `Usage count for ${keyName} reset.` });
      }

      if (action === 'reset_errors') {
          // Reset error counter
          await redis.hset(REDIS_KEY_ERRORS, { [keyName]: 0 });
          return res.status(200).json({ success: true, message: `Error count for ${keyName} reset.` });
      }

      return res.status(400).json({ error: "Invalid action" });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
