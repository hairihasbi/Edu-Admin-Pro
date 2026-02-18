
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const start = Date.now();

  let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
  if (rawUrl && rawUrl.startsWith('libsql://')) {
      rawUrl = rawUrl.replace('libsql://', 'https://');
  }
  const url = rawUrl;
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

  if (!url || !authToken) {
     return res.status(503).json({ 
         status: 'error', 
         message: "Database config missing",
         latency: Date.now() - start 
    });
  }

  const client = createClient({ 
      url, 
      authToken,
      // @ts-ignore
      fetch: fetch 
  });

  try {
    // Jalankan query sangat ringan
    await client.execute("SELECT 1");
    const end = Date.now();
    
    return res.status(200).json({ 
        status: 'ok', 
        message: 'System Operational',
        latency: end - start,
        timestamp: new Date().toISOString()
    });

  } catch (e: any) {
      return res.status(500).json({ 
          status: 'error', 
          message: e.message || 'Database Unreachable',
          latency: Date.now() - start
      });
  } finally {
      client.close();
  }
}
