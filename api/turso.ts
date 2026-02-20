
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
    // Note: Older migrations removed if they cause 'duplicate column' errors 
    // because the CREATE TABLE definitions above are up to date.
    // Only keep new ALTERs here if you add columns in future versions.
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
    // ... rest of the cases ...
    case 'eduadmin_bk_violations': return { table: 'bk_violations', columns: ['id', 'student_id', 'date', 'violation_name', 'points', 'description', 'reported_by', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.violationName), s(item.points), s(item.description), s(item.reportedBy), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_reductions': return { table: 'bk_reductions', columns: ['id', 'student_id', 'date', 'activity_name', 'points_removed', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.activityName), s(item.pointsRemoved), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_achievements': return { table: 'bk_achievements', columns: ['id', 'student_id', 'date', 'title', 'level', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.title), s(item.level), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_counseling': return { table: 'bk_counseling', columns: ['id', 'student_id', 'date', 'issue', 'notes', 'follow_up', 'status', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.issue), s(item.notes), s(item.follow_up), s(item.status), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_tickets': return { table: 'tickets', columns: ['id', 'user_id', 'teacher_name', 'subject', 'status', 'last_updated', 'messages', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.teacherName), s(item.subject), s(item.status), s(item.lastUpdated), JSON.stringify(item.messages || []), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_api_keys': return { table: 'api_keys', columns: ['id', 'key_value', 'provider', 'status', 'added_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.key), s(item.provider), s(item.status), s(item.addedAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_system_settings': return { table: 'system_settings', columns: ['id', 'feature_rpp_enabled', 'maintenance_message', 'app_name', 'school_name', 'app_description', 'app_keywords', 'logo_url', 'favicon_url', 'timezone', 'footer_text', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), item.featureRppEnabled ? 1 : 0, s(item.maintenanceMessage), s(item.appName), s(item.schoolName), s(item.appDescription), s(item.appKeywords), s(item.logoUrl), s(item.faviconUrl), s(item.timezone), s(item.footerText), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_wa_configs': return { table: 'wa_configs', columns: ['user_id', 'provider', 'base_url', 'api_key', 'device_id', 'is_active', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.userId), s(item.provider), s(item.baseUrl), s(item.apiKey), s(item.deviceId), item.isActive ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_notifications': return { table: 'notifications', columns: ['id', 'title', 'message', 'type', 'target_role', 'is_read', 'is_popup', 'created_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.title), s(item.message), s(item.type), s(item.targetRole), item.isRead ? 1 : 0, item.isPopup ? 1 : 0, s(item.createdAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_logs': return { table: 'logs', columns: ['id', 'timestamp', 'level', 'actor', 'role', 'action', 'details', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.timestamp), s(item.level), s(item.actor), s(item.role), s(item.action), s(item.details), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_master_subjects': return { table: 'master_subjects', columns: ['id', 'name', 'category', 'level', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.name), s(item.category), s(item.level), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_email_config': return { table: 'email_config', columns: ['id', 'provider', 'method', 'api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'from_email', 'from_name', 'is_active', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.provider), s(item.method), s(item.apiKey), s(item.smtpHost), s(item.smtpPort), s(item.smtpUser), s(item.smtpPass), s(item.fromEmail), s(item.fromName), item.isActive ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    default: return null;
  }
};

const mapRowToJSON = (collection: string, row: any) => {
  const base = {
    id: row.id,
    lastModified: row.last_modified,
    version: row.version,
    deleted: row.deleted === 1
  };

  switch (collection) {
    case 'eduadmin_users':
      return {
        ...base,
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
        homeroomClassId: row.homeroom_class_id
      };
    case 'eduadmin_classes':
      return { ...base, userId: row.user_id, schoolNpsn: row.school_npsn, name: row.name, description: row.description, studentCount: row.student_count };
    case 'eduadmin_students':
      return { ...base, classId: row.class_id, schoolNpsn: row.school_npsn, name: row.name, nis: row.nis, gender: row.gender, phone: row.phone };
    case 'eduadmin_scores':
      return { ...base, userId: row.user_id, studentId: row.student_id, classId: row.class_id, semester: row.semester, subject: row.subject, category: row.category, materialId: row.material_id, score: row.score, scoreDetails: parseJSONSafe(row.score_details) };
    case 'eduadmin_attendance':
      return { ...base, studentId: row.student_id, classId: row.class_id, date: row.date, status: row.status };
    case 'eduadmin_journals':
      return { ...base, userId: row.user_id, classId: row.class_id, date: row.date, materialId: row.material_id, learningObjective: row.learning_objective, meetingNo: row.meeting_no, activities: row.activities, reflection: row.reflection, followUp: row.follow_up };
    case 'eduadmin_materials':
      return { ...base, classId: row.class_id, userId: row.user_id, subject: row.subject, semester: row.semester, code: row.code, phase: row.phase, content: row.content, subScopes: parseJSONSafe(row.sub_scopes) };
    case 'eduadmin_schedules':
      return { ...base, userId: row.user_id, day: row.day, timeStart: row.time_start, timeEnd: row.time_end, className: row.class_name, subject: row.subject };
    case 'eduadmin_bk_violations':
      return { ...base, studentId: row.student_id, date: row.date, violationName: row.violation_name, points: row.points, description: row.description, reportedBy: row.reported_by };
    case 'eduadmin_bk_reductions':
      return { ...base, studentId: row.student_id, date: row.date, activityName: row.activity_name, pointsRemoved: row.points_removed, description: row.description };
    case 'eduadmin_bk_achievements':
      return { ...base, studentId: row.student_id, date: row.date, title: row.title, level: row.level, description: row.description };
    case 'eduadmin_bk_counseling':
      return { ...base, studentId: row.student_id, date: row.date, issue: row.issue, notes: row.notes, followUp: row.follow_up, status: row.status };
    case 'eduadmin_tickets':
      return { ...base, userId: row.user_id, teacherName: row.teacher_name, subject: row.subject, status: row.status, lastUpdated: row.last_updated, messages: parseJSONSafe(row.messages) };
    case 'eduadmin_api_keys':
      return { ...base, key: row.key_value, provider: row.provider, status: row.status, addedAt: row.added_at };
    case 'eduadmin_system_settings':
      return { ...base, featureRppEnabled: row.feature_rpp_enabled === 1, maintenanceMessage: row.maintenance_message, appName: row.app_name, schoolName: row.school_name, appDescription: row.app_description, appKeywords: row.app_keywords, logoUrl: row.logo_url, faviconUrl: row.favicon_url, timezone: row.timezone, footerText: row.footer_text };
    case 'eduadmin_wa_configs':
      return { ...base, userId: row.user_id, provider: row.provider, baseUrl: row.base_url, apiKey: row.api_key, deviceId: row.device_id, isActive: row.is_active === 1 };
    case 'eduadmin_notifications':
      return { ...base, title: row.title, message: row.message, type: row.type, targetRole: row.target_role, isRead: row.is_read === 1, isPopup: row.is_popup === 1, createdAt: row.created_at };
    case 'eduadmin_logs':
      return { ...base, timestamp: row.timestamp, level: row.level, actor: row.actor, role: row.role, action: row.action, details: row.details };
    case 'eduadmin_master_subjects':
      return { ...base, name: row.name, category: row.category, level: row.level };
    case 'eduadmin_email_config':
      return { ...base, provider: row.provider, method: row.method, apiKey: row.api_key, smtpHost: row.smtp_host, smtpPort: row.smtp_port, smtpUser: row.smtp_user, smtpPass: row.smtp_pass, fromEmail: row.from_email, fromName: row.from_name, isActive: row.is_active === 1 };
    default:
      return base;
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
    const { action, collection, items, force, dbUrl, dbToken, scope, semester } = body; 

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
            const statements = DB_SCHEMAS.map(sql => ({ sql, args: [] }));
            try {
                await client.batch(statements);
                results.push({ success: true, message: "Schemas created via batch." });
            } catch (e: any) {
                console.error("Batch init failed, retrying sequentially:", e);
                for (const schema of DB_SCHEMAS) {
                    try {
                        await client.execute(schema);
                        results.push({ success: true });
                    } catch (innerE: any) {
                        results.push({ success: false, error: innerE.message });
                    }
                }
            }
            try {
                const checkAdmin = await client.execute("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
                if (checkAdmin.rows.length === 0) {
                    await client.execute({
                        sql: `INSERT INTO users (id, username, password, full_name, role, status, school_name, school_npsn, last_modified, version, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        args: ['admin-001', 'admin', 'admin', 'Administrator Sekolah', 'ADMIN', 'ACTIVE', 'SMA Negeri 1 EduAdmin', '10101010', Date.now(), 1, 0]
                    });
                }
            } catch (seedErr) {}
            return res.status(200).json({ success: true, message: "Database Initialized & Migrated.", details: results });
        }

        if (action === 'push') {
            if (collection === 'eduadmin_api_keys' && currentUser?.role !== 'ADMIN') {
                return res.status(403).json({ error: "Only Admin can modify API Keys" });
            }
            if (!items || items.length === 0) return res.status(200).json({ success: true });
            
            const tableConfig = getTableConfig(collection);
            const tableName = tableConfig ? tableConfig.table : GENERIC_TABLE;
            
            const itemIds = items.map((i: any) => i.id);
            const placeholdersIds = itemIds.map(() => '?').join(',');
            let existingMap = new Map();
            if (!force) {
                try {
                    const checkSql = tableConfig 
                        ? `SELECT id, version FROM ${tableName} WHERE id IN (${placeholdersIds})`
                        : `SELECT id, version FROM ${GENERIC_TABLE} WHERE collection = ? AND id IN (${placeholdersIds})`;
                    const checkArgs = tableConfig ? itemIds : [collection, ...itemIds];
                    const rs = await client.execute({ sql: checkSql, args: checkArgs });
                    rs.rows.forEach((r: any) => existingMap.set(r.id, r.version));
                } catch (e) { }
            }

            // CRITICAL FIX: PRESERVE EXISTING PASSWORDS IF NOT PROVIDED
            // 1. Preserve existing password if client sends null/empty.
            // 2. Encrypt (Hash) password if client sends plain text.
            if (collection === 'eduadmin_users') {
                const idsToUpdate = items.map((i: any) => i.id);
                
                if (idsToUpdate.length > 0) {
                    try {
                        const pPlaceholders = idsToUpdate.map(() => '?').join(',');
                        const passRes = await client.execute({
                            sql: `SELECT id, password FROM users WHERE id IN (${pPlaceholders})`,
                            args: idsToUpdate
                        });
                        
                        const dbPassMap = new Map();
                        passRes.rows.forEach((r: any) => dbPassMap.set(r.id, r.password));
                        
                        for (const item of items) {
                            if (item.deleted) continue;

                            // CASE A: Password Missing -> Use DB Version
                            if (!item.password) {
                                if (dbPassMap.has(item.id)) {
                                    item.password = dbPassMap.get(item.id);
                                }
                            } 
                            // CASE B: Password Provided -> Hash if Plain Text
                            else {
                                // If it doesn't look like a bcrypt hash ($2...)
                                if (!item.password.startsWith('$2')) {
                                    item.password = await bcrypt.hash(item.password, 10);
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Failed to process passwords:", e);
                    }
                }
            }

            const statements = [];
            for (const item of items) {
                const isDeleted = item.deleted === true || item.deleted === 1;
                if (isDeleted) {
                    if (tableConfig) {
                        statements.push({ sql: `DELETE FROM ${tableName} WHERE id = ?`, args: [item.id] });
                    } else {
                        statements.push({ sql: `DELETE FROM ${GENERIC_TABLE} WHERE collection = ? AND id = ?`, args: [collection, item.id] });
                    }
                    continue; 
                }
                if (!force) {
                    const existingVersion = existingMap.get(item.id) || 0;
                    if (existingVersion > (item.version || 1)) continue; 
                }
                if (tableConfig) {
                    const placeholders = tableConfig.columns.map(() => '?').join(', ');
                    const sql = `INSERT OR REPLACE INTO ${tableName} (${tableConfig.columns.join(', ')}) VALUES (${placeholders})`;
                    statements.push({ sql, args: tableConfig.mapFn(item) });
                } else {
                    const userId = item.userId || null;
                    const schoolNpsn = item.schoolNpsn || null;
                    const isDeletedGeneric = 0; 
                    statements.push({
                        sql: `INSERT OR REPLACE INTO ${GENERIC_TABLE} (collection, id, data, updated_at, version, user_id, school_npsn, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        args: [collection, item.id, JSON.stringify({...item, isSynced: true}), item.lastModified || Date.now(), item.version || 1, userId, schoolNpsn, isDeletedGeneric]
                    });
                }
            }
            if (statements.length > 0) await client.batch(statements);
            return res.status(200).json({ success: true, processed: statements.length });
        }

        if (action === 'pull') {
            const isGuru = currentUser?.role === 'GURU';
            const userId = currentUser?.userId || null; 
            if (isGuru && (collection === 'eduadmin_api_keys')) return res.status(200).json({ rows: [] });

            const tableConfig = getTableConfig(collection);
            let rows: any[] = [];

            if (tableConfig) {
                let query = `SELECT * FROM ${tableConfig.table} WHERE (deleted = 0 OR deleted IS NULL)`;
                let args: any[] = [];
                if (isGuru) {
                    const userRes = await client.execute({ sql: "SELECT school_npsn FROM users WHERE id = ?", args: [userId] });
                    const userNpsn = userRes.rows[0]?.school_npsn || null; 
                    if (tableConfig.table === 'users') { query += " AND id = ?"; args = [userId]; }
                    else if (tableConfig.table === 'classes') { if (userNpsn) { query += " AND school_npsn = ?"; args = [userNpsn]; } else { query += " AND user_id = ?"; args = [userId]; } }
                    else if (tableConfig.table === 'students') { if (userNpsn) { query += " AND school_npsn = ?"; args = [userNpsn]; } else { query += " AND class_id IN (SELECT id FROM classes WHERE user_id = ?)"; args = [userId]; } }
                    else if (tableConfig.table === 'scores' || tableConfig.table === 'journals' || tableConfig.table === 'schedules' || tableConfig.table === 'materials') { query += " AND user_id = ?"; args = [userId]; }
                    else if (['bk_violations', 'bk_reductions', 'bk_achievements', 'bk_counseling'].includes(tableConfig.table)) { if (userNpsn) { query += " AND student_id IN (SELECT id FROM students WHERE school_npsn = ?)"; args = [userNpsn]; } }
                    else if (tableConfig.table === 'attendance') { if (userNpsn) { query += " AND class_id IN (SELECT id FROM classes WHERE school_npsn = ?)"; args = [userNpsn]; } else { query += " AND class_id IN (SELECT id FROM classes WHERE user_id = ?)"; args = [userId]; } }
                    else if (tableConfig.table === 'wa_configs') { query += " AND user_id = ?"; args = [userId]; }
                    else if (tableConfig.table === 'tickets') { query += " AND user_id = ?"; args = [userId]; } // Ensure Guru only pulls own tickets
                }
                const result = await client.execute({ sql: query, args });
                rows = result.rows.map(row => ({
                    id: tableConfig.table === 'wa_configs' ? row.user_id : row.id,
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
                const result = await client.execute({ sql: query, args: args });
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
