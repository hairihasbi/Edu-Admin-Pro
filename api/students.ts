
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";
import { StudentQuerySchema } from './_schemas.js';
import { authorize } from './_utils/auth.js';

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let currentUser;
  try {
    currentUser = await authorize(req, ['ADMIN', 'GURU']);
  } catch (err: any) {
    return res.status(err.status || 401).json({ error: err.message });
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

  const parseResult = StudentQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid Query Parameters", details: parseResult.error.format() });
  }

  const { page, limit, search, school, teacherId } = parseResult.data;

  const client = createClient({ 
      url, 
      authToken,
      // @ts-ignore
      fetch: fetch 
  });

  try {
    const offset = (page - 1) * limit;
    let whereConditions: string[] = ["(deleted IS NULL OR deleted = 0)"];
    let args: any[] = [];

    // 1. FILTERING LOGIC
    
    if (currentUser.role === 'GURU') {
        const userRes = await client.execute({ sql: "SELECT school_npsn FROM users WHERE id = ?", args: [currentUser.userId] });
        const userNpsn = userRes.rows[0]?.school_npsn;
        
        // Strict filter for Guru: Only their school's students
        if (userNpsn) {
            whereConditions.push("school_npsn = ?");
            args.push(userNpsn);
        } else {
            // Fallback legacy: Filter by classes owned by this user (requires subquery)
            whereConditions.push("class_id IN (SELECT id FROM classes WHERE user_id = ?)");
            args.push(currentUser.userId);
        }
    } else {
        // ADMIN FILTER
        if (school) {
            // Fix: Map School Name (from dropdown) to NPSN via Users table
            // Because students table stores school_npsn, but filter passes school_name
            whereConditions.push("school_npsn IN (SELECT school_npsn FROM users WHERE school_name = ?)");
            args.push(school);
        }
        
        if (teacherId) {
            whereConditions.push("class_id IN (SELECT id FROM classes WHERE user_id = ?)");
            args.push(teacherId);
        }
    }

    // 2. SEARCH FILTER
    if (search) {
      whereConditions.push("(name LIKE ? OR nis LIKE ?)");
      const term = `%${search}%`;
      args.push(term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // --- STEP 1: COUNT TOTAL ---
    const countSql = `SELECT COUNT(*) as total FROM students ${whereClause}`;
    const countResult = await client.execute({ sql: countSql, args });
    const total = countResult.rows[0].total as number;

    // --- STEP 2: FETCH STUDENTS (RAW) ---
    const studentsSql = `
      SELECT id, name, nis, gender, phone, class_id, school_npsn 
      FROM students 
      ${whereClause}
      ORDER BY name ASC 
      LIMIT ? OFFSET ?
    `;
    const studentsResult = await client.execute({ sql: studentsSql, args: [...args, limit, offset] });
    
    const rawStudents = studentsResult.rows;

    // --- STEP 3: FETCH RELATED DATA (CLASSES & USERS) MANUALLY ---
    // Extract IDs
    const classIds = [...new Set(rawStudents.map(s => s.class_id).filter(id => id))];
    let classes: any[] = [];
    let users: any[] = [];

    if (classIds.length > 0) {
        // Fetch Classes
        const placeholders = classIds.map(() => '?').join(',');
        const classesResult = await client.execute({
            sql: `SELECT id, name, user_id FROM classes WHERE id IN (${placeholders})`,
            args: classIds
        });
        classes = classesResult.rows;

        // Fetch Teachers (Users)
        const userIds = [...new Set(classes.map(c => c.user_id).filter(id => id))];
        if (userIds.length > 0) {
            const uPlaceholders = userIds.map(() => '?').join(',');
            const usersResult = await client.execute({
                sql: `SELECT id, full_name, school_name FROM users WHERE id IN (${uPlaceholders})`,
                args: userIds
            });
            users = usersResult.rows;
        }
    }

    // --- STEP 4: STITCH DATA (JOIN IN MEMORY) ---
    const classMap = new Map(classes.map(c => [c.id, c]));
    const userMap = new Map(users.map(u => [u.id, u]));

    const finalStudents = rawStudents.map(s => {
        const cls = classMap.get(s.class_id);
        const teacher = cls ? userMap.get(cls.user_id) : null;

        return {
            id: s.id,
            name: s.name,
            nis: s.nis,
            gender: s.gender,
            phone: s.phone || '',
            classId: s.class_id,
            className: cls?.name || 'Unknown Class',
            teacherName: teacher?.full_name || 'Unknown Teacher',
            schoolName: teacher?.school_name || (s.school_npsn ? `NPSN: ${s.school_npsn}` : 'Unknown School')
        };
    });

    // --- META FILTERS (Admin Only) ---
    let schoolsRes, teachersRes;
    if (currentUser.role !== 'GURU') {
        // Parallel Metadata Fetch for Filters
        const [sRes, tRes] = await Promise.all([
            client.execute("SELECT DISTINCT school_name FROM users WHERE role = 'GURU' AND school_name IS NOT NULL AND school_name != ''"),
            client.execute("SELECT id, full_name FROM users WHERE role = 'GURU' AND status = 'ACTIVE' ORDER BY full_name")
        ]);
        schoolsRes = sRes;
        teachersRes = tRes;
    }

    return res.status(200).json({
        data: finalStudents,
        meta: {
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
        },
        filters: {
            schools: schoolsRes ? schoolsRes.rows.map(r => r.school_name) : [],
            teachers: teachersRes ? teachersRes.rows.map(r => ({ id: r.id, name: r.full_name })) : []
        }
    });

  } catch (e: any) {
      console.error("API Error (Students Fetch):", e);
      return res.status(500).json({ error: e.message || "Failed to fetch students" });
  } finally {
      client.close();
  }
}
