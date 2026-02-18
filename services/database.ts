
// ... existing imports ...
import { 
  User, UserRole, ClassRoom, Student, AttendanceRecord, 
  ScopeMaterial, TeachingJournal, TeachingSchedule, 
  DashboardStatsData, Notification, BackupData, EmailConfig, 
  MasterSubject, LogEntry, StudentWithDetails, AssessmentScore,
  Ticket, TicketMessage, StudentViolation, StudentPointReduction, StudentAchievement, CounselingSession, UserStatus,
  WhatsAppConfig, ApiKey, SystemSettings
} from '../types';
import { initTurso, pushToTurso, pullFromTurso, checkConnection } from './tursoService';
import { sanitizeInput } from './security'; 
import bcrypt from 'bcryptjs';
import { db } from './db'; 
import { Table } from 'dexie';

// ... existing tables mapping ...
const MIGRATION_MAP: Record<string, Table<any, any>> = {
  'eduadmin_users': db.users,
  'eduadmin_classes': db.classes,
  'eduadmin_students': db.students,
  'eduadmin_attendance': db.attendanceRecords,
  'eduadmin_materials': db.scopeMaterials,
  'eduadmin_scores': db.assessmentScores,
  'eduadmin_journals': db.teachingJournals,
  'eduadmin_schedules': db.teachingSchedules,
  'eduadmin_logs': db.logs,
  'eduadmin_email_config': db.emailConfig,
  'eduadmin_master_subjects': db.masterSubjects,
  'eduadmin_tickets': db.tickets,
  'eduadmin_bk_violations': db.violations,
  'eduadmin_bk_reductions': db.pointReductions,
  'eduadmin_bk_achievements': db.achievements,
  'eduadmin_bk_counseling': db.counselingSessions,
  'eduadmin_wa_configs': db.whatsappConfigs,
  'eduadmin_notifications': db.notifications,
  'eduadmin_api_keys': db.apiKeys,
  'eduadmin_system_settings': db.systemSettings
};

let isOnline = navigator.onLine;
const tableSyncLocks = new Set<string>(); 
const syncDebounceTimers = new Map<string, NodeJS.Timeout>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const hashPassword = async (plainPassword: string) => { const salt = await bcrypt.genSalt(10); return await bcrypt.hash(plainPassword, salt); };

const chunkArray = (array: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

// ... existing sync implementations ...
export const checkUnsavedChanges = async () => {
  let hasUnsaved = false;
  for (const table of Object.values(MIGRATION_MAP)) {
    const count = await table.filter((item: any) => item.isSynced === false).count();
    if (count > 0) { hasUnsaved = true; break; }
  }
  window.dispatchEvent(new CustomEvent('unsaved-changes', { detail: hasUnsaved }));
  return hasUnsaved;
};

export const getSyncStats = async (user?: User) => {
    const stats: {table: string, count: number}[] = [];
    let totalUnsynced = 0;
    for (const [key, table] of Object.entries(MIGRATION_MAP)) {
        if (user && user.role === UserRole.GURU) {
            const adminOnlyTables = ['eduadmin_system_settings','eduadmin_master_subjects','eduadmin_api_keys','eduadmin_email_config','eduadmin_logs'];
            if (adminOnlyTables.includes(key)) continue;
            if (key === 'eduadmin_users') {
                const count = await table.filter((item: any) => item.isSynced === false && item.id === user.id).count();
                if (count > 0) { stats.push({ table: key.replace('eduadmin_', ''), count }); totalUnsynced += count; }
                continue;
            }
        }
        const count = await table.filter((item: any) => item.isSynced === false).count();
        if (count > 0) { stats.push({ table: key.replace('eduadmin_', ''), count }); totalUnsynced += count; }
    }
    return { stats, totalUnsynced };
};

const backgroundSync = async (key: string, table: Table<any, any>, forcePull: boolean = false) => {
    if (tableSyncLocks.has(key)) return; 
    tableSyncLocks.add(key);
    try {
        const localData = await table.toArray();
        const unsyncedItems = localData.filter(item => item.isSynced === false);
        if (unsyncedItems.length > 0) {
            const batches = chunkArray(unsyncedItems, 50); 
            for (const batch of batches) {
                try {
                    await pushToTurso(key, batch);
                    const deletedItems = batch.filter(i => i.deleted === true);
                    const keptItems = batch.filter(i => !i.deleted);
                    if (deletedItems.length > 0) { await table.bulkDelete(deletedItems.map(i => i.id)); }
                    if (keptItems.length > 0) { await table.bulkPut(keptItems.map(i => ({ ...i, isSynced: true }))); }
                } catch (pushError: any) {
                    if (pushError.message && pushError.message.startsWith('CONFLICT:')) { await pushToTurso(key, batch, true); } 
                    else { console.error(`Push failed for ${key}:`, pushError); }
                }
            }
        }
        if (forcePull || Math.random() > 0.8) {
            const { items: mergedData, hasChanges } = await pullFromTurso(key, localData);
            if (hasChanges) { await table.bulkPut(mergedData); window.dispatchEvent(new Event('storage')); }
        }
    } catch (e: any) { console.error(`Sync Error [${key}]:`, e.message); } finally { tableSyncLocks.delete(key); checkUnsavedChanges(); }
};

export const syncAllData = async (forcePull: boolean = false) => {
    if (!navigator.onLine) return;
    const isConnected = await checkConnection();
    if(!isConnected) { window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' })); return; }
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));
    try {
        const promises = Object.entries(MIGRATION_MAP).map(([key, table]) => backgroundSync(key, table, forcePull));
        await Promise.allSettled(promises);
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
    } catch (error) { window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' })); } 
    finally { setTimeout(() => window.dispatchEvent(new CustomEvent('sync-status', { detail: 'idle' })), 2000); }
};

const triggerAutoSync = (tableName: string, table: Table<any, any>, immediate = false) => {
    if (!isOnline) return;
    if (immediate) { backgroundSync(tableName, table).then(() => checkUnsavedChanges()); return; }
    if (syncDebounceTimers.has(tableName)) { clearTimeout(syncDebounceTimers.get(tableName)!); }
    const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));
        backgroundSync(tableName, table).then(() => window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }))).catch(() => window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }))).finally(() => { setTimeout(() => window.dispatchEvent(new CustomEvent('sync-status', { detail: 'idle' })), 2000); });
    }, 2000);
    syncDebounceTimers.set(tableName, timer);
};

const saveToDB = async <T extends {id?: string, lastModified?: number, isSynced?: boolean, version?: number, deleted?: boolean}>(
    table: Table<T, any>, itemOrItems: T | T[], tableNameForSync?: string 
) => {
    const now = Date.now();
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    const enrichedItems = items.map((item) => ({ ...item, lastModified: now, isSynced: false, version: (item.version || 0) + 1, deleted: item.deleted || false }));
    await table.bulkPut(enrichedItems);
    checkUnsavedChanges();
    if (isOnline && tableNameForSync) { triggerAutoSync(tableNameForSync, table); }
};

const softDeleteFromDB = async <T extends {id: string, lastModified?: number, isSynced?: boolean, version?: number, deleted?: boolean}>(
    table: Table<T, any>, idOrIds: string | string[], tableNameForSync: string
) => {
    const now = Date.now();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const items = await table.bulkGet(ids);
    const updates = items.filter(i => !!i).map(item => ({ ...item, lastModified: now, isSynced: false, version: (item!.version || 0) + 1, deleted: true }));
    if (updates.length > 0) {
        await table.bulkPut(updates as T[]);
        checkUnsavedChanges();
        if (isOnline && tableNameForSync) { triggerAutoSync(tableNameForSync, table, true); }
    }
};

export const runManualSync = async (mode: 'PUSH' | 'PULL' | 'FULL', onLog: (msg: string) => void) => {
    if (!navigator.onLine) { onLog("[ERROR] Tidak ada koneksi internet."); return; }
    const isConnected = await checkConnection();
    if (!isConnected) { onLog("[ERROR] Gagal terhubung ke Server Database."); return; }
    onLog(`[START] Memulai proses ${mode}...`);
    for (const [key, table] of Object.entries(MIGRATION_MAP)) {
        const tableName = key.replace('eduadmin_', '');
        try {
            if (mode === 'PUSH' || mode === 'FULL') {
                const unsyncedItems = await table.filter((item: any) => item.isSynced === false).toArray();
                if (unsyncedItems.length > 0) {
                    onLog(`[PUSH] Mengirim ${unsyncedItems.length} data ${tableName}...`);
                    const batches = chunkArray(unsyncedItems, 50);
                    for (const batch of batches) {
                        await pushToTurso(key, batch);
                        const deletedIds = batch.filter(i => i.deleted).map(i => i.id);
                        if (deletedIds.length > 0) await table.bulkDelete(deletedIds);
                    }
                    const remaining = await table.filter((item: any) => item.isSynced === false).toArray();
                    if (remaining.length > 0) { await table.bulkPut(remaining.map(i => ({ ...i, isSynced: true }))); }
                    onLog(`[OK] ${tableName} terkirim.`);
                } else { if (mode === 'PUSH') onLog(`[SKIP] ${tableName} sudah sinkron.`); }
            } 
            if (mode === 'PULL' || mode === 'FULL') {
                if (mode === 'PULL') onLog(`[PULL] Mengambil data ${tableName}...`);
                const localData = await table.toArray();
                const { items: mergedData, hasChanges } = await pullFromTurso(key, localData);
                if (hasChanges) { await table.bulkPut(mergedData); onLog(`[UPDATE] ${tableName} diperbarui dari server.`); }
            }
        } catch (e: any) { onLog(`[FAIL] Error pada ${tableName}: ${e.message}`); }
    }
    checkUnsavedChanges();
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
    onLog(`[DONE] Proses ${mode} selesai.`);
};

export const initDatabase = async () => { 
    if (!(db as any).isOpen()) await (db as any).open(); 
    await seedDatabase(); 
    if (navigator.onLine) { initTurso().catch(e => console.warn("Failed to init Turso:", e)); }
    checkUnsavedChanges(); 
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => { isOnline = true; syncAllData(); });
        window.addEventListener('offline', () => { isOnline = false; checkUnsavedChanges(); });
    }
};

// --- FIX: ROBUST SEEDING (ADMIN, GURU, BK) ---
// Fungsi ini memastikan user default selalu ada di database lokal
export const seedDatabase = async () => { 
    const now = Date.now();
    
    // 1. Seed Admin
    const adminCount = await db.users.where('username').equals('admin').count();
    if (adminCount === 0) {
        await db.users.add({ 
            id: 'admin-001', username: 'admin', password: 'admin', fullName: 'Administrator Sekolah', 
            role: UserRole.ADMIN, status: 'ACTIVE', schoolName: 'SMA EduAdmin', schoolNpsn: '10101010', 
            avatar: 'https://ui-avatars.com/api/?name=Admin', lastModified: now, version: 1, isSynced: false, deleted: false 
        });
        console.log("Seeded: admin/admin");
    }

    // 2. Seed Guru Mapel
    const guruCount = await db.users.where('username').equals('guru').count();
    if (guruCount === 0) {
        await db.users.add({ 
            id: 'guru-001', username: 'guru', password: 'guru', fullName: 'Budi Santoso, S.Pd', 
            role: UserRole.GURU, status: 'ACTIVE', schoolName: 'SMA EduAdmin', schoolNpsn: '10101010', subject: 'Matematika',
            avatar: 'https://ui-avatars.com/api/?name=Guru', lastModified: now, version: 1, isSynced: false, deleted: false 
        });
        console.log("Seeded: guru/guru");
    }

    // 3. Seed Guru BK
    const bkCount = await db.users.where('username').equals('bk').count();
    if (bkCount === 0) {
        await db.users.add({ 
            id: 'bk-001', username: 'bk', password: 'bk', fullName: 'Siti Aminah, M.Psi', 
            role: UserRole.GURU, status: 'ACTIVE', schoolName: 'SMA EduAdmin', schoolNpsn: '10101010', subject: 'Bimbingan Konseling',
            avatar: 'https://ui-avatars.com/api/?name=BK', lastModified: now, version: 1, isSynced: false, deleted: false 
        });
        console.log("Seeded: bk/bk");
    }
};

// --- FIX: ROBUST LOGIN (DEV/OFFLINE SUPPORT) ---
export const loginUser = async (u: string, p: string): Promise<User | null> => { 
    // 1. Try Server Login First if Online
    if (navigator.onLine) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p }),
                credentials: 'include'
            });
            
            // CRITICAL FIX: Check Content-Type for JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                // This catches HTML 404s in Dev and forces local fallback
                throw new Error("Server API not ready (Dev Mode)");
            }

            // Check for Hard Bans (Deleted users)
            if (response.status === 403) {
                const errData = await response.json();
                throw new Error(errData.error || 'Akun dinonaktifkan.');
            }

            if (response.ok) {
                const data = await response.json();
                if (data.user) {
                    const localUser = await db.users.get(data.user.id);
                    const serverVersion = data.user.version || 0;
                    const localVersion = localUser?.version || 0;

                    if (!localUser || serverVersion >= localVersion) {
                         await db.users.put({ ...data.user, isSynced: true });
                    }
                    return data.user;
                }
            } else {
                console.warn("Server login failed (401/500). Falling back to local...");
            }
        } catch (e: any) { 
            // Only rethrow if user is explicitly banned
            if (e.message.includes('dinonaktifkan') || e.message.includes('dihapus')) {
                throw e;
            }
            console.warn("Server login skipped (Network/Dev Error), falling back to local...", e.message); 
        }
    }

    // 2. Fallback to Local Login (Dexie)
    // Automatically happens if offline OR if server returns HTML/Error in dev
    const user = await db.users.where('username').equals(u).first();
    
    if (user && !user.deleted) { 
        let isValid = false;
        
        if (user.password && user.password.startsWith('$2')) {
            isValid = await bcrypt.compare(p, user.password);
        } else {
            // Check plain text (for default seeded users)
            isValid = user.password === p; 
        }

        if (isValid) {
            if (user.status !== 'ACTIVE') throw new Error('Akun belum aktif.');
            if (navigator.onLine) {
                syncAllData(true).catch(e => console.error("Background sync trigger failed", e));
            }
            return user;
        }
    }
    
    throw new Error('Username atau password salah.');
};

// ... (Export fungsi lainnya tetap ada seperti sebelumnya) ...
export const logoutUser = async () => {
    try {
        if (navigator.onLine) {
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        }
        localStorage.removeItem('eduadmin_user');
    } catch (e) { console.error("Logout failed", e); }
};

export const checkSession = async (): Promise<User | null> => {
    if (navigator.onLine) {
        try {
            const response = await fetch('/api/auth/me', { method: 'GET', credentials: 'include' });
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                if (response.ok) {
                    const data = await response.json();
                    return data.user;
                }
            }
        } catch (e) { /* Ignore */ }
    }
    const stored = localStorage.getItem('eduadmin_user');
    if (stored) { try { return JSON.parse(stored); } catch { return null; } }
    return null;
};

export const checkSchoolNameByNpsn = async (npsn: string): Promise<{found: boolean, schoolName?: string}> => {
    if (!navigator.onLine) return { found: false };
    try {
        const response = await fetch(`/api/check-npsn?npsn=${npsn}`, { method: 'GET' });
        if (response.ok) {
            return await response.json();
        }
    } catch (e) { console.warn("NPSN check failed:", e); }
    return { found: false };
};

export const registerUser = async (f: string, u: string, p: string, e: string, ph: string, npsn: string, schoolName: string, initialSubject?: string) => { 
    const existing = await db.users.where('username').equals(u).first(); 
    if (existing && !existing.deleted) return { success: false, message: 'Username sudah dipakai.' }; 
    
    const hashedPassword = await hashPassword(p); 
    const newUser: User = { 
        id: 'user-' + Date.now(), 
        fullName: f, 
        username: u, 
        password: hashedPassword, 
        email: e, 
        phone: ph,
        schoolNpsn: npsn, 
        schoolName: schoolName, 
        role: UserRole.GURU, 
        status: 'PENDING', 
        subject: initialSubject || '', 
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(f)}&background=random`, 
        lastModified: Date.now(), 
        version: 1, 
        isSynced: false,
        deleted: false 
    }; 
    if (navigator.onLine) {
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (res.ok) {
                newUser.isSynced = true;
                await db.users.put(newUser);
                return { success: true, message: 'Pendaftaran berhasil! Tunggu persetujuan admin.' };
            } else {
                const data = await res.json();
                if (res.status === 409) return { success: false, message: 'Username sudah dipakai (Server).' };
                throw new Error(data.error || 'Server error');
            }
        } catch (err) {
            console.error("Online registration failed, fallback to local:", err);
        }
    }
    await saveToDB(db.users, newUser, 'eduadmin_users'); 
    return { success: true, message: 'Pendaftaran tersimpan lokal! Data akan dikirim saat online.' }; 
};

export const getStudentsServerSide = async (page: number, limit: number, search: string = '', school: string = '', teacherId: string = '') => {
    if (navigator.onLine) {
        try {
            const userStr = localStorage.getItem('eduadmin_user');
            let authHeader = {};
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.id) {
                    authHeader = { 'Authorization': `Bearer ${user.id}` };
                }
            }
            const queryParams = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search, school, teacherId });
            const response = await fetch(`/api/students?${queryParams}`, { 
                method: 'GET', 
                headers: { 'Content-Type': 'application/json', ...authHeader }, 
                credentials: 'include' 
            });
            if (response.ok) return await response.json();
            if (response.status === 401) {
                return { error: 'Unauthorized', status: 401, data: [], meta: { total: 0, page: 1, totalPages: 0 } };
            }
        } catch (e) { console.warn("Server side fetch failed."); }
    }
    return { data: [], meta: { total: 0, page: 1, totalPages: 0 }, filters: { schools: [], teachers: [] } };
};

export const resetPassword = async (u: string, n: string) => { const user = await db.users.where('username').equals(u).first(); if (!user) return false; const hashedPassword = await hashPassword(n); await saveToDB(db.users, { ...user, password: hashedPassword }, 'eduadmin_users'); return true; };
export const updateUserProfile = async (id: string, d: Partial<User>) => { const user = await db.users.get(id); if (!user) return false; await saveToDB(db.users, { ...user, ...d }, 'eduadmin_users'); return true; };
export const updateUserPassword = async (id: string, n: string) => { const hashedPassword = await hashPassword(n); return await updateUserProfile(id, { password: hashedPassword }); };
export const getTeachers = async (): Promise<User[]> => { return await db.users.where('role').equals(UserRole.GURU).and(u => u.status === 'ACTIVE' && !u.deleted).toArray(); };
export const getPendingTeachers = async (): Promise<User[]> => { return await db.users.where('status').equals('PENDING').and(u => !u.deleted).toArray(); };
export const approveTeacher = async (id: string): Promise<boolean> => { const user = await db.users.get(id); if (!user) return false; await saveToDB(db.users, { ...user, status: 'ACTIVE' }, 'eduadmin_users'); return true; };
export const rejectTeacher = async (id: string): Promise<boolean> => { await softDeleteFromDB(db.users, id, 'eduadmin_users'); return true; };
export const deleteTeacher = async (id: string): Promise<boolean> => { await softDeleteFromDB(db.users, id, 'eduadmin_users'); return true; };
export const getClasses = async (id: string): Promise<ClassRoom[]> => { 
    const user = await db.users.get(id);
    let classes = [];
    if (!user || !user.schoolNpsn) { classes = await db.classes.where('userId').equals(id).toArray(); } else { classes = await db.classes.where('schoolNpsn').equals(user.schoolNpsn).toArray(); }
    return classes.filter(c => !c.deleted);
};
export const getAllClasses = async (): Promise<ClassRoom[]> => { return (await db.classes.toArray()).filter(c => !c.deleted); };
export const addClass = async (uid: string, n: string, d: string): Promise<ClassRoom | null> => { 
    const user = await db.users.get(uid);
    const npsn = user?.schoolNpsn || 'DEFAULT';
    const existing = await db.classes.where({ schoolNpsn: npsn, name: n }).first();
    if (existing && !existing.deleted) { alert(`Kelas "${n}" sudah ada.`); return existing; }
    const newClass: ClassRoom = { id: 'class-' + Date.now(), userId: uid, schoolNpsn: npsn, name: n, description: d, studentCount: 0, lastModified: Date.now(), version: 1, deleted: false }; 
    await saveToDB(db.classes, newClass, 'eduadmin_classes'); return newClass; 
};
export const deleteClass = async (id: string): Promise<void> => { await softDeleteFromDB(db.classes, id, 'eduadmin_classes'); const students = await db.students.where('classId').equals(id).toArray(); await softDeleteFromDB(db.students, students.map(s => s.id), 'eduadmin_students'); };
export const getStudents = async (id: string): Promise<Student[]> => { const students = await db.students.where('classId').equals(id).toArray(); return students.filter(s => !s.deleted).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())); };
export const getAllStudentsWithDetails = async (): Promise<StudentWithDetails[]> => { const students = (await db.students.toArray()).filter(s => !s.deleted); const classes = await db.classes.toArray(); const users = await db.users.toArray(); const classMap = new Map<string, ClassRoom>(classes.map(c => [c.id, c])); const userMap = new Map<string, User>(users.map(u => [u.id, u])); return students.map(s => { const cls = classMap.get(s.classId); const teacher = cls ? userMap.get(cls.userId) : null; return { ...s, className: cls?.name || 'Unknown', teacherName: teacher?.fullName || 'Unknown', schoolName: teacher?.schoolName || 'Unknown' }; }).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())); };
export const addStudent = async (classId: string, name: string, nis: string, gender: 'L'|'P', phone?: string): Promise<Student> => { 
    const cleanName = sanitizeInput(name); const cleanNis = sanitizeInput(nis); const cleanPhone = sanitizeInput(phone); const cls = await db.classes.get(classId); const npsn = cls?.schoolNpsn || 'DEFAULT'; const existing = await db.students.where({ schoolNpsn: npsn, nis: cleanNis }).first();
    if (existing) { if (!existing.deleted) { if (window.confirm(`Siswa dengan NIS ${cleanNis} (${existing.name}) sudah ada. Gunakan data tersebut?`)) { await saveToDB(db.students, { ...existing, classId, deleted: false }, 'eduadmin_students'); await updateClassCount(classId, 1); if (existing.classId !== classId) await updateClassCount(existing.classId, -1); return { ...existing, classId }; } else { throw new Error("Input dibatalkan."); } } else { const revived = { ...existing, classId, name: cleanName, gender, phone: cleanPhone, deleted: false, lastModified: Date.now() }; await saveToDB(db.students, revived, 'eduadmin_students'); await updateClassCount(classId, 1); return revived; } }
    const newStudent: Student = { id: 'student-' + Date.now() + Math.random().toString(36).substr(2, 5), classId, schoolNpsn: npsn, name: cleanName, nis: cleanNis, gender, phone: cleanPhone, lastModified: Date.now(), version: 1, deleted: false }; await saveToDB(db.students, newStudent, 'eduadmin_students'); await updateClassCount(classId, 1); return newStudent; 
};
export const importStudentsFromCSV = async (classId: string, csvText: string): Promise<{success: boolean, count: number, errors: string[]}> => { const cls = await db.classes.get(classId); let npsn = cls?.schoolNpsn; if (!npsn || npsn === 'DEFAULT') { if (cls?.userId) { const user = await db.users.get(cls.userId); npsn = user?.schoolNpsn || 'DEFAULT'; } else { npsn = 'DEFAULT'; } } const lines = csvText.split('\n'); const errors: string[] = []; const newStudents: Student[] = []; const cleanCSVField = (val: string) => val ? val.replace(/^["']|["']$/g, '').trim() : ''; for (let i = 1; i < lines.length; i++) { const line = lines[i].trim(); if (!line) continue; const parts = line.split(','); if (parts.length < 3) { errors.push(`Baris ${i+1}: Format salah`); continue; } const name = sanitizeInput(cleanCSVField(parts[0])); const nis = sanitizeInput(cleanCSVField(parts[1])); let genderRaw = cleanCSVField(parts[2]).toUpperCase(); let gender: 'L' | 'P' = 'L'; if (genderRaw.startsWith('L')) gender = 'L'; else if (genderRaw.startsWith('P')) gender = 'P'; else { errors.push(`Baris ${i+1}: Gender tidak valid (${genderRaw})`); continue; } const phoneRaw = parts[3] ? cleanCSVField(parts[3]) : ''; const phone = sanitizeInput(phoneRaw); if (!name || !nis) { errors.push(`Baris ${i+1}: Nama/NIS kosong`); continue; } const existing = await db.students.where({ schoolNpsn: npsn, nis }).first(); if (!existing || existing.deleted) { newStudents.push({ id: existing ? existing.id : 'student-' + Date.now() + Math.random(), classId, schoolNpsn: npsn, name, nis, gender, phone, lastModified: Date.now(), version: (existing?.version || 0) + 1, deleted: false }); } else { errors.push(`Baris ${i+1}: NIS ${nis} sudah ada (Dilewati)`); } } if (newStudents.length > 0) { await saveToDB(db.students, newStudents, 'eduadmin_students'); await updateClassCount(classId, newStudents.length); } return { success: true, count: newStudents.length, errors }; };
export const deleteStudent = async (id: string) => { const student = await db.students.get(id); if (student) { await softDeleteFromDB(db.students, id, 'eduadmin_students'); await updateClassCount(student.classId, -1); } };
export const bulkDeleteStudents = async (ids: string[]) => { const students = await db.students.bulkGet(ids); const classCounts: Record<string, number> = {}; students.forEach(s => { if (s) classCounts[s.classId] = (classCounts[s.classId] || 0) - 1; }); await softDeleteFromDB(db.students, ids, 'eduadmin_students'); for (const [classId, count] of Object.entries(classCounts)) { await updateClassCount(classId, count); } };
const updateClassCount = async (id: string, d: number) => { const cls = await db.classes.get(id); if (cls) { await saveToDB(db.classes, { ...cls, studentCount: Math.max(0, cls.studentCount + d) }, 'eduadmin_classes'); } };
export const getScopeMaterials = async (classId: string, semester: string, userId?: string): Promise<ScopeMaterial[]> => { 
    // Filter by class, semester AND user (privacy)
    const items = await db.scopeMaterials.where({ classId, semester }).toArray();
    return items.filter(x => !x.deleted && (userId ? x.userId === userId : true)); 
};
export const addScopeMaterial = async (material: Omit<ScopeMaterial, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newItem: ScopeMaterial = { id: 'mat-' + Date.now(), ...material, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.scopeMaterials, newItem, 'eduadmin_materials'); return newItem; };
export const copyScopeMaterials = async (sourceClassId: string, targetClassId: string, sourceSemester: string, targetSemester: string, userId: string, subject: string) => { const sources = await getScopeMaterials(sourceClassId, sourceSemester, userId); if (sources.length === 0) return false; const newItems = sources.map(s => ({ id: 'mat-' + Date.now() + Math.random(), classId: targetClassId, userId: userId, subject: subject, semester: targetSemester, code: s.code, phase: s.phase, content: s.content, lastModified: Date.now(), version: 1, isSynced: false, deleted: false })); await saveToDB(db.scopeMaterials, newItems, 'eduadmin_materials'); return true; };
export const deleteScopeMaterial = async (id: string) => { await softDeleteFromDB(db.scopeMaterials, id, 'eduadmin_materials'); };
export const bulkDeleteScopeMaterials = async (ids: string[]) => { await softDeleteFromDB(db.scopeMaterials, ids, 'eduadmin_materials'); };
export const deleteTeachingJournal = async (id: string) => { await softDeleteFromDB(db.teachingJournals, id, 'eduadmin_journals'); };
export const bulkDeleteTeachingJournals = async (ids: string[]) => { await softDeleteFromDB(db.teachingJournals, ids, 'eduadmin_journals'); };
export const deleteTeachingSchedule = async (id: string) => { await softDeleteFromDB(db.teachingSchedules, id, 'eduadmin_schedules'); };
export const deleteStudentViolation = async (id: string) => { await softDeleteFromDB(db.violations, id, 'eduadmin_bk_violations'); };
export const deleteStudentPointReduction = async (id: string) => { await softDeleteFromDB(db.pointReductions, id, 'eduadmin_bk_reductions'); };
export const deleteStudentAchievement = async (id: string) => { await softDeleteFromDB(db.achievements, id, 'eduadmin_bk_achievements'); };
export const deleteCounselingSession = async (id: string) => { await softDeleteFromDB(db.counselingSessions, id, 'eduadmin_bk_counseling'); };
export const deleteMasterSubject = async (id: string) => { await softDeleteFromDB(db.masterSubjects, id, 'eduadmin_master_subjects'); };
export const deleteNotification = async (id: string) => { await softDeleteFromDB(db.notifications, id, 'eduadmin_notifications'); };
export const deleteBackupApiKey = async (id: string) => { await softDeleteFromDB(db.apiKeys, id, 'eduadmin_api_keys'); };
export const getSystemLogs = async (): Promise<LogEntry[]> => { return (await db.logs.toArray()).filter(x => !x.deleted); };
export const getTeachingSchedules = async (id: string): Promise<TeachingSchedule[]> => { return (await db.teachingSchedules.where('userId').equals(id).toArray()).filter(x => !x.deleted); };
export const getTeachingJournals = async (id: string): Promise<TeachingJournal[]> => { return (await db.teachingJournals.where('userId').equals(id).toArray()).filter(x => !x.deleted); };
export const getAssessmentScores = async (id: string, s: string): Promise<AssessmentScore[]> => { return (await db.assessmentScores.where('classId').equals(id).and(sc => sc.semester === s).toArray()).filter(x => !x.deleted); };
export const getTickets = async (u: User): Promise<Ticket[]> => { if (u.role === UserRole.ADMIN) { return (await db.tickets.toArray()).filter(x => !x.deleted); } return (await db.tickets.where('userId').equals(u.id).toArray()).filter(x => !x.deleted); };
export const getStudentViolations = async (): Promise<StudentViolation[]> => { return (await db.violations.toArray()).filter(x => !x.deleted); };
export const getStudentPointReductions = async (): Promise<StudentPointReduction[]> => { return (await db.pointReductions.toArray()).filter(x => !x.deleted); };
export const getStudentAchievements = async (): Promise<StudentAchievement[]> => { return (await db.achievements.toArray()).filter(x => !x.deleted); };
export const getCounselingSessions = async (): Promise<CounselingSession[]> => { return (await db.counselingSessions.toArray()).filter(x => !x.deleted); };
export const getMasterSubjects = async (): Promise<MasterSubject[]> => { return (await db.masterSubjects.toArray()).filter(x => !x.deleted); };
export const getBackupApiKeys = async (): Promise<ApiKey[]> => { return (await db.apiKeys.toArray()).filter(x => !x.deleted); };
export const addSystemLog = async (level: any, actor: string, role: string, action: string, details: string) => { const log: LogEntry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), level, actor, role, action, details, lastModified: Date.now(), version: 1 }; await saveToDB(db.logs, log, 'eduadmin_logs'); };
export const clearSystemLogs = async () => { await db.logs.clear(); };
export const createBackup = async (u: User, semesterFilter?: string): Promise<BackupData> => { const filterFn = (x: any) => !x.deleted; const meta = { version: '2.0', date: new Date().toISOString(), generatedBy: u.fullName, role: u.role, semesterFilter }; const data: BackupData['data'] = { classes: (await db.classes.toArray()).filter(filterFn), students: (await db.students.toArray()).filter(filterFn), users: u.role === UserRole.ADMIN ? (await db.users.toArray()).filter(filterFn) : [u], scopeMaterials: (await db.scopeMaterials.toArray()).filter(filterFn), assessmentScores: (await db.assessmentScores.toArray()).filter(filterFn), teachingJournals: (await db.teachingJournals.toArray()).filter(filterFn), teachingSchedules: (await db.teachingSchedules.toArray()).filter(filterFn), attendanceRecords: (await db.attendanceRecords.toArray()).filter(filterFn), masterSubjects: (await db.masterSubjects.toArray()).filter(filterFn), tickets: (await db.tickets.toArray()).filter(filterFn), violations: (await db.violations.toArray()).filter(filterFn), pointReductions: (await db.pointReductions.toArray()).filter(filterFn), achievements: (await db.achievements.toArray()).filter(filterFn), counselingSessions: (await db.counselingSessions.toArray()).filter(filterFn), notifications: (await db.notifications.toArray()).filter(filterFn), apiKeys: u.role === UserRole.ADMIN ? (await db.apiKeys.toArray()).filter(filterFn) : [], systemSettings: u.role === UserRole.ADMIN ? (await db.systemSettings.toArray()) : [] }; return { meta, data }; };
export const restoreBackup = async (b: BackupData): Promise<{success: boolean, message: string}> => { try { if (b.data.users) await saveToDB(db.users, b.data.users, 'eduadmin_users'); if (b.data.classes) await saveToDB(db.classes, b.data.classes, 'eduadmin_classes'); if (b.data.students) await saveToDB(db.students, b.data.students, 'eduadmin_students'); if (b.data.scopeMaterials) await saveToDB(db.scopeMaterials, b.data.scopeMaterials, 'eduadmin_materials'); if (b.data.assessmentScores) await saveToDB(db.assessmentScores, b.data.assessmentScores, 'eduadmin_scores'); if (b.data.teachingJournals) await saveToDB(db.teachingJournals, b.data.teachingJournals, 'eduadmin_journals'); if (b.data.teachingSchedules) await saveToDB(db.teachingSchedules, b.data.teachingSchedules, 'eduadmin_schedules'); if (b.data.attendanceRecords) await saveToDB(db.attendanceRecords, b.data.attendanceRecords, 'eduadmin_attendance'); if (b.data.masterSubjects) await saveToDB(db.masterSubjects, b.data.masterSubjects, 'eduadmin_master_subjects'); if (b.data.tickets) await saveToDB(db.tickets, b.data.tickets, 'eduadmin_tickets'); if (b.data.violations) await saveToDB(db.violations, b.data.violations, 'eduadmin_bk_violations'); if (b.data.pointReductions) await saveToDB(db.pointReductions, b.data.pointReductions, 'eduadmin_bk_reductions'); if (b.data.achievements) await saveToDB(db.achievements, b.data.achievements, 'eduadmin_bk_achievements'); if (b.data.counselingSessions) await saveToDB(db.counselingSessions, b.data.counselingSessions, 'eduadmin_bk_counseling'); if (b.data.notifications) await saveToDB(db.notifications, b.data.notifications, 'eduadmin_notifications'); if (b.data.apiKeys) await saveToDB(db.apiKeys, b.data.apiKeys, 'eduadmin_api_keys'); if (b.data.systemSettings) await saveToDB(db.systemSettings, b.data.systemSettings, 'eduadmin_system_settings'); return { success: true, message: 'Restore berhasil.' }; } catch (e: any) { return { success: false, message: e.message || 'Gagal restore.' }; } };
export const resetSystemData = async (scope: 'SEMESTER' | 'ALL', semester?: string): Promise<{success: boolean, message: string}> => { try { if (scope === 'ALL') { const admins = await db.users.where('role').equals(UserRole.ADMIN).toArray(); await db.users.clear(); await db.classes.clear(); await db.students.clear(); await db.scopeMaterials.clear(); await db.assessmentScores.clear(); await db.teachingJournals.clear(); await db.teachingSchedules.clear(); await db.attendanceRecords.clear(); await db.tickets.clear(); await db.violations.clear(); await db.pointReductions.clear(); await db.achievements.clear(); await db.counselingSessions.clear(); await db.notifications.clear(); await db.users.bulkAdd(admins); await syncAllData(); return { success: true, message: 'Sistem berhasil di-reset total (Factory Reset).' }; } if (scope === 'SEMESTER' && semester) { const scoresToDelete = await db.assessmentScores.where('semester').equals(semester).primaryKeys(); await db.assessmentScores.bulkDelete(scoresToDelete); const materialsToDelete = await db.scopeMaterials.where('semester').equals(semester).primaryKeys(); await db.scopeMaterials.bulkDelete(materialsToDelete); await syncAllData(); return { success: true, message: `Data akademik semester ${semester} berhasil dihapus.` }; } return { success: false, message: 'Invalid Scope' }; } catch (e: any) { console.error("Reset Error:", e); return { success: false, message: e.message || 'Gagal mereset data.' }; } };
export const getDashboardStats = async (user: User): Promise<DashboardStatsData> => { let classes: ClassRoom[] = []; let students: Student[] = []; let journals: TeachingJournal[] = []; let attendance: AttendanceRecord[] = []; const filterNotDeleted = (item: any) => !item.deleted; if (user.role === UserRole.ADMIN) { classes = (await db.classes.toArray()).filter(filterNotDeleted); students = (await db.students.toArray()).filter(filterNotDeleted); journals = (await db.teachingJournals.toArray()).filter(filterNotDeleted); attendance = (await db.attendanceRecords.toArray()).filter(filterNotDeleted); } else { if (user.schoolNpsn) { classes = await db.classes.where('schoolNpsn').equals(user.schoolNpsn).toArray(); } else { classes = await db.classes.where('userId').equals(user.id).toArray(); } classes = classes.filter(filterNotDeleted); const classIds = classes.map(c => c.id); if (user.schoolNpsn) { students = await db.students.where('schoolNpsn').equals(user.schoolNpsn).toArray(); } else { if (classIds.length > 0) { students = await db.students.where('classId').anyOf(classIds).toArray(); } } students = students.filter(filterNotDeleted); journals = await db.teachingJournals.where('userId').equals(user.id).toArray(); journals = journals.filter(filterNotDeleted); if (classIds.length > 0) { attendance = await db.attendanceRecords.where('classId').anyOf(classIds).toArray(); attendance = attendance.filter(filterNotDeleted); } } const totalClasses = classes.length; const totalStudents = students.length; const filledJournals = journals.length; const presentCount = attendance.filter(a => a.status === 'H').length; const totalRecords = attendance.length; const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0; const maleCount = students.filter(s => s.gender === 'L').length; const femaleCount = students.filter(s => s.gender === 'P').length; const genderDistribution = [{ name: 'Laki-laki', value: maleCount }, { name: 'Perempuan', value: femaleCount }]; const weeklyAttendance: { name: string; hadir: number; sakit: number; izin: number }[] = []; return { totalClasses, totalStudents, filledJournals, attendanceRate, genderDistribution, weeklyAttendance }; };
export const addTeachingSchedule = async (schedule: Omit<TeachingSchedule, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newSchedule: TeachingSchedule = { id: 'schedule-' + Date.now(), ...schedule, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.teachingSchedules, newSchedule, 'eduadmin_schedules'); return newSchedule; };
export const getNotifications = async (role: UserRole): Promise<Notification[]> => { return (await db.notifications.filter(n => (n.targetRole === 'ALL' || n.targetRole === role) && !n.deleted).toArray()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); };
export const getActiveAnnouncements = async (): Promise<Notification[]> => { return (await db.notifications.filter(n => n.isPopup === true && !n.deleted).toArray()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); };
export const createNotification = async (title: string, message: string, type: Notification['type'], targetRole: Notification['targetRole'], isPopup: boolean = false) => { const newNotif: Notification = { id: 'notif-' + Date.now(), title, message, type, targetRole, isRead: false, isPopup, createdAt: new Date().toISOString(), lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.notifications, newNotif, 'eduadmin_notifications'); return newNotif; };
export const markNotificationAsRead = async (id: string) => { const notif = await db.notifications.get(id); if (notif) { await saveToDB(db.notifications, { ...notif, isRead: true }, 'eduadmin_notifications'); } };
export const clearNotifications = async (role: UserRole) => { const notifs = await db.notifications.filter(n => (n.targetRole === 'ALL' || n.targetRole === role) && !n.deleted).toArray(); const ids = notifs.map(n => n.id); await softDeleteFromDB(db.notifications, ids, 'eduadmin_notifications'); };
export const getSystemSettings = async (): Promise<SystemSettings> => { const settings = await db.systemSettings.get('global-settings'); if (settings) return settings; return { id: 'global-settings', featureRppEnabled: true, maintenanceMessage: '', appName: 'EduAdmin Pro', schoolName: 'Sekolah Indonesia', lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; };
export const saveSystemSettings = async (settings: SystemSettings) => { await saveToDB(db.systemSettings, { ...settings, id: 'global-settings' }, 'eduadmin_system_settings'); };
export const getAttendanceRecords = async (classId: string, month: number, year: number) => { const all = await db.attendanceRecords.where('classId').equals(classId).toArray(); return all.filter(r => { if (r.deleted) return false; const d = new Date(r.date); return d.getMonth() === month && d.getFullYear() === year; }); };
export const saveAttendanceRecords = async (records: Omit<AttendanceRecord, 'id'>[]) => { const recordsToSave: AttendanceRecord[] = []; for (const r of records) { const existing = await db.attendanceRecords.where({ studentId: r.studentId, classId: r.classId, date: r.date }).first(); if (existing) { recordsToSave.push({ ...existing, status: r.status }); } else { recordsToSave.push({ id: `att-${r.studentId}-${r.date}`, ...r, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }); } } await saveToDB(db.attendanceRecords, recordsToSave, 'eduadmin_attendance'); };
export const saveBulkAssessmentScores = async (scores: Omit<AssessmentScore, 'id'>[], userId: string, userName?: string) => { const scoresToSave: AssessmentScore[] = []; for (const s of scores) { let existing; if (s.category === 'LM') { existing = await db.assessmentScores.where({ studentId: s.studentId, category: 'LM', materialId: s.materialId }).first(); } else { existing = await db.assessmentScores.where({ studentId: s.studentId, category: s.category }).first(); } if (existing) { scoresToSave.push({ ...existing, score: s.score, userId, subject: s.subject }); } else { scoresToSave.push({ id: `score-${s.studentId}-${s.category}-${s.materialId || 'gen'}`, ...s, userId, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }); } } await saveToDB(db.assessmentScores, scoresToSave, 'eduadmin_scores'); };
export const addTeachingJournal = async (journal: Omit<TeachingJournal, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newItem: TeachingJournal = { id: 'journal-' + Date.now(), ...journal, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.teachingJournals, newItem, 'eduadmin_journals'); return newItem; };
export const saveEmailConfig = async (config: EmailConfig) => { const configToSave = { ...config, id: 'email-config', lastModified: Date.now(), isSynced: false, version: 1, deleted: false }; await saveToDB(db.emailConfig, configToSave as any, 'eduadmin_email_config'); return true; };
export const getEmailConfig = async (): Promise<EmailConfig | null> => { return (await db.emailConfig.get('email-config')) || null; };
export const sendApprovalEmail = async (user: User) => { const config = await getEmailConfig(); if (!config || !config.isActive) return { success: false, message: 'Email config not active' }; if (navigator.onLine) { try { const res = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, config }) }); return await res.json(); } catch (e: any) { return { success: false, message: e.message }; } } return { success: false, message: 'Offline' }; };
export const addMasterSubject = async (name: string, category: any, level: any) => { const newSub: MasterSubject = { id: 'sub-' + Date.now(), name, category, level, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.masterSubjects, newSub, 'eduadmin_master_subjects'); return newSub; };
export const addBackupApiKey = async (key: string) => { const newKey: ApiKey = { id: 'key-' + Date.now(), key, provider: 'GEMINI', status: 'ACTIVE', addedAt: new Date().toISOString(), lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.apiKeys, newKey, 'eduadmin_api_keys'); return newKey; };
export const clearBackupApiKeys = async () => { const all = await db.apiKeys.toArray(); const ids = all.map(k => k.id); await softDeleteFromDB(db.apiKeys, ids, 'eduadmin_api_keys'); };
export const createTicket = async (user: User, subject: string, message: string) => { const newTicket: Ticket = { id: 'ticket-' + Date.now(), userId: user.id, teacherName: user.fullName, subject, status: 'OPEN', lastUpdated: new Date().toISOString(), messages: [{ id: 'msg-' + Date.now(), senderRole: user.role, senderName: user.fullName, message, timestamp: new Date().toISOString() }], lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.tickets, newTicket, 'eduadmin_tickets'); return newTicket; };
export const replyTicket = async (ticketId: string, user: User, message: string) => { const ticket = await db.tickets.get(ticketId); if (!ticket) return false; const newMsg: TicketMessage = { id: 'msg-' + Date.now(), senderRole: user.role, senderName: user.fullName, message, timestamp: new Date().toISOString() }; const updatedTicket = { ...ticket, messages: [...ticket.messages, newMsg], lastUpdated: new Date().toISOString() }; await saveToDB(db.tickets, updatedTicket, 'eduadmin_tickets'); return true; };
export const closeTicket = async (ticketId: string) => { const ticket = await db.tickets.get(ticketId); if (!ticket) return false; await saveToDB(db.tickets, { ...ticket, status: 'CLOSED' }, 'eduadmin_tickets'); return true; };
export const addStudentViolation = async (data: Omit<StudentViolation, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newItem: StudentViolation = { id: 'viol-' + Date.now(), ...data, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.violations, newItem, 'eduadmin_bk_violations'); };
export const addStudentPointReduction = async (data: Omit<StudentPointReduction, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newItem: StudentPointReduction = { id: 'red-' + Date.now(), ...data, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.pointReductions, newItem, 'eduadmin_bk_reductions'); };
export const addStudentAchievement = async (data: Omit<StudentAchievement, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newItem: StudentAchievement = { id: 'ach-' + Date.now(), ...data, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.achievements, newItem, 'eduadmin_bk_achievements'); };
export const addCounselingSession = async (data: Omit<CounselingSession, 'id' | 'lastModified' | 'version' | 'isSynced' | 'deleted'>) => { const newItem: CounselingSession = { id: 'ses-' + Date.now(), ...data, lastModified: Date.now(), version: 1, isSynced: false, deleted: false }; await saveToDB(db.counselingSessions, newItem, 'eduadmin_bk_counseling'); };
export const saveWhatsAppConfig = async (config: WhatsAppConfig) => { const configToSave = { ...config, lastModified: Date.now(), isSynced: false, version: 1, deleted: false }; await saveToDB(db.whatsappConfigs, configToSave as any, 'eduadmin_wa_configs'); };
export const getWhatsAppConfig = async (userId: string): Promise<WhatsAppConfig | null> => { return await db.whatsappConfigs.where('userId').equals(userId).first() || null; };
export const sendWhatsAppBroadcast = async (config: WhatsAppConfig, recipients: {phone: string, name: string}[], message: string) => { if (navigator.onLine) { try { const res = await fetch('/api/send-whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, recipients, message }) }); return await res.json(); } catch (e: any) { console.error("WA Broadcast Error:", e); return { success: 0, failed: recipients.length }; } } else { alert("Fitur broadcast membutuhkan koneksi internet."); return { success: 0, failed: recipients.length }; } };
