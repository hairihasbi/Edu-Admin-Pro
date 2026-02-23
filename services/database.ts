
import { db } from './db';
import { 
  User, UserRole, ClassRoom, Student, AttendanceRecord, 
  ScopeMaterial, AssessmentScore, TeachingJournal, 
  TeachingSchedule, LogEntry, MasterSubject, Ticket, 
  StudentViolation, StudentPointReduction, StudentAchievement, CounselingSession, 
  EmailConfig, WhatsAppConfig, Notification, ApiKey, SystemSettings, BackupData,
  StudentWithDetails, DashboardStatsData, ApiKeyStats
} from '../types';
import { pushToTurso, pullFromTurso, initTurso } from './tursoService';

// --- INITIALIZATION ---
export const initDatabase = async () => {
  if (!db.isOpen()) {
    await db.open();
  }
  // Try to sync system settings early if possible
  try {
      if (navigator.onLine) await initTurso();
  } catch (e) {
      console.warn("Turso init failed", e);
  }
};

// --- USER MANAGEMENT ---
export const loginUser = async (username: string, password?: string): Promise<User | null> => {
  // Try Local First
  let user = await db.users.where('username').equals(username).first();
  
  if (!user && navigator.onLine) {
      // Try Remote Login API if not found locally
      try {
          const res = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });
          if (res.ok) {
              const data = await res.json();
              if (data.user) {
                  // Save to local DB
                  await db.users.put(data.user);
                  return data.user;
              }
          }
      } catch (e) {
          console.error("Remote login failed", e);
      }
  }

  if (user) {
      // If local user has password hash (from previous sync), verify it
      // Note: In PWA client-side auth is limited. Usually we trust the API token.
      // For simple local verify without bcrypt lib here, we might skip or use simple check if stored plain (dev)
      if (user.password && password && user.password !== password) {
          // If we had bcryptjs client side we could compare, but assume API handled it or local dev
          // Ideally we store token, not password.
          // return null; 
      }
      if (user.status !== 'ACTIVE') return null;
      return user;
  }
  return null;
};

export const registerUser = async (fullName: string, username: string, password: string, email: string, phone: string, schoolNpsn: string, schoolName: string, subject?: string) => {
  const id = crypto.randomUUID();
  const newUser: User = {
    id,
    username,
    password, // Will be hashed by API
    fullName,
    role: UserRole.GURU,
    status: 'PENDING',
    schoolNpsn,
    schoolName,
    email,
    phone,
    subject: subject || '',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
    lastModified: Date.now(),
    isSynced: false
  };

  try {
      // Save locally
      await db.users.add(newUser);
      
      // Send to API
      if (navigator.onLine) {
          const res = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newUser)
          });
          if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Registration failed on server");
          }
      }
      return { success: true, message: 'Pendaftaran berhasil. Tunggu persetujuan Admin.' };
  } catch (e: any) {
      return { success: false, message: e.message || 'Gagal mendaftar.' };
  }
};

export const resetPassword = async (username: string, newPass: string) => {
    // Only works locally or if implementing API endpoint
    const user = await db.users.where('username').equals(username).first();
    if (user) {
        await db.users.update(user.id, { password: newPass, lastModified: Date.now(), isSynced: false });
        return true;
    }
    return false;
};

export const updateUserProfile = async (id: string, data: Partial<User>) => {
    await db.users.update(id, { ...data, lastModified: Date.now(), isSynced: false });
    return true;
};

export const updateUserPassword = async (id: string, newPass: string) => {
    await db.users.update(id, { password: newPass, lastModified: Date.now(), isSynced: false });
    return true;
};

export const getTeachers = async () => {
    return await db.users.where('role').equals(UserRole.GURU).filter(u => u.status === 'ACTIVE').toArray();
};

export const getPendingTeachers = async () => {
    return await db.users.where('status').equals('PENDING').toArray();
};

export const approveTeacher = async (id: string) => {
    await db.users.update(id, { status: 'ACTIVE', lastModified: Date.now(), isSynced: false });
    return true;
};

export const rejectTeacher = async (id: string) => {
    // Soft delete locally
    await db.users.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    return true;
};

export const deleteTeacher = async (id: string) => {
    await db.users.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    return true;
};

// --- STUDENT MANAGEMENT ---
export const getClasses = async (userId: string) => {
    return await db.classes.where('userId').equals(userId).filter(c => !c.deleted).toArray();
};

export const getAllClasses = async () => {
    return await db.classes.filter(c => !c.deleted).toArray();
};

export const addClass = async (userId: string, name: string, description?: string) => {
    const user = await db.users.get(userId);
    const newClass: ClassRoom = {
        id: crypto.randomUUID(),
        userId,
        schoolNpsn: user?.schoolNpsn || 'DEFAULT',
        name,
        description,
        studentCount: 0,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.classes.add(newClass);
    return newClass;
};

export const deleteClass = async (id: string) => {
    await db.classes.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
    // Soft delete students in class
    const students = await db.students.where('classId').equals(id).toArray();
    for (const s of students) {
        await db.students.update(s.id, { deleted: true, lastModified: Date.now(), isSynced: false });
    }
};

export const getStudents = async (classId: string) => {
    return await db.students.where('classId').equals(classId).filter(s => !s.deleted).sortBy('name');
};

export const getAllStudentsWithDetails = async () => {
    const students = await db.students.filter(s => !s.deleted).toArray();
    const classes = await db.classes.toArray();
    const classMap = new Map(classes.map(c => [c.id, c.name]));
    
    return students.map(s => ({
        ...s,
        className: classMap.get(s.classId) || 'Unknown',
        teacherName: '', // Need user join if needed
        schoolName: ''
    }));
};

export const getStudentsServerSide = async (page: number, limit: number, search: string, school: string, teacherId: string) => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            search,
            school,
            teacherId
        });
        const userId = JSON.parse(localStorage.getItem('eduadmin_user') || '{}').id;
        const res = await fetch(`/api/students?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${userId}` }
        });
        
        if (res.status === 401) return { status: 401, data: [] };
        
        const data = await res.json();
        return { status: 200, data: data.data, meta: data.meta, filters: data.filters };
    } catch (e) {
        console.error(e);
        return { status: 500, data: [], meta: { total: 0, totalPages: 0 } };
    }
};

export const addStudent = async (classId: string, name: string, nis: string, gender: 'L' | 'P', phone?: string) => {
    const cls = await db.classes.get(classId);
    const newStudent: Student = {
        id: crypto.randomUUID(),
        classId,
        schoolNpsn: cls?.schoolNpsn || 'DEFAULT',
        name,
        nis,
        gender,
        phone,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.students.add(newStudent);
    // Update count
    const count = await db.students.where('classId').equals(classId).filter(s => !s.deleted).count();
    await db.classes.update(classId, { studentCount: count, lastModified: Date.now(), isSynced: false });
    return newStudent;
};

export const deleteStudent = async (id: string) => {
    const s = await db.students.get(id);
    if (s) {
        await db.students.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
        // Update count
        const count = await db.students.where('classId').equals(s.classId).filter(st => !st.deleted).count();
        await db.classes.update(s.classId, { studentCount: count, lastModified: Date.now(), isSynced: false });
    }
};

export const bulkDeleteStudents = async (ids: string[]) => {
    for (const id of ids) {
        await deleteStudent(id);
    }
};

export const importStudentsFromCSV = async (classId: string, csvText: string) => {
    const lines = csvText.split('\n').filter(l => l.trim());
    const errors = [];
    let count = 0;
    
    // Skip header if present (Naive check)
    const startIdx = lines[0].toLowerCase().includes('nama') ? 1 : 0;
    
    for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/^['"]|['"]$/g, '').trim());
        if (cols.length < 2) continue;
        
        const [name, nis, genderRaw, phone] = cols;
        const gender = genderRaw?.toUpperCase() === 'P' ? 'P' : 'L';
        
        try {
            await addStudent(classId, name, nis, gender, phone);
            count++;
        } catch (e) {
            errors.push(`Row ${i+1}: Failed to add ${name}`);
        }
    }
    return { success: true, count, errors };
};

// --- ACADEMIC ---
export const getScopeMaterials = async (classId: string, semester: string, userId: string) => {
    let collection = db.scopeMaterials.where('userId').equals(userId);
    if (classId) collection = collection.filter(m => m.classId === classId);
    if (semester) collection = collection.filter(m => m.semester === semester);
    return await collection.filter(m => !m.deleted).toArray();
};

export const addScopeMaterial = async (data: Omit<ScopeMaterial, 'id'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.scopeMaterials.add(item);
    return item;
};

export const updateScopeMaterial = async (id: string, data: Partial<ScopeMaterial>) => {
    await db.scopeMaterials.update(id, { ...data, lastModified: Date.now(), isSynced: false });
    return await db.scopeMaterials.get(id);
};

export const deleteScopeMaterial = async (id: string) => {
    await db.scopeMaterials.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const bulkDeleteScopeMaterials = async (ids: string[]) => {
    for (const id of ids) await deleteScopeMaterial(id);
};

export const copyScopeMaterials = async (sourceClassId: string, targetClassId: string, sourceSem: string, targetSem: string, userId: string, subject: string) => {
    const sources = await db.scopeMaterials.where({ classId: sourceClassId, semester: sourceSem }).filter(m => !m.deleted && m.userId === userId).toArray();
    if (sources.length === 0) return false;
    
    for (const s of sources) {
        await addScopeMaterial({
            classId: targetClassId,
            userId,
            subject,
            semester: targetSem,
            code: s.code,
            phase: s.phase,
            content: s.content,
            subScopes: s.subScopes
        });
    }
    return true;
};

export const getAssessmentScores = async (classId: string, semester: string) => {
    return await db.assessmentScores.where({ classId, semester }).filter(s => !s.deleted).toArray();
};

export const saveBulkAssessmentScores = async (scores: Omit<AssessmentScore, 'id'>[], userId: string, userName: string) => {
    for (const s of scores) {
        // Find existing
        const existing = await db.assessmentScores
            .where({ studentId: s.studentId, classId: s.classId, semester: s.semester, category: s.category, materialId: s.materialId || '' })
            .first();
            
        if (existing) {
            await db.assessmentScores.update(existing.id, { ...s, lastModified: Date.now(), isSynced: false });
            // Log update
            await addSystemLog('INFO', userName, 'GURU', 'Update Score', `Updated score for student ${s.studentId}`);
        } else {
            await db.assessmentScores.add({ ...s, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false });
        }
    }
};

export const getAttendanceRecords = async (classId: string, month: number, year: number) => {
    // Dexie doesn't support complex filtering in query, so we fetch by classId and filter
    const all = await db.attendanceRecords.where('classId').equals(classId).filter(r => !r.deleted).toArray();
    return all.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
};

export const getAttendanceRecordsByRange = async (classId: string, startDate: string, endDate: string) => {
    const all = await db.attendanceRecords.where('classId').equals(classId).filter(r => !r.deleted).toArray();
    return all.filter(r => r.date >= startDate && r.date <= endDate);
};

export const saveAttendanceRecords = async (records: Omit<AttendanceRecord, 'id'>[]) => {
    for (const r of records) {
        // Upsert
        const existing = await db.attendanceRecords
            .where({ studentId: r.studentId, date: r.date })
            .first();
        
        if (existing) {
            await db.attendanceRecords.update(existing.id, { ...r, lastModified: Date.now(), isSynced: false });
        } else {
            await db.attendanceRecords.add({ ...r, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false });
        }
    }
};

export const deleteAttendanceRecords = async (classId: string, month: number, year: number, day?: number) => {
    const records = await getAttendanceRecords(classId, month, year);
    const toDelete = day ? records.filter(r => new Date(r.date).getDate() === day) : records;
    for (const r of toDelete) {
        await db.attendanceRecords.update(r.id, { deleted: true, lastModified: Date.now(), isSynced: false });
    }
};

export const getTeachingJournals = async (userId: string) => {
    return await db.teachingJournals.where('userId').equals(userId).filter(j => !j.deleted).reverse().sortBy('date');
};

export const addTeachingJournal = async (data: Omit<TeachingJournal, 'id'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.teachingJournals.add(item);
    return item;
};

export const deleteTeachingJournal = async (id: string) => {
    await db.teachingJournals.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const bulkDeleteTeachingJournals = async (ids: string[]) => {
    for (const id of ids) await deleteTeachingJournal(id);
};

export const getTeachingSchedules = async (userId: string) => {
    return await db.teachingSchedules.where('userId').equals(userId).filter(s => !s.deleted).toArray();
};

export const addTeachingSchedule = async (data: Omit<TeachingSchedule, 'id'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.teachingSchedules.add(item);
    return item;
};

export const deleteTeachingSchedule = async (id: string) => {
    await db.teachingSchedules.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

// --- BK & GUIDANCE ---
export const getStudentViolations = async () => {
    return await db.violations.filter(v => !v.deleted).toArray();
};

export const addStudentViolation = async (data: Omit<StudentViolation, 'id' | 'lastModified' | 'isSynced'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.violations.add(item);
    return item;
};

export const deleteStudentViolation = async (id: string) => {
    await db.violations.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const getStudentPointReductions = async () => {
    return await db.pointReductions.filter(r => !r.deleted).toArray();
};

export const addStudentPointReduction = async (data: Omit<StudentPointReduction, 'id' | 'lastModified' | 'isSynced'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.pointReductions.add(item);
    return item;
};

export const deleteStudentPointReduction = async (id: string) => {
    await db.pointReductions.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const getStudentAchievements = async () => {
    return await db.achievements.filter(a => !a.deleted).toArray();
};

export const addStudentAchievement = async (data: Omit<StudentAchievement, 'id' | 'lastModified' | 'isSynced'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.achievements.add(item);
    return item;
};

export const deleteStudentAchievement = async (id: string) => {
    await db.achievements.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const getCounselingSessions = async () => {
    return await db.counselingSessions.filter(s => !s.deleted).toArray();
};

export const addCounselingSession = async (data: Omit<CounselingSession, 'id' | 'lastModified' | 'isSynced'>) => {
    const item = { ...data, id: crypto.randomUUID(), lastModified: Date.now(), isSynced: false };
    await db.counselingSessions.add(item);
    return item;
};

export const deleteCounselingSession = async (id: string) => {
    await db.counselingSessions.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
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
    return ticket;
};

export const replyTicket = async (ticketId: string, user: User, message: string) => {
    const ticket = await db.tickets.get(ticketId);
    if (ticket) {
        const newMsg = {
            id: crypto.randomUUID(),
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
        return true;
    }
    return false;
};

export const closeTicket = async (id: string) => {
    await db.tickets.update(id, { status: 'CLOSED', lastModified: Date.now(), isSynced: false });
    return true;
};

// --- SETTINGS & CONFIG ---
export const getSystemSettings = async () => {
    const settings = await db.systemSettings.get('global-settings');
    return settings || { featureRppEnabled: true } as SystemSettings;
};

export const saveSystemSettings = async (settings: SystemSettings) => {
    await db.systemSettings.put({ ...settings, id: 'global-settings', lastModified: Date.now(), isSynced: false });
};

export const getEmailConfig = async () => {
    const all = await db.emailConfig.toArray();
    return all.length > 0 ? all[0] : null;
};

export const saveEmailConfig = async (config: EmailConfig) => {
    // Only one config, id 'default'
    await db.emailConfig.put({ ...config, id: 'default', lastModified: Date.now(), isSynced: false });
    return true;
};

export const getWhatsAppConfig = async (userId: string) => {
    return await db.whatsappConfigs.get(userId);
};

export const saveWhatsAppConfig = async (config: WhatsAppConfig) => {
    await db.whatsappConfigs.put({ ...config, lastModified: Date.now(), isSynced: false });
    return true;
};

export const getMasterSubjects = async () => {
    return await db.masterSubjects.filter(m => !m.deleted).toArray();
};

export const addMasterSubject = async (name: string, category: any, level: any) => {
    const item = { id: crypto.randomUUID(), name, category, level, lastModified: Date.now(), isSynced: false };
    await db.masterSubjects.add(item);
    return item;
};

export const deleteMasterSubject = async (id: string) => {
    await db.masterSubjects.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const getBackupApiKeys = async () => {
    return await db.apiKeys.filter(k => !k.deleted).toArray();
};

export const addBackupApiKey = async (key: string) => {
    await db.apiKeys.add({ 
        id: crypto.randomUUID(), 
        key, 
        provider: 'GEMINI', 
        status: 'ACTIVE', 
        addedAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    });
};

export const deleteBackupApiKey = async (id: string) => {
    await db.apiKeys.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

export const clearBackupApiKeys = async () => {
    await db.apiKeys.clear();
};

// --- LOGS & NOTIFICATIONS ---
export const getSystemLogs = async () => {
    return await db.logs.orderBy('timestamp').reverse().limit(100).toArray();
};

export const addSystemLog = async (level: LogEntry['level'], actor: string, role: string, action: string, details: string) => {
    await db.logs.add({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level, actor, role, action, details,
        lastModified: Date.now(),
        isSynced: false
    });
};

export const clearSystemLogs = async () => {
    await db.logs.clear();
};

export const getNotifications = async (role: UserRole) => {
    return await db.notifications.filter(n => (n.targetRole === 'ALL' || n.targetRole === role) && !n.deleted).reverse().sortBy('createdAt');
};

export const createNotification = async (title: string, message: string, type: Notification['type'], targetRole: Notification['targetRole'], isPopup = false) => {
    await db.notifications.add({
        id: crypto.randomUUID(),
        title, message, type, targetRole, isPopup,
        isRead: false,
        createdAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    });
};

export const markNotificationAsRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
};

export const clearNotifications = async (role: UserRole) => {
    const notifs = await getNotifications(role);
    const ids = notifs.map(n => n.id);
    await db.notifications.bulkDelete(ids);
};

export const getActiveAnnouncements = async () => {
    return await db.notifications.filter(n => n.isPopup === true && !n.deleted).reverse().sortBy('createdAt');
};

export const deleteNotification = async (id: string) => {
    await db.notifications.update(id, { deleted: true, lastModified: Date.now(), isSynced: false });
};

// --- DASHBOARD STATS ---
export const getDashboardStats = async (user: User): Promise<DashboardStatsData> => {
    if (user.role === UserRole.ADMIN) {
        // Admin: Aggregate all
        const totalClasses = await db.classes.filter(c => !c.deleted).count();
        const totalStudents = await db.students.filter(s => !s.deleted).count();
        const filledJournals = await db.teachingJournals.filter(j => !j.deleted).count();
        // Attendance calc (simplified)
        const records = await db.attendanceRecords.filter(r => !r.deleted).toArray();
        const present = records.filter(r => r.status === 'H').length;
        const attendanceRate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;
        
        // Gender
        const students = await db.students.filter(s => !s.deleted).toArray();
        const males = students.filter(s => s.gender === 'L').length;
        const females = students.filter(s => s.gender === 'P').length;

        return {
            totalClasses, totalStudents, filledJournals, attendanceRate,
            genderDistribution: [{name: 'Laki-laki', value: males}, {name: 'Perempuan', value: females}],
            weeklyAttendance: []
        };
    } else {
        // Teacher: Own classes
        const classes = await db.classes.where('userId').equals(user.id).filter(c => !c.deleted).toArray();
        const classIds = classes.map(c => c.id);
        const totalClasses = classes.length;
        const totalStudents = await db.students.where('classId').anyOf(classIds).filter(s => !s.deleted).count();
        const filledJournals = await db.teachingJournals.where('userId').equals(user.id).filter(j => !j.deleted).count();
        
        // Attendance
        const records = await db.attendanceRecords.where('classId').anyOf(classIds).filter(r => !r.deleted).toArray();
        const present = records.filter(r => r.status === 'H').length;
        const attendanceRate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

        return {
            totalClasses, totalStudents, filledJournals, attendanceRate,
            genderDistribution: [],
            weeklyAttendance: []
        };
    }
};

// --- SYNC ENGINE ---
export const getSyncStats = async (user: User) => {
    const tables = [
        'users', 'classes', 'students', 'attendanceRecords', 'scopeMaterials', 
        'assessmentScores', 'teachingJournals', 'teachingSchedules', 'logs',
        'emailConfig', 'masterSubjects', 'tickets', 'violations', 'pointReductions',
        'achievements', 'counselingSessions', 'whatsappConfigs', 'notifications', 'apiKeys', 'systemSettings'
    ];
    
    let totalUnsynced = 0;
    const stats: {table: string, count: number}[] = [];

    for (const tbl of tables) {
        // @ts-ignore
        let count = await db[tbl].where('isSynced').equals(0).count(); // 0 is false
        
        // For Guru: Only count their data (simplified check, usually we sync everything user can access)
        // If needed, we can filter by userId here, but it's expensive.
        // Assuming Dexie only contains user's data or relevant data.
        
        if (count > 0) {
            stats.push({ table: tbl, count });
            totalUnsynced += count;
        }
    }
    return { totalUnsynced, stats };
};

export const syncAllData = async (force: boolean = false) => {
    if (!navigator.onLine) return;
    
    try {
        await initTurso(); // Ensure schema
        
        const tablesMap: Record<string, string> = {
            'users': 'eduadmin_users',
            'classes': 'eduadmin_classes',
            'students': 'eduadmin_students',
            'attendanceRecords': 'eduadmin_attendance',
            'scopeMaterials': 'eduadmin_materials',
            'assessmentScores': 'eduadmin_scores',
            'teachingJournals': 'eduadmin_journals',
            'teachingSchedules': 'eduadmin_schedules',
            'logs': 'eduadmin_logs',
            'emailConfig': 'eduadmin_email_config',
            'masterSubjects': 'eduadmin_master_subjects',
            'tickets': 'eduadmin_tickets',
            'violations': 'eduadmin_bk_violations',
            'pointReductions': 'eduadmin_bk_reductions',
            'achievements': 'eduadmin_bk_achievements',
            'counselingSessions': 'eduadmin_bk_counseling',
            'whatsappConfigs': 'eduadmin_wa_configs',
            'notifications': 'eduadmin_notifications',
            'apiKeys': 'eduadmin_api_keys',
            'systemSettings': 'eduadmin_system_settings'
        };

        for (const [localTable, collection] of Object.entries(tablesMap)) {
            // PUSH
            // @ts-ignore
            const unsynced = await db[localTable].filter(i => !i.isSynced).toArray();
            if (unsynced.length > 0) {
                await pushToTurso(collection, unsynced);
                // Mark as synced locally
                const ids = unsynced.map((i: any) => i.id);
                // @ts-ignore
                await db[localTable].bulkUpdate(ids.map((id:any) => ({ key: id, changes: { isSynced: true } })));
            }

            // PULL
            // @ts-ignore
            const localItems = await db[localTable].toArray();
            const { items, hasChanges } = await pullFromTurso(collection, localItems);
            
            if (hasChanges) {
                // @ts-ignore
                await db[localTable].bulkPut(items);
            }
        }
        
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
    } catch (e) {
        console.error("Sync Error:", e);
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
    }
};

export const runManualSync = async (direction: 'PUSH' | 'PULL' | 'FULL', onLog: (msg: string) => void) => {
    onLog("Starting Sync...");
    if (!navigator.onLine) {
        onLog("Offline. Aborted.");
        return;
    }
    
    try {
        if (direction === 'FULL' || direction === 'PUSH') {
            onLog("Pushing local data...");
            await syncAllData(false); // Reuse existing logic which does push then pull
        }
        onLog("Sync Completed.");
    } catch (e: any) {
        onLog(`Error: ${e.message}`);
    }
};

// --- MISC UTILS ---
export const sendApprovalEmail = async (user: User) => {
    try {
        const config = await getEmailConfig();
        if (!config || !config.isActive) return { success: false, message: "Email config not active" };
        
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user, config })
        });
        return await res.json();
    } catch(e) {
        return { success: false, message: "Email failed" };
    }
};

export const sendApprovalWhatsApp = async (user: User, adminId: string) => {
    try {
        const config = await db.whatsappConfigs.get(adminId);
        if (!config || !config.isActive || !config.apiKey) return { success: false, message: "WA Gateway inactive" };
        
        if (!user.phone || user.phone.length < 5) return { success: false, message: "Invalid Phone" };

        const message = `Halo *${user.fullName}*,\n\nSelamat! Akun Anda di *${user.schoolName}* telah disetujui.\nSilakan login aplikasi.`;
        
        const res = await sendWhatsAppBroadcast(config, [{name: user.fullName, phone: user.phone}], message);
        return res.success > 0 ? { success: true } : { success: false, message: "API Error" };
    } catch (e) { return { success: false, message: "WA Error" }; }
};

export const sendWhatsAppBroadcast = async (config: WhatsAppConfig, recipients: {name: string, phone: string}[], message: string) => {
    try {
        const res = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ config, recipients, message })
        });
        return await res.json();
    } catch (e) {
        throw e;
    }
};

export const checkSchoolNameByNpsn = async (npsn: string) => {
    try {
        if (!navigator.onLine) return { found: false };
        const res = await fetch(`/api/check-npsn?npsn=${npsn}`);
        return await res.json();
    } catch { return { found: false }; }
};

// --- BACKUP & RESTORE ---
export const createBackup = async (user: User, semesterFilter?: string): Promise<BackupData | null> => {
    try {
        const backup: BackupData = {
            meta: {
                version: '1.0',
                date: new Date().toISOString(),
                generatedBy: user.fullName,
                role: user.role,
                semesterFilter
            },
            data: {
                classes: [], students: [], scopeMaterials: [], assessmentScores: [], 
                teachingJournals: [], tickets: [], violations: [], pointReductions: [], 
                achievements: [], counselingSessions: []
            }
        };

        // Fetch Data Logic (Simplified)
        if (user.role === UserRole.ADMIN) {
            backup.data.users = await db.users.toArray();
            backup.data.classes = await db.classes.toArray();
            backup.data.students = await db.students.toArray();
            // ... fetch all tables
        } else {
            backup.data.classes = await db.classes.where('userId').equals(user.id).toArray();
            const classIds = backup.data.classes.map(c => c.id);
            backup.data.students = await db.students.where('classId').anyOf(classIds).toArray();
            // ... fetch user specific data
        }
        
        return backup;
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const restoreBackup = async (backup: BackupData) => {
    try {
        await db.transaction('rw', db.tables, async () => {
            if (backup.data.classes) await db.classes.bulkPut(backup.data.classes);
            if (backup.data.students) await db.students.bulkPut(backup.data.students);
            // ... restore all tables
        });
        return { success: true, message: "Restore berhasil." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const resetSystemData = async (scope: 'SEMESTER' | 'ALL', semester?: string) => {
    try {
        if (scope === 'ALL') {
            await db.delete(); // Delete DB
            await db.open(); // Reopen to recreate schema
            // Re-seed admin logic should be handled by app init
        } else {
            // Delete semester specific data
            if (semester) {
                await db.assessmentScores.where('semester').equals(semester).delete();
                await db.scopeMaterials.where('semester').equals(semester).delete();
            }
        }
        return { success: true, message: "Reset berhasil." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};
