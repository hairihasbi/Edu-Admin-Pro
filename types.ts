
export enum UserRole {
  ADMIN = 'ADMIN',
  GURU = 'GURU',
}

export type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

// Base interface for syncable items
export interface Syncable {
  lastModified?: number; // Timestamp
  isSynced?: boolean;
  version?: number; // Integer version for optimistic locking
  deleted?: boolean; // NEW: Soft Delete Flag
}

export interface User extends Syncable {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  email?: string; 
  phone?: string; // Added phone number
  role: UserRole;
  status?: UserStatus; 
  avatar: string;
  nip?: string;
  schoolName?: string;
  schoolNpsn?: string; // NEW: Multi-tenancy Key
  subject?: string;
  additionalRole?: 'WALI_KELAS'; 
  homeroomClassId?: string; 
}

export interface SystemSettings extends Syncable {
  id: string; // usually 'global-settings'
  featureRppEnabled: boolean;
  maintenanceMessage?: string;
  // Site Settings
  appName?: string;
  schoolName?: string;
  appDescription?: string; // SEO Meta Description
  appKeywords?: string; // SEO Keywords
  logoUrl?: string; // URL Logo Aplikasi
  faviconUrl?: string; // URL Favicon
  timezone?: string; // e.g. 'Asia/Jakarta'
  footerText?: string;
}

export interface MasterSubject extends Syncable {
  id: string;
  name: string; 
  category: 'UMUM' | 'KEJURUAN' | 'MULOK' | 'PILIHAN';
  level: 'SD' | 'SMP' | 'SMA' | 'SMK' | 'SEMUA'; // Added Level
}

export interface LogEntry extends Syncable {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'AUDIT';
  actor: string; 
  role: string; 
  action: string; 
  details: string; 
}

export interface DashboardStatsData {
  totalClasses: number;
  totalStudents: number;
  filledJournals: number;
  attendanceRate: number;
  genderDistribution: { name: string; value: number }[];
  weeklyAttendance: { name: string; hadir: number; sakit: number; izin: number }[];
}

export interface DashboardStat {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
}

export interface ClassRoom extends Syncable {
  id: string;
  userId: string; // Creator ID
  schoolNpsn: string; // NEW: Shared ID per School
  name: string; 
  description?: string;
  studentCount: number;
}

export interface Student extends Syncable {
  id: string;
  classId: string;
  schoolNpsn?: string; // NEW: Deduplication Key
  name: string;
  nis: string;
  gender: 'L' | 'P';
  attendance?: number; 
  averageScore?: number;
  phone?: string; // Added phone number for WhatsApp
}

export interface StudentWithDetails extends Student {
  className: string;
  teacherName: string;
  schoolName: string;
}

export interface AttendanceRecord extends Syncable {
  id: string;
  studentId: string;
  classId: string;
  date: string; 
  status: 'H' | 'S' | 'I' | 'A';
}

export interface ScopeMaterial extends Syncable {
  id: string;
  classId: string;
  userId: string; // NEW: Private ownership
  subject?: string; // NEW: Subject filter
  semester: string;
  code: string; 
  phase: string; 
  content: string; 
}

export interface AssessmentScore extends Syncable {
  id: string;
  userId?: string; // NEW: Owner of the score (Teacher ID)
  studentId: string;
  classId: string;
  semester: string;
  subject?: string; 
  category: 'LM' | 'STS' | 'SAS'; 
  materialId?: string; 
  score: number;
}

export interface TeachingJournal extends Syncable {
  id: string;
  userId: string;
  classId: string;
  materialId: string; 
  learningObjective: string; 
  date: string;
  meetingNo: string;
  activities: string;
  reflection?: string;
  followUp?: string;
}

export interface TeachingSchedule extends Syncable {
  id: string;
  userId: string;
  day: string; 
  timeStart: string; 
  timeEnd: string; 
  className: string;
  subject: string;
}

// Updated RPP Request Interface
export interface LessonPlanRequest {
  // Tahap 1: Identitas
  curriculumType: 'MERDEKA' | 'CINTA';
  teacherName: string;
  teacherNip: string;
  headmasterName: string;
  headmasterNip: string;
  schoolName: string;
  subject: string;
  grade: string;
  phase: string;
  semester: string;
  academicYear: string;
  timeAllocation: string;
  city: string;
  date: string;

  // Tahap 2: Detail Pembelajaran
  topic: string;
  learningModel: string;
  learningStrategy: string;
  cpMode: 'MANUAL' | 'AUTO';
  cpManualContent?: string;
  graduateProfileDimensions: string[]; // Dimensi Profil Lulusan

  // Tahap 3: Asesmen
  assessmentType: string;
  assessmentInstrument: string;
  
  // Fitur Tambahan
  useSearch?: boolean; // NEW: AI Fact Check / Grounding
}

export interface Notification extends Syncable {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert' | 'maintenance' | 'update'; // Added maintenance & update
  isRead: boolean;
  isPopup?: boolean; // New Flag for Banner
  createdAt: string;
  targetRole: 'ALL' | UserRole;
}

// --- TICKETING SYSTEM TYPES ---
export interface TicketMessage {
  id: string;
  senderRole: UserRole; 
  senderName: string;
  message: string;
  timestamp: string;
}

export interface Ticket extends Syncable {
  id: string;
  userId: string; 
  teacherName: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  lastUpdated: string;
  messages: TicketMessage[];
}

// --- BK / GUIDANCE TYPES ---
export interface StudentViolation extends Syncable {
  id: string;
  studentId: string;
  date: string;
  violationName: string;
  points: number;
  description?: string;
  reportedBy: string;
}

export interface StudentPointReduction extends Syncable {
  id: string;
  studentId: string;
  date: string;
  activityName: string; // e.g. "Membersihkan Perpustakaan"
  pointsRemoved: number; // e.g. 10
  description?: string;
}

export interface StudentAchievement extends Syncable {
  id: string;
  studentId: string;
  date: string;
  title: string;
  level: 'Sekolah' | 'Kecamatan' | 'Kabupaten' | 'Provinsi' | 'Nasional' | 'Internasional';
  description?: string;
}

export interface CounselingSession extends Syncable {
  id: string;
  studentId: string;
  date: string;
  issue: string; 
  notes: string; 
  followUp?: string; 
  status: 'OPEN' | 'CLOSED';
}

// Backup API Key
export interface ApiKey extends Syncable {
  id: string;
  key: string;
  provider: 'GEMINI';
  status: 'ACTIVE' | 'DEAD';
  addedAt: string;
}

export interface BackupData {
  meta: {
    version: string;
    date: string;
    generatedBy: string;
    role: UserRole;
    semesterFilter?: string;
  };
  data: {
    users?: User[];
    classes: ClassRoom[];
    students: Student[];
    scopeMaterials: ScopeMaterial[];
    assessmentScores: AssessmentScore[];
    teachingJournals: TeachingJournal[];
    teachingSchedules?: TeachingSchedule[];
    attendanceRecords?: AttendanceRecord[];
    masterSubjects?: MasterSubject[]; 
    tickets?: Ticket[];
    violations?: StudentViolation[]; 
    pointReductions?: StudentPointReduction[]; // Added
    achievements?: StudentAchievement[]; 
    counselingSessions?: CounselingSession[]; 
    notifications?: Notification[];
    apiKeys?: ApiKey[]; // Include keys in backup
    systemSettings?: SystemSettings[]; // Include settings
  };
}

export type EmailProvider = 'MAILERSEND' | 'BREVO';
export type EmailMethod = 'API' | 'SMTP';

// Fixed: Extend Syncable
export interface EmailConfig extends Syncable {
  provider: EmailProvider;
  method: EmailMethod;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
}

export interface WhatsAppConfig extends Syncable {
  userId: string; // Link to specific user (Admin/Guru)
  provider: 'FLOWKIRIM' | 'OTHER' | 'FONNTE';
  baseUrl: string; // API Endpoint
  apiKey: string;
  deviceId?: string; // Optional device ID for some providers
  isActive: boolean;
}

export interface ApiKeyStats {
  keyName: string; // e.g. "GEMINI_KEY_1"
  maskedKey: string; // e.g. "sk-....A1B2"
  status: 'ACTIVE' | 'DEAD' | 'RATE_LIMITED';
  usageCount: number;
  lastUsed?: string;
  errorCount: number;
}

export type ViewState = 'dashboard' | 'students' | 'teachers' | 'classes' | 'ai-assistant' | 'settings' | 'profile';
