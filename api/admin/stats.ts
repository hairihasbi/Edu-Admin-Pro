
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";
import { authorize } from '../_utils/auth.js';

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authorization Check (Admin Only)
    await authorize(req, ['ADMIN']);

    // FORCE HTTP
    let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
    if (rawUrl && rawUrl.startsWith('libsql://')) {
        rawUrl = rawUrl.replace('libsql://', 'https://');
    }
    const url = rawUrl;
    const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

    if (!url || !authToken) {
      return res.status(500).json({ error: "Database configuration missing" });
    }

    // Inject fetch
    const client = createClient({ 
        url, 
        authToken,
        // @ts-ignore
        fetch: fetch 
    });

    // 2. Aggregate Queries (Filtered by deleted = 0)
    const [classesRes, studentsRes, journalsRes, attendanceTotalRes, attendancePresentRes, genderRes] = await Promise.all([
        client.execute("SELECT COUNT(*) as count FROM classes WHERE deleted = 0 OR deleted IS NULL"),
        client.execute("SELECT COUNT(*) as count FROM students WHERE deleted = 0 OR deleted IS NULL"),
        client.execute("SELECT COUNT(*) as count FROM sync_store WHERE collection = 'eduadmin_journals' AND (deleted = 0 OR deleted IS NULL)"),
        client.execute("SELECT COUNT(*) as count FROM sync_store WHERE collection = 'eduadmin_attendance' AND (deleted = 0 OR deleted IS NULL)"),
        client.execute("SELECT COUNT(*) as count FROM sync_store WHERE collection = 'eduadmin_attendance' AND (deleted = 0 OR deleted IS NULL) AND data LIKE '%\"status\":\"H\"%'"),
        client.execute("SELECT gender, COUNT(*) as count FROM students WHERE deleted = 0 OR deleted IS NULL GROUP BY gender")
    ]);

    const totalClasses = classesRes.rows[0].count as number;
    const totalStudents = studentsRes.rows[0].count as number;
    const filledJournals = journalsRes.rows[0].count as number;
    
    const totalAttendance = attendanceTotalRes.rows[0].count as number;
    const presentAttendance = attendancePresentRes.rows[0].count as number;
    
    const attendanceRate = totalAttendance > 0 
        ? Math.round((presentAttendance / totalAttendance) * 100) 
        : 0;

    // Process Gender Distribution
    let males = 0;
    let females = 0;
    
    genderRes.rows.forEach((row: any) => {
        if (row.gender === 'L') males = row.count as number;
        if (row.gender === 'P') females = row.count as number;
    });

    const genderDistribution = [
        { name: 'Laki-laki', value: males },
        { name: 'Perempuan', value: females }
    ];

    client.close();

    return res.status(200).json({
        totalClasses,
        totalStudents,
        filledJournals,
        attendanceRate,
        genderDistribution 
    });

  } catch (e: any) {
    console.error("Admin Stats Error:", e);
    return res.status(500).json({ error: e.message || "Internal Server Error" });
  }
}
