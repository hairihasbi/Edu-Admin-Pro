
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";
import { Redis } from '@upstash/redis';
import { authorize } from './_utils/auth.js';

// --- CONFIGURATION ---
const GENERIC_TABLE = "sync_store";

// SCHEMA DEFINITIONS (Updated with 'deleted' column)
const DB_SCHEMAS = [
    `CREATE TABLE IF NOT EXISTS sync_store (
        collection TEXT,
        id TEXT,
        data TEXT,
        updated_at INTEGER,
        version INTEGER DEFAULT 1,
        user_id TEXT,
        school_npsn TEXT,
        deleted INTEGER DEFAULT 0,
        PRIMARY KEY (collection, id)
    )`,
    `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        password TEXT,
        full_name TEXT,
        role TEXT,
        status TEXT,
        school_name TEXT,
        school_npsn TEXT,
        nip TEXT,
        email TEXT,
        phone TEXT,
        subject TEXT,
        avatar TEXT,
        additional_role TEXT,
        homeroom_class_id TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        school_npsn TEXT,
        name TEXT,
        description TEXT,
        student_count INTEGER,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        class_id TEXT,
        school_npsn TEXT,
        name TEXT,
        nis TEXT,
        gender TEXT,
        phone TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        user_id TEXT, 
        student_id TEXT,
        class_id TEXT,
        semester TEXT,
        subject TEXT,
        category TEXT,
        material_id TEXT,
        score INTEGER,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_value TEXT,
        provider TEXT,
        status TEXT,
        added_at TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
        id TEXT PRIMARY KEY,
        feature_rpp_enabled BOOLEAN,
        maintenance_message TEXT,
        app_name TEXT,
        school_name TEXT,
        app_description TEXT,
        app_keywords TEXT,
        logo_url TEXT,
        favicon_url TEXT,
        timezone TEXT,
        footer_text TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS point_reductions (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        date TEXT,
        activity_name TEXT,
        points_removed INTEGER,
        description TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`
];

// Helper to convert undefined to null for SQL
const s = (val: any) => (val === undefined ? null : val);

const getTableConfig = (collection: string) => {
  switch (collection) {
    case 'eduadmin_users': return { 
        table: 'users', 
        columns: ['id', 'username', 'password', 'full_name', 'role', 'status', 'school_name', 'school_npsn', 'nip', 'email', 'phone', 'subject', 'avatar', 'additional_role', 'homeroom_class_id', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.username), s(item.password), s(item.fullName), s(item.role), s(item.status), s(item.schoolName), s(item.schoolNpsn), s(item.nip), s(item.email), s(item.phone), s(item.subject), s(item.avatar), s(item.additionalRole), s(item.homeroomClassId), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_classes': return { 
        table: 'classes', 
        columns: ['id', 'user_id', 'school_npsn', 'name', 'description', 'student_count', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId), s(item.schoolNpsn || 'DEFAULT'), s(item.name), s(item.description), s(item.studentCount), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_students': return { 
        table: 'students', 
        columns: ['id', 'class_id', 'school_npsn', 'name', 'nis', 'gender', 'phone', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.classId), s(item.schoolNpsn || 'DEFAULT'), s(item.name), s(item.nis), s(item.gender), s(item.phone || ''), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_scores': return { 
        table: 'scores', 
        columns: ['id', 'user_id', 'student_id', 'class_id', 'semester', 'subject', 'category', 'material_id', 'score', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId || 'UNKNOWN'), s(item.studentId), s(item.classId), s(item.semester), s(item.subject), s(item.category), s(item.materialId), s(item.score), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_api_keys': return { 
        table: 'api_keys', 
        columns: ['id', 'key_value', 'provider', 'status', 'added_at', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.key), s(item.provider), s(item.status), s(item.addedAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_system_settings': return { 
        table: 'system_settings', 
        columns: ['id', 'feature_rpp_enabled', 'maintenance_message', 'app_name', 'school_name', 'app_description', 'app_keywords', 'logo_url', 'favicon_url', 'timezone', 'footer_text', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), item.featureRppEnabled ? 1 : 0, s(item.maintenanceMessage), s(item.appName), s(item.schoolName), s(item.appDescription), s(item.appKeywords), s(item.logoUrl), s(item.faviconUrl), s(item.timezone), s(item.footerText), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_bk_reductions': return { 
        table: 'point_reductions', 
        columns: ['id', 'student_id', 'date', 'activity_name', 'points_removed', 'description', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.activityName), s(item.pointsRemoved), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    default: return null;
  }
};

const mapRowToJSON = (collection: string, row: any) => {
  const base = { version: row.version || 1, deleted: row.deleted === 1 };
  switch (collection) {
    case 'eduadmin_users': return { ...base, id: row.id, username: row.username, password: row.password, fullName: row.full_name, role: row.role, status: row.status, schoolName: row.school_name, schoolNpsn: row.school_npsn, nip: row.nip, email: row.email, phone: row.phone, subject: row.subject, avatar: row.avatar, additionalRole: row.additional_role, homeroomClassId: row.homeroom_class_id, lastModified: row.last_modified };
    case 'eduadmin_classes': return { ...base, id: row.id, userId: row.user_id, schoolNpsn: row.school_npsn, name: row.name, description: row.description, studentCount: row.student_count, lastModified: row.last_modified };
    case 'eduadmin_students': return { ...base, id: row.id, classId: row.class_id, schoolNpsn: row.school_npsn, name: row.name, nis: row.nis, gender: row.gender, phone: row.phone, lastModified: row.last_modified };
    case 'eduadmin_scores': return { ...base, id: row.id, userId: row.user_id, studentId: row.student_id, classId: row.class_id, semester: row.semester, subject: row.subject, category: row.category, materialId: row.material_id, score: row.score, lastModified: row.last_modified };
    case 'eduadmin_api_keys': return { ...base, id: row.id, key: row.key_value, provider: row.provider, status: row.status, addedAt: row.added_at, lastModified: row.last_modified };
    case 'eduadmin_system_settings': return { ...base, id: row.id, featureRppEnabled: Boolean(row.feature_rpp_enabled), maintenanceMessage: row.maintenance_message, appName: row.app_name, schoolName: row.school_name, appDescription: row.app_description, appKeywords: row.app_keywords, logoUrl: row.logo_url, faviconUrl: row.favicon_url, timezone: row.timezone, footerText: row.footer_text, lastModified: row.last_modified };
    case 'eduadmin_bk_reductions': return { ...base, id: row.id, studentId: row.student_id, date: row.date, activityName: row.activity_name, pointsRemoved: row.points_removed, description: row.description, lastModified: row.last_modified };
    default: return null;
  }
};

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let client;
  try {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const { action, collection, items, force, dbUrl, dbToken } = body;

    if (!action) {
        return res.status(400).json({ error: 'Action is required' });
    }

    let rawUrl = cleanEnv(dbUrl) || cleanEnv(process.env.TURSO_DB_URL);
    const authToken = cleanEnv(dbToken) || cleanEnv(process.env.TURSO_AUTH_TOKEN);

    if (!rawUrl || !authToken) {
        return res.status(503).json({ error: "Database configuration missing." });
    }

    if (rawUrl.startsWith('libsql://')) {
        rawUrl = rawUrl.replace('libsql://', 'https://');
    }

    let currentUser;
    if (action !== 'init' && action !== 'check') {
        try {
            currentUser = await authorize(req, ['ADMIN', 'GURU']);
        } catch (err: any) {
            // FALLBACK LOGIC: Handle Offline Registration Sync
            const isUserPush = action === 'push' && collection === 'eduadmin_users';
            const isAuthError = err.status === 401 || (err.message && err.message.includes('User not found'));
            
            if (isUserPush && isAuthError) {
                 const authHeader = req.headers.authorization || '';
                 const tokenUserId = authHeader.split(' ')[1];
                 const selfRegistration = items?.find((i: any) => i.id === tokenUserId);
                 
                 if (selfRegistration) {
                     currentUser = { userId: tokenUserId, role: selfRegistration.role || 'GURU', username: selfRegistration.username };
                 } else {
                     return res.status(err.status || 401).json({ error: err.message });
                 }
            } else {
                return res.status(err.status || 401).json({ error: err.message });
            }
        }
    }

    try {
        client = createClient({ 
            url: rawUrl, 
            authToken: authToken,
            // @ts-ignore
            fetch: fetch 
        });
    } catch (err: any) {
        return res.status(500).json({ 
            error: "Failed to initialize database client.", 
            details: err.message
        });
    }

    try {
        if (action === 'check') {
            await client.execute("SELECT 1");
            return res.status(200).json({ status: 'ok', message: 'Connected to Turso via HTTPS.' });
        }

        if (action === 'init') {
            const results = [];
            
            // 1. Create Tables
            for (const schema of DB_SCHEMAS) {
                const tableNameMatch = schema.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
                const tableName = tableNameMatch ? tableNameMatch[1] : 'unknown';
                try {
                    await client.execute(schema);
                    results.push({ table: tableName, success: true });
                } catch (tableErr: any) {
                    console.error(`Table Creation Failed (${tableName}):`, tableErr);
                    results.push({ table: tableName, success: false, error: tableErr.message });
                }
            }

            // 2. MIGRATIONS (Column Additions - idempotent)
            const migrations = [
                { table: 'students', col: 'phone TEXT' },
                { table: 'users', col: 'email TEXT' },
                { table: 'users', col: 'phone TEXT' },
                { table: 'users', col: 'subject TEXT' },
                { table: 'users', col: 'avatar TEXT' },
                { table: 'users', col: 'additional_role TEXT' },
                { table: 'users', col: 'homeroom_class_id TEXT' },
                { table: 'users', col: 'school_npsn TEXT' },
                { table: 'classes', col: 'school_npsn TEXT' },
                { table: 'students', col: 'school_npsn TEXT' },
                { table: 'scores', col: 'user_id TEXT' },
                { table: 'sync_store', col: 'user_id TEXT' },
                { table: 'sync_store', col: 'school_npsn TEXT' },
                // Soft Delete Migration
                { table: 'users', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'classes', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'students', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'scores', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'api_keys', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'system_settings', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'point_reductions', col: 'deleted INTEGER DEFAULT 0' },
                { table: 'sync_store', col: 'deleted INTEGER DEFAULT 0' },
            ];

            for (const mig of migrations) {
                try {
                    await client.execute(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.col}`);
                    results.push({ migration: `${mig.table}_${mig.col.split(' ')[0]}`, success: true });
                } catch (e: any) {
                    if (!e.message?.includes('duplicate column')) {
                        console.warn(`Migration skipped/failed: ${mig.table} ${mig.col}`, e.message);
                    }
                }
            }

            // 3. Seed Admin
            try {
                const checkAdmin = await client.execute("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
                if (checkAdmin.rows.length === 0) {
                    await client.execute({
                        sql: `INSERT INTO users (id, username, password, full_name, role, status, school_name, school_npsn, last_modified, version, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        args: ['admin-001', 'admin', 'admin', 'Administrator Sekolah', 'ADMIN', 'ACTIVE', 'SMA Negeri 1 EduAdmin', '10101010', Date.now(), 1, 0]
                    });
                    results.push({ table: 'seed_admin', success: true });
                }
            } catch (seedErr: any) {
                results.push({ table: 'seed_admin', success: false, error: seedErr.message });
            }

            return res.status(200).json({ success: true, message: "Database Initialized & Migrated.", details: results });
        }

        if (action === 'push') {
            if (collection === 'eduadmin_api_keys' && currentUser?.role !== 'ADMIN') {
                return res.status(403).json({ error: "Only Admin can modify API Keys" });
            }
            if (!items || items.length === 0) return res.status(200).json({ success: true });
            
            const tableConfig = getTableConfig(collection);
            const transaction = await client.transaction();
            try {
                for (const item of items) {
                    // --- HARD DELETE LOGIC ---
                    // Jika item ditandai sebagai deleted oleh frontend, lakukan DELETE fisik.
                    const isDeleted = item.deleted === true || item.deleted === 1;

                    if (isDeleted) {
                        if (tableConfig) {
                            await transaction.execute({ 
                                sql: `DELETE FROM ${tableConfig.table} WHERE id = ?`, 
                                args: [item.id] 
                            });
                        } else {
                            await transaction.execute({
                                sql: `DELETE FROM ${GENERIC_TABLE} WHERE collection = ? AND id = ?`,
                                args: [collection, item.id]
                            });
                        }
                        continue; // Lanjut ke item berikutnya, jangan insert/replace
                    }

                    // --- CONFLICT & INSERT LOGIC (Untuk item non-delete) ---
                    if (!force) {
                        let existing = null;
                        try {
                            if (tableConfig) {
                                const rs = await transaction.execute({ sql: `SELECT version FROM ${tableConfig.table} WHERE id = ?`, args: [item.id] });
                                existing = rs.rows[0];
                            } else {
                                const rs = await transaction.execute({ sql: `SELECT version FROM ${GENERIC_TABLE} WHERE collection = ? AND id = ?`, args: [collection, item.id] });
                                existing = rs.rows[0];
                            }
                        } catch (e) { /* ignore */ }

                        if (existing && (existing.version as number) > (item.version || 1)) continue; 
                    }

                    if (tableConfig) {
                        // SQL Table Insert
                        const placeholders = tableConfig.columns.map(() => '?').join(', ');
                        const sql = `INSERT OR REPLACE INTO ${tableConfig.table} (${tableConfig.columns.join(', ')}) VALUES (${placeholders})`;
                        await transaction.execute({ sql, args: tableConfig.mapFn(item) });
                    } else {
                        // Generic JSON Insert
                        const userId = item.userId || null;
                        const schoolNpsn = item.schoolNpsn || null;
                        // For generic table, strictly deleted should be 0 because we delete physically above
                        const isDeletedGeneric = 0; 
                        
                        await transaction.execute({
                            sql: `INSERT OR REPLACE INTO ${GENERIC_TABLE} (collection, id, data, updated_at, version, user_id, school_npsn, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            args: [
                                collection, 
                                item.id, 
                                JSON.stringify({...item, isSynced: true}), 
                                item.lastModified || Date.now(), 
                                item.version || 1,
                                userId,
                                schoolNpsn,
                                isDeletedGeneric
                            ]
                        });
                    }
                }
                await transaction.commit();
                return res.status(200).json({ success: true });
            } catch (txErr) {
                await transaction.rollback(); 
                throw txErr;
            }
        }

        if (action === 'pull') {
            const isGuru = currentUser?.role === 'GURU';
            const userId = currentUser?.userId || null; 

            if (isGuru && (collection === 'eduadmin_api_keys' || collection === 'eduadmin_email_config')) {
                return res.status(200).json({ rows: [] });
            }

            const tableConfig = getTableConfig(collection);
            let rows: any[] = [];

            if (tableConfig) {
                // Ensure we don't fetch deleted rows if soft delete still exists in DB from legacy
                let query = `SELECT * FROM ${tableConfig.table} WHERE (deleted = 0 OR deleted IS NULL)`;
                let args: any[] = [];

                if (isGuru) {
                    const userRes = await client.execute({ sql: "SELECT school_npsn FROM users WHERE id = ?", args: [userId] });
                    const userNpsn = userRes.rows[0]?.school_npsn || null; 

                    if (tableConfig.table === 'users') {
                        query += " AND id = ?";
                        args = [userId];
                    } else if (tableConfig.table === 'classes') {
                        if (userNpsn) {
                            query += " AND school_npsn = ?";
                            args = [userNpsn];
                        } else {
                            query += " AND user_id = ?";
                            args = [userId];
                        }
                    } else if (tableConfig.table === 'students') {
                        if (userNpsn) {
                            query += " AND school_npsn = ?";
                            args = [userNpsn];
                        } else {
                            query += " AND class_id IN (SELECT id FROM classes WHERE user_id = ?)";
                            args = [userId];
                        }
                    } else if (tableConfig.table === 'scores') {
                        query += " AND user_id = ?";
                        args = [userId];
                    } else if (tableConfig.table === 'point_reductions') {
                        query += " AND student_id IN (SELECT id FROM students WHERE school_npsn = ?)";
                        args = [userNpsn];
                    }
                }

                const result = await client.execute({ sql: query, args });
                rows = result.rows.map(row => ({
                    id: row.id,
                    data: mapRowToJSON(collection, row),
                    updated_at: row.last_modified,
                    version: row.version
                }));
            } else {
                let query = `SELECT id, data, updated_at, version, deleted FROM ${GENERIC_TABLE} WHERE collection = ? AND (deleted = 0 OR deleted IS NULL)`;
                let args: any[] = [collection];

                if (isGuru) {
                    const userRes = await client.execute({ sql: "SELECT school_npsn FROM users WHERE id = ?", args: [userId] });
                    const userNpsn = userRes.rows[0]?.school_npsn || null;

                    query += " AND (user_id = ? OR (user_id IS NULL AND (school_npsn = ? OR school_npsn IS NULL)))";
                    args.push(userId, userNpsn);
                }

                const result = await client.execute({
                    sql: query,
                    args: args
                });
                
                rows = result.rows.map(r => ({
                    id: r.id,
                    data: typeof r.data === 'string' ? JSON.parse(r.data as string) : r.data,
                    updated_at: r.updated_at,
                    version: r.version
                }));
            }
            return res.status(200).json({ rows });
        }

        return res.status(400).json({ error: "Unknown action" });

    } catch (e: any) {
        console.error("Execution Error:", e);
        return res.status(500).json({ error: "Database Execution Failed", details: e.message });
    }

  } catch (e: any) {
      console.error("Critical API Error:", e);
      return res.status(500).json({ error: e.message || "Internal Server Error" });
  } finally {
      if (client) client.close(); 
  }
}
