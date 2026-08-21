
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

  const { username, password } = req.body || {};

  if (!username || !password) {
      return res.status(400).json({ error: "Username dan Password wajib diisi" });
  }

  let rawUrl = cleanEnv(process.env.TURSO_DB_URL) || cleanEnv(process.env.TURSO_DATABASE_URL) || cleanEnv(process.env.LIBSQL_URL);
  if (rawUrl && rawUrl.startsWith('libsql://')) {
      rawUrl = rawUrl.replace('libsql://', 'https://');
  }
  const url = rawUrl;
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN) || cleanEnv(process.env.TURSO_TOKEN) || cleanEnv(process.env.LIBSQL_AUTH_TOKEN);

  if (!url || !authToken) {
     return res.status(503).json({ error: "Database server belum dikonfigurasi (ENV Missing)" });
  }

  const client = createClient({ 
      url, 
      authToken,
      // @ts-ignore
      fetch: fetch 
  });

  try {
    // 1. Ambil user berdasarkan username, email, atau NIP (case-insensitive)
    const cleanUsername = String(username).trim();
    const result = await client.execute({
        sql: "SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?) OR username = ? OR LOWER(TRIM(email)) = LOWER(?) OR nip = ? LIMIT 1",
        args: [cleanUsername, cleanUsername, cleanUsername, cleanUsername]
    });

    if (result.rows.length === 0) {
        return res.status(401).json({ error: "Username tidak ditemukan." });
    }

    const userRow = result.rows[0];

    // 2. Cek apakah user dihapus (Hard Ban)
    if (userRow.deleted === 1) {
        return res.status(403).json({ error: "Akun ini telah dihapus oleh Admin." });
    }

    // 3. Verifikasi Password
    const storedPassword = String(userRow.password || '').trim();
    const inputPassword = String(password);
    let isValid = false;

    if (storedPassword.startsWith('$2')) {
        // Jika password ter-hash (bcrypt)
        try {
            isValid = await bcrypt.compare(inputPassword, storedPassword);
        } catch (err) {
            console.error("Bcrypt compare error:", err);
            isValid = false;
        }

        // Coba bandingkan dengan trim jika ada spasi input
        if (!isValid && inputPassword !== inputPassword.trim()) {
            try {
                isValid = await bcrypt.compare(inputPassword.trim(), storedPassword);
            } catch {}
        }

        // Fallback jika storedPassword ternyata sama persis secara literal
        if (!isValid && storedPassword === inputPassword) {
            isValid = true;
        }
    } else {
        // Jika password plain text (misal: admin default lama atau belum di-hash)
        isValid = storedPassword === inputPassword || storedPassword === inputPassword.trim();
    }

    if (!isValid) {
        return res.status(401).json({ error: "Password salah." });
    }

    // 4. Cek & Perbaiki Status (Self-Healing untuk ADMIN)
    // Jika User adalah ADMIN tapi status NULL/PENDING, otomatis aktifkan.
    if (userRow.status !== 'ACTIVE') {
        if (userRow.role === 'ADMIN') {
            console.log(`[Auto-Fix] Activating Admin user ${userRow.username} who had status: ${userRow.status}`);
            await client.execute({
                sql: "UPDATE users SET status = 'ACTIVE' WHERE id = ?",
                args: [userRow.id]
            });
            userRow.status = 'ACTIVE';
        } else {
            // Jika Guru / Tendik belum diaktifkan
            return res.status(403).json({ error: "Akun belum diaktifkan oleh Admin." });
        }
    }

    // 5. Login Sukses - Kembalikan Data User (Termasuk Password Hash untuk Offline Login)
    const user = {
        id: userRow.id,
        username: userRow.username,
        password: userRow.password, // PENTING: Kirim hash password untuk disimpan di Dexie (Offline Mode)
        fullName: userRow.full_name,
        role: userRow.role,
        status: userRow.status,
        schoolName: userRow.school_name,
        schoolNpsn: userRow.school_npsn,
        nip: userRow.nip,
        email: userRow.email,
        phone: userRow.phone,
        subject: userRow.subject,
        secondarySubject: userRow.secondary_subject,
        avatar: userRow.avatar,
        additionalRole: userRow.additional_role,
        homeroomClassId: userRow.homeroom_class_id,
        homeroomClassName: userRow.homeroom_class_name,
        rppUsageCount: userRow.rpp_usage_count,
        rppLastReset: userRow.rpp_last_reset,
        teacherType: userRow.teacher_type,
        phase: userRow.phase,
        isSupervisor: Boolean(userRow.is_supervisor),
        isRfidOfficer: Boolean(userRow.is_rfid_officer),
        lastModified: userRow.last_modified,
        version: userRow.version,
        isSynced: true // Tandai bahwa data ini berasal dari server
    };

    return res.status(200).json({ 
        success: true, 
        message: "Login berhasil",
        user 
    });

  } catch (e: any) {
      console.error("Login API Error:", e);
      return res.status(500).json({ error: "Terjadi kesalahan server saat login." });
  } finally {
      client.close();
  }
}
