
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

  const { npsn } = req.query;

  if (!npsn || typeof npsn !== 'string') {
      return res.status(400).json({ error: "NPSN required" });
  }

  let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
  if (rawUrl && rawUrl.startsWith('libsql://')) {
      rawUrl = rawUrl.replace('libsql://', 'https://');
  }
  const url = rawUrl;
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

  if (!url || !authToken) {
     // Jika config DB belum ada (mode offline/lokal dev), kembalikan not found agar input manual
     return res.status(200).json({ found: false });
  }

  const client = createClient({ 
      url, 
      authToken,
      // @ts-ignore
      fetch: fetch 
  });

  try {
    // Cari apakah ada user (guru/admin) yang sudah menggunakan NPSN ini
    // Kita asumsikan nama sekolah yang diinput user pertama adalah yang benar/baku
    const result = await client.execute({
        sql: "SELECT school_name FROM users WHERE school_npsn = ? AND school_name IS NOT NULL AND school_name != '' LIMIT 1",
        args: [npsn]
    });

    if (result.rows.length > 0) {
        return res.status(200).json({ 
            found: true, 
            schoolName: result.rows[0].school_name 
        });
    } else {
        return res.status(200).json({ found: false });
    }

  } catch (e: any) {
      console.error("Check NPSN Error:", e);
      return res.status(500).json({ error: e.message });
  } finally {
      client.close();
  }
}
