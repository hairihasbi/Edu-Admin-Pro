
import { db } from './db';
import { 
  User, UserRole, ClassRoom, Student, AttendanceRecord, 
  ScopeMaterial, AssessmentScore, TeachingJournal, 
  TeachingSchedule, LogEntry, MasterSubject, Ticket, 
  StudentViolation, StudentPointReduction, StudentAchievement, CounselingSession, 
  EmailConfig, WhatsAppConfig, Notification, ApiKey, SystemSettings,
  BackupData, StudentWithDetails, LessonPlanRequest, DashboardStatsData
} from '../types';
import { initTurso, pushToTurso, pullFromTurso, deleteFromTurso, clearRemoteTable } from './tursoService';
import bcrypt from 'bcryptjs';

const uuidv4 = () => crypto.randomUUID();

export const initDatabase = async () => {
  if (!db.isOpen()) {
    await db.open();
  }
  await initTurso();
};

// --- AUTH & USER ---

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
            const user = await db.users.where('username').equals(username).first();
            return user || null;
        }
    } catch (e) { console.error(e); }
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
    } catch (e: any) { return { success: false, message: e.message || 'Gagal menghubungi server.' }; }
};

export const updateUserProfile = async (id: string, data: Partial<User>) => {
    await db.users.update(id, { ...data, lastModified: Date.now(), isSynced: false });
    const updated = await db.users.get(id);
    if(updated) pushToTurso('eduadmin_users', [updated]);
    return true;
};

export const updateUserPassword = async (id: string, newPass: string) => {
    // FIX: Hash password locally before saving
    const hashedPassword = await bcrypt.hash(newPass, 10);
    
    await db.users.update(id, { 
        password: hashedPassword, // Update the password field
        lastModified: Date.now(), 
        isSynced: false 
    });
    
    // Get full object to ensure all fields are present for sync
    const updated = await db.users.get(id);
    if(updated) pushToTurso('eduadmin_users', [updated]);
    
    return true;
};

export const resetPassword = async (username: string, newPass: string) => {
    const user = await db.users.where('username').equals(username).first();
    if (!user) return false;
    
    // FIX: Hash password for reset too
    const hashedPassword = await bcrypt.hash(newPass, 10);
    
    await db.users.update(user.id, { 
        password: hashedPassword,
        lastModified: Date.now(), 
        isSynced: false 
    });
    
    const updated = await db.users.get(user.id);
    if(updated) pushToTurso('eduadmin_users', [updated]);
    
    return true;
};

export const getTeachers = async () => {
    return await db.users.where('role').equals('GURU').and(u => u.status === 'ACTIVE').toArray();
};

export const getAllUsers = async () => {
    return await db.users.toArray();
};

export const getPendingTeachers = async () => {
    return await db.users.where('status').equals('PENDING').toArray();
};

export const approveTeacher = async (id: string) => {
    await db.users.update(id, { status: 'ACTIVE', lastModified: Date.now(), isSynced: false });
    const user = await db.users.get(id);
    if(user) pushToTurso('eduadmin_users', [user]);
    return true;
};

export const rejectTeacher = async (id: string) => {
    const user = await db.users.get(id);
    if (user) {
        await db.users.delete(id);
        // HARD DELETE: Remove from Turso completely
        await deleteFromTurso('eduadmin_users', id);
    }
    return true;
};

export const deleteTeacher = async (id: string) => {
    const user = await db.users.get(id);
    if (user) {
        await db.users.delete(id);
        // HARD DELETE: Remove from Turso completely
        await deleteFromTurso('eduadmin_users', id);
    }
    return true;
};

// --- CLASS & HOMEROOM ---

export const getClasses = async (userId: string) => {
    return await db.classes.where('userId').equals(userId).toArray();
};

export const getAllClasses = async () => {
    return await db.classes.toArray();
};

export const getAvailableClassesForHomeroom = async (schoolNpsn: string) => {
    if (!schoolNpsn) return [];
    return await db.classes.where('schoolNpsn').equals(schoolNpsn).toArray();
};

export const claimHomeroomClass = async (classId: string, teacher: User) => {
    try {
        const targetClass = await db.classes.get(classId);
        if (!targetClass) throw new Error("Kelas tidak ditemukan");
        
        if (targetClass.homeroomTeacherId && targetClass.homeroomTeacherId !== teacher.id) {
            throw new Error(`Kelas sudah diambil oleh ${targetClass.homeroomTeacherName}`);
        }

        const existingClass = await db.classes.where({ homeroomTeacherId: teacher.id }).first();
        if (existingClass && existingClass.id !== classId) {
            throw new Error(`Anda sudah menjadi wali kelas ${existingClass.name}. Lepas dulu kelas lama.`);
        }

        const updatedClass = {
            ...targetClass,
            homeroomTeacherId: teacher.id,
            homeroomTeacherName: teacher.fullName,
            lastModified: Date.now(),
            isSynced: false
        };
        await db.classes.put(updatedClass);

        const updatedUser = {
            ...teacher,
            additionalRole: 'WALI_KELAS' as const,
            homeroomClassId: classId,
            homeroomClassName: targetClass.name,
            lastModified: Date.now(),
            isSynced: false
        };
        await db.users.put(updatedUser);

        pushToTurso('eduadmin_classes', [updatedClass]);
        pushToTurso('eduadmin_users', [updatedUser]);

        return { success: true, user: updatedUser };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const releaseHomeroomClass = async (classId: string, teacher: User) => {
    try {
        const targetClass = await db.classes.get(classId);
        if (!targetClass) throw new Error("Kelas tidak ditemukan");

        if (targetClass.homeroomTeacherId !== teacher.id) {
            throw new Error("Anda bukan wali kelas ini");
        }

        const updatedClass = {
            ...targetClass,
            homeroomTeacherId: undefined,
            homeroomTeacherName: undefined,
            lastModified: Date.now(),
            isSynced: false
        };
        delete updatedClass.homeroomTeacherId;
        delete updatedClass.homeroomTeacherName;
        
        await db.classes.put(updatedClass);

        const updatedUser = {
            ...teacher,
            additionalRole: undefined,
            homeroomClassId: undefined,
            homeroomClassName: undefined,
            lastModified: Date.now(),
            isSynced: false
        };
        delete updatedUser.additionalRole;
        delete updatedUser.homeroomClassId;
        delete updatedUser.homeroomClassName;
        
        await db.users.put(updatedUser);

        // @ts-ignore
        pushToTurso('eduadmin_classes', [{...updatedClass, homeroomTeacherId: null, homeroomTeacherName: null}]);
        // @ts-ignore
        pushToTurso('eduadmin_users', [{...updatedUser, additionalRole: null, homeroomClassId: null}]);

        return { success: true, user: updatedUser };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
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
    pushToTurso('eduadmin_classes', [{id, deleted: true}]);
};

// --- SYSTEM ---

export const getSystemSettings = async () => {
    return await db.systemSettings.get('global-settings');
};

export const saveSystemSettings = async (settings: SystemSettings) => {
    const toSave = { ...settings, id: 'global-settings', lastModified: Date.now(), isSynced: false };
    await db.systemSettings.put(toSave);
    pushToTurso('eduadmin_system_settings', [toSave]);
    return true;
};

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
        const countBool = await db[tbl].filter(i => i.isSynced === false || i.isSynced === 0).count();
        if (countBool > 0) {
            stats.push({ table: tbl, count: countBool });
            totalUnsynced += countBool;
        }
    }
    return { totalUnsynced, stats };
};

// SYNC LOCK VARIABLE
let isSyncRunning = false;
let syncStartTime = 0;

export const resetSyncLock = () => {
    isSyncRunning = false;
    syncStartTime = 0;
};

export const runManualSync = async (direction: 'PUSH' | 'PULL' | 'FULL', logCallback: (msg: string) => void) => {
    // Auto-timeout check: If sync has been running for more than 60 seconds, force reset
    if (isSyncRunning && (Date.now() - syncStartTime > 60000)) {
        logCallback("Previous sync stuck. Force resetting lock...");
        resetSyncLock();
    }

    if (isSyncRunning) {
        logCallback("Sync in progress, skipping...");
        return;
    }
    isSyncRunning = true;
    syncStartTime = Date.now();

    try {
        const collections = [
            'eduadmin_users', 'eduadmin_classes', 'eduadmin_students', 'eduadmin_attendance', 
            'eduadmin_materials', 'eduadmin_scores', 'eduadmin_journals', 'eduadmin_schedules', 
            'eduadmin_logs', 'eduadmin_email_config', 'eduadmin_master_subjects', 'eduadmin_tickets', 
            'eduadmin_bk_violations', 'eduadmin_bk_reductions', 'eduadmin_bk_achievements', 'eduadmin_bk_counseling',
            'eduadmin_wa_configs', 'eduadmin_notifications', 'eduadmin_api_keys', 'eduadmin_system_settings',
            'eduadmin_pickets', 'eduadmin_incidents'
        ];

        const tableMap: Record<string, any> = {
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
            'eduadmin_system_settings': db.systemSettings,
            'eduadmin_pickets': db.dailyPickets,
            'eduadmin_incidents': db.studentIncidents
        };

        if (direction === 'PUSH' || direction === 'FULL') {
            logCallback("Starting PUSH...");
            for (const col of collections) {
                const table = tableMap[col];
                // @ts-ignore
                const items = await table.filter(i => !i.isSynced).toArray();
                if (items.length > 0) {
                    logCallback(`Pushing ${items.length} items from ${col}...`);
                    await pushToTurso(col, items);
                    for(const item of items) {
                        await table.update(item.id || item.userId, { isSynced: true });
                    }
                }
            }
            logCallback("PUSH Completed.");
        }

        if (direction === 'PULL' || direction === 'FULL') {
            logCallback("Starting PULL...");
            for (const col of collections) {
                const table = tableMap[col];
                const localItems = await table.toArray();
                logCallback(`Checking ${col}...`);
                const result = await pullFromTurso(col, localItems);
                if (result.hasChanges) {
                    logCallback(`Updating local ${col}...`);
                    
                    // Deduplicate items to prevent ConstraintError
                    const uniqueMap = new Map();
                    result.items.forEach(item => {
                        if(item.id) uniqueMap.set(String(item.id), item);
                    });
                    const uniqueItems = Array.from(uniqueMap.values());

                    // USE TRANSACTION FOR ATOMIC UPDATE
                    await db.transaction('rw', table, async () => {
                        await table.clear();
                        // Use bulkPut instead of bulkAdd to safely overwrite existing keys
                        // This fixes the ConstraintError when syncing
                        await table.bulkPut(uniqueItems);
                    });
                }
            }
            logCallback("PULL Completed.");
        }
    } catch (e: any) {
        logCallback(`Sync Error: ${e.message}`);
    } finally {
        isSyncRunning = false;
        syncStartTime = 0;
    }
};

export const syncAllData = async (force = false) => {
    // Silent Sync Wrapper
    await runManualSync('FULL', (msg) => { /* console.log('[AutoSync]', msg) */ });
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
            classes: [], students: [], scopeMaterials: [], assessmentScores: [], teachingJournals: []
        }
    };

    if (user.role === UserRole.ADMIN) {
        backup.data.users = await db.users.toArray();
        backup.data.classes = await db.classes.toArray();
        backup.data.students = await db.students.toArray();
        backup.data.scopeMaterials = await db.scopeMaterials.toArray();
        backup.data.assessmentScores = await db.assessmentScores.toArray();
        backup.data.teachingJournals = await db.teachingJournals.toArray();
        backup.data.teachingSchedules = await db.teachingSchedules.toArray();
        backup.data.attendanceRecords = await db.attendanceRecords.toArray();
        backup.data.masterSubjects = await db.masterSubjects.toArray();
        backup.data.tickets = await db.tickets.toArray();
        backup.data.violations = await db.violations.toArray();
        backup.data.pointReductions = await db.pointReductions.toArray();
        backup.data.achievements = await db.achievements.toArray();
        backup.data.counselingSessions = await db.counselingSessions.toArray();
        backup.data.notifications = await db.notifications.toArray();
        backup.data.apiKeys = await db.apiKeys.toArray();
        backup.data.systemSettings = await db.systemSettings.toArray();
    } else {
        backup.data.classes = await db.classes.where('userId').equals(user.id).toArray();
        const classIds = backup.data.classes.map(c => c.id);
        backup.data.students = await db.students.where('classId').anyOf(classIds).toArray();
        
        if (semesterFilter) {
            backup.data.scopeMaterials = await db.scopeMaterials.where('userId').equals(user.id).and(m => m.semester === semesterFilter).toArray();
            backup.data.assessmentScores = await db.assessmentScores.where('userId').equals(user.id).and(s => s.semester === semesterFilter).toArray();
        } else {
            backup.data.scopeMaterials = await db.scopeMaterials.where('userId').equals(user.id).toArray();
            backup.data.assessmentScores = await db.assessmentScores.where('userId').equals(user.id).toArray();
        }
        
        backup.data.teachingJournals = await db.teachingJournals.where('userId').equals(user.id).toArray();
        backup.data.teachingSchedules = await db.teachingSchedules.where('userId').equals(user.id).toArray();
    }

    return backup;
};

export const restoreBackup = async (backup: BackupData) => {
    try {
        await db.transaction('rw', db.tables, async () => {
            if (backup.data.users) await db.users.bulkPut(backup.data.users);
            if (backup.data.classes) await db.classes.bulkPut(backup.data.classes);
            if (backup.data.students) await db.students.bulkPut(backup.data.students);
            if (backup.data.scopeMaterials) await db.scopeMaterials.bulkPut(backup.data.scopeMaterials);
            if (backup.data.assessmentScores) await db.assessmentScores.bulkPut(backup.data.assessmentScores);
            if (backup.data.teachingJournals) await db.teachingJournals.bulkPut(backup.data.teachingJournals);
            if (backup.data.teachingSchedules) await db.teachingSchedules.bulkPut(backup.data.teachingSchedules);
            if (backup.data.attendanceRecords) await db.attendanceRecords.bulkPut(backup.data.attendanceRecords);
            if (backup.data.masterSubjects) await db.masterSubjects.bulkPut(backup.data.masterSubjects);
            if (backup.data.tickets) await db.tickets.bulkPut(backup.data.tickets);
            if (backup.data.violations) await db.violations.bulkPut(backup.data.violations);
            if (backup.data.pointReductions) await db.pointReductions.bulkPut(backup.data.pointReductions);
            if (backup.data.achievements) await db.achievements.bulkPut(backup.data.achievements);
            if (backup.data.counselingSessions) await db.counselingSessions.bulkPut(backup.data.counselingSessions);
            if (backup.data.notifications) await db.notifications.bulkPut(backup.data.notifications);
            if (backup.data.apiKeys) await db.apiKeys.bulkPut(backup.data.apiKeys);
            if (backup.data.systemSettings) await db.systemSettings.bulkPut(backup.data.systemSettings);
        });
        syncAllData(true);
        return { success: true, message: 'Data berhasil dipulihkan.' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const resetSystemData = async (scope: 'SEMESTER' | 'ALL', semester?: string) => {
    if (scope === 'ALL') {
        await Promise.all(db.tables.map(table => table.clear()));
        return { success: true, message: 'Semua data telah dihapus.' };
    } else if (scope === 'SEMESTER' && semester) {
        if (semester === 'FULL_YEAR') {
            await db.students.clear();
            await db.classes.clear();
            await db.attendanceRecords.clear();
            await db.scopeMaterials.clear();
            await db.assessmentScores.clear();
            await db.teachingJournals.clear();
            await db.violations.clear();
            await db.achievements.clear();
            await db.counselingSessions.clear();
            return { success: true, message: 'Data tahun ajaran berhasil direset.' };
        } else {
            await db.scopeMaterials.where('semester').equals(semester).delete();
            await db.assessmentScores.where('semester').equals(semester).delete();
            return { success: true, message: `Data semester ${semester} berhasil dihapus.` };
        }
    }
    return { success: false, message: 'Invalid scope' };
};

// --- MISC UTILS ---

export const checkSchoolNameByNpsn = async (npsn: string) => {
    try {
        if (navigator.onLine) {
            const res = await fetch(`/api/check-npsn?npsn=${npsn}`);
            return await res.json();
        }
    } catch (e) {}
    return { found: false };
};

export const getMasterSubjects = async () => {
    return await db.masterSubjects.toArray();
};

export const addMasterSubject = async (name: string, category: MasterSubject['category'], level: MasterSubject['level']) => {
    const newItem: MasterSubject = {
        id: uuidv4(),
        name,
        category,
        level,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.masterSubjects.add(newItem);
    pushToTurso('eduadmin_master_subjects', [newItem]);
    return newItem;
};

export const deleteMasterSubject = async (id: string) => {
    await db.masterSubjects.delete(id);
    pushToTurso('eduadmin_master_subjects', [{id, deleted: true}]);
};

export const getEmailConfig = async () => {
    return await db.emailConfig.orderBy('id').first();
};

export const saveEmailConfig = async (config: EmailConfig) => {
    const id = (config as any).id || uuidv4();
    const toSave = { ...config, id, lastModified: Date.now(), isSynced: false };
    await db.emailConfig.put(toSave);
    pushToTurso('eduadmin_email_config', [toSave]);
    return true;
};

export const getWhatsAppConfig = async (userId: string) => {
    return await db.whatsappConfigs.get(userId);
};

export const saveWhatsAppConfig = async (config: WhatsAppConfig) => {
    const toSave = { ...config, lastModified: Date.now(), isSynced: false };
    await db.whatsappConfigs.put(toSave);
    pushToTurso('eduadmin_wa_configs', [toSave]);
    return true;
};

export const sendWhatsAppBroadcast = async (config: WhatsAppConfig, recipients: {name: string, phone: string}[], message: string) => {
    try {
        const res = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ config, recipients, message })
        });
        return await res.json();
    } catch (e: any) {
        return { success: 0, failed: recipients.length, errors: [e.message] };
    }
};

export const sendEmailBroadcast = async (config: EmailConfig, recipients: {name: string, email: string}[], subject: string, content: string) => {
    try {
        const res = await fetch('/api/broadcast-email', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ config, recipients, subject, content })
        });
        return await res.json();
    } catch (e: any) {
        return { success: 0, failed: recipients.length, errors: [e.message] };
    }
};

export const sendApprovalEmail = async (user: User) => {
    try {
        const config = await getEmailConfig();
        if (!config || !config.isActive) {
            await addSystemLog('WARNING', 'SYSTEM', 'ADMIN', 'EMAIL_SKIPPED', `Email config inactive for user ${user.email}`);
            return { success: false, message: 'Email config inactive' };
        }
        
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user, config })
        });

        const data = await res.json();

        if (!res.ok) {
            const errorMsg = data.error || 'Unknown error';
            await addSystemLog('ERROR', 'SYSTEM', 'ADMIN', 'EMAIL_FAILED', `Failed to send to ${user.email}: ${errorMsg}`);
            return { success: false, message: errorMsg };
        }

        await addSystemLog('INFO', 'SYSTEM', 'ADMIN', 'EMAIL_SENT', `Approval email sent to ${user.email}`);
        return data;
    } catch(e: any) {
        await addSystemLog('ERROR', 'SYSTEM', 'ADMIN', 'EMAIL_ERROR', `Exception sending to ${user.email}: ${e.message}`);
        return { success: false, message: e.message };
    }
};



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
    return newItem;
};

export const deleteBackupApiKey = async (id: string) => {
    await db.apiKeys.delete(id);
    pushToTurso('eduadmin_api_keys', [{id, deleted: true}]);
};

export const clearBackupApiKeys = async () => {
    const keys = await db.apiKeys.toArray();
    await db.apiKeys.clear();
    const deletedItems = keys.map(k => ({ id: k.id, deleted: true }));
    pushToTurso('eduadmin_api_keys', deletedItems);
};

export const getActiveAnnouncements = async () => {
    const list = await db.notifications.where('isPopup').equals(1).toArray();
    return list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getNotifications = async (role: string) => {
    return await db.notifications.filter(n => n.targetRole === 'ALL' || n.targetRole === role).reverse().sortBy('createdAt');
};

export const createNotification = async (title: string, message: string, type: Notification['type'], targetRole: Notification['targetRole'], isPopup = false) => {
    const newItem: Notification = {
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
    await db.notifications.add(newItem);
    pushToTurso('eduadmin_notifications', [newItem]);
    return newItem;
};

export const markNotificationAsRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
};

export const clearNotifications = async (role: string) => {
    const notifs = await getNotifications(role);
    const ids = notifs.map(n => n.id);
    await db.notifications.bulkDelete(ids);
};

export const deleteNotification = async (id: string) => {
    await db.notifications.delete(id);
    pushToTurso('eduadmin_notifications', [{id, deleted: true}]);
};

// --- TICKETING ---
export const createTicket = async (user: User, subject: string, message: string) => {
    const newItem: Ticket = {
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
    await db.tickets.add(newItem);
    pushToTurso('eduadmin_tickets', [newItem]);
    return newItem;
};

export const getTickets = async (user: User) => {
    if (user.role === 'ADMIN') {
        return await db.tickets.toArray();
    }
    return await db.tickets.where('userId').equals(user.id).toArray();
};

export const getDonations = async () => {
    return await db.donations.orderBy('createdAt').reverse().toArray();
};

export const deleteDonation = async (id: string) => {
    await db.donations.delete(id);
    pushToTurso('eduadmin_donations', [{id, deleted: true}]);
    return true;
};

export const replyTicket = async (ticketId: string, sender: User, message: string) => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket) return false;
    
    const newMsg = {
        id: uuidv4(),
        senderRole: sender.role,
        senderName: sender.fullName,
        message,
        timestamp: new Date().toISOString()
    };
    
    const updated = {
        ...ticket,
        messages: [...ticket.messages, newMsg],
        lastUpdated: new Date().toISOString(),
        lastModified: Date.now(),
        isSynced: false
    };
    
    await db.tickets.put(updated);
    pushToTurso('eduadmin_tickets', [updated]);
    return true;
};

export const closeTicket = async (id: string) => {
    await db.tickets.update(id, { status: 'CLOSED', lastModified: Date.now(), isSynced: false });
    const ticket = await db.tickets.get(id);
    if(ticket) pushToTurso('eduadmin_tickets', [ticket]);
    return true;
};

export const deleteTicket = async (id: string) => {
    await db.tickets.delete(id);
    pushToTurso('eduadmin_tickets', [{id, deleted: true}]);
    return true;
};

// --- BK ---
export const getStudentViolations = async () => await db.violations.toArray();
export const addStudentViolation = async (data: Omit<StudentViolation, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.violations.add(item);
    pushToTurso('eduadmin_bk_violations', [item]);
    return item;
};
export const deleteStudentViolation = async (id: string) => {
    await db.violations.delete(id);
    pushToTurso('eduadmin_bk_violations', [{id, deleted: true}]);
};

export const getStudentPointReductions = async () => await db.pointReductions.toArray();
export const addStudentPointReduction = async (data: Omit<StudentPointReduction, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.pointReductions.add(item);
    pushToTurso('eduadmin_bk_reductions', [item]);
    return item;
};
export const deleteStudentPointReduction = async (id: string) => {
    await db.pointReductions.delete(id);
    pushToTurso('eduadmin_bk_reductions', [{id, deleted: true}]);
};

export const getStudentAchievements = async () => await db.achievements.toArray();
export const addStudentAchievement = async (data: Omit<StudentAchievement, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.achievements.add(item);
    pushToTurso('eduadmin_bk_achievements', [item]);
    return item;
};
export const deleteStudentAchievement = async (id: string) => {
    await db.achievements.delete(id);
    pushToTurso('eduadmin_bk_achievements', [{id, deleted: true}]);
};

export const getCounselingSessions = async () => await db.counselingSessions.toArray();
export const addCounselingSession = async (data: Omit<CounselingSession, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.counselingSessions.add(item);
    pushToTurso('eduadmin_bk_counseling', [item]);
    return item;
};
export const deleteCounselingSession = async (id: string) => {
    await db.counselingSessions.delete(id);
    pushToTurso('eduadmin_bk_counseling', [{id, deleted: true}]);
};

// --- DAILY PICKET ---

export const getTeachersBySchool = async (schoolNpsn: string) => {
    return await db.users.where('schoolNpsn').equals(schoolNpsn).filter(u => u.role === 'GURU').toArray();
};

export const getDailyPicket = async (date: string, schoolNpsn: string) => {
    return await db.dailyPickets.where('date').equals(date).filter(p => p.schoolNpsn === schoolNpsn).first();
};

export const saveDailyPicket = async (date: string, schoolNpsn: string, officers: string[], notes?: string) => {
    const existing = await getDailyPicket(date, schoolNpsn);
    const id = existing ? existing.id : uuidv4();
    
    const item = {
        id,
        date,
        schoolNpsn,
        officers,
        notes,
        lastModified: Date.now(),
        isSynced: false
    };
    
    await db.dailyPickets.put(item);
    pushToTurso('eduadmin_pickets', [item]);
    return item;
};

export const deleteDailyPicket = async (id: string) => {
    // 1. Delete Picket
    await db.dailyPickets.delete(id);
    pushToTurso('eduadmin_pickets', [{id, deleted: true}]);

    // 2. Delete Incidents linked to this picket
    const incidents = await db.studentIncidents.where('picketId').equals(id).toArray();
    const incidentIds = incidents.map(i => i.id);
    
    if (incidentIds.length > 0) {
        await db.studentIncidents.bulkDelete(incidentIds);
        pushToTurso('eduadmin_incidents', incidentIds.map(iid => ({id: iid, deleted: true})));
    }
};

export const getStudentIncidents = async (picketId: string) => {
    return await db.studentIncidents.where('picketId').equals(picketId).toArray();
};

export const addStudentIncident = async (picketId: string, data: {studentName: string, className: string, time: string, type: 'LATE' | 'PERMIT_EXIT' | 'EARLY_HOME', reason?: string}) => {
    const item = {
        id: uuidv4(),
        picketId,
        ...data,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.studentIncidents.add(item);
    pushToTurso('eduadmin_incidents', [item]);
    return item;
};

export const deleteStudentIncident = async (id: string) => {
    await db.studentIncidents.delete(id);
    pushToTurso('eduadmin_incidents', [{id, deleted: true}]);
};

export const getSchoolAttendanceSummary = async (date: string, schoolNpsn: string) => {
    // 1. Get all classes in this school
    const classes = await db.classes.where('schoolNpsn').equals(schoolNpsn).toArray();
    
    // 2. Get all attendance records for this date and these classes
    const classIds = classes.map(c => c.id);
    const attendance = await db.attendanceRecords
        .where('date').equals(date)
        .filter(r => classIds.includes(r.classId))
        .toArray();

    // 3. Aggregate data per class
    const summary = classes.map(cls => {
        const classAttendance = attendance.filter(a => a.classId === cls.id);
        
        const sakit = classAttendance.filter(a => a.status === 'S').length;
        const izin = classAttendance.filter(a => a.status === 'I').length;
        const alfa = classAttendance.filter(a => a.status === 'A').length;
        const hadir = cls.studentCount - (sakit + izin + alfa);

        // Get names of absent students
        const absentStudents = classAttendance
            .filter(a => ['S', 'I', 'A'].includes(a.status))
            .map(async (a) => {
                const student = await db.students.get(a.studentId);
                return { name: student?.name || 'Unknown', status: a.status };
            });

        return {
            className: cls.name,
            studentCount: cls.studentCount,
            hadir: Math.max(0, hadir), // Prevent negative
            sakit,
            izin,
            alfa,
            absentDetails: Promise.all(absentStudents)
        };
    });

    // Resolve promises for student names
    const resolvedSummary = await Promise.all(summary.map(async (s) => ({
        ...s,
        absentDetails: await s.absentDetails
    })));

    return resolvedSummary;
};

export const getAttendanceSummaryByRange = async (startDate: string, endDate: string, schoolNpsn: string) => {
    // 1. Get all classes in this school
    const classes = await db.classes.where('schoolNpsn').equals(schoolNpsn).toArray();
    const classIds = classes.map(c => c.id);

    // 2. Get all attendance records in range
    // Dexie string comparison works for ISO dates YYYY-MM-DD
    const attendance = await db.attendanceRecords
        .where('date').between(startDate, endDate, true, true)
        .filter(r => classIds.includes(r.classId))
        .toArray();

    // 3. Aggregate data per class
    const summary = classes.map(cls => {
        const classAttendance = attendance.filter(a => a.classId === cls.id);
        
        const sakit = classAttendance.filter(a => a.status === 'S').length;
        const izin = classAttendance.filter(a => a.status === 'I').length;
        const alfa = classAttendance.filter(a => a.status === 'A').length;
        
        // For range summary, 'Hadir' is sum of all 'H' records, NOT (Total Students * Days) - Absences
        // because we might not have attendance for every day.
        const hadir = classAttendance.filter(a => a.status === 'H').length;

        // Total records for this class in this period
        const totalRecords = classAttendance.length;

        return {
            className: cls.name,
            studentCount: cls.studentCount,
            hadir,
            sakit,
            izin,
            alfa,
            totalRecords,
            absentDetails: [] // Not needed for monthly summary usually, or too large
        };
    });

    return summary;
};

export const getIncidentsByDateRange = async (startDate: string, endDate: string, schoolNpsn: string) => {
    // 1. Get Pickets in range
    const pickets = await db.dailyPickets
        .where('date').between(startDate, endDate, true, true)
        .filter(p => p.schoolNpsn === schoolNpsn)
        .toArray();
        
    const picketIds = pickets.map(p => p.id);

    if (picketIds.length === 0) return [];

    // 2. Get Incidents for these pickets
    const incidents = await db.studentIncidents
        .where('picketId').anyOf(picketIds)
        .toArray();

    // 3. Enrich with date from picket
    return incidents.map(inc => {
        const picket = pickets.find(p => p.id === inc.picketId);
        return {
            ...inc,
            date: picket?.date || 'Unknown Date'
        };
    }).sort((a, b) => a.date.localeCompare(b.date));
};

// --- STUDENT OPS ---
export const addStudent = async (classId: string, name: string, nis: string, gender: 'L'|'P', phone?: string) => {
    const cls = await db.classes.get(classId);
    const item: Student = {
        id: uuidv4(),
        classId,
        schoolNpsn: cls?.schoolNpsn,
        name, nis, gender, phone,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.students.add(item);
    // Update count
    if (cls) {
        await db.classes.update(classId, { studentCount: (cls.studentCount || 0) + 1 });
    }
    pushToTurso('eduadmin_students', [item]);
    return item;
};

export const deleteStudent = async (id: string) => {
    const s = await db.students.get(id);
    if (s) {
        await db.students.delete(id);
        const cls = await db.classes.get(s.classId);
        if (cls) await db.classes.update(s.classId, { studentCount: Math.max(0, (cls.studentCount || 0) - 1) });
        pushToTurso('eduadmin_students', [{id, deleted: true}]);
    }
};

export const bulkDeleteStudents = async (ids: string[]) => {
    for (const id of ids) await deleteStudent(id);
};

export const getAllStudentsWithDetails = async () => {
    // Used by Admin. Join with class and user.
    const students = await db.students.toArray();
    const classes = await db.classes.toArray();
    const users = await db.users.toArray();
    
    return students.map(s => {
        const cls = classes.find(c => c.id === s.classId);
        const teacher = cls ? users.find(u => u.id === cls.userId) : null;
        return {
            ...s,
            className: cls?.name || 'Unknown',
            teacherName: teacher?.fullName || 'Unknown',
            schoolName: teacher?.schoolName || 'Unknown'
        };
    });
};

export const getStudentsServerSide = async (page: number, limit: number, search: string, school: string, teacherId: string) => {
    // If online, use API
    if (navigator.onLine) {
        try {
            const userStr = localStorage.getItem('eduadmin_user');
            const user = userStr ? JSON.parse(userStr) : null;
            const token = user?.id;

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search,
                school,
                teacherId
            });
            
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`/api/students?${params}`, { headers });
            if (res.status === 401) return { status: 401, data: [], meta: { total: 0, totalPages: 0 } };
            return await res.json();
        } catch(e) { console.error(e); }
    }
    
    // Fallback to local
    const all = await getAllStudentsWithDetails();
    let filtered = all.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        s.nis.includes(search)
    );
    if (school) filtered = filtered.filter(s => s.schoolName === school);
    
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
        data: filtered.slice(start, end),
        meta: {
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / limit)
        },
        filters: { schools: [], teachers: [] }
    };
};

export const getStudents = async (classId: string) => {
    return await db.students.where('classId').equals(classId).sortBy('name');
};

export const importStudentsFromCSV = async (classId: string, csvText: string) => {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    const errors: string[] = [];
    let count = 0;
    
    const startIdx = lines[0].toLowerCase().includes('nama') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim()); 
        
        if (cleanParts.length < 2) {
            errors.push(`Baris ${i+1}: Format salah`);
            continue;
        }

        const name = cleanParts[0];
        const nis = cleanParts[1];
        const gender = (cleanParts[2] || 'L').toUpperCase() === 'P' ? 'P' : 'L';
        const phone = cleanParts[3] || '';

        try {
            await addStudent(classId, name, nis, gender, phone);
            count++;
        } catch(e) {
            errors.push(`Baris ${i+1}: Gagal simpan (${name})`);
        }
    }
    return { success: true, count, errors };
};

// --- ATTENDANCE ---
export const saveAttendanceRecords = async (records: Omit<AttendanceRecord, 'id'>[]) => {
    const items = records.map(r => ({ ...r, id: uuidv4(), lastModified: Date.now(), isSynced: false }));
    await db.attendanceRecords.bulkAdd(items);
    pushToTurso('eduadmin_attendance', items);
};

export const deleteAttendanceRecords = async (classId: string, month: number, year: number, day?: number) => {
    const all = await db.attendanceRecords.where('classId').equals(classId).toArray();
    const toDelete = all.filter(r => {
        const d = new Date(r.date);
        const matchMonth = d.getMonth() === month && d.getFullYear() === year;
        if (day) return matchMonth && d.getDate() === day;
        return matchMonth;
    });
    const ids = toDelete.map(r => r.id);
    await db.attendanceRecords.bulkDelete(ids);
    pushToTurso('eduadmin_attendance', ids.map(id => ({id, deleted: true})));
};

export const getAttendanceRecords = async (classId: string, month: number, year: number) => {
    const all = await db.attendanceRecords.where('classId').equals(classId).toArray();
    return all.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });
};

export const getAttendanceRecordsByRange = async (classId: string, startDate: string, endDate: string) => {
    const all = await db.attendanceRecords.where('classId').equals(classId).toArray();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return all.filter(r => {
        const t = new Date(r.date).getTime();
        return t >= start && t <= end;
    });
};

// --- SCOPE MATERIALS ---
export const addScopeMaterial = async (data: Omit<ScopeMaterial, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.scopeMaterials.add(item);
    pushToTurso('eduadmin_materials', [item]);
    return item;
};

export const updateScopeMaterial = async (id: string, data: Partial<ScopeMaterial>) => {
    await db.scopeMaterials.update(id, { ...data, lastModified: Date.now(), isSynced: false });
    const item = await db.scopeMaterials.get(id);
    if(item) pushToTurso('eduadmin_materials', [item]);
    return item;
};

export const getScopeMaterials = async (classId: string, semester: string, userId: string) => {
    let collection = db.scopeMaterials.where('userId').equals(userId);
    if (classId) collection = collection.filter(m => m.classId === classId);
    if (semester) collection = collection.filter(m => m.semester === semester);
    return await collection.toArray();
};

export const deleteScopeMaterial = async (id: string) => {
    await db.scopeMaterials.delete(id);
    pushToTurso('eduadmin_materials', [{id, deleted: true}]);
};

export const bulkDeleteScopeMaterials = async (ids: string[]) => {
    await db.scopeMaterials.bulkDelete(ids);
    pushToTurso('eduadmin_materials', ids.map(id => ({id, deleted: true})));
};

export const copyScopeMaterials = async (sourceClassId: string, targetClassId: string, sourceSem: string, targetSem: string, userId: string, subject: string) => {
    const sources = await db.scopeMaterials.where({ classId: sourceClassId, semester: sourceSem }).toArray();
    if (sources.length === 0) return false;

    const newItems = sources.map(s => ({
        id: uuidv4(),
        classId: targetClassId,
        semester: targetSem,
        userId,
        subject,
        code: s.code,
        phase: s.phase,
        content: s.content,
        subScopes: s.subScopes,
        lastModified: Date.now(),
        isSynced: false
    }));
    
    await db.scopeMaterials.bulkAdd(newItems);
    pushToTurso('eduadmin_materials', newItems);
    return true;
};

// --- SCORES ---
export const saveBulkAssessmentScores = async (scores: Omit<AssessmentScore, 'id'>[], userId: string, teacherName?: string, deletedIds?: string[]) => {
    const itemsToSync: any[] = [];
    
    // Handle Deletions
    if (deletedIds && deletedIds.length > 0) {
        await db.assessmentScores.bulkDelete(deletedIds);
        deletedIds.forEach(id => {
            itemsToSync.push({ id, deleted: true });
        });
    }

    // Handle Upserts
    for (const score of scores) {
        const existing = await db.assessmentScores
            .where({ studentId: score.studentId, category: score.category, materialId: score.materialId || '' })
            .filter(s => s.semester === score.semester && s.classId === score.classId)
            .first();
            
        const payload = {
            ...score,
            id: existing ? existing.id : uuidv4(),
            userId,
            lastModified: Date.now(),
            isSynced: false
        };
        
        await db.assessmentScores.put(payload);
        itemsToSync.push(payload);
    }
    
    pushToTurso('eduadmin_scores', itemsToSync);
};

export const getAssessmentScores = async (classId: string, semester: string) => {
    return await db.assessmentScores.where({ classId, semester }).toArray();
};

// --- JOURNALS ---
export const getTeachingJournals = async (userId: string) => {
    return await db.teachingJournals.where('userId').equals(userId).reverse().sortBy('date');
};

export const addTeachingJournal = async (data: Omit<TeachingJournal, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.teachingJournals.add(item);
    pushToTurso('eduadmin_journals', [item]);
    return item;
};

export const deleteTeachingJournal = async (id: string) => {
    await db.teachingJournals.delete(id);
    pushToTurso('eduadmin_journals', [{id, deleted: true}]);
};

export const bulkDeleteTeachingJournals = async (ids: string[]) => {
    await db.teachingJournals.bulkDelete(ids);
    pushToTurso('eduadmin_journals', ids.map(id => ({id, deleted: true})));
};

// --- SCHEDULES ---
export const getTeachingSchedules = async (userId: string) => {
    return await db.teachingSchedules.where('userId').equals(userId).toArray();
};

export const addTeachingSchedule = async (data: Omit<TeachingSchedule, 'id'|'lastModified'|'isSynced'>) => {
    const item = { ...data, id: uuidv4(), lastModified: Date.now(), isSynced: false };
    await db.teachingSchedules.add(item);
    pushToTurso('eduadmin_schedules', [item]);
    return item;
};

export const deleteTeachingSchedule = async (id: string) => {
    await db.teachingSchedules.delete(id);
    pushToTurso('eduadmin_schedules', [{id, deleted: true}]);
};

// --- LOGS & STATS ---
export const getSystemLogs = async () => {
    return await db.logs.toArray();
};

export const addSystemLog = async (level: LogEntry['level'], actor: string, role: string, action: string, details: string) => {
    const item: LogEntry = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        level, actor, role, action, details,
        lastModified: Date.now(),
        isSynced: false
    };
    await db.logs.add(item);
    pushToTurso('eduadmin_logs', [item]);
};

export const clearSystemLogs = async () => {
    await db.logs.clear();
    // HARD DELETE REMOTE
    try {
        await clearRemoteTable('eduadmin_logs');
    } catch (e) {
        console.error("Failed to clear remote logs:", e);
    }
};

export const getDashboardStats = async (user: User): Promise<DashboardStatsData> => {
    const classes = await db.classes.where('userId').equals(user.id).toArray();
    const classIds = classes.map(c => c.id);
    const students = await db.students.where('classId').anyOf(classIds).toArray();
    const journals = await db.teachingJournals.where('userId').equals(user.id).count();
    
    const attendance = await db.attendanceRecords.where('classId').anyOf(classIds).toArray();
    const present = attendance.filter(a => a.status === 'H').length;
    const rate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

    const males = students.filter(s => s.gender === 'L').length;
    const females = students.filter(s => s.gender === 'P').length;

    return {
        totalClasses: classes.length,
        totalStudents: students.length,
        filledJournals: journals,
        attendanceRate: rate,
        genderDistribution: [
            { name: 'Laki-laki', value: males },
            { name: 'Perempuan', value: females }
        ],
        weeklyAttendance: [] 
    };
};
