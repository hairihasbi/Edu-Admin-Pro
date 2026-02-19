
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

// --- INITIALIZATION ---

export const initDatabase = async () => {
  if (!(db as any).isOpen()) {
    await (db as any).open();
  }
  
  // Try to sync on init if online
  if (navigator.onLine) {
      initTurso().catch(console.error);
  }
};

// --- AUTHENTICATION ---

export const loginUser = async (username: string, password: string): Promise<User | null> => {
    // 1. Try Online Login via API
    if (navigator.onLine) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                const user = data.user;
                // Update local DB with latest user data
                await db.users.put(user);
                return user;
            }
        } catch (e) {
            console.warn("Online login failed, trying offline:", e);
        }
    }

    // 2. Offline Fallback
    const user = await db.users.where('username').equals(username).first();
    if (user && user.password && user.status === 'ACTIVE') {
        const isValid = user.password.startsWith('$2') 
            ? await bcrypt.compare(password, user.password)
            : user.password === password; // Legacy/Default plain text
            
        if (isValid) return user;
    }
    return null;
};

export const registerUser = async (fullName: string, username: string, password: string, email: string, phone: string, schoolNpsn: string, schoolName: string, subject: string = ''): Promise<{success: boolean, message: string}> => {
    if (!navigator.onLine) return { success: false, message: "Pendaftaran membutuhkan koneksi internet." };

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = `user-${Date.now()}`; // Temp ID, will be used in DB
    const newUser: User = {
        id,
        username,
        password: hashedPassword,
        fullName,
        email,
        phone,
        schoolNpsn,
        schoolName,
        role: UserRole.GURU,
        status: 'PENDING',
        subject,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });

        if (response.ok) {
            return { success: true, message: "Pendaftaran berhasil! Tunggu verifikasi Admin." };
        } else {
            const err = await response.json();
            return { success: false, message: err.error || "Gagal mendaftar." };
        }
    } catch (e: any) {
        return { success: false, message: e.message || "Gagal menghubungi server." };
    }
};

export const resetPassword = async (username: string, newPass: string): Promise<boolean> => {
    const user = await db.users.where('username').equals(username).first();
    if (!user) return false;
    
    const hashedPassword = await bcrypt.hash(newPass, 10);
    await db.users.update(user.id, {
        password: hashedPassword,
        lastModified: Date.now(),
        isSynced: false
    });
    
    await syncAllData(); // Push change immediately
    return true;
};

// --- USER MANAGEMENT ---

export const updateUserProfile = async (id: string, data: Partial<User>): Promise<boolean> => {
    try {
        await db.users.update(id, { ...data, lastModified: Date.now(), isSynced: false });
        // Sync immediately if online
        if (navigator.onLine) syncAllData();
        return true;
    } catch { return false; }
};

export const updateUserPassword = async (id: string, newPass: string): Promise<boolean> => {
    const hashedPassword = await bcrypt.hash(newPass, 10);
    return updateUserProfile(id, { password: hashedPassword });
};

export const getTeachers = async (): Promise<User[]> => {
    return await db.users.where('role').equals(UserRole.GURU).filter(u => u.status === 'ACTIVE' && !u.deleted).toArray();
};

export const getPendingTeachers = async (): Promise<User[]> => {
    return await db.users.where('role').equals(UserRole.GURU).filter(u => u.status === 'PENDING' && !u.deleted).toArray();
};

export const approveTeacher = async (id: string): Promise<boolean> => {
    await db.users.update(id, { status: 'ACTIVE', lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
    return true;
};

export const rejectTeacher = async (id: string): Promise<boolean> => {
    await deleteTeacher(id); // Soft delete or hard delete? Usually reject means delete.
    return true;
};

export const deleteTeacher = async (id: string): Promise<boolean> => {
    await db.users.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
    return true;
};

// --- CLASSES ---

export const getClasses = async (userId: string): Promise<ClassRoom[]> => {
    return await db.classes.where('userId').equals(userId).filter(c => !c.deleted).toArray();
};

export const getAllClasses = async (): Promise<ClassRoom[]> => {
    return await db.classes.filter(c => !c.deleted).toArray();
};

export const addClass = async (userId: string, name: string, description: string): Promise<ClassRoom> => {
    // Get School NPSN from user
    const user = await db.users.get(userId);
    const schoolNpsn = user?.schoolNpsn || 'DEFAULT';

    const newClass: ClassRoom = {
        id: `cls-${Date.now()}`,
        userId,
        schoolNpsn,
        name: sanitizeInput(name),
        description: sanitizeInput(description),
        studentCount: 0,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.classes.add(newClass);
    if(navigator.onLine) syncAllData();
    return newClass;
};

export const deleteClass = async (id: string): Promise<void> => {
    await db.classes.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    // Also delete students in this class?
    const students = await db.students.where('classId').equals(id).toArray();
    await bulkDeleteStudents(students.map(s => s.id));
    if(navigator.onLine) syncAllData();
};

// --- STUDENTS ---

export const getStudents = async (classId: string): Promise<Student[]> => {
    return await db.students.where('classId').equals(classId).filter(s => !s.deleted).toArray();
};

export const getAllStudentsWithDetails = async (): Promise<StudentWithDetails[]> => {
    const students = await db.students.filter(s => !s.deleted).toArray();
    // Join with classes and teachers manually
    const classes = await db.classes.toArray();
    const teachers = await db.users.toArray();
    
    // Explicitly type maps to avoid 'unknown' errors
    const classMap = new Map<string, ClassRoom>(classes.map(c => [c.id, c] as [string, ClassRoom]));
    const teacherMap = new Map<string, User>(teachers.map(t => [t.id, t] as [string, User]));

    return students.map(s => {
        const cls = classMap.get(s.classId);
        const teacher = cls ? teacherMap.get(cls.userId) : null;
        return {
            ...s,
            className: cls?.name || 'Unknown',
            teacherName: teacher?.fullName || 'Unknown',
            schoolName: teacher?.schoolName || 'Unknown'
        };
    });
};

export const addStudent = async (classId: string, name: string, nis: string, gender: 'L' | 'P', phone?: string): Promise<Student> => {
    const cls = await db.classes.get(classId);
    const schoolNpsn = cls?.schoolNpsn || 'DEFAULT';

    const newStudent: Student = {
        id: `std-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        classId,
        schoolNpsn,
        name: sanitizeInput(name),
        nis: sanitizeInput(nis),
        gender,
        phone: sanitizeInput(phone),
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.students.add(newStudent);
    // Update class count
    if (cls) {
        await db.classes.update(classId, { studentCount: (cls.studentCount || 0) + 1, lastModified: Date.now(), isSynced: false });
    }
    if(navigator.onLine) syncAllData();
    return newStudent;
};

export const deleteStudent = async (id: string): Promise<void> => {
    const student = await db.students.get(id);
    if (student) {
        await db.students.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
        const cls = await db.classes.get(student.classId);
        if (cls) {
            await db.classes.update(student.classId, { studentCount: Math.max(0, (cls.studentCount || 0) - 1), lastModified: Date.now(), isSynced: false });
        }
        if(navigator.onLine) syncAllData();
    }
};

export const bulkDeleteStudents = async (ids: string[]): Promise<void> => {
    for (const id of ids) {
        await deleteStudent(id);
    }
};

export const importStudentsFromCSV = async (classId: string, csvText: string): Promise<{success: boolean, count: number, errors: string[]}> => {
    const lines = csvText.split('\n');
    let count = 0;
    const errors: string[] = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV parse (handling quotes roughly)
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length < 3) {
            errors.push(`Line ${i+1}: Format salah`);
            continue;
        }
        
        const name = parts[0].replace(/^"|"$/g, '').trim();
        const nis = parts[1].replace(/^['"]|['"]$/g, '').trim();
        const genderRaw = parts[2].replace(/^"|"$/g, '').trim().toUpperCase();
        const phone = parts[3] ? parts[3].replace(/^['"]|['"]$/g, '').trim() : '';
        
        const gender = (genderRaw === 'L' || genderRaw === 'LAKI-LAKI') ? 'L' : 'P';
        
        if (name && nis) {
            await addStudent(classId, name, nis, gender, phone);
            count++;
        }
    }
    return { success: true, count, errors };
};

// --- ACADEMIC & STATS ---

export const getDashboardStats = async (user: User): Promise<DashboardStatsData> => {
    let classesCount = 0;
    let studentsCount = 0;
    let filledJournals = 0;
    
    if (user.role === UserRole.ADMIN) {
        // Admin sees global stats (locally available ones)
        classesCount = await db.classes.filter(x => !x.deleted).count();
        studentsCount = await db.students.filter(x => !x.deleted).count();
        filledJournals = await db.teachingJournals.filter(x => !x.deleted).count();
    } else {
        // Teacher sees own stats
        classesCount = await db.classes.where('userId').equals(user.id).filter(x => !x.deleted).count();
        // Students in teacher's classes
        const myClasses = await db.classes.where('userId').equals(user.id).primaryKeys();
        studentsCount = await db.students.where('classId').anyOf(myClasses as string[]).filter(x => !x.deleted).count();
        filledJournals = await db.teachingJournals.where('userId').equals(user.id).filter(x => !x.deleted).count();
    }

    // Attendance Calculation (Simple)
    const totalAttendance = await db.attendanceRecords.filter(x => !x.deleted).count();
    const present = await db.attendanceRecords.filter(x => x.status === 'H' && !x.deleted).count();
    const attendanceRate = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0;

    // Gender Distribution
    let males = 0;
    let females = 0;
    if (user.role === UserRole.ADMIN) {
        males = await db.students.filter(s => s.gender === 'L' && !s.deleted).count();
        females = await db.students.filter(s => s.gender === 'P' && !s.deleted).count();
    } else {
        const myClasses = await db.classes.where('userId').equals(user.id).primaryKeys();
        males = await db.students.where('classId').anyOf(myClasses as string[]).filter(s => s.gender === 'L' && !s.deleted).count();
        females = await db.students.where('classId').anyOf(myClasses as string[]).filter(s => s.gender === 'P' && !s.deleted).count();
    }

    return {
        totalClasses: classesCount,
        totalStudents: studentsCount,
        filledJournals: filledJournals,
        attendanceRate: attendanceRate,
        genderDistribution: [
            { name: 'Laki-laki', value: males },
            { name: 'Perempuan', value: females }
        ],
        weeklyAttendance: [] // Placeholder
    };
};

export const getTeachingSchedules = async (userId: string): Promise<TeachingSchedule[]> => {
    return await db.teachingSchedules.where('userId').equals(userId).filter(s => !s.deleted).toArray();
};

export const addTeachingSchedule = async (schedule: any): Promise<TeachingSchedule> => {
    const newSchedule = {
        ...schedule,
        id: `sch-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.teachingSchedules.add(newSchedule);
    if(navigator.onLine) syncAllData();
    return newSchedule;
};

export const deleteTeachingSchedule = async (id: string): Promise<void> => {
    await db.teachingSchedules.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getActiveAnnouncements = async (): Promise<Notification[]> => {
    // Only return popups
    return await db.notifications.filter(n => n.isPopup === true && !n.deleted).reverse().toArray();
};

export const getNotifications = async (role: UserRole): Promise<Notification[]> => {
    return await db.notifications.filter(n => (n.targetRole === 'ALL' || n.targetRole === role) && !n.deleted).reverse().toArray();
};

export const createNotification = async (title: string, message: string, type: any, targetRole: any, isPopup: boolean = false): Promise<void> => {
    const notif: Notification = {
        id: `notif-${Date.now()}`,
        title,
        message,
        type,
        targetRole,
        isRead: false,
        isPopup,
        createdAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.notifications.add(notif);
    if(navigator.onLine) syncAllData();
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
    await db.notifications.update(id, { isRead: true });
};

export const clearNotifications = async (role: UserRole): Promise<void> => {
    const notifs = await getNotifications(role);
    // Soft delete
    await Promise.all(notifs.map(n => db.notifications.update(n.id, { deleted: true })));
};

export const deleteNotification = async (id: string): Promise<void> => {
    await db.notifications.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

// ... (System Settings, System Logs, Master Subjects, etc.)

export const getSystemSettings = async (): Promise<SystemSettings> => {
    const settings = await db.systemSettings.get('global-settings');
    if (!settings) {
        return { id: 'global-settings', featureRppEnabled: true, maintenanceMessage: '' };
    }
    return settings;
};

export const saveSystemSettings = async (settings: SystemSettings): Promise<void> => {
    await db.systemSettings.put({ ...settings, id: 'global-settings', lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getSystemLogs = async (): Promise<LogEntry[]> => {
    return await db.logs.filter(l => !l.deleted).toArray();
};

export const addSystemLog = async (level: any, actor: string, role: string, action: string, details: string): Promise<void> => {
    await db.logs.add({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level, actor, role, action, details,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    });
    if(navigator.onLine) syncAllData();
};

export const clearSystemLogs = async (): Promise<void> => {
    const logs = await db.logs.toArray();
    await Promise.all(logs.map(l => db.logs.update(l.id, { deleted: true })));
};

export const getMasterSubjects = async (): Promise<MasterSubject[]> => {
    return await db.masterSubjects.filter(m => !m.deleted).toArray();
};

export const addMasterSubject = async (name: string, category: any, level: any): Promise<MasterSubject> => {
    const newSub: MasterSubject = {
        id: `sub-${Date.now()}`,
        name, category, level,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.masterSubjects.add(newSub);
    if(navigator.onLine) syncAllData();
    return newSub;
};

export const deleteMasterSubject = async (id: string): Promise<void> => {
    await db.masterSubjects.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getEmailConfig = async (): Promise<EmailConfig | undefined> => {
    return await db.emailConfig.get('default');
};

export const saveEmailConfig = async (config: EmailConfig): Promise<boolean> => {
    // Add lastModified and isSynced flags for proper sync tracking
    const configToSave = { 
        ...config, 
        id: 'default',
        lastModified: Date.now(),
        isSynced: false 
    };
    await db.emailConfig.put(configToSave);
    
    // Trigger sync immediately if online
    if(navigator.onLine) syncAllData();
    
    return true;
};

export const getWhatsAppConfig = async (userId: string): Promise<WhatsAppConfig | undefined> => {
    return await db.whatsappConfigs.get(userId);
};

export const saveWhatsAppConfig = async (config: WhatsAppConfig): Promise<void> => {
    // Ensure all changes trigger sync
    await db.whatsappConfigs.put({ ...config, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getBackupApiKeys = async (): Promise<ApiKey[]> => {
    return await db.apiKeys.filter(k => !k.deleted).toArray();
};

export const addBackupApiKey = async (key: string): Promise<void> => {
    await db.apiKeys.add({
        id: `key-${Date.now()}`,
        key,
        provider: 'GEMINI',
        status: 'ACTIVE',
        addedAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    });
    if(navigator.onLine) syncAllData();
};

export const deleteBackupApiKey = async (id: string): Promise<void> => {
    await db.apiKeys.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const clearBackupApiKeys = async (): Promise<void> => {
    const keys = await db.apiKeys.toArray();
    await Promise.all(keys.map(k => db.apiKeys.update(k.id, { deleted: true })));
    if(navigator.onLine) syncAllData();
};

// --- ACADEMIC: SCOPE MATERIAL, JOURNALS, SCORES ---

export const getScopeMaterials = async (classId: string, semester: string, userId: string): Promise<ScopeMaterial[]> => {
    return await db.scopeMaterials.where({ classId, semester, userId }).filter(m => !m.deleted).toArray();
};

export const addScopeMaterial = async (data: any): Promise<ScopeMaterial> => {
    const newItem = {
        ...data,
        id: `mat-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.scopeMaterials.add(newItem);
    if(navigator.onLine) syncAllData();
    return newItem;
};

export const deleteScopeMaterial = async (id: string): Promise<void> => {
    await db.scopeMaterials.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const bulkDeleteScopeMaterials = async (ids: string[]): Promise<void> => {
    for(const id of ids) await deleteScopeMaterial(id);
};

export const copyScopeMaterials = async (fromClassId: string, toClassId: string, fromSemester: string, toSemester: string, userId: string, subject: string): Promise<boolean> => {
    const sources = await db.scopeMaterials.where({ classId: fromClassId, semester: fromSemester, userId }).filter(m => !m.deleted).toArray();
    if (sources.length === 0) return false;

    const newItems = sources.map(s => ({
        id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        classId: toClassId,
        userId,
        subject,
        semester: toSemester,
        code: s.code,
        phase: s.phase,
        content: s.content,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    }));
    
    await db.scopeMaterials.bulkAdd(newItems as any);
    if(navigator.onLine) syncAllData();
    return true;
};

export const getTeachingJournals = async (userId: string): Promise<TeachingJournal[]> => {
    return await db.teachingJournals.where('userId').equals(userId).filter(j => !j.deleted).reverse().toArray();
};

export const addTeachingJournal = async (data: any): Promise<TeachingJournal> => {
    const newItem = {
        ...data,
        id: `jrn-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.teachingJournals.add(newItem);
    if(navigator.onLine) syncAllData();
    return newItem;
};

export const deleteTeachingJournal = async (id: string): Promise<void> => {
    await db.teachingJournals.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const bulkDeleteTeachingJournals = async (ids: string[]): Promise<void> => {
    for(const id of ids) await deleteTeachingJournal(id);
};

export const getAssessmentScores = async (classId: string, semester: string): Promise<AssessmentScore[]> => {
    return await db.assessmentScores.where({ classId, semester }).filter(s => !s.deleted).toArray();
};

export const saveBulkAssessmentScores = async (scores: any[], userId: string, userName: string): Promise<void> => {
    const timestamp = Date.now();
    for (const score of scores) {
        // Find existing score by composite key simulation (student+category+material+semester)
        const existing = await db.assessmentScores
            .where({ studentId: score.studentId, category: score.category, semester: score.semester })
            .filter(s => s.materialId === score.materialId && s.subject === score.subject)
            .first();

        if (existing) {
            await db.assessmentScores.update(existing.id, {
                score: score.score,
                lastModified: timestamp,
                isSynced: false,
                version: (existing.version || 1) + 1
            });
        } else {
            await db.assessmentScores.add({
                ...score,
                id: `scr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                userId,
                lastModified: timestamp,
                isSynced: false,
                version: 1
            });
        }
    }
    await addSystemLog('SUCCESS', userName, 'GURU', 'Update Score', `Saved ${scores.length} scores.`);
    if(navigator.onLine) syncAllData();
};

export const getAttendanceRecords = async (classId: string, month: number, year: number): Promise<AttendanceRecord[]> => {
    // Filter by date range in JS since date is string YYYY-MM-DD
    const all = await db.attendanceRecords.where('classId').equals(classId).filter(r => !r.deleted).toArray();
    return all.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
};

export const saveAttendanceRecords = async (records: any[]): Promise<void> => {
    for (const rec of records) {
        const existing = await db.attendanceRecords.where({ studentId: rec.studentId, date: rec.date }).first();
        if (existing) {
            await db.attendanceRecords.update(existing.id, { status: rec.status, lastModified: Date.now(), isSynced: false });
        } else {
            await db.attendanceRecords.add({
                ...rec,
                id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                lastModified: Date.now(),
                isSynced: false,
                version: 1
            });
        }
    }
    if(navigator.onLine) syncAllData();
};

// --- BK & HELP CENTER ---

export const createTicket = async (user: User, subject: string, message: string): Promise<Ticket> => {
    const ticket: Ticket = {
        id: `tkt-${Date.now()}`,
        userId: user.id,
        teacherName: user.fullName,
        subject,
        status: 'OPEN',
        lastUpdated: new Date().toISOString(),
        messages: [{
            id: `msg-${Date.now()}`,
            senderRole: user.role,
            senderName: user.fullName,
            message,
            timestamp: new Date().toISOString()
        }],
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    };
    await db.tickets.add(ticket);
    if(navigator.onLine) syncAllData();
    return ticket;
};

export const getTickets = async (user: User): Promise<Ticket[]> => {
    if (user.role === UserRole.ADMIN) {
        return await db.tickets.filter(t => !t.deleted).toArray();
    } else {
        return await db.tickets.where('userId').equals(user.id).filter(t => !t.deleted).toArray();
    }
};

export const replyTicket = async (ticketId: string, user: User, message: string): Promise<boolean> => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket) return false;

    const newMsg: TicketMessage = {
        id: `msg-${Date.now()}`,
        senderRole: user.role,
        senderName: user.fullName,
        message,
        timestamp: new Date().toISOString()
    };

    const updatedMessages = [...ticket.messages, newMsg];
    await db.tickets.update(ticketId, {
        messages: updatedMessages,
        lastUpdated: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    });
    if(navigator.onLine) syncAllData();
    return true;
};

export const closeTicket = async (id: string): Promise<boolean> => {
    await db.tickets.update(id, { status: 'CLOSED', lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
    return true;
};

export const getStudentViolations = async (): Promise<StudentViolation[]> => {
    return await db.violations.filter(v => !v.deleted).toArray();
};

export const addStudentViolation = async (data: any): Promise<void> => {
    await db.violations.add({
        ...data,
        id: `viol-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    });
    if(navigator.onLine) syncAllData();
};

export const deleteStudentViolation = async (id: string): Promise<void> => {
    await db.violations.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getStudentPointReductions = async (): Promise<StudentPointReduction[]> => {
    return await db.pointReductions.filter(r => !r.deleted).toArray();
};

export const addStudentPointReduction = async (data: any): Promise<void> => {
    await db.pointReductions.add({
        ...data,
        id: `red-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    });
    if(navigator.onLine) syncAllData();
};

export const deleteStudentPointReduction = async (id: string): Promise<void> => {
    await db.pointReductions.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getStudentAchievements = async (): Promise<StudentAchievement[]> => {
    return await db.achievements.filter(a => !a.deleted).toArray();
};

export const addStudentAchievement = async (data: any): Promise<void> => {
    await db.achievements.add({
        ...data,
        id: `ach-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    });
    if(navigator.onLine) syncAllData();
};

export const deleteStudentAchievement = async (id: string): Promise<void> => {
    await db.achievements.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

export const getCounselingSessions = async (): Promise<CounselingSession[]> => {
    return await db.counselingSessions.filter(s => !s.deleted).toArray();
};

export const addCounselingSession = async (data: any): Promise<void> => {
    await db.counselingSessions.add({
        ...data,
        id: `sess-${Date.now()}`,
        lastModified: Date.now(),
        isSynced: false,
        version: 1
    });
    if(navigator.onLine) syncAllData();
};

export const deleteCounselingSession = async (id: string): Promise<void> => {
    await db.counselingSessions.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    if(navigator.onLine) syncAllData();
};

// --- SYNC & BACKUP ---

export const getSyncStats = async (user: User) => {
    // ... existing implementation ...
    let tablesToCheck = ['users', 'classes', 'students', 'scores', 'attendance', 'journals', 'materials', 'schedules', 'violations', 'reductions', 'achievements', 'counseling', 'tickets', 'notifications'];
    
    let totalUnsynced = 0;
    const stats: {table: string, count: number}[] = [];

    // Map internal Dexie table objects
    const tableMap: any = {
        'users': db.users, 'classes': db.classes, 'students': db.students, 'scores': db.assessmentScores,
        'attendance': db.attendanceRecords, 'journals': db.teachingJournals, 'materials': db.scopeMaterials,
        'schedules': db.teachingSchedules, 'violations': db.violations, 'reductions': db.pointReductions,
        'achievements': db.achievements, 'counseling': db.counselingSessions, 'tickets': db.tickets, 'notifications': db.notifications
    };

    for (const name of tablesToCheck) {
        const table = tableMap[name] as Table<any, any>;
        // Filter by user role if needed (e.g. teacher only sees their unsynced data) - for now simpler global check
        const count = await table.filter(i => !i.isSynced).count();
        if (count > 0) {
            stats.push({ table: name, count });
            totalUnsynced += count;
        }
    }

    return { stats, totalUnsynced };
};

export const syncAllData = async (force = false) => {
    if (!navigator.onLine) return;
    
    // List of tables to sync (Order matters for foreign keys)
    // ADDED: eduadmin_wa_configs, eduadmin_system_settings, eduadmin_api_keys, eduadmin_master_subjects, eduadmin_email_config
    const collections = [
        { table: db.users, name: 'eduadmin_users' },
        { table: db.classes, name: 'eduadmin_classes' },
        { table: db.students, name: 'eduadmin_students' },
        { table: db.scopeMaterials, name: 'eduadmin_materials' },
        { table: db.assessmentScores, name: 'eduadmin_scores' },
        { table: db.attendanceRecords, name: 'eduadmin_attendance' },
        { table: db.teachingJournals, name: 'eduadmin_journals' },
        { table: db.teachingSchedules, name: 'eduadmin_schedules' },
        { table: db.violations, name: 'eduadmin_bk_violations' },
        { table: db.pointReductions, name: 'eduadmin_bk_reductions' },
        { table: db.achievements, name: 'eduadmin_bk_achievements' },
        { table: db.counselingSessions, name: 'eduadmin_bk_counseling' },
        { table: db.tickets, name: 'eduadmin_tickets' },
        { table: db.notifications, name: 'eduadmin_notifications' },
        { table: db.systemSettings, name: 'eduadmin_system_settings' },
        { table: db.whatsappConfigs, name: 'eduadmin_wa_configs' },
        { table: db.apiKeys, name: 'eduadmin_api_keys' },
        { table: db.logs, name: 'eduadmin_logs' },
        { table: db.masterSubjects, name: 'eduadmin_master_subjects' },
        { table: db.emailConfig, name: 'eduadmin_email_config' } 
    ];

    for (const col of collections) {
        // PUSH
        const unsynced = await col.table.filter(i => !i.isSynced).toArray();
        if (unsynced.length > 0 || force) {
            await pushToTurso(col.name, unsynced, force);
            
            // Fix: Use bulkPut instead of bulkUpdate
            const updatedItems = unsynced.map(item => ({ ...item, isSynced: true }));
            await (col.table as any).bulkPut(updatedItems);
        }

        // PULL
        const localItems = await col.table.toArray();
        const { items, hasChanges } = await pullFromTurso(col.name, localItems);
        if (hasChanges) {
            await (col.table as any).bulkPut(items);
        }
    }
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
};

export const runManualSync = async (direction: 'PUSH' | 'PULL' | 'FULL', logFn: (msg: string) => void) => {
    logFn(`Starting ${direction} Sync...`);
    try {
        await syncAllData(direction === 'FULL');
        logFn('Sync Completed Successfully.');
    } catch (e: any) {
        logFn(`Sync Failed: ${e.message}`);
    }
};

export const resetSystemData = async (scope: 'SEMESTER' | 'ALL', semester?: string): Promise<{success: boolean, message: string}> => { 
    try { 
        // 1. Perform Remote Hard Reset First (REALTIME API)
        if (navigator.onLine) {
            const userStr = localStorage.getItem('eduadmin_user');
            const token = userStr ? JSON.parse(userStr).id : '';
            
            try {
                const response = await fetch('/api/turso', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ 
                        action: 'reset', 
                        scope: semester === 'FULL_YEAR' ? 'FULL_YEAR' : scope, 
                        semester 
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Gagal melakukan reset di server.");
                }
            } catch (apiError: any) {
                console.error("Server Reset Error:", apiError);
                return { success: false, message: `Gagal menghapus data server: ${apiError.message}. Cek koneksi.` };
            }
        } else {
            return { success: false, message: "Koneksi internet diperlukan untuk melakukan reset database (Hard Delete)." };
        }

        // 2. Perform Local Cleanup (Dexie)
        if (scope === 'ALL') { 
            // Factory Reset Logic
            const admins = await db.users.where('role').equals(UserRole.ADMIN).toArray(); 
            
            // Clear Local - No Soft Delete Needed as Server is Wiped
            // Fix: cast db to any to access tables property if types are missing
            await Promise.all((db as any).tables.map((table: Table) => table.clear()));
            
            // Restore Admin
            await db.users.bulkAdd(admins); 
            
            return { success: true, message: 'Database (Cloud & Lokal) berhasil di-reset total.' }; 
        } 
        
        if (scope === 'SEMESTER') { 
            if (semester === 'FULL_YEAR') {
               // Full Year Reset: Clear Students, Classes, Academic Data Locally
               await db.students.clear();
               await db.classes.clear();
               await db.assessmentScores.clear();
               await db.attendanceRecords.clear();
               await db.teachingJournals.clear();
               await db.scopeMaterials.clear();
               await db.teachingSchedules.clear();
               
               // Clear BK Data
               await db.violations.clear();
               await db.pointReductions.clear();
               await db.achievements.clear();
               await db.counselingSessions.clear();

               return { success: true, message: "Data Tahun Ajaran (Server & Lokal) berhasil direset." };
            }

            // Semester Reset: Clear only specific semester data locally
            if (semester) {
                const scoresToDelete = await db.assessmentScores.where('semester').equals(semester).primaryKeys(); 
                if (scoresToDelete.length > 0) await db.assessmentScores.bulkDelete(scoresToDelete);
                
                const materialsToDelete = await db.scopeMaterials.where('semester').equals(semester).primaryKeys(); 
                if (materialsToDelete.length > 0) await db.scopeMaterials.bulkDelete(materialsToDelete);
                
                return { success: true, message: `Data semester ${semester} berhasil dihapus dari Server & Lokal.` }; 
            }
        } 
        
        return { success: false, message: 'Invalid Scope' }; 
    } catch (e: any) { 
        console.error("Reset Error:", e); 
        return { success: false, message: e.message || 'Gagal mereset data.' }; 
    } 
};

export const createBackup = async (user: User, semesterFilter?: string): Promise<BackupData | null> => {
    // Simplified Backup logic
    try {
        const meta = {
            version: '1.0',
            date: new Date().toISOString(),
            generatedBy: user.fullName,
            role: user.role,
            semesterFilter
        };

        let data: any = {};
        
        if (user.role === UserRole.ADMIN) {
            // Full Dump
            data.users = await db.users.toArray();
            data.classes = await db.classes.toArray();
            data.students = await db.students.toArray();
            data.scopeMaterials = await db.scopeMaterials.toArray();
            data.assessmentScores = await db.assessmentScores.toArray();
            data.teachingJournals = await db.teachingJournals.toArray();
            // ... and so on
        } else {
            // Teacher Dump
            data.classes = await db.classes.where('userId').equals(user.id).toArray();
            const classIds = data.classes.map((c: any) => c.id);
            data.students = await db.students.where('classId').anyOf(classIds).toArray();
            data.scopeMaterials = await db.scopeMaterials.where('userId').equals(user.id).toArray();
            data.teachingJournals = await db.teachingJournals.where('userId').equals(user.id).toArray();
            data.assessmentScores = await db.assessmentScores.where('userId').equals(user.id).toArray();
        }

        return { meta, data };
    } catch (e) {
        console.error("Backup failed", e);
        return null;
    }
};

export const restoreBackup = async (backup: BackupData): Promise<{success: boolean, message: string}> => {
    try {
        const { data } = backup;
        
        if (data.users) await db.users.bulkPut(data.users);
        if (data.classes) await db.classes.bulkPut(data.classes);
        if (data.students) await db.students.bulkPut(data.students);
        if (data.scopeMaterials) await db.scopeMaterials.bulkPut(data.scopeMaterials);
        if (data.assessmentScores) await db.assessmentScores.bulkPut(data.assessmentScores);
        if (data.teachingJournals) await db.teachingJournals.bulkPut(data.teachingJournals);
        
        return { success: true, message: "Data berhasil dipulihkan." };
    } catch (e: any) {
        return { success: false, message: e.message || "Gagal restore." };
    }
};

export const sendApprovalEmail = async (user: User): Promise<{success: boolean, message: string}> => {
    const config = await getEmailConfig();
    if (!config || !config.isActive) return { success: false, message: "Email config missing or inactive." };

    try {
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, config })
        });
        return await res.json();
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const sendWhatsAppBroadcast = async (config: WhatsAppConfig, recipients: any[], message: string): Promise<{success: number, failed: number}> => {
    try {
        const res = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config, recipients, message })
        });
        return await res.json();
    } catch (e) {
        return { success: 0, failed: recipients.length };
    }
};

export const checkSchoolNameByNpsn = async (npsn: string) => {
    try {
        const response = await fetch(`/api/check-npsn?npsn=${npsn}`);
        return await response.json();
    } catch (e) {
        return { found: false };
    }
};

export const getStudentsServerSide = async (page: number, limit: number, search: string, school: string, teacherId: string) => {
    try {
        const userStr = localStorage.getItem('eduadmin_user');
        const token = userStr ? JSON.parse(userStr).id : '';
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            search,
            school,
            teacherId
        });
        
        const response = await fetch(`/api/students?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401) return { status: 401 };
        return await response.json();
    } catch (e) {
        return { status: 500, data: [], meta: { total: 0, totalPages: 0 } };
    }
};
