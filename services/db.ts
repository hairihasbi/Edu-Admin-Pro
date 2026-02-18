
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
    // Bumped to version 10 to index 'userId' on scopeMaterials table
    (this as any).version(10).stores({
      users: '&id, username, role, status, schoolNpsn',
      classes: '&id, userId, schoolNpsn, name', // Indexed schoolNpsn and name
      students: '&id, classId, schoolNpsn, name, nis, gender', // Indexed schoolNpsn, nis, and gender
      attendanceRecords: '&id, studentId, classId, date',
      scopeMaterials: '&id, classId, semester, userId', // NEW: Added userId index
      assessmentScores: '&id, userId, studentId, classId, semester, category, materialId, subject',
      teachingJournals: '&id, userId, classId, date',
      teachingSchedules: '&id, userId, day',
      logs: '&id, level, actor, action, timestamp',
      emailConfig: '&id', 
      masterSubjects: '&id, name',
      tickets: '&id, userId, status, lastUpdated',
      violations: '&id, studentId, date',
      pointReductions: '&id, studentId, date',
      achievements: '&id, studentId, date',
      counselingSessions: '&id, studentId, date, status',
      whatsappConfigs: '&userId',
      notifications: '&id, targetRole, isRead, createdAt',
      apiKeys: '&id, key, status',
      systemSettings: '&id'
    });
  }
}

export const db = new EduAdminDatabase();
