
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

    // Helper untuk menjalankan query dengan fallback aman
    const safeCount = async (table: string, collectionName?: string) => {
        try {
            // Priority 1: Specific Table
            const res = await client.execute(`SELECT COUNT(*) as count FROM ${table} WHERE deleted = 0 OR deleted IS NULL`);
            return res.rows[0].count as number;
        } catch (e: any) {
            // Fallback: Sync Store
            if (collectionName) {
                try {
                    const res = await client.execute({
                        sql: `SELECT COUNT(*) as count FROM sync_store WHERE collection = ? AND (deleted = 0 OR deleted IS NULL)`,
                        args: [collectionName]
                    });
                    return res.rows[0].count as number;
                } catch (innerE) {
                    console.warn(`Failed to count ${table}/${collectionName}:`, innerE);
                    return 0;
                }
            }
            return 0;
        }
    };

    // 2. Aggregate Queries
    const [totalClasses, totalStudents, filledJournals, totalAttendance] = await Promise.all([
        safeCount('classes', 'eduadmin_classes'),
        safeCount('students', 'eduadmin_students'),
        safeCount('journals', 'eduadmin_journals'),
        safeCount('attendance', 'eduadmin_attendance')
    ]);

    // Hitung Kehadiran (Try specific table first, then sync_store fallback)
    let presentAttendance = 0;
    try {
        const res = await client.execute("SELECT COUNT(*) as count FROM attendance WHERE status = 'H' AND (deleted = 0 OR deleted IS NULL)");
        presentAttendance = res.rows[0].count as number;
    } catch {
        // Fallback to sync_store JSON parsing (slow but works if table missing)
        try {
            const res = await client.execute("SELECT COUNT(*) as count FROM sync_store WHERE collection = 'eduadmin_attendance' AND (deleted = 0 OR deleted IS NULL) AND data LIKE '%\"status\":\"H\"%'");
            presentAttendance = res.rows[0].count as number;
        } catch {}
    }
    
    const attendanceRate = totalAttendance > 0 
        ? Math.round((presentAttendance / totalAttendance) * 100) 
        : 0;

    // Process Gender Distribution
    let males = 0;
    let females = 0;
    
    try {
        const genderRes = await client.execute("SELECT gender, COUNT(*) as count FROM students WHERE (deleted = 0 OR deleted IS NULL) GROUP BY gender");
        genderRes.rows.forEach((row: any) => {
            if (row.gender === 'L') males = row.count as number;
            if (row.gender === 'P') females = row.count as number;
        });
    } catch (e) {
        // Fallback sync_store
        try {
             // Basic naive estimation from JSON text search if needed, usually students table exists
        } catch {}
    }

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
