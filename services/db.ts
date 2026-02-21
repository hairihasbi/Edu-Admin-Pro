
import Dexie, { Table } from 'dexie';
import { 
  User, ClassRoom, Student, AttendanceRecord, 
  ScopeMaterial, AssessmentScore, TeachingJournal, 
  TeachingSchedule, LogEntry, MasterSubject, Ticket, 
  StudentViolation, StudentPointReduction, StudentAchievement, CounselingSession, EmailConfig,
  WhatsAppConfig, Notification, ApiKey, SystemSettings
} from '../types';

export class EduAdminDatabase extends Dexie {
  // Declare implicit table properties.
  // (Just to inform TypeScript. Instantiated by Dexie in stores() method)
  users!: Table<User>;
  classes!: Table<ClassRoom>;
  students!: Table<Student>;
  attendanceRecords!: Table<AttendanceRecord>;
  scopeMaterials!: Table<ScopeMaterial>;
  assessmentScores!: Table<AssessmentScore>;
  teachingJournals!: Table<TeachingJournal>;
  teachingSchedules!: Table<TeachingSchedule>;
  logs!: Table<LogEntry>;
  emailConfig!: Table<EmailConfig & { id: string }>; // Config usually singleton, but stored as table
  masterSubjects!: Table<MasterSubject>;
  tickets!: Table<Ticket>;
  violations!: Table<StudentViolation>;
  pointReductions!: Table<StudentPointReduction>; // Added
  achievements!: Table<StudentAchievement>;
  counselingSessions!: Table<CounselingSession>;
  whatsappConfigs!: Table<WhatsAppConfig>;
  notifications!: Table<Notification>;
  apiKeys!: Table<ApiKey>;
  systemSettings!: Table<SystemSettings>;

  constructor() {
    super('EduAdminDB');
    
    // Define tables and indexes
    // & = Primary Key
    // * = Multi-entry index (not used here)
    // [field] = Indexed field for searching
    // Added schoolNpsn indexes for multi-tenancy filtering
    // Bumped to version 15 to include new quota fields
    (this as any).version(15).stores({
      users: '&id, username, role, status, schoolNpsn, isSynced',
      classes: '&id, userId, schoolNpsn, name, isSynced', 
      students: '&id, classId, schoolNpsn, name, nis, gender, isSynced', 
      attendanceRecords: '&id, studentId, classId, date, isSynced',
      scopeMaterials: '&id, classId, semester, userId, isSynced', 
      assessmentScores: '&id, userId, studentId, classId, semester, category, materialId, subject, isSynced',
      teachingJournals: '&id, userId, classId, date, isSynced',
      teachingSchedules: '&id, userId, day, isSynced',
      logs: '&id, level, actor, action, timestamp, isSynced',
      emailConfig: '&id, isSynced', 
      masterSubjects: '&id, name, isSynced',
      tickets: '&id, userId, status, lastUpdated, isSynced',
      violations: '&id, studentId, date, isSynced',
      pointReductions: '&id, studentId, date, isSynced',
      achievements: '&id, studentId, date, isSynced',
      counselingSessions: '&id, studentId, date, status, isSynced',
      whatsappConfigs: '&userId, isSynced',
      notifications: '&id, targetRole, isRead, createdAt, isSynced',
      apiKeys: '&id, key, status, isSynced',
      systemSettings: '&id, isSynced'
    });
  }
}

export const db = new EduAdminDatabase();
