
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";
import bcrypt from 'bcryptjs';

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, username, password, fullName, email, phone, schoolNpsn, schoolName, role, status, subject, avatar, lastModified, teacherType, phase } = req.body;

  if (!username || !password || !schoolNpsn) {
      return res.status(400).json({ error: "Missing required fields (username, password, npsn)" });
  }

  let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
  if (rawUrl && rawUrl.startsWith('libsql://')) {
      rawUrl = rawUrl.replace('libsql://', 'https://');
  }
  const url = rawUrl;
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

  if (!url || !authToken) {
     return res.status(503).json({ error: "Database config missing" });
  }

  const client = createClient({ 
      url, 
      authToken,
      // @ts-ignore
      fetch: fetch 
  });

  try {
    // 1. Cek username duplikat di server
    const check = await client.execute({
        sql: "SELECT id FROM users WHERE username = ?",
        args: [username]
    });

    if (check.rows.length > 0) {
        return res.status(409).json({ error: "Username sudah digunakan." });
    }

    // 2. Enkripsi Password (Hashing)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert User Baru (Secure)
    // Pastikan status default PENDING jika tidak dikirim
    const finalStatus = status || 'PENDING';
    const finalRole = role || 'GURU';

    await client.execute({
        sql: `INSERT INTO users (
            id, username, password, full_name, email, phone, 
            school_npsn, school_name, role, status, subject, 
            avatar, teacher_type, phase, last_modified, version, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        args: [
            id, username, hashedPassword, fullName, email || '', phone || '',
            schoolNpsn, schoolName, finalRole, finalStatus, subject || '',
            avatar, teacherType || 'SUBJECT', phase || null, lastModified || Date.now(), 1
        ]
    });

    return res.status(200).json({ success: true, message: "Pendaftaran berhasil disimpan di server." });

  } catch (e: any) {
      console.error("Register Error:", e);
      return res.status(500).json({ error: e.message || "Gagal menyimpan data ke database." });
  } finally {
      client.close();
  }
}
