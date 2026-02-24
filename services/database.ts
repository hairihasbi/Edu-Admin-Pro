
import { db } from './db';
import { 
  User, UserRole, ClassRoom, Student, AttendanceRecord, 
  ScopeMaterial, AssessmentScore, TeachingJournal, 
  TeachingSchedule, LogEntry, MasterSubject, Ticket, 
  StudentViolation, StudentPointReduction, StudentAchievement, CounselingSession, 
  EmailConfig, WhatsAppConfig, Notification, ApiKey, SystemSettings,
  BackupData, StudentWithDetails, LessonPlanRequest, DashboardStatsData
} from '../types';
import { initTurso, pushToTurso, pullFromTurso } from './tursoService';

const uuidv4 = () => crypto.randomUUID();

export const initDatabase = async () => {
  if (!db.isOpen()) {
    await db.open();
  }
  await initTurso();
};

// --- USER MANAGEMENT ---
export const loginUser = async (username: string, password: string): Promise<User | null> => {
    try {
        if (navigator.onLine) {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                const data = await res.json();
                await db.users.put(data.user);
                return data.user;
            }
        } else {
            // Basic offline fallback (insecure)
            const user = await db.users.where('username').equals(username).first();
            // In a real PWA we should have a session token or verify hash locally
            return user || null;
        }
    } catch (e) {
        console.error(e);
    }
    return null;
};

export const registerUser = async (fullName: string, username: string, password: string, email: string, phone: string, schoolNpsn: string, schoolName: string, subject: string) => {
    try {
        const id = uuidv4();
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id, username, password, fullName, email, phone, schoolNpsn, schoolName, subject,
                role: 'GURU', status: 'PENDING', avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
            })
        });
        
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error };
        
        return { success: true, message: 'Pendaftaran berhasil. Tunggu persetujuan Admin.' };
    } catch (e: any) {
        return { success: false, message: e.message || 'Gagal menghubungi server.' };
    }
};

export const resetPassword = async (username: string, newPass: string) => {
    const user = await db.users.where('username').equals(username).first();
    if (!user) return false;
    await db.users.update(user.id, { password: newPass, lastModified: Date.now(), isSynced: false });
    pushToTurso('eduadmin_users', [{...user, password: newPass, lastModified: Date.now()}]);
    return true;
};

export const updateUserProfile = async (id: string, data: Partial<User>) => {
    await db.users.update(id, { ...data, lastModified: Date.now(), isSynced: false });
    const updated = await db.users.get(id);
    if(updated) pushToTurso('eduadmin_users', [updated]);
    return true;
};

export const updateUserPassword = async (id: string, newPass: string) => {
    await db.users.update(id, { password: newPass, lastModified: Date.now(), isSynced: false });
    const updated = await db.users.get(id);
    if(updated) pushToTurso('eduadmin_users', [updated]);
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
    const u = await db.users.get(id);
    if(u) pushToTurso('eduadmin_users', [u]);
    return true;
};

export const rejectTeacher = async (id: string) => {
    await db.users.delete(id);
    pushToTurso('eduadmin_users', [{id, deleted: true}]);
    return true;
};

export const deleteTeacher = async (id: string) => {
    await db.users.delete(id);
    pushToTurso('eduadmin_users', [{id, deleted: true}]);
    return true;
};

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
        
        if (!user.phone || user.phone.length < 8) return { success: false, message: "Invalid Phone" };

        const message = `Halo *${user.fullName}*,\n\nSelamat! Akun Anda di *${user.schoolName || 'Sekolah'}* telah disetujui oleh Admin.\n\nSilakan login ke aplikasi EduAdmin Pro.\n\nTerima kasih.`;
        
        const res = await sendWhatsAppBroadcast(config, [{name: user.fullName, phone: user.phone}], message);
        return res.success > 0 ? { success: true, message: "Terkirim" } : { success: false, message: res.errors?.[0] || "API Error" };
    } catch (e: any) { return { success: false, message: e.message || "Connection Error" }; }
};

// --- CLASS MANAGEMENT ---
export const getClasses = async (userId: string) => {
    return await db.classes.where('userId').equals(userId).toArray();
};

export const getAllClasses = async () => {
    return await db.classes.toArray();
};

export const addClass = async (userId: string, name: string, description: string) => {
    const user = await db.users.get(userId);
    const newItem: ClassRoom = {
        id: uuidv4(),
        userId,
        schoolNpsn: user?.schoolNpsn || 'DEFAULT',
        name,
        description,
        studentCount: 0,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.classes.add(newItem);
    pushToTurso('eduadmin_classes', [newItem]);
    return newItem;
};

export const deleteClass = async (id: string) => {
    await db.classes.delete(id);
    const students = await db.students.where('classId').equals(id).toArray();
    if(students.length > 0) {
        await db.students.bulkDelete(students.map(s => s.id));
        pushToTurso('eduadmin_students', students.map(s => ({id: s.id, deleted: true})));
    }
    pushToTurso('eduadmin_classes', [{id, deleted: true}]);
};

// --- STUDENT MANAGEMENT ---
export const getStudents = async (classId: string) => {
    return await db.students.where('classId').equals(classId).sortBy('name');
};

export const addStudent = async (classId: string, name: string, nis: string, gender: 'L'|'P', phone: string) => {
    const cls = await db.classes.get(classId);
    const newItem: Student = {
        id: uuidv4(),
        classId,
        schoolNpsn: cls?.schoolNpsn,
        name,
        nis,
        gender,
        phone,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.students.add(newItem);
    
    if(cls) {
        await db.classes.update(classId, { studentCount: (cls.studentCount || 0) + 1 });
    }
    
    pushToTurso('eduadmin_students', [newItem]);
    return newItem;
};

export const deleteStudent = async (id: string) => {
    const s = await db.students.get(id);
    await db.students.delete(id);
    if(s) {
        const cls = await db.classes.get(s.classId);
        if(cls) await db.classes.update(s.classId, { studentCount: Math.max(0, (cls.studentCount || 0) - 1) });
    }
    pushToTurso('eduadmin_students', [{id, deleted: true}]);
};

export const bulkDeleteStudents = async (ids: string[]) => {
    const students = await db.students.where('id').anyOf(ids).toArray();
    await db.students.bulkDelete(ids);
    
    const classCounts: Record<string, number> = {};
    students.forEach(s => {
        classCounts[s.classId] = (classCounts[s.classId] || 0) + 1;
    });
    
    for(const [cid, count] of Object.entries(classCounts)) {
        const cls = await db.classes.get(cid);
        if(cls) await db.classes.update(cid, { studentCount: Math.max(0, (cls.studentCount || 0) - count) });
    }

    pushToTurso('eduadmin_students', ids.map(id => ({id, deleted: true})));
};

export const getAllStudentsWithDetails = async (): Promise<StudentWithDetails[]> => {
    const students = await db.students.toArray();
    const classes = await db.classes.toArray();
    const users = await db.users.toArray();
    
    const classMap = new Map(classes.map(c => [c.id, c]));
    const userMap = new Map(users.map(u => [u.id, u]));
    
    return students.map(s => {
        const cls = classMap.get(s.classId);
        const teacher = cls ? userMap.get(cls.userId) : null;
        return {
            ...s,
            className: cls?.name || 'Unknown',
            teacherName: teacher?.fullName || 'Unknown',
            schoolName: teacher?.schoolName || 'Unknown'
        };
    });
};

export const getStudentsServerSide = async (page: number, limit: number, search: string, school: string, teacherId: string) => {
    try {
        const query = new URLSearchParams({ 
            page: page.toString(), 
            limit: limit.toString(), 
            search, 
            school, 
            teacherId 
        });
        const token = JSON.parse(localStorage.getItem('eduadmin_user') || '{}').id;
        
        const res = await fetch(`/api/students?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) return { status: 401, data: [], meta: { total: 0, totalPages: 0 } };
        return await res.json();
    } catch (e) {
        return { status: 500, data: [], meta: { total: 0, totalPages: 0 } };
    }
};

export const importStudentsFromCSV = async (classId: string, csvText: string) => {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    // Skip header if present
    const startIdx = lines[0].toLowerCase().includes('nama') ? 1 : 0;
    
    let count = 0;
    const errors = [];
    const cls = await db.classes.get(classId);
    const newStudents: Student[] = [];

    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.replace(/^['"]|['"]$/g, '').trim());
        if (parts.length < 3) continue;
        
        try {
            const student: Student = {
                id: uuidv4(),
                classId,
                schoolNpsn: cls?.schoolNpsn,
                name: parts[0],
                nis: parts[1],
                gender: (parts[2].toUpperCase() === 'L' ? 'L' : 'P'),
                phone: parts[3] || '',
                lastModified: Date.now(),
                isSynced: false
            };
            newStudents.push(student);
            count++;
        } catch (e) {
            errors.push(`Line ${i+1}: Format error`);
        }
    }
    
    if (newStudents.length > 0) {
        await db.students.bulkAdd(newStudents);
        if(cls) await db.classes.update(classId, { studentCount: (cls.studentCount || 0) + count });
        pushToTurso('eduadmin_students', newStudents);
    }
    
    return { success: true, count, errors };
};

// --- ACADEMIC ---
export const saveAttendanceRecords = async (records: Omit<AttendanceRecord, 'id'>[]) => {
    const recordsToSync: AttendanceRecord[] = [];

    await db.transaction('rw', db.attendanceRecords, async () => {
        for (const r of records) {
            // Check if record exists for this student & date
            const existing = await db.attendanceRecords
                .where({ studentId: r.studentId, date: r.date })
                .first();
            
            if (existing) {
                // Update
                if (existing.status !== r.status) {
                    const updated = { ...existing, status: r.status, lastModified: Date.now(), isSynced: false };
                    await db.attendanceRecords.put(updated);
                    recordsToSync.push(updated);
                }
            } else {
                // Insert
                const newRec: AttendanceRecord = {
                    id: uuidv4(),
                    ...r,
                    lastModified: Date.now(),
                    isSynced: false
                };
                await db.attendanceRecords.add(newRec);
                recordsToSync.push(newRec);
            }
        }
    });
    
    if (recordsToSync.length > 0) {
        pushToTurso('eduadmin_attendance', recordsToSync);
    }
};

export const deleteAttendanceRecords = async (classId: string, month: number, year: number, day?: number) => {
    // 1. Get all records for this class
    const allRecords = await db.attendanceRecords.where('classId').equals(classId).toArray();
    
    // 2. Filter by date logic
    const recordsToDelete = allRecords.filter(r => {
        const d = new Date(r.date);
        const matchMonth = d.getMonth() === month && d.getFullYear() === year;
        if (!matchMonth) return false;
        
        if (day) {
            return d.getDate() === day; // Filter specific day
        }
        return true; // Delete whole month
    });

    if (recordsToDelete.length > 0) {
        const ids = recordsToDelete.map(r => r.id);
        await db.attendanceRecords.bulkDelete(ids);
        // Push deletions to server
        pushToTurso('eduadmin_attendance', ids.map(id => ({ id, deleted: true })));
    }
    
    return recordsToDelete.length;
};

export const getAttendanceRecords = async (classId: string, month: number, year: number) => {
    // Basic filter, more refined date filter in memory or advanced query
    const all = await db.attendanceRecords.where('classId').equals(classId).toArray();
    return all.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
};

// NEW: Get records by range for Recap
export const getAttendanceRecordsByRange = async (classId: string, startDate: string, endDate: string) => {
    // We fetch all for class then filter because IndexedDB string range queries can be tricky with complex keys
    // But simplified ISO string comparison works well.
    const all = await db.attendanceRecords.where('classId').equals(classId).toArray();
    return all.filter(r => r.date >= startDate && r.date <= endDate);
};

export const addScopeMaterial = async (data: any) => {
    const newItem: ScopeMaterial = {
        id: uuidv4(),
        ...data,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.scopeMaterials.add(newItem);
    pushToTurso('eduadmin_materials', [newItem]);
    return newItem;
};

export const updateScopeMaterial = async (id: string, updates: Partial<ScopeMaterial>) => {
    await db.scopeMaterials.update(id, { ...updates, lastModified: Date.now(), isSynced: false });
    const updated = await db.scopeMaterials.get(id);
    if(updated) pushToTurso('eduadmin_materials', [updated]);
    return updated;
};

export const getScopeMaterials = async (classId: string, semester: string, userId: string) => {
    // If classId is empty, fetch all for user & semester
    if (!classId) {
        return await db.scopeMaterials
            .where('userId').equals(userId)
            .filter(m => m.semester === semester)
            .toArray();
    }
    
    // If classId provided
    return await db.scopeMaterials
        .where('classId').equals(classId)
        .filter(m => m.semester === semester && m.userId === userId)
        .toArray();
};

export const deleteScopeMaterial = async (id: string) => {
    await db.scopeMaterials.delete(id);
    pushToTurso('eduadmin_materials', [{ id, deleted: true }]);
};

export const bulkDeleteScopeMaterials = async (ids: string[]) => {
    await db.scopeMaterials.bulkDelete(ids);
    pushToTurso('eduadmin_materials', ids.map(id => ({ id, deleted: true })));
};

export const copyScopeMaterials = async (sourceClassId: string, targetClassId: string, sourceSem: string, targetSem: string, userId: string, subject: string) => {
    const sources = await db.scopeMaterials.where({ classId: sourceClassId, semester: sourceSem }).filter(m => m.userId === userId).toArray();
    if (sources.length === 0) return false;
    
    const copies = sources.map(s => ({
        ...s,
        id: uuidv4(),
        classId: targetClassId,
        semester: targetSem,
        userId, 
        subject,
        lastModified: Date.now(),
        isSynced: false
    }));
    
    await db.scopeMaterials.bulkAdd(copies);
    pushToTurso('eduadmin_materials', copies);
    return true;
};

export const getAssessmentScores = async (classId: string, semester: string) => {
    return await db.assessmentScores.where({ classId, semester }).toArray();
};

export const saveBulkAssessmentScores = async (scores: Omit<AssessmentScore, 'id'>[], userId: string, userName: string) => {
    const existing = await getAssessmentScores(scores[0].classId, scores[0].semester);
    const toPut: AssessmentScore[] = [];
    
    scores.forEach(s => {
        const found = existing.find(e => 
            e.studentId === s.studentId && 
            e.category === s.category && 
            e.materialId === s.materialId
        );
        
        toPut.push({
            ...s,
            id: found ? found.id : uuidv4(),
            userId, // Ensure ownership
            lastModified: Date.now(),
            isSynced: false
        });
    });
    
    await db.assessmentScores.bulkPut(toPut);
    pushToTurso('eduadmin_scores', toPut);
    
    // Log
    await addSystemLog('INFO', userName, 'GURU', 'Update Score', `Updated ${toPut.length} scores`);
};

export const getTeachingJournals = async (userId: string) => {
    return await db.teachingJournals.where('userId').equals(userId).reverse().sortBy('date');
};

export const addTeachingJournal = async (data: any) => {
    const newItem: TeachingJournal = {
        id: uuidv4(),
        ...data,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.teachingJournals.add(newItem);
    pushToTurso('eduadmin_journals', [newItem]);
    return newItem;
};

export const deleteTeachingJournal = async (id: string) => {
    await db.teachingJournals.delete(id);
    pushToTurso('eduadmin_journals', [{ id, deleted: true }]);
};

export const bulkDeleteTeachingJournals = async (ids: string[]) => {
    await db.teachingJournals.bulkDelete(ids);
    pushToTurso('eduadmin_journals', ids.map(id => ({ id, deleted: true })));
};

export const getTeachingSchedules = async (userId: string) => {
    return await db.teachingSchedules.where('userId').equals(userId).toArray();
};

export const addTeachingSchedule = async (data: any) => {
    const newItem: TeachingSchedule = {
        id: uuidv4(),
        ...data,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.teachingSchedules.add(newItem);
    pushToTurso('eduadmin_schedules', [newItem]);
    return newItem;
};

export const deleteTeachingSchedule = async (id: string) => {
    await db.teachingSchedules.delete(id);
    pushToTurso('eduadmin_schedules', [{ id, deleted: true }]);
};

// --- SYSTEM & LOGS ---
export const getSystemLogs = async () => {
    return await db.logs.toArray();
};

export const addSystemLog = async (level: LogEntry['level'], actor: string, role: string, action: string, details: string) => {
    const log: LogEntry = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        level,
        actor,
        role,
        action,
        details,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.logs.add(log);
    pushToTurso('eduadmin_logs', [log]);
};

export const clearSystemLogs = async () => {
    await db.logs.clear();
};

export const getDashboardStats = async (user: User) => {
    try {
        let classes = 0;
        let students = 0;
        let journals = 0;
        let attendanceRate = 0;
        let males = 0;
        let females = 0;

        if (user.role === 'ADMIN') {
            classes = await db.classes.count();
            students = await db.students.count();
            journals = await db.teachingJournals.count();
            males = await db.students.where('gender').equals('L').count();
            females = await db.students.where('gender').equals('P').count();
            
            // Calc Attendance
            const totalRecs = await db.attendanceRecords.count();
            const presentRecs = await db.attendanceRecords.where('status').equals('H').count();
            attendanceRate = totalRecs > 0 ? Math.round((presentRecs / totalRecs) * 100) : 0;

        } else {
            // GURU
            classes = await db.classes.where('userId').equals(user.id).count();
            
            const clsIds = await db.classes.where('userId').equals(user.id).primaryKeys();
            students = await db.students.where('classId').anyOf(clsIds as string[]).count();
            
            // Stats based on owned students
            const myStudents = await db.students.where('classId').anyOf(clsIds as string[]).toArray();
            males = myStudents.filter(s => s.gender === 'L').length;
            females = myStudents.filter(s => s.gender === 'P').length;

            journals = await db.teachingJournals.where('userId').equals(user.id).count();

            // Calc Attendance for owned classes
            const totalRecs = await db.attendanceRecords.where('classId').anyOf(clsIds as string[]).count();
            const presentRecs = await db.attendanceRecords.where('classId').anyOf(clsIds as string[]).filter(r => r.status === 'H').count();
            attendanceRate = totalRecs > 0 ? Math.round((presentRecs / totalRecs) * 100) : 0;
        }

        return {
            totalClasses: classes,
            totalStudents: students,
            filledJournals: journals,
            attendanceRate: attendanceRate,
            genderDistribution: [
                { name: 'Laki-laki', value: males },
                { name: 'Perempuan', value: females }
            ],
            weeklyAttendance: []
        } as DashboardStatsData;
    } catch (e) {
        console.error("Error calculating stats:", e);
        return {
            totalClasses: 0,
            totalStudents: 0,
            filledJournals: 0,
            attendanceRate: 0,
            genderDistribution: [],
            weeklyAttendance: []
        } as DashboardStatsData;
    }
};

export const getSystemSettings = async () => {
    const s = await db.systemSettings.get('global-settings');
    if (!s) {
        // Initialize default
        const def: SystemSettings = {
            id: 'global-settings',
            featureRppEnabled: true,
            maintenanceMessage: '',
            appName: 'EduAdmin Pro',
            isSynced: false,
            lastModified: Date.now()
        };
        await db.systemSettings.put(def);
        return def;
    }
    return s;
};

export const saveSystemSettings = async (settings: SystemSettings) => {
    await db.systemSettings.put({ ...settings, lastModified: Date.now(), isSynced: false });
    pushToTurso('eduadmin_system_settings', [settings]);
};

// --- SYNC & BACKUP ---
export const getSyncStats = async (user: User) => {
    // Count unsynced items
    const tables = db.tables;
    let totalUnsynced = 0;
    const stats: {table: string, count: number}[] = [];

    for (const table of tables) {
        // Safe check using filter to handle potential lack of index or different falsy values
        const count = await table.filter(item => !item.isSynced).count();
        if (count > 0) {
            totalUnsynced += count;
            stats.push({ table: table.name, count });
        }
    }
    return { totalUnsynced, stats };
};

// CRITICAL FIX: Implement actual PULL logic so cleared DB gets populated from server
export const runManualSync = async (direction: 'PUSH' | 'PULL' | 'FULL', onLog: (msg: string) => void) => {
    // Mapping table name to collection name
    const tableMap: Record<string, string> = {
        'users': 'eduadmin_users',
        'classes': 'eduadmin_classes',
        'students': 'eduadmin_students',
        'assessmentScores': 'eduadmin_scores',
        'attendanceRecords': 'eduadmin_attendance',
        'teachingJournals': 'eduadmin_journals',
        'scopeMaterials': 'eduadmin_materials',
        'teachingSchedules': 'eduadmin_schedules',
        'violations': 'eduadmin_bk_violations',
        'pointReductions': 'eduadmin_bk_reductions',
        'achievements': 'eduadmin_bk_achievements',
        'counselingSessions': 'eduadmin_bk_counseling',
        'tickets': 'eduadmin_tickets',
        'whatsappConfigs': 'eduadmin_wa_configs',
        'notifications': 'eduadmin_notifications',
        'masterSubjects': 'eduadmin_master_subjects',
        'emailConfig': 'eduadmin_email_config',
        'systemSettings': 'eduadmin_system_settings'
    };

    try {
        // --- PUSH PHASE ---
        if (direction === 'PUSH' || direction === 'FULL') {
            onLog('Starting Push...');
            
            for (const [table, collection] of Object.entries(tableMap)) {
                // Use filter for safety and robust boolean check
                const unsynced = await db.table(table).filter(item => !item.isSynced).toArray();
                
                if (unsynced.length > 0) {
                    onLog(`Pushing ${unsynced.length} items from ${table}...`);
                    try {
                        await pushToTurso(collection, unsynced);
                        // Mark synced
                        await db.table(table).bulkPut(unsynced.map(i => ({ ...i, isSynced: true })));
                    } catch (e: any) {
                        onLog(`Failed to push ${table}: ${e.message}`);
                    }
                }
            }
            onLog('Push Completed.');
        }

        // --- PULL PHASE ---
        if (direction === 'PULL' || direction === 'FULL') {
            onLog('Starting Pull...');
            
            for (const [table, collection] of Object.entries(tableMap)) {
                onLog(`Pulling ${collection}...`);
                
                try {
                    const dbTable = db.table(table);
                    const localItems = await dbTable.toArray();
                    
                    const { items: mergedItems, hasChanges } = await pullFromTurso(collection, localItems);
                    
                    if (hasChanges) {
                        onLog(`Updating ${table}: Syncing changes...`);
                        await dbTable.bulkPut(mergedItems);
                    }
                } catch (e: any) {
                    onLog(`Failed to pull ${collection}: ${e.message}`);
                }
            }
            onLog('Pull Completed.');
            
            // Notify UI to refresh data
            window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
        }
    } catch (e: any) {
        onLog(`Critical Sync Error: ${e.message}`);
    }
};

export const syncAllData = async (force: boolean) => {
    // FORCE FULL SYNC
    await runManualSync('FULL', (msg) => console.log(msg));
};

export const createBackup = async (user: User, semesterFilter?: string): Promise<BackupData | null> => {
    try {
        const data: any = {};
        for (const table of db.tables) {
            data[table.name] = await table.toArray();
        }
        
        return {
            meta: {
                version: '1.0',
                date: new Date().toISOString(),
                generatedBy: user.username,
                role: user.role,
                semesterFilter
            },
            data
        };
    } catch (e) {
        return null;
    }
};

export const restoreBackup = async (backup: BackupData) => {
    try {
        const tableNames = db.tables.map(t => t.name);
        await db.transaction('rw', tableNames, async () => {
            for (const [tableName, items] of Object.entries(backup.data)) {
                if (db.table(tableName)) {
                    await db.table(tableName).bulkPut(items as any[]);
                }
            }
        });
        return { success: true, message: 'Restore berhasil.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

// --- MISC FEATURES ---
export const checkSchoolNameByNpsn = async (npsn: string) => {
    try {
        const res = await fetch(`/api/check-npsn?npsn=${npsn}`);
        if (res.ok) return await res.json();
    } catch {}
    return { found: false };
};

export const getMasterSubjects = async () => {
    return await db.masterSubjects.toArray();
};

export const addMasterSubject = async (name: string, category: MasterSubject['category'], level: MasterSubject['level']) => {
    const item: MasterSubject = {
        id: uuidv4(),
        name,
        category,
        level,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.masterSubjects.add(item);
    pushToTurso('eduadmin_master_subjects', [item]);
    return item;
};

export const deleteMasterSubject = async (id: string) => {
    await db.masterSubjects.delete(id);
    pushToTurso('eduadmin_master_subjects', [{ id, deleted: true }]);
};

// --- EMAIL & WA ---
export const getEmailConfig = async () => {
    const conf = await db.emailConfig.toArray();
    return conf[0] || null;
};

export const saveEmailConfig = async (config: EmailConfig) => {
    const existing = await getEmailConfig();
    const id = existing?.id || 'default-email-config'; // Singleton ID
    const newConfig = { ...config, id, lastModified: Date.now(), isSynced: false };
    await db.emailConfig.put(newConfig);
    pushToTurso('eduadmin_email_config', [newConfig]);
    return true;
};

export const getWhatsAppConfig = async (userId: string) => {
    return await db.whatsappConfigs.get(userId);
};

export const saveWhatsAppConfig = async (config: WhatsAppConfig) => {
    const newConf = { ...config, lastModified: Date.now(), isSynced: false };
    await db.whatsappConfigs.put(newConf);
    pushToTurso('eduadmin_wa_configs', [newConf]);
};

export const sendWhatsAppBroadcast = async (config: WhatsAppConfig, recipients: any[], message: string) => {
    try {
        const res = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config, recipients, message })
        });
        return await res.json();
    } catch (e: any) {
        return { success: 0, failed: recipients.length, errors: [e.message] };
    }
};

// --- KEYS ---
export const getBackupApiKeys = async () => {
    return await db.apiKeys.toArray();
};

export const addBackupApiKey = async (key: string) => {
    const newItem: ApiKey = {
        id: uuidv4(),
        key,
        provider: 'GEMINI',
        status: 'ACTIVE',
        addedAt: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    };
    await db.apiKeys.add(newItem);
    pushToTurso('eduadmin_api_keys', [newItem]);
};

export const deleteBackupApiKey = async (id: string) => {
    await db.apiKeys.delete(id);
    pushToTurso('eduadmin_api_keys', [{ id, deleted: true }]);
};

export const clearBackupApiKeys = async () => {
    const keys = await db.apiKeys.toArray();
    await db.apiKeys.clear();
    pushToTurso('eduadmin_api_keys', keys.map(k => ({ id: k.id, deleted: true })));
};

// --- ANNOUNCEMENTS ---
export const getActiveAnnouncements = async () => {
    // In real app, filter by expiry date? For now just return all notifications marked as popup
    return await db.notifications.where('isPopup').equals(1).toArray();
};

export const getNotifications = async (role: UserRole) => {
    return await db.notifications.where('targetRole').anyOf(role, 'ALL').reverse().sortBy('createdAt');
};

export const createNotification = async (title: string, message: string, type: Notification['type'], targetRole: Notification['targetRole'], isPopup: boolean = false) => {
    const notif: Notification = {
        id: uuidv4(),
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
    pushToTurso('eduadmin_notifications', [notif]);
};

export const markNotificationAsRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
};

export const clearNotifications = async (role: UserRole) => {
    // Only clear for this user role context
    // Local DB is shared in browser, so this might clear for others if on same device
    // In PWA single user mode, this is fine.
    const notifs = await db.notifications.where('targetRole').anyOf(role, 'ALL').primaryKeys();
    await db.notifications.bulkDelete(notifs);
};

export const deleteNotification = async (id: string) => {
    await db.notifications.delete(id);
    pushToTurso('eduadmin_notifications', [{ id, deleted: true }]);
};

// --- TICKETS ---
export const createTicket = async (user: User, subject: string, message: string) => {
    const ticket: Ticket = {
        id: uuidv4(),
        userId: user.id,
        teacherName: user.fullName,
        subject,
        status: 'OPEN',
        lastUpdated: new Date().toISOString(),
        messages: [{
            id: uuidv4(),
            senderRole: user.role,
            senderName: user.fullName,
            message,
            timestamp: new Date().toISOString()
        }],
        lastModified: Date.now(),
        isSynced: false
    };
    await db.tickets.add(ticket);
    pushToTurso('eduadmin_tickets', [ticket]);
    return ticket;
};

export const getTickets = async (user: User) => {
    if (user.role === 'ADMIN') {
        return await db.tickets.toArray();
    } else {
        return await db.tickets.where('userId').equals(user.id).toArray();
    }
};

export const replyTicket = async (ticketId: string, user: User, message: string) => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket) return false;

    const newMsg = {
        id: uuidv4(),
        senderRole: user.role,
        senderName: user.fullName,
        message,
        timestamp: new Date().toISOString()
    };

    const updatedMessages = [...ticket.messages, newMsg];
    
    // UPDATE LAST MODIFIED SO ADMIN/GURU SEES THE CHANGE
    await db.tickets.update(ticketId, { 
        messages: updatedMessages, 
        lastUpdated: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    });
    
    // Notify
    pushToTurso('eduadmin_tickets', [{...ticket, messages: updatedMessages, lastUpdated: new Date().toISOString(), lastModified: Date.now()}]);
    return true;
};

export const closeTicket = async (id: string) => {
    await db.tickets.update(id, { status: 'CLOSED', lastModified: Date.now(), isSynced: false });
    const t = await db.tickets.get(id);
    if(t) pushToTurso('eduadmin_tickets', [t]);
    return true;
};

// --- BK ---
export const getStudentViolations = async () => await db.violations.toArray();
export const addStudentViolation = async (data: any) => {
    const item = { id: uuidv4(), ...data, lastModified: Date.now(), isSynced: false };
    await db.violations.add(item);
    pushToTurso('eduadmin_bk_violations', [item]);
    return item;
};
export const deleteStudentViolation = async (id: string) => {
    await db.violations.delete(id);
    pushToTurso('eduadmin_bk_violations', [{ id, deleted: true }]);
};

export const getStudentPointReductions = async () => await db.pointReductions.toArray();
export const addStudentPointReduction = async (data: any) => {
    const item = { id: uuidv4(), ...data, lastModified: Date.now(), isSynced: false };
    await db.pointReductions.add(item);
    pushToTurso('eduadmin_bk_reductions', [item]);
    return item;
};
export const deleteStudentPointReduction = async (id: string) => {
    await db.pointReductions.delete(id);
    pushToTurso('eduadmin_bk_reductions', [{ id, deleted: true }]);
};

export const getStudentAchievements = async () => await db.achievements.toArray();
export const addStudentAchievement = async (data: any) => {
    const item = { id: uuidv4(), ...data, lastModified: Date.now(), isSynced: false };
    await db.achievements.add(item);
    pushToTurso('eduadmin_bk_achievements', [item]);
    return item;
};
export const deleteStudentAchievement = async (id: string) => {
    await db.achievements.delete(id);
    pushToTurso('eduadmin_bk_achievements', [{ id, deleted: true }]);
};

export const getCounselingSessions = async () => await db.counselingSessions.toArray();
export const addCounselingSession = async (data: any) => {
    const item = { id: uuidv4(), ...data, lastModified: Date.now(), isSynced: false };
    await db.counselingSessions.add(item);
    pushToTurso('eduadmin_bk_counseling', [item]);
    return item;
};
export const deleteCounselingSession = async (id: string) => {
    await db.counselingSessions.delete(id);
    pushToTurso('eduadmin_bk_counseling', [{ id, deleted: true }]);
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
                    throw new Error(err.error || "Gagal melakukan reset di server. Batalkan reset lokal untuk menjaga sinkronisasi.");
                }
            } catch (apiError: any) {
                console.error("Server Reset Error:", apiError);
                return { success: false, message: `Gagal menghapus data server: ${apiError.message}. Cek koneksi.` };
            }
        } else {
            return { success: false, message: "Koneksi internet diperlukan untuk melakukan reset database (Hard Delete)." };
        }

        // 2. Perform Local Cleanup (Dexie) - ONLY IF SERVER SUCCESS
        if (scope === 'ALL') { 
            // Factory Reset Logic
            const admins = await db.users.where('role').equals(UserRole.ADMIN).toArray(); 
            
            // Clear Local - Hard Wipe
            // Use explicit table names map
            const tableNames = db.tables.map(t => t.name);
            await db.transaction('rw', tableNames, async () => {
                await Promise.all(db.tables.map(table => table.clear()));
                await db.users.bulkAdd(admins); 
            });
            
            return { success: true, message: 'Database (Cloud & Lokal) berhasil di-reset total.' }; 
        } 
        
        if (scope === 'SEMESTER') { 
            if (semester === 'FULL_YEAR') {
               // Full Year Reset: Clear Students, Classes, Academic Data Locally
               const tablesToClear = [
                   'students', 'classes', 'assessmentScores', 'attendanceRecords', 
                   'teachingJournals', 'scopeMaterials', 'teachingSchedules', 
                   'violations', 'pointReductions', 'achievements', 'counselingSessions'
               ];
               // Get Table objects for transaction scope
               const tablesObj = tablesToClear.map(name => db.table(name));
               
               await db.transaction('rw', tablesObj, async () => {
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
               });

               return { success: true, message: "Data Tahun Ajaran (Server & Lokal) berhasil direset." };
            }

            // Semester Reset: Clear only specific semester data locally
            if (semester) {
                await db.transaction('rw', [db.assessmentScores, db.scopeMaterials], async () => {
                    const scoresToDelete = await db.assessmentScores.where('semester').equals(semester).primaryKeys(); 
                    if (scoresToDelete.length > 0) await db.assessmentScores.bulkDelete(scoresToDelete);
                    
                    const materialsToDelete = await db.scopeMaterials.where('semester').equals(semester).primaryKeys(); 
                    if (materialsToDelete.length > 0) await db.scopeMaterials.bulkDelete(materialsToDelete);
                });
                
                return { success: true, message: `Data semester ${semester} berhasil dihapus dari Server & Lokal.` }; 
            }
        } 
        
        return { success: false, message: 'Invalid Scope' }; 
    } catch (e: any) { 
        console.error("Reset Error:", e); 
        return { success: false, message: e.message || 'Gagal mereset data.' }; 
    } 
};
