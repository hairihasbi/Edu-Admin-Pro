import { db } from './db';
import { 
  User, UserRole, ClassRoom, Student, AttendanceRecord, 
  ScopeMaterial, AssessmentScore, TeachingJournal, 
  TeachingSchedule, LogEntry, MasterSubject, Ticket, 
  StudentViolation, StudentPointReduction, StudentAchievement, CounselingSession, 
  EmailConfig, WhatsAppConfig, Notification, ApiKey, SystemSettings, 
  DashboardStatsData, BackupData, StudentWithDetails
} from '../types';
import { pushToTurso, pullFromTurso, initTurso } from './tursoService';

// --- AUTH & USER ---

export const initDatabase = async () => {
  if (!db.isOpen()) {
    await db.open();
  }
  // Try to sync on init
  if (navigator.onLine) {
      initTurso().catch(console.warn);
  }
};

export const loginUser = async (username: string, password?: string): Promise<User | null> => {
    // 1. Try local DB first (Dexie)
    let user = await db.users.where('username').equals(username).first();
    
    // 2. If online, try server login to get fresh data/token
    if (navigator.onLine) {
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                const data = await res.json();
                user = data.user;
                // Update local DB with fresh user data from server
                if (user) await db.users.put(user);
            }
        } catch (e) {
            console.warn("Server login failed, falling back to local:", e);
        }
    }

    if (!user) return null;
    
    // Local Password Check (fallback)
    if (!navigator.onLine && user.password && user.password !== password) {
        return null;
    }

    if (user.status !== 'ACTIVE') return null;
    
    return user;
};

export const registerUser = async (fullName: string, username: string, password: string, email: string, phone: string, schoolNpsn: string, schoolName: string, subject: string) => {
    const newUser: User = {
        id: crypto.randomUUID(),
        username,
        password, 
        fullName,
        email,
        phone,
        schoolNpsn,
        schoolName,
        role: UserRole.GURU, // Default
        status: 'PENDING',
        subject,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
        lastModified: Date.now(),
        isSynced: false
    };

    // Save to local
    await db.users.add(newUser);

    // Push to server immediately
    if (navigator.onLine) {
        try {
            await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            await db.users.update(newUser.id, { isSynced: true });
            return { success: true, message: "Pendaftaran berhasil! Tunggu persetujuan Admin." };
        } catch (e) {
            return { success: true, message: "Pendaftaran tersimpan (Offline). Akan dikirim saat online." };
        }
    }
    
    return { success: true, message: "Pendaftaran tersimpan (Offline). Tunggu persetujuan Admin." };
};

export const resetPassword = async (username: string, newPass: string) => {
    return false; // Not fully implemented client side securely
};

export const updateUserProfile = async (id: string, data: Partial<User>) => {
    await db.users.update(id, { ...data, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_users');
    return true;
};

export const updateUserPassword = async (id: string, newPass: string) => {
    await db.users.update(id, { password: newPass, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_users');
    return true;
};

export const getTeachers = async () => {
    return await db.users.where('role').equals(UserRole.GURU).filter(u => u.status === 'ACTIVE' && !u.deleted).toArray();
};

export const getPendingTeachers = async () => {
    return await db.users.where('status').equals('PENDING').filter(u => !u.deleted).toArray();
};

export const approveTeacher = async (id: string): Promise<boolean> => {
    await db.users.update(id, { status: 'ACTIVE', lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_users', true);
    return true;
};

export const rejectTeacher = async (id: string): Promise<boolean> => {
    await deleteTeacher(id);
    return true;
};

export const deleteTeacher = async (id: string): Promise<boolean> => {
    await db.users.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_users', true);
    return true;
};

export const sendApprovalEmail = async (user: User) => {
    try {
        const config = await getEmailConfig();
        if (!config || !config.isActive) return { success: false };

        await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, config })
        });
        return { success: true, message: "Notifikasi email terkirim." };
    } catch (e) {
        return { success: false };
    }
};

// --- STATS & LOGS ---

export const getDashboardStats = async (user: User): Promise<DashboardStatsData> => {
    let classesCount = 0;
    let studentsCount = 0;
    let journalsCount = 0;
    
    if (user.role === UserRole.ADMIN) {
        classesCount = await db.classes.filter(x => !x.deleted).count();
        studentsCount = await db.students.filter(x => !x.deleted).count();
        journalsCount = await db.teachingJournals.filter(x => !x.deleted).count();
    } else {
        classesCount = await db.classes.where('userId').equals(user.id).filter(x => !x.deleted).count();
        const myClasses = await db.classes.where('userId').equals(user.id).keys();
        studentsCount = await db.students.where('classId').anyOf(myClasses as string[]).filter(x => !x.deleted).count();
        journalsCount = await db.teachingJournals.where('userId').equals(user.id).filter(x => !x.deleted).count();
    }

    return {
        totalClasses: classesCount,
        totalStudents: studentsCount,
        filledJournals: journalsCount,
        attendanceRate: 0,
        genderDistribution: [],
        weeklyAttendance: []
    };
};

export const getSystemLogs = async () => {
    return await db.logs.orderBy('timestamp').reverse().limit(100).toArray();
};

export const addSystemLog = async (level: LogEntry['level'], actor: string, role: string, action: string, details: string) => {
    await db.logs.add({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        actor,
        role,
        action,
        details,
        lastModified: Date.now(),
        isSynced: false
    });
    triggerSync('eduadmin_logs');
};

export const clearSystemLogs = async () => {
    await db.logs.clear();
};

export const getSyncStats = async (user: User) => {
    const stats = [];
    let totalUnsynced = 0;
    
    const checkTable = async (table: any, name: string) => {
        const count = await table.filter((i: any) => i.isSynced === false).count();
        if (count > 0) {
            stats.push({ table: name, count });
            totalUnsynced += count;
        }
    };

    await checkTable(db.users, 'users');
    await checkTable(db.classes, 'classes');
    await checkTable(db.students, 'students');
    await checkTable(db.assessmentScores, 'scores');
    await checkTable(db.attendanceRecords, 'attendance');
    await checkTable(db.teachingJournals, 'journals');
    
    return { stats, totalUnsynced };
};

// --- CLASSES & STUDENTS ---

export const getClasses = async (userId: string) => {
    return await db.classes.where('userId').equals(userId).filter(c => !c.deleted).toArray();
};

export const getAllClasses = async () => {
    return await db.classes.filter(c => !c.deleted).toArray();
};

export const addClass = async (userId: string, name: string, description?: string) => {
    const newClass: ClassRoom = {
        id: crypto.randomUUID(),
        userId,
        name,
        description,
        studentCount: 0,
        schoolNpsn: 'DEFAULT', 
        lastModified: Date.now(),
        isSynced: false
    };
    await db.classes.add(newClass);
    triggerSync('eduadmin_classes');
    return newClass;
};

export const deleteClass = async (id: string) => {
    await db.classes.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_classes');
};

export const getStudents = async (classId: string) => {
    return await db.students.where('classId').equals(classId).filter(s => !s.deleted).sortBy('name');
};

export const getAllStudentsWithDetails = async (): Promise<StudentWithDetails[]> => {
    const students = await db.students.filter(s => !s.deleted).toArray();
    return students.map(s => ({ ...s, className: '?', teacherName: '?', schoolName: '?' }));
};

export const getStudentsServerSide = async (page: number, limit: number, search: string, school: string, teacherId: string) => {
    const params = new URLSearchParams({ 
        page: page.toString(), 
        limit: limit.toString(),
        search,
        school, 
        teacherId
    });
    const res = await fetch(`/api/students?${params.toString()}`);
    if (res.status === 401) return { status: 401, data: [], meta: { total: 0, totalPages: 0 } };
    return await res.json();
};

export const addStudent = async (classId: string, name: string, nis: string, gender: 'L'|'P', phone?: string) => {
    const newStudent: Student = {
        id: crypto.randomUUID(),
        classId,
        name,
        nis,
        gender,
        phone,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.students.add(newStudent);
    triggerSync('eduadmin_students');
    return newStudent;
};

export const deleteStudent = async (id: string) => {
    await db.students.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_students');
};

export const bulkDeleteStudents = async (ids: string[]) => {
    await db.transaction('rw', db.students, async () => {
        for (const id of ids) {
            await db.students.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
        }
    });
    triggerSync('eduadmin_students');
};

export const importStudentsFromCSV = async (classId: string, csvText: string) => {
    const lines = csvText.split('\n');
    const errors = [];
    let count = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim());
        
        if (cleanParts.length < 3) {
            errors.push(`Row ${i+1}: Format invalid`);
            continue;
        }
        
        const [name, nis, genderRaw, phone] = cleanParts;
        const gender = (genderRaw.toUpperCase() === 'L' || genderRaw.toUpperCase() === 'LAKI-LAKI') ? 'L' : 'P';
        
        await addStudent(classId, name, nis, gender, phone);
        count++;
    }
    
    return { success: true, count, errors };
};

// --- ACADEMIC ---

export const getTeachingSchedules = async (userId: string) => {
    return await db.teachingSchedules.where('userId').equals(userId).filter(s => !s.deleted).toArray();
};

export const addTeachingSchedule = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.teachingSchedules.add(newItem);
    triggerSync('eduadmin_schedules');
    return newItem;
};

export const deleteTeachingSchedule = async (id: string) => {
    await db.teachingSchedules.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_schedules');
};

export const getScopeMaterials = async (classId: string, semester: string, userId?: string) => {
    let q = db.scopeMaterials.where('classId').equals(classId).filter(m => m.semester === semester && !m.deleted);
    if (userId) {
        q = q.and(m => m.userId === userId);
    }
    return await q.toArray();
};

export const addScopeMaterial = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.scopeMaterials.add(newItem);
    triggerSync('eduadmin_materials');
    return newItem;
};

export const deleteScopeMaterial = async (id: string) => {
    await db.scopeMaterials.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_materials');
};

export const bulkDeleteScopeMaterials = async (ids: string[]) => {
    await db.transaction('rw', db.scopeMaterials, async () => {
        for (const id of ids) {
            await db.scopeMaterials.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
        }
    });
    triggerSync('eduadmin_materials');
};

export const copyScopeMaterials = async (fromClassId: string, toClassId: string, fromSem: string, toSem: string, userId: string, subject: string) => {
    const sources = await db.scopeMaterials.where('classId').equals(fromClassId).filter(m => m.semester === fromSem && !m.deleted).toArray();
    if (sources.length === 0) return false;
    
    await db.transaction('rw', db.scopeMaterials, async () => {
        for (const m of sources) {
            await db.scopeMaterials.add({
                id: crypto.randomUUID(),
                classId: toClassId,
                userId,
                subject,
                semester: toSem,
                code: m.code,
                phase: m.phase,
                content: m.content,
                lastModified: Date.now(),
                isSynced: false
            });
        }
    });
    triggerSync('eduadmin_materials');
    return true;
};

export const getAssessmentScores = async (classId: string, semester: string) => {
    return await db.assessmentScores.where('classId').equals(classId).filter(s => s.semester === semester && !s.deleted).toArray();
};

export const saveBulkAssessmentScores = async (scores: any[], userId: string, userName?: string) => {
    await db.transaction('rw', db.assessmentScores, async () => {
        for (const s of scores) {
            let existing;
            if (s.category === 'LM') {
                existing = await db.assessmentScores
                    .where({ studentId: s.studentId, materialId: s.materialId })
                    .first();
            } else {
                existing = await db.assessmentScores
                    .where({ studentId: s.studentId, category: s.category, semester: s.semester })
                    .first();
            }

            if (existing) {
                await db.assessmentScores.update(existing.id, { ...s, lastModified: Date.now(), isSynced: false });
            } else {
                await db.assessmentScores.add({ ...s, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false });
            }
        }
    });
    triggerSync('eduadmin_scores');
};

export const getTeachingJournals = async (userId: string) => {
    return await db.teachingJournals.where('userId').equals(userId).filter(j => !j.deleted).reverse().sortBy('date');
};

export const addTeachingJournal = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.teachingJournals.add(newItem);
    triggerSync('eduadmin_journals');
    return newItem;
};

export const deleteTeachingJournal = async (id: string) => {
    await db.teachingJournals.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_journals');
};

export const bulkDeleteTeachingJournals = async (ids: string[]) => {
    await db.transaction('rw', db.teachingJournals, async () => {
        for (const id of ids) {
            await db.teachingJournals.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
        }
    });
    triggerSync('eduadmin_journals');
};

export const getAttendanceRecords = async (classId: string, month: number, year: number) => {
    const start = `${year}-${String(month+1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month+1).padStart(2, '0')}-31`;
    
    return await db.attendanceRecords.where('classId').equals(classId)
        .filter(r => r.date >= start && r.date <= end && !r.deleted)
        .toArray();
};

export const saveAttendanceRecords = async (records: any[]) => {
    await db.transaction('rw', db.attendanceRecords, async () => {
        for (const r of records) {
            const existing = await db.attendanceRecords
                .where({ studentId: r.studentId, date: r.date })
                .first();
            
            if (existing) {
                if (existing.status !== r.status) {
                    await db.attendanceRecords.update(existing.id, { status: r.status, lastModified: Date.now(), isSynced: false });
                }
            } else {
                await db.attendanceRecords.add({ ...r, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false });
            }
        }
    });
    triggerSync('eduadmin_attendance');
};

// --- BK ---

export const getStudentViolations = async () => {
    return await db.violations.filter(v => !v.deleted).toArray();
};

export const addStudentViolation = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.violations.add(newItem);
    triggerSync('eduadmin_bk_violations');
};

export const deleteStudentViolation = async (id: string) => {
    await db.violations.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_bk_violations');
};

export const getStudentPointReductions = async () => {
    return await db.pointReductions.filter(r => !r.deleted).toArray();
};

export const addStudentPointReduction = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.pointReductions.add(newItem);
    triggerSync('eduadmin_bk_reductions');
};

export const deleteStudentPointReduction = async (id: string) => {
    await db.pointReductions.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_bk_reductions');
};

export const getStudentAchievements = async () => {
    return await db.achievements.filter(a => !a.deleted).toArray();
};

export const addStudentAchievement = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.achievements.add(newItem);
    triggerSync('eduadmin_bk_achievements');
};

export const deleteStudentAchievement = async (id: string) => {
    await db.achievements.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_bk_achievements');
};

export const getCounselingSessions = async () => {
    return await db.counselingSessions.filter(s => !s.deleted).toArray();
};

export const addCounselingSession = async (data: any) => {
    const newItem = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.counselingSessions.add(newItem);
    triggerSync('eduadmin_bk_counseling');
};

export const deleteCounselingSession = async (id: string) => {
    await db.counselingSessions.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_bk_counseling');
};

// --- TICKETS ---

export const getTickets = async (user: User) => {
    if (user.role === UserRole.ADMIN) {
        return await db.tickets.filter(t => !t.deleted).toArray();
    }
    return await db.tickets.where('userId').equals(user.id).filter(t => !t.deleted).toArray();
};

export const createTicket = async (user: User, subject: string, message: string) => {
    const ticket: Ticket = {
        id: crypto.randomUUID(),
        userId: user.id,
        teacherName: user.fullName,
        subject,
        status: 'OPEN',
        lastUpdated: new Date().toISOString(),
        messages: [{
            id: crypto.randomUUID(),
            senderRole: user.role,
            senderName: user.fullName,
            message,
            timestamp: new Date().toISOString()
        }],
        lastModified: Date.now(),
        isSynced: false
    };
    await db.tickets.add(ticket);
    triggerSync('eduadmin_tickets');
    return ticket;
};

export const replyTicket = async (ticketId: string, user: User, message: string) => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket) return false;
    
    const newMsg = {
        id: crypto.randomUUID(),
        senderRole: user.role,
        senderName: user.fullName,
        message,
        timestamp: new Date().toISOString()
    };
    
    const updates = {
        messages: [...ticket.messages, newMsg],
        lastUpdated: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    };
    
    await db.tickets.update(ticketId, updates);
    triggerSync('eduadmin_tickets');
    return true;
};

export const closeTicket = async (ticketId: string) => {
    await db.tickets.update(ticketId, { status: 'CLOSED', lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_tickets');
    return true;
};

// --- SETTINGS ---

export const getSystemSettings = async (): Promise<SystemSettings> => {
    const s = await db.systemSettings.get('global-settings');
    if (s) return s;
    return { id: 'global-settings', featureRppEnabled: true };
};

export const saveSystemSettings = async (settings: SystemSettings) => {
    await db.systemSettings.put({ ...settings, id: 'global-settings', lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_system_settings');
};

export const getEmailConfig = async () => {
    return await db.emailConfig.toCollection().first();
};

export const saveEmailConfig = async (config: any) => {
    const id = config.id || 'default';
    await db.emailConfig.put({ ...config, id, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_email_config');
    return true;
};

export const getWhatsAppConfig = async (userId: string) => {
    return await db.whatsappConfigs.get(userId);
};

export const saveWhatsAppConfig = async (config: WhatsAppConfig) => {
    await db.whatsappConfigs.put({ ...config, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_wa_configs');
};

export const getMasterSubjects = async () => {
    return await db.masterSubjects.filter(s => !s.deleted).toArray();
};

export const addMasterSubject = async (name: string, category: any, level: any) => {
    const newSub: MasterSubject = {
        id: crypto.randomUUID(),
        name,
        category,
        level,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.masterSubjects.add(newSub);
    triggerSync('eduadmin_master_subjects');
    return newSub;
};

export const deleteMasterSubject = async (id: string) => {
    await db.masterSubjects.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_master_subjects');
};

export const getBackupApiKeys = async () => {
    return await db.apiKeys.filter(k => !k.deleted).toArray();
};

export const addBackupApiKey = async (key: string) => {
    const newKey: ApiKey = {
        id: crypto.randomUUID(),
        key,
        provider: 'GEMINI',
        status: 'ACTIVE',
        addedAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    };
    await db.apiKeys.add(newKey);
    triggerSync('eduadmin_api_keys');
};

export const deleteBackupApiKey = async (id: string) => {
    await db.apiKeys.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_api_keys');
};

export const clearBackupApiKeys = async () => {
    await db.apiKeys.clear();
};

// --- NOTIFICATIONS ---

export const getNotifications = async (role: UserRole) => {
    return await db.notifications
        .filter(n => (n.targetRole === 'ALL' || n.targetRole === role) && !n.deleted)
        .reverse()
        .sortBy('createdAt');
};

export const createNotification = async (title: string, message: string, type: Notification['type'], targetRole: Notification['targetRole'], isPopup = false) => {
    const notif: Notification = {
        id: crypto.randomUUID(),
        title,
        message,
        type,
        targetRole,
        isRead: false,
        isPopup,
        createdAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    };
    await db.notifications.add(notif);
    triggerSync('eduadmin_notifications');
};

export const markNotificationAsRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
};

export const clearNotifications = async (role: UserRole) => {
    const toDelete = await db.notifications.filter(n => (n.targetRole === 'ALL' || n.targetRole === role)).keys();
    await db.notifications.bulkDelete(toDelete);
};

export const getActiveAnnouncements = async () => {
    return await db.notifications.filter(n => n.isPopup === true && !n.deleted).reverse().sortBy('createdAt');
};

export const deleteNotification = async (id: string) => {
    await db.notifications.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    triggerSync('eduadmin_notifications');
};

// --- SYNC & BACKUP ---

let syncTimeout: any = null;
const triggerSync = (collectionName: string, force = false) => {
    if (syncTimeout) clearTimeout(syncTimeout);
    
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(reg => {
            // @ts-ignore
            return reg.sync.register('sync-data');
        }).catch(() => {
            syncTimeout = setTimeout(() => syncAllData(), 5000);
        });
    } else {
        syncTimeout = setTimeout(() => syncAllData(), 5000);
    }
    
    window.dispatchEvent(new CustomEvent('unsaved-changes', { detail: true }));
};

export const syncAllData = async (forcePush = false) => {
    if (!navigator.onLine) return;
    
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));
    
    try {
        const collections = [
            { name: 'eduadmin_users', table: db.users },
            { name: 'eduadmin_classes', table: db.classes },
            { name: 'eduadmin_students', table: db.students },
            { name: 'eduadmin_scores', table: db.assessmentScores },
            { name: 'eduadmin_attendance', table: db.attendanceRecords },
            { name: 'eduadmin_journals', table: db.teachingJournals },
            { name: 'eduadmin_materials', table: db.scopeMaterials },
            { name: 'eduadmin_schedules', table: db.teachingSchedules },
            { name: 'eduadmin_bk_violations', table: db.violations },
            { name: 'eduadmin_bk_reductions', table: db.pointReductions },
            { name: 'eduadmin_bk_achievements', table: db.achievements },
            { name: 'eduadmin_bk_counseling', table: db.counselingSessions },
            { name: 'eduadmin_tickets', table: db.tickets },
            { name: 'eduadmin_system_settings', table: db.systemSettings },
            { name: 'eduadmin_notifications', table: db.notifications },
            { name: 'eduadmin_logs', table: db.logs },
            { name: 'eduadmin_master_subjects', table: db.masterSubjects },
            { name: 'eduadmin_wa_configs', table: db.whatsappConfigs },
            { name: 'eduadmin_email_config', table: db.emailConfig }
        ];

        for (const col of collections) {
            // PUSH
            const unsynced = await col.table.where('isSynced').equals(0).toArray(); 
            if (unsynced.length > 0 || forcePush) {
                const itemsToPush = forcePush ? await col.table.toArray() : unsynced;
                await pushToTurso(col.name, itemsToPush, forcePush);
                
                if (!forcePush) {
                    await db.transaction('rw', col.table, async () => {
                        for (const item of unsynced) {
                            await col.table.update((item as any).id || (item as any).userId, { isSynced: true });
                        }
                    });
                }
            }

            // PULL
            const allLocal = await col.table.toArray();
            const { items: merged, hasChanges } = await pullFromTurso(col.name, allLocal);
            if (hasChanges) {
                await db.transaction('rw', col.table, async () => {
                    await col.table.bulkPut(merged);
                });
            }
        }
        
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
        window.dispatchEvent(new CustomEvent('unsaved-changes', { detail: false }));

    } catch (e) {
        console.error("Sync Error:", e);
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
    }
};

export const runManualSync = async (direction: 'PUSH'|'PULL'|'FULL', logger: (msg: string) => void) => {
    logger("Sync Started...");
    await syncAllData();
    logger("Sync Completed.");
};

// --- MISC ---

export const checkSchoolNameByNpsn = async (npsn: string) => {
    try {
        const res = await fetch(`/api/check-npsn?npsn=${npsn}`);
        if (res.ok) return await res.json();
    } catch {
        return { found: false };
    }
    return { found: false };
};

export const sendWhatsAppBroadcast = async (config: WhatsAppConfig, recipients: any[], message: string) => {
    try {
        const res = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config, recipients, message })
        });
        return await res.json();
    } catch (e) {
        return { success: 0, failed: recipients.length, errors: ["Network Error"] };
    }
};

export const createBackup = async (user: User, semesterFilter?: string) => {
    const backup: BackupData = {
        meta: {
            version: '1.0',
            date: new Date().toISOString(),
            generatedBy: user.username,
            role: user.role,
            semesterFilter
        },
        data: {
            classes: [], students: [], scopeMaterials: [], assessmentScores: [], teachingJournals: [], attendanceRecords: []
        }
    };

    if (user.role === UserRole.ADMIN) {
        backup.data.users = await db.users.toArray();
        backup.data.classes = await db.classes.toArray();
        backup.data.students = await db.students.toArray();
        backup.data.scopeMaterials = await db.scopeMaterials.toArray();
        backup.data.assessmentScores = await db.assessmentScores.toArray();
        backup.data.teachingJournals = await db.teachingJournals.toArray();
        backup.data.attendanceRecords = await db.attendanceRecords.toArray();
    } else {
        backup.data.classes = await getClasses(user.id);
        const myClasses = backup.data.classes.map(c => c.id);
        backup.data.students = await db.students.where('classId').anyOf(myClasses).toArray();
        
        let scores = await db.assessmentScores.where('userId').equals(user.id).toArray();
        if (semesterFilter) scores = scores.filter(s => s.semester === semesterFilter);
        backup.data.assessmentScores = scores;

        let materials = await db.scopeMaterials.where('userId').equals(user.id).toArray();
        if (semesterFilter) materials = materials.filter(m => m.semester === semesterFilter);
        backup.data.scopeMaterials = materials;

        backup.data.teachingJournals = await getTeachingJournals(user.id);
    }

    return backup;
};

export const restoreBackup = async (backup: BackupData) => {
    try {
        await db.transaction('rw', db.classes, db.students, db.scopeMaterials, db.assessmentScores, db.teachingJournals, async () => {
            if (backup.data.classes) await db.classes.bulkPut(backup.data.classes.map(x => ({...x, isSynced: false})));
            if (backup.data.students) await db.students.bulkPut(backup.data.students.map(x => ({...x, isSynced: false})));
            if (backup.data.scopeMaterials) await db.scopeMaterials.bulkPut(backup.data.scopeMaterials.map(x => ({...x, isSynced: false})));
            if (backup.data.assessmentScores) await db.assessmentScores.bulkPut(backup.data.assessmentScores.map(x => ({...x, isSynced: false})));
            if (backup.data.teachingJournals) await db.teachingJournals.bulkPut(backup.data.teachingJournals.map(x => ({...x, isSynced: false})));
        });
        triggerSync('eduadmin_users'); 
        return { success: true, message: "Restore berhasil." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const resetSystemData = async (scope: 'SEMESTER' | 'ALL', semester?: string) => {
    if (scope === 'ALL') {
        await db.students.clear();
        await db.classes.clear();
        await db.assessmentScores.clear();
        await db.teachingJournals.clear();
        await db.scopeMaterials.clear();
        await db.teachingSchedules.clear();
        await db.attendanceRecords.clear();
        await db.violations.clear();
        await db.pointReductions.clear();
        await db.achievements.clear();
        await db.counselingSessions.clear();
        
        try {
            await fetch('/api/turso', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset', scope })
            });
        } catch {}
        
        return { success: true, message: "System Reset." };
    }
    
    return { success: true, message: "Done." };
};