import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@libsql/client/web";
import { authorize } from './_utils/auth.js';
import bcrypt from 'bcryptjs';
import { sendSMTP, sendMailerSend, sendBrevo } from './broadcast-email.js';

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
        teacher_type TEXT,
        phase TEXT,
        secondary_subject TEXT,
        is_supervisor INTEGER DEFAULT 0,
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
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nis_npsn ON students(school_npsn, nis)`,

    // 5. ACADEMIC: SCORES (NILAI)
    `CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        user_id TEXT, 
        student_id TEXT,
        class_id TEXT,
        school_npsn TEXT,
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
        school_npsn TEXT,
        date TEXT,
        status TEXT, -- H, S, I, A
        user_id TEXT,
        visibility TEXT DEFAULT 'SHARED',
        notes TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_att_class_date ON attendance(class_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_att_user ON attendance(user_id)`,

    // 7. ACADEMIC: JOURNALS
    `CREATE TABLE IF NOT EXISTS journals (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        class_id TEXT,
        school_npsn TEXT,
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
        school_npsn TEXT,
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
        school_npsn TEXT,
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
        headmaster_name TEXT,
        headmaster_nip TEXT,
        school_city TEXT,
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

    // 22. DONATIONS
    `CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        invoice_number TEXT,
        amount INTEGER,
        payment_method TEXT,
        status TEXT,
        payment_url TEXT,
        created_at TEXT,
        paid_at TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,

    // 23. DAILY TICKETS (PIKET HARIAN)
    `CREATE TABLE IF NOT EXISTS daily_pickets (
        id TEXT PRIMARY KEY,
        date TEXT,
        school_npsn TEXT,
        officers TEXT, -- JSON Array
        notes TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pickets_date_npsn ON daily_pickets(date, school_npsn)`,

    // 24. STUDENT INCIDENTS (KEJADIAN SISWA)
    `CREATE TABLE IF NOT EXISTS student_incidents (
        id TEXT PRIMARY KEY,
        picket_id TEXT,
        student_name TEXT,
        class_name TEXT,
        time TEXT,
        type TEXT,
        reason TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_incidents_picket ON student_incidents(picket_id)`,

    // 25. TEACHER CALENDAR
    `CREATE TABLE IF NOT EXISTS teacher_calendar (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        school_npsn TEXT,
        date TEXT,
        type TEXT,
        description TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON teacher_calendar(user_id, date)`,

    // 26. PASSWORD RESETS
    `CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        token TEXT,
        expiry TEXT,
        used BOOLEAN,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token)`,

    // 27. CLASS INVENTORY
    `CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        class_id TEXT,
        user_id TEXT,
        school_npsn TEXT,
        item_name TEXT,
        volume INTEGER,
        condition TEXT,
        notes TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_inventory_class ON inventory(class_id)`,

    // 28. HOME VISITS
    `CREATE TABLE IF NOT EXISTS home_visits (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        class_id TEXT,
        school_npsn TEXT,
        date TEXT,
        address TEXT,
        reason TEXT,
        result TEXT,
        follow_up TEXT,
        notes TEXT,
        user_id TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_home_visits_npsn ON home_visits(school_npsn)`,

    // 29. PARENT CALLS
    `CREATE TABLE IF NOT EXISTS parent_calls (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        class_id TEXT,
        school_npsn TEXT,
        date TEXT,
        parent_name TEXT,
        parent_phone TEXT,
        problem TEXT,
        solution TEXT,
        follow_up TEXT,
        notes TEXT,
        user_id TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_parent_calls_npsn ON parent_calls(school_npsn)`,

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
    // DOKU PAYMENT GATEWAY
    `ALTER TABLE system_settings ADD COLUMN doku_client_id TEXT`,
    `ALTER TABLE system_settings ADD COLUMN doku_secret_key TEXT`,
    `ALTER TABLE system_settings ADD COLUMN doku_is_production BOOLEAN`,
    // NEW COLUMNS FOR TEACHER TYPE
    `ALTER TABLE users ADD COLUMN teacher_type TEXT`,
    `ALTER TABLE users ADD COLUMN phase TEXT`,
    `ALTER TABLE users ADD COLUMN secondary_subject TEXT`,
    // ATTENDANCE VISIBILITY
    `ALTER TABLE attendance ADD COLUMN user_id TEXT`,
    `ALTER TABLE attendance ADD COLUMN visibility TEXT DEFAULT 'SHARED'`,
    `ALTER TABLE system_settings ADD COLUMN headmaster_name TEXT`,
    `ALTER TABLE system_settings ADD COLUMN headmaster_nip TEXT`,
    `ALTER TABLE system_settings ADD COLUMN school_city TEXT`,
    `ALTER TABLE users ADD COLUMN is_supervisor INTEGER DEFAULT 0`,
    // MULTI-TENANCY MIGRATIONS
    `ALTER TABLE attendance ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE journals ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE materials ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE schedules ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE scores ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE teacher_calendar ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE home_visits ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE parent_calls ADD COLUMN school_npsn TEXT`,
    `ALTER TABLE cbt_questions RENAME COLUMN "order" TO sort_order`,
    `CREATE TABLE IF NOT EXISTS supervision_assignments (
        id TEXT PRIMARY KEY,
        supervisor_id TEXT,
        teacher_id TEXT,
        school_npsn TEXT,
        status TEXT,
        scheduled_date TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS supervision_results (
        id TEXT PRIMARY KEY,
        assignment_id TEXT,
        supervisor_id TEXT,
        teacher_id TEXT,
        date TEXT,
        score REAL,
        notes TEXT,
        aspects TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS home_visits (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        class_id TEXT,
        school_npsn TEXT,
        date TEXT,
        address TEXT,
        reason TEXT,
        result TEXT,
        follow_up TEXT,
        notes TEXT,
        user_id TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_home_visits_npsn ON home_visits(school_npsn)`,
    `CREATE TABLE IF NOT EXISTS parent_calls (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        class_id TEXT,
        school_npsn TEXT,
        date TEXT,
        parent_name TEXT,
        parent_phone TEXT,
        problem TEXT,
        solution TEXT,
        follow_up TEXT,
        notes TEXT,
        user_id TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_parent_calls_npsn ON parent_calls(school_npsn)`,
    // 30. LEARNING STYLE ASSESSMENTS
    `CREATE TABLE IF NOT EXISTS learning_style_assessments (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        student_name TEXT,
        teacher_id TEXT,
        class_id TEXT,
        visual_score INTEGER,
        auditory_score INTEGER,
        kinesthetic_score INTEGER,
        dominant_style TEXT,
        assessment_date TEXT,
        method TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lsa_class ON learning_style_assessments(class_id)`,
    
    // 31. CBT EXAMS
    `CREATE TABLE IF NOT EXISTS cbt_exams (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        school_npsn TEXT,
        title TEXT,
        subject TEXT,
        level TEXT,
        duration_minutes INTEGER,
        start_time TEXT,
        end_time TEXT,
        status TEXT,
        token TEXT,
        randomize_questions INTEGER DEFAULT 0,
        randomize_options INTEGER DEFAULT 0,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cbt_exams_npsn ON cbt_exams(school_npsn)`,

    // 32. CBT QUESTIONS
    `CREATE TABLE IF NOT EXISTS cbt_questions (
        id TEXT PRIMARY KEY,
        exam_id TEXT,
        question_text TEXT,
        type TEXT,
        options TEXT, -- JSON Object
        correct_answer TEXT,
        image_data TEXT, -- Base64
        sort_order INTEGER,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cbt_questions_exam ON cbt_questions(exam_id)`,

    // 33. CBT ATTEMPTS
    `CREATE TABLE IF NOT EXISTS cbt_attempts (
        id TEXT PRIMARY KEY,
        exam_id TEXT,
        student_id TEXT,
        student_name TEXT,
        school_npsn TEXT,
        start_time TEXT,
        end_time TEXT,
        score REAL,
        answers TEXT, -- JSON Object
        violation_count INTEGER DEFAULT 0,
        status TEXT,
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cbt_attempts_exam ON cbt_attempts(exam_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cbt_attempts_student ON cbt_attempts(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cbt_attempts_npsn ON cbt_attempts(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_journals_npsn ON journals(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_schedules_npsn ON schedules(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_materials_npsn ON materials(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_npsn ON attendance(school_npsn)`,
    `CREATE INDEX IF NOT EXISTS idx_scores_npsn ON scores(school_npsn)`
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
        columns: ['id', 'username', 'password', 'full_name', 'role', 'status', 'school_name', 'school_npsn', 'nip', 'email', 'phone', 'subject', 'secondary_subject', 'is_supervisor', 'avatar', 'additional_role', 'homeroom_class_id', 'homeroom_class_name', 'rpp_usage_count', 'rpp_last_reset', 'teacher_type', 'phase', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.username), s(item.password), s(item.fullName), s(item.role), s(item.status), s(item.schoolName), s(item.schoolNpsn), s(item.nip), s(item.email), s(item.phone), s(item.subject), s(item.secondarySubject), item.isSupervisor ? 1 : 0, s(item.avatar), s(item.additionalRole), s(item.homeroomClassId), s(item.homeroomClassName), item.rppUsageCount || 0, s(item.rppLastReset), s(item.teacherType), s(item.phase), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_classes': return { table: 'classes', columns: ['id', 'user_id', 'school_npsn', 'name', 'description', 'student_count', 'homeroom_teacher_id', 'homeroom_teacher_name', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.schoolNpsn || 'DEFAULT'), s(item.name), s(item.description), s(item.studentCount), s(item.homeroomTeacherId), s(item.homeroomTeacherName), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_students': return { table: 'students', columns: ['id', 'class_id', 'school_npsn', 'name', 'nis', 'gender', 'phone', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.classId), s(item.schoolNpsn || 'DEFAULT'), s(item.name), s(item.nis), s(item.gender), s(item.phone || ''), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_scores': return { table: 'scores', columns: ['id', 'user_id', 'student_id', 'class_id', 'school_npsn', 'semester', 'subject', 'category', 'material_id', 'score', 'score_details', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId || 'UNKNOWN'), s(item.studentId), s(item.classId), s(item.schoolNpsn), s(item.semester), s(item.subject), s(item.category), s(item.materialId), s(item.score), JSON.stringify(item.scoreDetails || {}), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_attendance': return { table: 'attendance', columns: ['id', 'student_id', 'class_id', 'school_npsn', 'date', 'status', 'user_id', 'visibility', 'notes', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.classId), s(item.schoolNpsn), s(item.date), s(item.status), s(item.userId), s(item.visibility || 'SHARED'), s(item.notes), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_journals': return { table: 'journals', columns: ['id', 'user_id', 'class_id', 'school_npsn', 'date', 'material_id', 'learning_objective', 'meeting_no', 'activities', 'reflection', 'follow_up', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.classId), s(item.schoolNpsn), s(item.date), s(item.materialId), s(item.learningObjective), s(item.meetingNo), s(item.activities), s(item.reflection), s(item.followUp), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_materials': return { table: 'materials', columns: ['id', 'class_id', 'user_id', 'school_npsn', 'subject', 'semester', 'code', 'phase', 'content', 'sub_scopes', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.classId), s(item.userId), s(item.schoolNpsn), s(item.subject), s(item.semester), s(item.code), s(item.phase), s(item.content), JSON.stringify(item.subScopes || []), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_schedules': return { table: 'schedules', columns: ['id', 'user_id', 'school_npsn', 'day', 'time_start', 'time_end', 'class_name', 'subject', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.schoolNpsn), s(item.day), s(item.timeStart), s(item.timeEnd), s(item.className), s(item.subject), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_violations': return { table: 'bk_violations', columns: ['id', 'student_id', 'date', 'violation_name', 'points', 'description', 'reported_by', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.violationName), s(item.points), s(item.description), s(item.reportedBy), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_reductions': return { table: 'bk_reductions', columns: ['id', 'student_id', 'date', 'activity_name', 'points_removed', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.activityName), s(item.pointsRemoved), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_achievements': return { table: 'bk_achievements', columns: ['id', 'student_id', 'date', 'title', 'level', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.title), s(item.level), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_bk_counseling': return { table: 'bk_counseling', columns: ['id', 'student_id', 'date', 'issue', 'notes', 'follow_up', 'status', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.date), s(item.issue), s(item.notes), s(item.follow_up), s(item.status), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_tickets': return { table: 'tickets', columns: ['id', 'user_id', 'teacher_name', 'subject', 'status', 'last_updated', 'messages', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.teacherName), s(item.subject), s(item.status), s(item.lastUpdated), JSON.stringify(item.messages || []), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_api_keys': return { table: 'api_keys', columns: ['id', 'key_value', 'provider', 'status', 'added_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.key), s(item.provider), s(item.status), s(item.addedAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_system_settings': return { table: 'system_settings', columns: ['id', 'feature_rpp_enabled', 'maintenance_message', 'app_name', 'school_name', 'app_description', 'app_keywords', 'logo_url', 'favicon_url', 'timezone', 'footer_text', 'ai_provider', 'ai_base_url', 'ai_api_key', 'ai_model', 'rpp_monthly_limit', 'doku_client_id', 'doku_secret_key', 'doku_is_production', 'headmaster_name', 'headmaster_nip', 'school_city', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), item.featureRppEnabled ? 1 : 0, s(item.maintenanceMessage), s(item.appName), s(item.schoolName), s(item.appDescription), s(item.appKeywords), s(item.logoUrl), s(item.faviconUrl), s(item.timezone), s(item.footerText), s(item.aiProvider), s(item.aiBaseUrl), s(item.aiApiKey), s(item.aiModel), item.rppMonthlyLimit || 0, s(item.dokuClientId), s(item.dokuSecretKey), item.dokuIsProduction ? 1 : 0, s(item.headmasterName), s(item.headmasterNip), s(item.schoolCity), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_wa_configs': return { table: 'wa_configs', columns: ['user_id', 'provider', 'base_url', 'api_key', 'device_id', 'is_active', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.userId), s(item.provider), s(item.baseUrl), s(item.apiKey), s(item.deviceId), item.isActive ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_notifications': return { table: 'notifications', columns: ['id', 'title', 'message', 'type', 'target_role', 'is_read', 'is_popup', 'created_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.title), s(item.message), s(item.type), s(item.targetRole), item.isRead ? 1 : 0, item.isPopup ? 1 : 0, s(item.createdAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_logs': return { table: 'logs', columns: ['id', 'timestamp', 'level', 'actor', 'role', 'action', 'details', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.timestamp), s(item.level), s(item.actor), s(item.role), s(item.action), s(item.details), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_master_subjects': return { table: 'master_subjects', columns: ['id', 'name', 'category', 'level', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.name), s(item.category), s(item.level), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_email_config': return { table: 'email_config', columns: ['id', 'provider', 'method', 'api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'from_email', 'from_name', 'is_active', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.provider), s(item.method), s(item.apiKey), s(item.smtpHost), s(item.smtpPort), s(item.smtpUser), s(item.smtpPass), s(item.fromEmail), s(item.fromName), item.isActive ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_donations': return { table: 'donations', columns: ['id', 'user_id', 'invoice_number', 'amount', 'payment_method', 'status', 'payment_url', 'created_at', 'paid_at', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.invoiceNumber), s(item.amount), s(item.paymentMethod), s(item.status), s(item.paymentUrl), s(item.createdAt), s(item.paidAt), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_pickets': return { table: 'daily_pickets', columns: ['id', 'date', 'school_npsn', 'officers', 'notes', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.date), s(item.schoolNpsn), JSON.stringify(item.officers || []), s(item.notes), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_incidents': return { table: 'student_incidents', columns: ['id', 'picket_id', 'student_name', 'class_name', 'time', 'type', 'reason', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.picketId), s(item.studentName), s(item.className), s(item.time), s(item.type), s(item.reason), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_teacher_calendar': return { table: 'teacher_calendar', columns: ['id', 'user_id', 'school_npsn', 'date', 'type', 'description', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.schoolNpsn), s(item.date), s(item.type), s(item.description), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_password_resets': return { table: 'password_resets', columns: ['id', 'user_id', 'token', 'expiry', 'used', 'last_modified', 'version', 'deleted'], mapFn: (item: any) => [s(item.id), s(item.userId), s(item.token), s(item.expiry), item.used ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] };
    case 'eduadmin_inventory': return { 
        table: 'inventory', 
        columns: ['id', 'class_id', 'user_id', 'school_npsn', 'item_name', 'volume', 'condition', 'notes', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.classId), s(item.userId), s(item.schoolNpsn), s(item.itemName), s(item.volume), s(item.condition), s(item.notes), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_home_visits': return { 
        table: 'home_visits', 
        columns: ['id', 'student_id', 'class_id', 'school_npsn', 'date', 'address', 'reason', 'result', 'follow_up', 'notes', 'user_id', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.classId), s(item.schoolNpsn), s(item.date), s(item.address), s(item.reason), s(item.result), s(item.followUp), s(item.notes), s(item.userId), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_parent_calls': return { 
        table: 'parent_calls', 
        columns: ['id', 'student_id', 'class_id', 'school_npsn', 'date', 'parent_name', 'parent_phone', 'problem', 'solution', 'follow_up', 'notes', 'user_id', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.classId), s(item.schoolNpsn), s(item.date), s(item.parentName), s(item.parentPhone), s(item.problem), s(item.solution), s(item.followUp), s(item.notes), s(item.userId), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_learning_style_assessments': return { 
        table: 'learning_style_assessments', 
        columns: ['id', 'student_id', 'student_name', 'teacher_id', 'class_id', 'visual_score', 'auditory_score', 'kinesthetic_score', 'dominant_style', 'assessment_date', 'method', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.studentId), s(item.studentName), s(item.teacherId), s(item.classId), s(item.visualScore), s(item.auditoryScore), s(item.kinestheticScore), s(item.dominantStyle), s(item.assessmentDate), s(item.method), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_supervision_assignments': return { 
        table: 'supervision_assignments', 
        columns: ['id', 'supervisor_id', 'teacher_id', 'school_npsn', 'status', 'scheduled_date', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.supervisorId), s(item.teacherId), s(item.schoolNpsn), s(item.status), s(item.scheduledDate), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_supervision_results': return { 
        table: 'supervision_results', 
        columns: ['id', 'assignment_id', 'supervisor_id', 'teacher_id', 'date', 'score', 'notes', 'aspects', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.assignmentId), s(item.supervisorId), s(item.teacherId), s(item.date), s(item.score), s(item.notes), JSON.stringify(item.aspects || []), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_cbt_exams': return { 
        table: 'cbt_exams', 
        columns: ['id', 'user_id', 'school_npsn', 'title', 'subject', 'level', 'duration_minutes', 'start_time', 'end_time', 'status', 'token', 'randomize_questions', 'randomize_options', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.userId), s(item.schoolNpsn), s(item.title), s(item.subject), s(item.level), s(item.durationMinutes), s(item.startTime), s(item.endTime), s(item.status), s(item.token), item.randomizeQuestions ? 1 : 0, item.randomizeOptions ? 1 : 0, s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_cbt_questions': return { 
        table: 'cbt_questions', 
        columns: ['id', 'exam_id', 'question_text', 'type', 'options', 'correct_answer', 'image_data', 'sort_order', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.examId), s(item.questionText), s(item.type), JSON.stringify(item.options || {}), s(item.correctAnswer), s(item.imageData), s(item.sortOrder), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    case 'eduadmin_cbt_attempts': return { 
        table: 'cbt_attempts', 
        columns: ['id', 'exam_id', 'student_id', 'student_name', 'school_npsn', 'start_time', 'end_time', 'score', 'answers', 'violation_count', 'status', 'last_modified', 'version', 'deleted'], 
        mapFn: (item: any) => [s(item.id), s(item.examId), s(item.studentId), s(item.studentName), s(item.schoolNpsn), s(item.startTime), s(item.endTime), s(item.score), JSON.stringify(item.answers || {}), item.violationCount || 0, s(item.status), s(item.lastModified), item.version || 1, item.deleted ? 1 : 0] 
    };
    default:
      return null;
  }
};

// --- ROW MAPPER (DB -> JSON) ---
// Used when PULLING data from Turso to Frontend
const mapRowToJSON = (collection: string, row: any) => {
  switch (collection) {
    case 'eduadmin_users': return {
        id: row.id,
        username: row.username,
        password: row.password, // Keep hashed pass for preservation
        fullName: row.full_name,
        role: row.role,
        status: row.status,
        schoolName: row.school_name,
        schoolNpsn: row.school_npsn,
        nip: row.nip,
        email: row.email,
        phone: row.phone,
        subject: row.subject,
        secondarySubject: row.secondary_subject,
        avatar: row.avatar,
        additionalRole: row.additional_role,
        homeroomClassId: row.homeroom_class_id,
        homeroomClassName: row.homeroom_class_name,
        rppUsageCount: row.rpp_usage_count,
        rppLastReset: row.rpp_last_reset,
        teacherType: row.teacher_type,
        phase: row.phase,
        isSupervisor: Boolean(row.is_supervisor),
        lastModified: row.last_modified,
        version: row.version,
        deleted: Boolean(row.deleted)
    };
    case 'eduadmin_classes': return {
        id: row.id, userId: row.user_id, schoolNpsn: row.school_npsn, name: row.name,
        description: row.description, studentCount: row.student_count,
        homeroomTeacherId: row.homeroom_teacher_id, homeroomTeacherName: row.homeroom_teacher_name,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_students': return {
        id: row.id, classId: row.class_id, schoolNpsn: row.school_npsn, name: row.name,
        nis: row.nis, gender: row.gender, phone: row.phone,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_scores': return {
        id: row.id, userId: row.user_id, studentId: row.student_id, classId: row.class_id,
        semester: row.semester, subject: row.subject, category: row.category,
        materialId: row.material_id, score: row.score, scoreDetails: parseJSONSafe(row.score_details),
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_attendance': return {
        id: row.id, studentId: row.student_id, classId: row.class_id, date: row.date,
        status: row.status, userId: row.user_id, visibility: row.visibility, notes: row.notes,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_journals': return {
        id: row.id, userId: row.user_id, classId: row.class_id, date: row.date,
        materialId: row.material_id, learningObjective: row.learning_objective,
        meetingNo: row.meeting_no, activities: row.activities, reflection: row.reflection,
        followUp: row.follow_up, lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_materials': return {
        id: row.id, classId: row.class_id, userId: row.user_id, subject: row.subject,
        semester: row.semester, code: row.code, phase: row.phase, content: row.content,
        subScopes: parseJSONSafe(row.sub_scopes), lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_schedules': return {
        id: row.id, userId: row.user_id, day: row.day, timeStart: row.time_start,
        timeEnd: row.time_end, className: row.class_name, subject: row.subject,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_bk_violations': return {
        id: row.id, studentId: row.student_id, date: row.date, violationName: row.violation_name,
        points: row.points, description: row.description, reportedBy: row.reported_by,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_bk_reductions': return {
        id: row.id, studentId: row.student_id, date: row.date, activityName: row.activity_name,
        pointsRemoved: row.points_removed, description: row.description,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_bk_achievements': return {
        id: row.id, studentId: row.student_id, date: row.date, title: row.title,
        level: row.level, description: row.description,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_bk_counseling': return {
        id: row.id, studentId: row.student_id, date: row.date, issue: row.issue,
        notes: row.notes, followUp: row.follow_up, status: row.status,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_tickets': return {
        id: row.id, userId: row.user_id, teacherName: row.teacher_name, subject: row.subject,
        status: row.status, lastUpdated: row.last_updated, messages: parseJSONSafe(row.messages),
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_api_keys': return {
        id: row.id, key: row.key_value, provider: row.provider, status: row.status,
        addedAt: row.added_at, lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_system_settings': return {
        id: row.id, featureRppEnabled: Boolean(row.feature_rpp_enabled),
        maintenanceMessage: row.maintenance_message, appName: row.app_name,
        schoolName: row.school_name, appDescription: row.app_description,
        appKeywords: row.app_keywords, logoUrl: row.logo_url, faviconUrl: row.favicon_url,
        timezone: row.timezone, footerText: row.footer_text,
        aiProvider: row.ai_provider, aiBaseUrl: row.ai_base_url, aiApiKey: row.ai_api_key, aiModel: row.ai_model,
        rppMonthlyLimit: row.rpp_monthly_limit,
        dokuClientId: row.doku_client_id, dokuSecretKey: row.doku_secret_key, dokuIsProduction: Boolean(row.doku_is_production),
        headmasterName: row.headmaster_name, headmasterNip: row.headmaster_nip, schoolCity: row.school_city,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_wa_configs': return {
        userId: row.user_id, provider: row.provider, baseUrl: row.base_url,
        apiKey: row.api_key, deviceId: row.device_id, isActive: Boolean(row.is_active),
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_notifications': return {
        id: row.id, title: row.title, message: row.message, type: row.type,
        targetRole: row.target_role, isRead: Boolean(row.is_read), isPopup: Boolean(row.is_popup),
        createdAt: row.created_at, lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_logs': return {
        id: row.id, timestamp: row.timestamp, level: row.level, actor: row.actor,
        role: row.role, action: row.action, details: row.details,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_master_subjects': return {
        id: row.id, name: row.name, category: row.category, level: row.level,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_email_config': return {
        id: row.id, provider: row.provider, method: row.method, apiKey: row.api_key,
        smtpHost: row.smtp_host, smtpPort: row.smtp_port, smtpUser: row.smtp_user,
        smtpPass: row.smtp_pass, fromEmail: row.from_email, fromName: row.from_name,
        isActive: Boolean(row.is_active), lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_donations': return {
        id: row.id, userId: row.user_id, invoiceNumber: row.invoice_number, amount: row.amount,
        paymentMethod: row.payment_method, status: row.status, paymentUrl: row.payment_url,
        createdAt: row.created_at, paidAt: row.paid_at,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_pickets': return {
        id: row.id, date: row.date, schoolNpsn: row.school_npsn,
        officers: parseJSONSafe(row.officers), notes: row.notes,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_incidents': return {
        id: row.id, picketId: row.picket_id, studentName: row.student_name,
        className: row.class_name, time: row.time, type: row.type, reason: row.reason,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_teacher_calendar': return {
        id: row.id, userId: row.user_id, date: row.date, type: row.type, description: row.description,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_password_resets': return {
        id: row.id, userId: row.user_id, token: row.token, expiry: row.expiry, used: Boolean(row.used),
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_inventory': return {
        id: row.id, classId: row.class_id, userId: row.user_id, schoolNpsn: row.school_npsn,
        itemName: row.item_name, volume: row.volume, condition: row.condition, notes: row.notes,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_home_visits': return {
        id: row.id, studentId: row.student_id, classId: row.class_id, schoolNpsn: row.school_npsn,
        date: row.date, address: row.address, reason: row.reason, result: row.result,
        followUp: row.follow_up, notes: row.notes, userId: row.user_id,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_parent_calls': return {
        id: row.id, studentId: row.student_id, classId: row.class_id, schoolNpsn: row.school_npsn,
        date: row.date, parentName: row.parent_name, parentPhone: row.parent_phone,
        problem: row.problem, solution: row.solution, followUp: row.follow_up,
        notes: row.notes, userId: row.user_id,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_learning_style_assessments': return {
        id: row.id, studentId: row.student_id, studentName: row.student_name,
        teacherId: row.teacher_id, classId: row.class_id,
        visualScore: row.visual_score, auditoryScore: row.auditory_score,
        kinestheticScore: row.kinesthetic_score, dominantStyle: row.dominant_style,
        assessmentDate: row.assessment_date, method: row.method,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_supervision_assignments': return {
        id: row.id, supervisorId: row.supervisor_id, teacherId: row.teacher_id,
        schoolNpsn: row.school_npsn, status: row.status, scheduledDate: row.scheduled_date,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_supervision_results': return {
        id: row.id, assignmentId: row.assignment_id, supervisorId: row.supervisor_id,
        teacherId: row.teacher_id, date: row.date, score: row.score, notes: row.notes,
        aspects: parseJSONSafe(row.aspects),
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_cbt_exams': return {
        id: row.id, userId: row.user_id, schoolNpsn: row.school_npsn, title: row.title,
        subject: row.subject, level: row.level, durationMinutes: row.duration_minutes, startTime: row.start_time,
        endTime: row.end_time, status: row.status, token: row.token,
        randomizeQuestions: Boolean(row.randomize_questions), randomizeOptions: Boolean(row.randomize_options),
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_cbt_questions': return {
        id: row.id, examId: row.exam_id, questionText: row.question_text, type: row.type,
        options: parseJSONSafe(row.options), correctAnswer: row.correct_answer,
        imageData: row.image_data, sortOrder: row.sort_order,
        lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    case 'eduadmin_cbt_attempts': return {
        id: row.id, examId: row.exam_id, studentId: row.student_id, studentName: row.student_name,
        schoolNpsn: row.school_npsn, startTime: row.start_time, endTime: row.end_time,
        score: row.score, answers: parseJSONSafe(row.answers), violationCount: row.violation_count,
        status: row.status, lastModified: row.last_modified, version: row.version, deleted: Boolean(row.deleted)
    };
    default:
        return row; 
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

    console.log(`[DEBUG] Connection Init - URL: ${rawUrl ? rawUrl.substring(0, 15) + '...' : 'MISSING'}, Token: ${authToken ? 'PRESENT' : 'MISSING'}`);

    if (!rawUrl || !authToken) {
        return res.status(503).json({ error: "Database configuration missing." });
    }

    // Auto-fix URL scheme
    if (rawUrl && !rawUrl.includes('://')) {
        // Check if it looks like a hostname only (e.g. "admin") which causes ENOTFOUND
        if (!rawUrl.includes('.')) {
             console.error(`[CRITICAL] Invalid DB URL detected: "${rawUrl}". It looks like a simple string, not a URL.`);
             return res.status(500).json({ error: `Invalid Database URL configuration: "${rawUrl}". Please check TURSO_DB_URL env var.` });
        }
        rawUrl = 'https://' + rawUrl;
    } else if (rawUrl.startsWith('libsql://')) {
        rawUrl = rawUrl.replace('libsql://', 'https://');
    }

    let currentUser;
    // Allow public access for password reset flow and student assessments
    const publicActions = ['init', 'check', 'request_password_reset', 'verify_reset_token', 'complete_password_reset', 'get_public_assessment_data', 'submit_public_assessment', 'verify_student'];
    
    if (!publicActions.includes(action)) {
        try {
            currentUser = await authorize(req, ['ADMIN', 'GURU', 'SISWA']);
        } catch (err: any) {
             const isUserPush = action === 'push' && collection === 'eduadmin_users';
             const isAuthError = err.status === 401 || (err.message && err.message.includes('User not found'));
             
             // CRITICAL FIX: Allow "Self-Rescue" for Admin Pushes even if Auth fails
             // This allows re-inserting the Admin user if the DB was wiped.
             if (isUserPush && isAuthError) {
                 console.log("Allowing unauthenticated push for user restoration");
                 // Continue execution...
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

    // --- PUBLIC ASSESSMENT DATA ---
    if (action === 'get_public_assessment_data') {
        const { classId } = body;
        if (!classId) return res.status(400).json({ error: 'Class ID is required' });

        try {
            // 1. Get Class Info
            const classResult = await client.execute({
                sql: "SELECT name, school_npsn, homeroom_teacher_id FROM classes WHERE id = ? AND deleted = 0",
                args: [classId]
            });

            if (classResult.rows.length === 0) {
                return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
            }

            const classInfo = classResult.rows[0];

            // 2. Get Students
            const studentsResult = await client.execute({
                sql: "SELECT id, name, nis FROM students WHERE class_id = ? AND deleted = 0",
                args: [classId]
            });

            return res.status(200).json({
                class: {
                    name: classInfo.name,
                    schoolNpsn: classInfo.school_npsn,
                    homeroomTeacherId: classInfo.homeroom_teacher_id
                },
                students: studentsResult.rows
            });

        } catch (e: any) {
            console.error("Public Assessment Data Error:", e);
            return res.status(500).json({ error: "Gagal memuat data asesmen." });
        }
    }

    // --- PUBLIC ASSESSMENT SUBMISSION ---
    if (action === 'submit_public_assessment') {
        const { assessment } = body;
        if (!assessment) return res.status(400).json({ error: 'Assessment data is required' });

        try {
            const tableConfig = getTableConfig('eduadmin_learning_style_assessments');
            if (!tableConfig) return res.status(400).json({ error: 'Invalid collection' });

            const placeholders = tableConfig.columns.map(() => '?').join(', ');
            const sql = `INSERT OR REPLACE INTO learning_style_assessments (${tableConfig.columns.join(', ')}) VALUES (${placeholders})`;
            
            await client.execute({
                sql,
                args: tableConfig.mapFn({
                    ...assessment,
                    lastModified: Date.now(),
                    version: 1,
                    deleted: 0
                })
            });

            return res.status(200).json({ success: true });

        } catch (e: any) {
            console.error("Public Assessment Submission Error:", e);
            return res.status(500).json({ error: "Gagal mengirim hasil asesmen." });
        }
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

    // --- PASSWORD RESET ACTIONS ---
    if (action === 'request_password_reset') {
        const { email, origin } = body; // Expect origin from client
        if (!email) return res.status(400).json({ error: 'Email is required' });

        try {
            // 1. Find User (Case Insensitive)
            const userResult = await client.execute({
                sql: "SELECT id, email, full_name FROM users WHERE lower(email) = lower(?) AND deleted = 0",
                args: [email]
            });

            if (userResult.rows.length === 0) {
                // Return generic success to prevent enumeration, or specific error if desired.
                // For this app, specific error is better for UX.
                return res.status(404).json({ error: 'Email tidak ditemukan.' });
            }

            const user = userResult.rows[0];

            // 2. Get Email Config
            const configResult = await client.execute("SELECT * FROM email_config WHERE is_active = 1 AND deleted = 0 LIMIT 1");
            if (configResult.rows.length === 0) {
                return res.status(500).json({ error: 'Sistem email belum dikonfigurasi oleh Admin.' });
            }
            
            // Map config row to object (snake_case to camelCase for helpers)
            const row = configResult.rows[0];
            const config = {
                provider: row.provider,
                method: row.method,
                apiKey: row.api_key,
                smtpHost: row.smtp_host,
                smtpPort: row.smtp_port,
                smtpUser: row.smtp_user,
                smtpPass: row.smtp_pass,
                fromEmail: row.from_email,
                fromName: row.from_name
            };

            const token = crypto.randomUUID();
            const expiry = Date.now() + 3600000; // 1 hour

            // 3. Insert Token
            await client.execute({
                sql: "INSERT INTO password_resets (id, user_id, token, expiry, used, last_modified, version, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                args: [crypto.randomUUID(), user.id, token, expiry, 0, Date.now(), 1, 0]
            });

            // 4. Send Email
            // Use origin if provided, otherwise try to infer from referer, or fallback to a safe default
            let baseUrl = origin;
            if (!baseUrl) {
                const referer = req.headers.referer;
                if (referer) {
                    try {
                        const url = new URL(referer);
                        baseUrl = url.origin;
                    } catch (e) {
                        // ignore invalid referer
                    }
                }
            }
            if (!baseUrl) {
                 baseUrl = 'https://eduadmin-pro.vercel.app'; // Ultimate fallback
            }

            const resetLink = `${baseUrl}/#/reset-password?token=${token}`;
            const expiryTime = new Date(expiry).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

            const subject = `Permintaan Reset Password - EduAdmin Pro`;
            const html = `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <h2>Reset Password</h2>
                  <p>Halo ${user.full_name},</p>
                  <p>Kami menerima permintaan untuk mereset password akun Anda.</p>
                  <p>Silakan klik tombol di bawah ini untuk membuat password baru:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                  </div>
                  <p>Link ini akan kedaluwarsa pada: ${expiryTime}</p>
                  <p style="font-size: 12px; color: #666;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #888;">
                      Email ini dikirim melalui sistem EduAdmin Pro.<br/>
                      ${config.fromName}
                  </p>
              </div>
            `;

            if (config.method === 'API') {
                if (config.provider === 'MAILERSEND') {
                    await sendMailerSend(config, user.email as string, subject, html);
                } else if (config.provider === 'BREVO') {
                    await sendBrevo(config, user.email as string, subject, html);
                }
            } else {
                await sendSMTP(config, user.email as string, subject, html);
            }

            return res.status(200).json({ success: true, message: 'Email reset password telah dikirim.' });

        } catch (e: any) {
            console.error("Reset Request Error:", e);
            return res.status(500).json({ error: "Gagal memproses permintaan reset password: " + e.message });
        }
    }

    if (action === 'verify_reset_token') {
        const { token } = body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        try {
            const result = await client.execute({
                sql: "SELECT * FROM password_resets WHERE token = ? AND deleted = 0",
                args: [token]
            });

            if (result.rows.length === 0) {
                return res.status(404).json({ valid: false, message: 'Token tidak ditemukan.' });
            }

            const resetItem = result.rows[0];
            
            if (resetItem.used) {
                return res.status(400).json({ valid: false, message: 'Token sudah digunakan.' });
            }

            if (Number(resetItem.expiry) < Date.now()) {
                return res.status(400).json({ valid: false, message: 'Token sudah kadaluarsa.' });
            }

            return res.status(200).json({ valid: true });

        } catch (e: any) {
            return res.status(500).json({ error: "Gagal memverifikasi token." });
        }
    }

    if (action === 'complete_password_reset') {
        const { token, newPassword } = body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

        try {
            // 1. Verify Token again
            const tokenResult = await client.execute({
                sql: "SELECT * FROM password_resets WHERE token = ? AND deleted = 0",
                args: [token]
            });

            if (tokenResult.rows.length === 0) return res.status(404).json({ error: 'Token tidak ditemukan.' });
            const resetItem = tokenResult.rows[0];
            if (resetItem.used) return res.status(400).json({ error: 'Token sudah digunakan.' });
            if (Number(resetItem.expiry) < Date.now()) return res.status(400).json({ error: 'Token sudah kadaluarsa.' });

            // 2. Hash Password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // 3. Update User Password
            await client.execute({
                sql: "UPDATE users SET password = ?, last_modified = ?, version = version + 1 WHERE id = ?",
                args: [hashedPassword, Date.now(), resetItem.user_id]
            });

            // 4. Mark Token Used
            await client.execute({
                sql: "UPDATE password_resets SET used = 1, last_modified = ?, version = version + 1 WHERE id = ?",
                args: [Date.now(), resetItem.id]
            });

            return res.status(200).json({ success: true, message: 'Password berhasil diubah.' });

        } catch (e: any) {
            console.error("Complete Reset Error:", e);
            return res.status(500).json({ error: "Gagal mengubah password." });
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

    // --- DELETE LOGIC ---
    if (action === 'delete') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'ID is required for delete' });

        const tableConfig = getTableConfig(collection);
        if (!tableConfig) return res.status(400).json({ error: 'Invalid collection' });

        try {
            await client.execute({
                sql: `DELETE FROM ${tableConfig.table} WHERE id = ?`,
                args: [id]
            });
            return res.status(200).json({ success: true, message: 'Deleted permanently' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // --- CLEAR TABLE LOGIC (TRUNCATE) ---
    if (action === 'clear') {
        const tableConfig = getTableConfig(collection);
        if (!tableConfig) return res.status(400).json({ error: 'Invalid collection' });

        // Safety Guard: Only allow clearing specific tables
        const ALLOWED_CLEAR_TABLES = ['logs', 'notifications'];
        if (!ALLOWED_CLEAR_TABLES.includes(tableConfig.table)) {
             return res.status(403).json({ error: 'Operation not allowed for this table' });
        }

        try {
            await client.execute(`DELETE FROM ${tableConfig.table}`);
            return res.status(200).json({ success: true, message: `Table ${tableConfig.table} cleared.` });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // --- STUDENT VERIFICATION LOGIC (LOGIN WITHOUT ACCOUNT) ---
    if (action === 'verify_student') {
        const { npsn, nis } = body;
        if (!npsn || !nis) return res.status(400).json({ error: 'NPSN dan NIS wajib diisi.' });

        try {
            const student = await client.execute({
                sql: "SELECT * FROM students WHERE school_npsn = ? AND nis = ? AND deleted = 0 LIMIT 1",
                args: [npsn, nis]
            });

            if (student.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Siswa tidak ditemukan atau belum terdaftar di database sekolah.' });
            }

            const row = student.rows[0];
            
            // Format to match the User type for virtual session
            return res.status(200).json({
                success: true,
                user: {
                    id: row.id, // Using student DB ID as temporary session ID
                    username: `siswa_${row.nis}`,
                    fullName: row.name,
                    role: 'SISWA',
                    status: 'ACTIVE',
                    schoolNpsn: row.school_npsn,
                    nis: row.nis,
                    gender: row.gender,
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name as string)}&background=random`
                }
            });
        } catch (e: any) {
            console.error("verify_student error:", e);
            return res.status(500).json({ error: e.message });
        }
    }

    // --- PUSH LOGIC ---
    if (action === 'push') {
        if (!items || items.length === 0) return res.status(200).json({ success: true });
        
        const tableConfig = getTableConfig(collection);
        const tableName = tableConfig ? tableConfig.table : GENERIC_TABLE;
        
        const statements = [];
        for (const item of items) {
            // SISWA SECURITY: Prevent students from pushing to restricted tables
            const SISWA_RESTRICTED_TABLES = ['users', 'classes', 'students', 'journals', 'schedules', 'materials', 'attendance'];
            if (currentUser?.role === 'SISWA' && SISWA_RESTRICTED_TABLES.includes(tableName)) {
                return res.status(403).json({ error: `Siswa tidak diizinkan untuk mengubah data di tabel ${tableName}` });
            }

            if (tableConfig) {
                // --- SELF HEALING: ADMIN ROLE SAFEGUARD ---
                if (collection === 'eduadmin_users' && item.role === 'ADMIN') {
                    // FORCE ACTIVE STATUS: Prevent admin from locking themselves out
                    item.status = 'ACTIVE';
                    
                    // FORCE PASSWORD FIX: Check if password is missing/empty
                    if (!item.password || item.password === '') {
                        try {
                            const existing = await client.execute({
                                sql: "SELECT password FROM users WHERE id = ?",
                                args: [item.id]
                            });
                            
                            // If row exists and has a password, use it
                            if (existing.rows.length > 0 && existing.rows[0].password) {
                                item.password = existing.rows[0].password;
                            } else {
                                // Fallback: Either row missing OR password is null in DB
                                // Since this is a rescue operation (and DB wiped), we set a default password
                                console.log(`[Auto-Heal] Resetting password for Admin ${item.username} (was missing/null)`);
                                item.password = await bcrypt.hash("admin", 10);
                            }
                        } catch (e) {
                            console.warn("Password preservation failed:", e);
                            // Emergency fallback
                            item.password = await bcrypt.hash("admin", 10);
                        }
                    }
                }
                // --- END SELF HEALING ---

                // --- START WAKASEK VALIDATION ---
                if (tableName === 'users' && item.additionalRole === 'WAKASEK_KURIKULUM') {
                    const existingWakasek = await client.execute({
                        sql: "SELECT id, full_name FROM users WHERE school_npsn = ? AND additional_role = 'WAKASEK_KURIKULUM' AND id != ?",
                        args: [item.schoolNpsn, item.id]
                    });
                    if (existingWakasek.rows.length > 0) {
                        return res.status(400).json({ 
                            error: `Jabatan Wakasek Kurikulum sudah diambil oleh ${existingWakasek.rows[0].full_name}.`,
                            code: 'WAKASEK_ALREADY_EXISTS'
                        });
                    }
                }
                // --- END WAKASEK VALIDATION ---

                // --- START HOMEROOM VALIDATION ---
                if (tableName === 'classes' && item.homeroomTeacherId) {
                    const existingHomeroom = await client.execute({
                        sql: "SELECT id, name, homeroom_teacher_name FROM classes WHERE id = ? AND homeroom_teacher_id IS NOT NULL AND homeroom_teacher_id != ?",
                        args: [item.id, item.homeroomTeacherId]
                    });
                    if (existingHomeroom.rows.length > 0) {
                        return res.status(400).json({ 
                            error: `Kelas ${existingHomeroom.rows[0].name} sudah memiliki Wali Kelas: ${existingHomeroom.rows[0].homeroom_teacher_name}.`,
                            code: 'HOMEROOM_ALREADY_EXISTS'
                        });
                    }
                }
                // --- END HOMEROOM VALIDATION ---

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
                    await client.execute(`ALTER TABLE users ADD COLUMN additional_role TEXT`).catch(() => {});
                    await client.execute(`ALTER TABLE users ADD COLUMN homeroom_class_id TEXT`).catch(() => {});
                    await client.execute(`ALTER TABLE users ADD COLUMN rpp_usage_count INTEGER DEFAULT 0`).catch(() => {});
                    await client.execute(`ALTER TABLE users ADD COLUMN rpp_last_reset TEXT`).catch(() => {});
                    await client.batch(statements);
                } else {
                    throw batchError;
                }
            }
        }
        return res.status(200).json({ success: true, processed: statements.length });
    }

    // --- PULL LOGIC ---
    if (action === 'pull') {
        const isStaff = currentUser?.role === 'GURU' || currentUser?.role === 'TENDIK';
        const userId = currentUser?.userId || null; 
        
        const tableConfig = getTableConfig(collection);
        let rows: any[] = [];

        if (tableConfig) {
            let query = `SELECT * FROM ${tableConfig.table}`;
            let whereClauses: string[] = [];
            let args: any[] = [];

            if (isStaff) {
                const userRes = await client.execute({ sql: "SELECT school_npsn, additional_role FROM users WHERE id = ?", args: [userId] });
                let userNpsn = userRes.rows[0]?.school_npsn || null; 
                const additionalRole = userRes.rows[0]?.additional_role || null;
                const isWakasek = additionalRole === 'WAKASEK_KURIKULUM';
                const isKepsek = additionalRole === 'KEPALA_SEKOLAH';
                
                // Fallback to NPSN from request if DB record is missing it
                if ((!userNpsn || userNpsn === 'DEFAULT') && req.body.schoolNpsn && req.body.schoolNpsn !== 'DEFAULT') {
                    userNpsn = req.body.schoolNpsn;
                    console.log(`[API] Using fallback NPSN ${userNpsn} from request for user ${userId}`);
                    
                    // Optional: Update the user record in DB to fix it for future requests
                    client.execute({ 
                        sql: "UPDATE users SET school_npsn = ?, last_modified = ? WHERE id = ?", 
                        args: [userNpsn, Date.now(), userId] 
                    }).catch(err => console.error("Failed to auto-fix user NPSN:", err));
                }

                if (!userNpsn) {
                    // Fallback: if user is Guru but NPSN is missing in Turso, 
                    // they might need to push their profile first.
                    console.warn(`[API] Guru ${userId} has no NPSN in Turso.`);
                }
                
                // Logic Filter for Staff (GURU/TENDIK)
                if (tableConfig.table === 'classes') {
                    // Show classes in same school OR created by user
                    if (userNpsn && userNpsn !== 'DEFAULT') { 
                        whereClauses.push("(school_npsn = ? OR user_id = ? OR user_id IN (SELECT id FROM users WHERE school_npsn = ?))"); 
                        args = [userNpsn, userId, userNpsn]; 
                    } 
                    else { whereClauses.push("user_id = ?"); args = [userId]; }
                }
                else if (tableConfig.table === 'users') { 
                    // All teachers in same school should see each other for picket/shared features
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("school_npsn = ?"); args = [userNpsn];
                    } else {
                        whereClauses.push("id = ?"); args = [userId]; 
                    }
                }
                else if (tableConfig.table === 'journals') {
                    // Wakasek & Kepsek see all journals in school
                    if ((isWakasek || isKepsek) && userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("user_id IN (SELECT id FROM users WHERE school_npsn = ?)"); args = [userNpsn];
                    } else {
                        whereClauses.push("user_id = ?"); args = [userId];
                    }
                }
                else if (tableConfig.table === 'attendance') {
                    // Wakasek & Kepsek see all attendance in school
                    if ((isWakasek || isKepsek) && userNpsn && userNpsn !== 'DEFAULT') {
                        // Scope to school
                        whereClauses.push("class_id IN (SELECT id FROM classes WHERE school_npsn = ?)"); args = [userNpsn];
                    } else {
                        whereClauses.push("user_id = ?"); args = [userId];
                    }
                }
                else if (['scores','materials','inventory','home_visits','parent_calls','teacher_calendar'].includes(tableConfig.table)) { 
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("(user_id = ? OR user_id IN (SELECT id FROM users WHERE school_npsn = ?))"); 
                        args = [userId, userNpsn];
                    } else {
                        whereClauses.push("user_id = ?"); args = [userId]; 
                    }
                }
                else if (tableConfig.table === 'schedules') {
                    // Schedules should be visible to everyone in the same school (so teachers see Wakasek's input)
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("school_npsn = ?"); 
                        args = [userNpsn];
                    } else {
                        whereClauses.push("user_id = ?"); args = [userId]; 
                    }
                }
                else if (['tickets','donations','password_resets','wa_configs'].includes(tableConfig.table)) {
                    whereClauses.push("user_id = ?"); args = [userId];
                }
                else if (tableConfig.table === 'learning_style_assessments') {
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("(teacher_id = ? OR teacher_id IN (SELECT id FROM users WHERE school_npsn = ?))"); 
                        args = [userId, userNpsn];
                    } else {
                        whereClauses.push("teacher_id = ?"); args = [userId]; 
                    }
                }
                else if (['bk_violations', 'bk_reductions', 'bk_achievements', 'bk_counseling'].includes(tableConfig.table)) {
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("student_id IN (SELECT id FROM students WHERE school_npsn = ?)");
                        args = [userNpsn];
                    }
                }
                else if (tableConfig.table === 'notifications') {
                    whereClauses.push("(target_role = ? OR target_role = 'ALL')");
                    args = [currentUser?.role || 'GURU'];
                }
                else if (tableConfig.table === 'students') { 
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        // Pull students where NPSN matches OR class belongs to school/teacher in school
                        whereClauses.push("(school_npsn = ? OR class_id IN (SELECT id FROM classes WHERE school_npsn = ? OR user_id = ? OR user_id IN (SELECT id FROM users WHERE school_npsn = ?)))"); 
                        args = [userNpsn, userNpsn, userId, userNpsn]; 
                    } else {
                        // If no NPSN, fallback to user's classes
                        whereClauses.push("class_id IN (SELECT id FROM classes WHERE user_id = ?)");
                        args = [userId];
                    }
                }
                else if (tableConfig.table === 'attendance') { 
                    // All teachers in same school should see attendance for picket/shared features
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("(user_id IN (SELECT id FROM users WHERE school_npsn = ?) OR class_id IN (SELECT id FROM classes WHERE school_npsn = ?))"); 
                        args = [userNpsn, userNpsn];
                    } else {
                        whereClauses.push("user_id = ?"); args = [userId];
                    }
                }
                else if (tableConfig.table === 'daily_pickets') {
                    if (userNpsn) {
                        whereClauses.push("school_npsn = ?"); args = [userNpsn];
                    }
                }
                else if (tableConfig.table === 'student_incidents') {
                    if (userNpsn) {
                        whereClauses.push("picket_id IN (SELECT id FROM daily_pickets WHERE school_npsn = ?)");
                        args = [userNpsn];
                    }
                }
                else if (tableConfig.table === 'supervision_assignments') {
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("school_npsn = ?");
                        args = [userNpsn];
                    } else {
                        whereClauses.push("(supervisor_id = ? OR teacher_id = ?)");
                        args = [userId, userId];
                    }
                }
                else if (tableConfig.table === 'supervision_results') {
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("(supervisor_id IN (SELECT id FROM users WHERE school_npsn = ?) OR teacher_id IN (SELECT id FROM users WHERE school_npsn = ?))");
                        args = [userNpsn, userNpsn];
                    } else {
                        whereClauses.push("(supervisor_id = ? OR teacher_id = ?)");
                        args = [userId, userId];
                    }
                }
                else if (tableConfig.table === 'cbt_exams') {
                    if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("school_npsn = ?");
                        args = [userNpsn];
                    } else {
                        whereClauses.push("user_id = ?"); 
                        args = [userId];
                    }
                }
                else if (tableConfig.table === 'cbt_attempts') {
                    // Students see their own, teachers see school's
                    if (currentUser?.role === 'SISWA') {
                        whereClauses.push("student_id = ?");
                        args = [userId];
                    } else if (userNpsn && userNpsn !== 'DEFAULT') {
                        whereClauses.push("school_npsn = ?");
                        args = [userNpsn];
                    } else {
                        whereClauses.push("student_id = ?");
                        args = [userId];
                    }
                }
            }

            if (whereClauses.length > 0) {
                query += ` WHERE ${whereClauses.join(" AND ")}`;
            }
            
            if (tableConfig.table === 'materials') {
                console.log(`[API Debug] Materials Query: ${query}`, args);
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