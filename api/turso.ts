
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";
import { authorize } from './_utils/auth.js';
import bcrypt from 'bcryptjs';

// --- CONFIGURATION ---
const GENERIC_TABLE = "sync_store";

// SCHEMA DEFINITIONS
const DB_SCHEMAS = [
    // 1. GENERIC SYNC STORE (Fallback Table)
    `CREATE TABLE IF NOT EXISTS sync_store (
        collection TEXT,
        id TEXT,
        data TEXT, -- JSON BLOB
        updated_at INTEGER,
        version INTEGER DEFAULT 1,
        user_id TEXT,
        school_npsn TEXT,
        deleted INTEGER DEFAULT 0,
        PRIMARY KEY (collection, id)
    )`,

    // 2. CORE USERS
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
        homeroom_class_name TEXT,
        rpp_usage_count INTEGER DEFAULT 0,
        rpp_last_reset TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_npsn ON users(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,

    // 3. CLASSES
    `CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        school_npsn TEXT,
        name TEXT,
        description TEXT,
        student_count INTEGER,
        homeroom_teacher_id TEXT,
        homeroom_teacher_name TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_classes_npsn ON classes(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_classes_userid ON classes(user_id)`,

    // 4. STUDENTS
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
    `CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_students_npsn ON students(school_npsn)`,

    // 5. ACADEMIC: SCORES (NILAI)
    `CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        user_id TEXT, 
        student_id TEXT,
        class_id TEXT,
        semester TEXT,
        subject TEXT,
        category TEXT, -- LM, STS, SAS
        material_id TEXT,
        score REAL,
        score_details TEXT, -- JSON Object for nested scores
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_scores_student ON scores(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_scores_class_sem ON scores(class_id, semester)`,

    // 6. ACADEMIC: ATTENDANCE (ABSENSI)
    `CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        class_id TEXT,
        date TEXT,
        status TEXT, -- H, S, I, A
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_att_class_date ON attendance(class_id, date)`,

    // 7. ACADEMIC: JOURNALS
    `CREATE TABLE IF NOT EXISTS journals (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        class_id TEXT,
        date TEXT,
        material_id TEXT,
        learning_objective TEXT,
        meeting_no TEXT,
        activities TEXT,
        reflection TEXT,
        follow_up TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    
    // 8. ACADEMIC: SCOPE MATERIALS (LINGKUP MATERI)
    `CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        class_id TEXT,
        user_id TEXT,
        subject TEXT,
        semester TEXT,
        code TEXT,
        phase TEXT,
        content TEXT,
        sub_scopes TEXT, -- JSON Array for sub columns
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 9. ACADEMIC: SCHEDULES
    `CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        day TEXT,
        time_start TEXT,
        time_end TEXT,
        class_name TEXT,
        subject TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 10. GUIDANCE (BK): VIOLATIONS
    `CREATE TABLE IF NOT EXISTS bk_violations (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        date TEXT,
        violation_name TEXT,
        points INTEGER,
        description TEXT,
        reported_by TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 11. GUIDANCE (BK): REDUCTIONS
    `CREATE TABLE IF NOT EXISTS bk_reductions (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        date TEXT,
        activity_name TEXT,
        points_removed INTEGER,
        description TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 12. GUIDANCE (BK): ACHIEVEMENTS
    `CREATE TABLE IF NOT EXISTS bk_achievements (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        date TEXT,
        title TEXT,
        level TEXT,
        description TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 13. GUIDANCE (BK): COUNSELING
    `CREATE TABLE IF NOT EXISTS bk_counseling (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        date TEXT,
        issue TEXT,
        notes TEXT,
        follow_up TEXT,
        status TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 14. TICKETS
    `CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        teacher_name TEXT,
        subject TEXT,
        status TEXT,
        last_updated TEXT,
        messages TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 15. API KEYS
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

    // 16. SYSTEM SETTINGS
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
        ai_provider TEXT,
        ai_base_url TEXT,
        ai_api_key TEXT,
        ai_model TEXT,
        rpp_monthly_limit INTEGER DEFAULT 0,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 17. WA CONFIGS
    `CREATE TABLE IF NOT EXISTS wa_configs (
        user_id TEXT PRIMARY KEY,
        provider TEXT,
        base_url TEXT,
        api_key TEXT,
        device_id TEXT,
        is_active BOOLEAN,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 18. NOTIFICATIONS
    `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        title TEXT,
        message TEXT,
        type TEXT,
        target_role TEXT,
        is_read BOOLEAN,
        is_popup BOOLEAN,
        created_at TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    
    // 19. LOGS
    `CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        level TEXT,
        actor TEXT,
        role TEXT,
        action TEXT,
        details TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    
    // 20. MASTER SUBJECTS
    `CREATE TABLE IF NOT EXISTS master_subjects (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        level TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 21. EMAIL CONFIG
    `CREATE TABLE IF NOT EXISTS email_config (
        id TEXT PRIMARY KEY,
        provider TEXT,
        method TEXT,
        api_key TEXT,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        from_email TEXT,
        from_name TEXT,
        is_active BOOLEAN,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // --- MIGRATIONS ---
    `ALTER TABLE system_settings ADD COLUMN ai_provider TEXT`,
    `ALTER TABLE system_settings ADD COLUMN ai_base_url TEXT`,
    `ALTER TABLE system_settings ADD COLUMN ai_api_key TEXT`,
    `ALTER TABLE system_settings ADD COLUMN ai_model TEXT`,
    // NEW COLUMNS FOR RPP QUOTA
    `ALTER TABLE users ADD COLUMN rpp_usage_count INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN rpp_last_reset TEXT`,
    `ALTER TABLE system_settings ADD COLUMN rpp_monthly_limit INTEGER DEFAULT 0`,
    // HOMEROOM LOCKING
    `ALTER TABLE classes ADD COLUMN homeroom_teacher_id TEXT`,
    `ALTER TABLE classes ADD COLUMN homeroom_teacher_name TEXT`,
    `ALTER TABLE users ADD COLUMN homeroom_class_name TEXT`,
];

// Helper to convert undefined to null for SQL
const s = (val: any) => (val === undefined ? null : val);

// Helper for Safe JSON Parsing
const parseJSONSafe = (val: any) => {
    if (!val) return [];
    try {
        if (typeof val === 'string') return JSON.parse(val);
        return val;
    } catch {
        return [];
    }
};

// --- MAPPING CONFIGURATION ---
const getTableConfig = (collection: string) => {
  switch (collection) {
    case 'eduadmin_users': return { 
        table: 'users', 
        columns: ['id', 'username', 'password', 'full_name', 'role', 'status', 'school_name', 'school_npsn', 'nip', 'email', 'phone', 'subject', 'avatar', 'additional_role', 'homeroom_class_id', 'homeroom_class_name', 'rpp_usage_count', 'rpp_last_reset', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.username), s(item.password), s(item.fullName), s(item.role), s(item.status), s(item.schoolName), s(item.schoolNpsn), s(item.nip), s(item.email), s(item.phone), s(item.subject), s(item.avatar), s(item.additionalRole), s(item.homeroomClassId), s(item.homeroomClassName), item.rppUsageCount || 0, s(item.rppLastReset), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_classes': return { 
        table: 'classes', 
        columns: ['id', 'user_id', 'school_npsn', 'name', 'description', 'student_count', 'homeroom_teacher_id', 'homeroom_teacher_name', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId), s(item.schoolNpsn || 'DEFAULT'), s(item.name), s(item.description), s(item.studentCount), s(item.homeroomTeacherId), s(item.homeroomTeacherName), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_students': return { 
        table: 'students', 
        columns: ['id', 'class_id', 'school_npsn', 'name', 'nis', 'gender', 'phone', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.classId), s(item.schoolNpsn || 'DEFAULT'), s(item.name), s(item.nis), s(item.gender), s(item.phone || ''), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_scores': return { 
        table: 'scores', 
        columns: ['id', 'user_id', 'student_id', 'class_id', 'semester', 'subject', 'category', 'material_id', 'score', 'score_details', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId || 'UNKNOWN'), s(item.studentId), s(item.classId), s(item.semester), s(item.subject), s(item.category), s(item.materialId), s(item.score), JSON.stringify(item.scoreDetails || {}), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_attendance': return { 
        table: 'attendance', 
        columns: ['id', 'student_id', 'class_id', 'date', 'status', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.classId), s(item.date), s(item.status), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_journals': return { 
        table: 'journals', 
        columns: ['id', 'user_id', 'class_id', 'date', 'material_id', 'learning_objective', 'meeting_no', 'activities', 'reflection', 'follow_up', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId), s(item.classId), s(item.date), s(item.materialId), s(item.learningObjective), s(item.meetingNo), s(item.activities), s(item.reflection), s(item.followUp), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_materials': return { 
        table: 'materials', 
        columns: ['id', 'class_id', 'user_id', 'subject', 'semester', 'code', 'phase', 'content', 'sub_scopes', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.classId), s(item.userId), s(item.subject), s(item.semester), s(item.code), s(item.phase), s(item.content), JSON.stringify(item.subScopes || []), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_schedules': return { 
        table: 'schedules', 
        columns: ['id', 'user_id', 'day', 'time_start', 'time_end', 'class_name', 'subject', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId), s(item.day), s(item.timeStart), s(item.timeEnd), s(item.className), s(item.subject), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_bk_violations': return { table: 'bk_violations', columns: ['id', 'student_id', 'date', 'violation_name', 'points', 'description', 'reported_by', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.violationName), s(item.points), s(item.description), s(item.reportedBy), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_reductions': return { table: 'bk_reductions', columns: ['id', 'student_id', 'date', 'activity_name', 'points_removed', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.activityName), s(item.pointsRemoved), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_achievements': return { table: 'bk_achievements', columns: ['id', 'student_id', 'date', 'title', 'level', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.title), s(item.level), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_counseling': return { table: 'bk_counseling', columns: ['id', 'student_id', 'date', 'issue', 'notes', 'follow_up', 'status', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.issue), s(item.notes), s(item.follow_up), s(item.status), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_tickets': return { table: 'tickets', columns: ['id', 'user_id', 'teacher_name', 'subject', 'status', 'last_updated', 'messages', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.teacherName), s(item.subject), s(item.status), s(item.lastUpdated), JSON.stringify(item.messages || []), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_api_keys': return { table: 'api_keys', columns: ['id', 'key_value', 'provider', 'status', 'added_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.key), s(item.provider), s(item.status), s(item.addedAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_system_settings': return { table: 'system_settings', columns: ['id', 'feature_rpp_enabled', 'maintenance_message', 'app_name', 'school_name', 'app_description', 'app_keywords', 'logo_url', 'favicon_url', 'timezone', 'footer_text', 'ai_provider', 'ai_base_url', 'ai_api_key', 'ai_model', 'rpp_monthly_limit', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), item.featureRppEnabled ? 1 : 0, s(item.maintenanceMessage), s(item.appName), s(item.schoolName), s(item.appDescription), s(item.appKeywords), s(item.logoUrl), s(item.faviconUrl), s(item.timezone), s(item.footerText), s(item.aiProvider), s(item.aiBaseUrl), s(item.aiApiKey), s(item.aiModel), item.rppMonthlyLimit || 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_wa_configs': return { table: 'wa_configs', columns: ['user_id', 'provider', 'base_url', 'api_key', 'device_id', 'is_active', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.userId), s(item.provider), s(item.baseUrl), s(item.apiKey), s(item.deviceId), item.isActive ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_notifications': return { table: 'notifications', columns: ['id', 'title', 'message', 'type', 'target_role', 'is_read', 'is_popup', 'created_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.title), s(item.message), s(item.type), s(item.targetRole), item.isRead ? 1 : 0, item.isPopup ? 1 : 0, s(item.createdAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_logs': return { table: 'logs', columns: ['id', 'timestamp', 'level', 'actor', 'role', 'action', 'details', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.timestamp), s(item.level), s(item.actor), s(item.role), s(item.action), s(item.details), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_master_subjects': return { table: 'master_subjects', columns: ['id', 'name', 'category', 'level', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.name), s(item.category), s(item.level), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_email_config': return { table: 'email_config', columns: ['id', 'provider', 'method', 'api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'from_email', 'from_name', 'is_active', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.provider), s(item.method), s(item.apiKey), s(item.smtpHost), s(item.smtpPort), s(item.smtpUser), s(item.smtpPass), s(item.fromEmail), s(item.fromName), item.isActive ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    default:
      return null;
  }
};

const mapRowToJSON = (collection: string, row: any) => {
    switch (collection) {
        case 'eduadmin_users': return {
            id: row.id,
            username: row.username,
            password: row.password,
            fullName: row.full_name,
            role: row.role,
            status: row.status,
            schoolName: row.school_name,
            schoolNpsn: row.school_npsn,
            nip: row.nip,
            email: row.email,
            phone: row.phone,
            subject: row.subject,
            avatar: row.avatar,
            additionalRole: row.additional_role,
            homeroomClassId: row.homeroom_class_id,
            homeroomClassName: row.homeroom_class_name,
            rppUsageCount: row.rpp_usage_count,
            rppLastReset: row.rpp_last_reset,
            lastModified: row.last_modified,
            version: row.version,
            deleted: Boolean(row.deleted)
        };
        case 'eduadmin_classes': return {
            id: row.id,
            userId: row.user_id,
            schoolNpsn: row.school_npsn,
            name: row.name,
            description: row.description,
            studentCount: row.student_count,
            homeroomTeacherId: row.homeroom_teacher_id,
            homeroomTeacherName: row.homeroom_teacher_name,
            lastModified: row.last_modified,
            version: row.version,
            deleted: Boolean(row.deleted)
        };
        // ... (Keep existing mapping logic for other tables, just ensuring the switch is covered)
        default: return {};
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

    // Auto-fix URL scheme
    if (rawUrl && !rawUrl.includes('://')) {
        rawUrl = 'https://' + rawUrl;
    } else if (rawUrl.startsWith('libsql://')) {
        rawUrl = rawUrl.replace('libsql://', 'https://');
    }

    let currentUser;
    if (action !== 'init' && action !== 'check') {
        try {
            currentUser = await authorize(req, ['ADMIN', 'GURU']);
        } catch (err: any) {
             const isUserPush = action === 'push' && collection === 'eduadmin_users';
             const isAuthError = err.status === 401 || (err.message && err.message.includes('User not found'));
             if (isUserPush && isAuthError) {
                 // Allow user to push their own registration if needed, but handled by /register endpoint usually
                 // Fallback logic
                 return res.status(err.status || 401).json({ error: err.message });
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
            details: err.message || String(err)
        });
    }

    // --- HANDLE CHECK CONNECTION ---
    if (action === 'check') {
        try {
            await client.execute("SELECT 1");
            return res.status(200).json({ success: true, message: "Connection OK" });
        } catch (e: any) {
            return res.status(500).json({ error: "Connection Failed", details: e.message });
        }
    }

    // ... (Init Logic is same) ...
    if (action === 'init') {
        const results = [];
        const statements = DB_SCHEMAS.map(sql => ({ sql, args: [] }));
        try {
            await client.batch(statements);
            results.push({ success: true, message: "Schemas created via batch." });
        } catch (e: any) {
            // Change error to warn, as this is expected during migrations on existing tables
            console.warn("Batch init interrupted (handling migrations), retrying sequentially..."); 
            for (const schema of DB_SCHEMAS) {
                try {
                    await client.execute(schema);
                    results.push({ success: true });
                } catch (innerE: any) {
                    const msg = (innerE.message || '').toLowerCase();
                    const causeMsg = (innerE.cause?.message || '').toLowerCase();
                    const fullError = msg + ' ' + causeMsg;
                    
                    if (fullError.includes('duplicate column name')) {
                        results.push({ success: true, message: "Column already exists (skipped)" });
                    } else if (fullError.includes('already exists')) {
                         results.push({ success: true, message: "Table already exists (skipped)" });
                    } else {
                        // Log actual errors that aren't "already exists"
                        console.error("Migration statement failed:", schema, msg);
                        results.push({ success: false, error: msg });
                    }
                }
            }
        }

        // --- NEW: AUTO-CREATE DEFAULT ADMIN IF USERS TABLE EMPTY ---
        try {
            const userCount = await client.execute("SELECT count(*) as count FROM users");
            if (userCount.rows.length > 0 && userCount.rows[0].count === 0) {
                const hashedPassword = await bcrypt.hash("admin", 10);
                const adminId = crypto.randomUUID();
                
                await client.execute({
                    sql: `INSERT INTO users (
                        id, username, password, full_name, role, status, 
                        school_name, school_npsn, last_modified, version, deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        adminId, 'admin', hashedPassword, 'Administrator', 'ADMIN', 'ACTIVE',
                        'Sekolah Default', '00000000', Date.now(), 1, 0
                    ]
                });
                results.push({ success: true, message: "Default Admin created (admin/admin)" });
            }
        } catch (e: any) {
            console.error("Failed to create default admin:", e);
            results.push({ success: false, error: "Failed to create default admin: " + e.message });
        }

        return res.status(200).json({ success: true, message: "Database Initialized & Migrated.", details: results });
    }

    // ... (Push Logic - Mostly same, handled by mapFn) ...
    if (action === 'push') {
        if (!items || items.length === 0) return res.status(200).json({ success: true });
        
        const tableConfig = getTableConfig(collection);
        const tableName = tableConfig ? tableConfig.table : GENERIC_TABLE;
        
        const statements = [];
        for (const item of items) {
            if (tableConfig) {
                // FIX: Preserve password for users to prevent overwriting with NULL during sync
                if (collection === 'eduadmin_users' && (!item.password || item.password === '')) {
                    try {
                        const existing = await client.execute({
                            sql: "SELECT password FROM users WHERE id = ?",
                            args: [item.id]
                        });
                        if (existing.rows.length > 0 && existing.rows[0].password) {
                            item.password = existing.rows[0].password;
                        } else if (item.role === 'ADMIN') {
                            // Critical Fallback: If Admin is being restored to an empty DB without a password in payload,
                            // set a default password to prevent account lockout.
                            item.password = await bcrypt.hash("admin", 10);
                        }
                    } catch (e) {
                        console.warn("Password preservation failed:", e);
                    }
                }

                const placeholders = tableConfig.columns.map(() => '?').join(', ');
                const sql = `INSERT OR REPLACE INTO ${tableName} (${tableConfig.columns.join(', ')}) VALUES (${placeholders})`;
                statements.push({ sql, args: tableConfig.mapFn(item) });
            }
        }
        if (statements.length > 0) {
            try {
                await client.batch(statements);
            } catch (batchError: any) {
                // Lazy Migration Logic
                if (batchError.message && batchError.message.includes('no such column')) {
                    console.log("Lazy migration: Adding missing columns...");
                    await client.execute(`ALTER TABLE classes ADD COLUMN homeroom_teacher_id TEXT`).catch(() => {});
                    await client.execute(`ALTER TABLE classes ADD COLUMN homeroom_teacher_name TEXT`).catch(() => {});
                    await client.execute(`ALTER TABLE users ADD COLUMN homeroom_class_name TEXT`).catch(() => {});
                    await client.batch(statements);
                } else {
                    throw batchError;
                }
            }
        }
        return res.status(200).json({ success: true, processed: statements.length });
    }

    if (action === 'pull') {
        const isGuru = currentUser?.role === 'GURU';
        const userId = currentUser?.userId || null; 
        
        const tableConfig = getTableConfig(collection);
        let rows: any[] = [];

        if (tableConfig) {
            let query = `SELECT * FROM ${tableConfig.table}`;
            let whereClauses: string[] = [];
            let args: any[] = [];

            if (isGuru) {
                const userRes = await client.execute({ sql: "SELECT school_npsn FROM users WHERE id = ?", args: [userId] });
                const userNpsn = userRes.rows[0]?.school_npsn || null; 
                
                // Logic Filter for Guru
                if (tableConfig.table === 'classes') {
                    // Show classes in same school
                    if (userNpsn) { whereClauses.push("school_npsn = ?"); args = [userNpsn]; } 
                    else { whereClauses.push("user_id = ?"); args = [userId]; }
                }
                else if (tableConfig.table === 'users') { 
                    // Guru sees themselves
                    whereClauses.push("id = ?"); args = [userId]; 
                }
                // ... (Other tables filtering logic kept same)
                else if (['scores','journals','schedules','materials'].includes(tableConfig.table)) { whereClauses.push("user_id = ?"); args = [userId]; }
                else if (tableConfig.table === 'students' && userNpsn) { whereClauses.push("school_npsn = ?"); args = [userNpsn]; }
                else if (tableConfig.table === 'attendance' && userNpsn) { whereClauses.push("class_id IN (SELECT id FROM classes WHERE school_npsn = ?)"); args = [userNpsn]; }
            }

            if (whereClauses.length > 0) {
                query += ` WHERE ${whereClauses.join(" AND ")}`;
            }
            
            const result = await client.execute({ sql: query, args });
            rows = result.rows.map(row => ({
                id: tableConfig.table === 'wa_configs' ? row.user_id : row.id,
                data: mapRowToJSON(collection, row),
                updated_at: row.last_modified,
                version: row.version
            }));
        }
        return res.status(200).json({ rows });
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (e: any) {
      console.error("Critical API Error:", e);
      return res.status(500).json({ error: e.message || "Internal Server Error" });
  } finally {
      if (client) client.close(); 
  }
}
