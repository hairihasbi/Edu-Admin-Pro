
export enum UserRole {
  ADMIN = 'ADMIN',
  GURU = 'GURU',
  TENDIK = 'TENDIK',
  SISWA = 'SISWA',
  ORANG_TUA = 'ORANG_TUA'
}

export type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

// Base interface for syncable items 
export interface Syncable {
  lastModified?: number; // Timestamp
  isSynced?: boolean;
  version?: number; // Integer version for optimistic locking
  deleted?: boolean; // NEW: Soft Delete Flag
  createdAt?: string; // ISO String
  updatedAt?: string; // ISO String
}

export interface User extends Syncable {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  email?: string; 
  phone?: string;
  role: UserRole;
  status?: UserStatus; 
  avatar: string;
  nip?: string;
  schoolName?: string;
  schoolNpsn?: string;
  subject?: string;
  secondarySubject?: string;
  additionalRole?: 'WALI_KELAS' | 'WAKASEK_KURIKULUM' | 'KEPALA_SEKOLAH' | null; 
  homeroomClassId?: string | null;
  homeroomClassName?: string | null;
  classId?: string; // Target: Student's class ID
  teacherType?: 'SUBJECT' | 'CLASS';
  phase?: 'A' | 'B' | 'C';
  isMultiSubject?: boolean;
  subjects?: string[];
  rppUsageCount?: number;
  rppLastReset?: string;
  isSupervisor?: boolean;
  isRfidOfficer?: boolean;
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
  // RFID Attendance Settings
  rfidCheckInStart?: string; // e.g. "06:00"
  rfidCheckInLate?: string; // e.g. "07:30"
  rfidCheckOutStart?: string; // e.g. "14:00"
  rfidCooldownSeconds?: number; // Time between scans for same card
  rfidAntiDuplicateMinutes?: number; // Time between scans for same student across different devices
  rfidBlockedTags?: string[]; // List of lost/blocked card IDs
  // AI Configuration (LiteLLM / Custom Gateway)
  aiProvider?: 'GOOGLE' | 'CUSTOM';
  aiBaseUrl?: string; // e.g. https://my-litellm.com/v1
  aiApiKey?: string; // Custom Key
  aiModel?: string; // e.g. gemini-pro, gpt-3.5-turbo (mapped in gateway)
  // Quota Management
  rppMonthlyLimit?: number; // 0 = Unlimited
  // DOKU Payment Gateway
  dokuClientId?: string;
  dokuSecretKey?: string;
  dokuIsProduction?: boolean;
  headmasterName?: string;
  headmasterNip?: string;
  schoolCity?: string;
}

export interface Donation extends Syncable {
  id: string;
  userId: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: 'DOKU' | 'MANUAL';
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  paymentUrl?: string;
  createdAt: string;
  paidAt?: string;
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
  // Homeroom Logic
  homeroomTeacherId?: string | null; // ID Wali Kelas
  homeroomTeacherName?: string | null; // Nama Wali Kelas (untuk display)
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
  rfidTag?: string;
}

export interface StudentWithDetails extends Student {
  className: string;
  teacherName: string;
  schoolName: string;
}

export interface RfidLog extends Syncable {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  schoolNpsn: string;
  timestamp: string;
  status: 'HADIR' | 'PULANG' | 'TERLAMBAT' | 'IZIN';
  method: 'KEYBOARD' | 'SERIAL';
  deviceId?: string; // NEW: To track which pos/device sent the log
}
export interface AttendanceRecord extends Syncable {
  id: string;
  studentId: string;
  classId: string;
  userId: string; // NEW: Owner of the record
  date: string; 
  status: 'H' | 'S' | 'I' | 'A';
  visibility: 'PRIVATE' | 'SHARED'; // NEW: Visibility control
  notes?: string; // NEW: Additional notes
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
  subScopes?: string[]; // NEW: Array of sub-column names e.g. ["Tugas", "Praktik"]
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
  scoreDetails?: Record<string, number>; // NEW: Store sub-scores e.g. {"Tugas": 80, "Praktik": 90}
}

export interface AbsentStudent {
  studentId: string;
  name: string;
  status: 'S' | 'I' | 'A'; // Sakit, Ijin, Alfa
}

export interface TeachingJournal extends Syncable {
  id: string;
  userId: string;
  classId: string;
  subject?: string; // NEW: Subject filter
  materialId: string; 
  learningObjective: string; 
  date: string;
  meetingNo: string;
  activities: string;
  reflection?: string;
  followUp?: string;
  examAgenda?: string; // NEW: Exam Agenda
  absentStudents?: string; // JSON string of AbsentStudent[]
}

export interface TeachingSchedule extends Syncable {
  id: string;
  userId: string;
  schoolNpsn?: string; // NEW: Multi-tenancy Key
  day: string; 
  meetingNo?: number; // NEW: Jam Ke (Mulai)
  meetingNoEnd?: number; // NEW: Jam Ke (Selesai)
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
  useEEAT?: boolean; // NEW: EEAT Standard (Experience, Expertise, Authoritativeness, Trustworthiness)
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
export interface ClassInventory extends Syncable {
  id: string;
  classId: string;
  userId: string;
  schoolNpsn: string;
  itemName: string;
  volume: number;
  condition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_SEDANG' | 'RUSAK_BERAT';
  notes?: string;
}

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

export interface HomeVisit extends Syncable {
  id: string;
  studentId: string;
  classId: string;
  schoolNpsn: string;
  date: string;
  address: string;
  reason: string;
  result: string;
  followUp: string;
  notes?: string;
  userId: string;
}

export interface ParentCall extends Syncable {
  id: string;
  studentId: string;
  classId: string;
  schoolNpsn: string;
  date: string;
  parentName: string;
  parentPhone: string;
  problem: string;
  solution: string;
  followUp: string;
  notes?: string;
  userId: string;
}

export interface LearningStyleAssessment extends Syncable {
  id: string;
  studentId: string;
  classId: string;
  schoolNpsn: string;
  userId: string; // Homeroom Teacher ID
  visualScore: number;
  auditoryScore: number;
  kinestheticScore: number;
  dominantStyle: string;
  date: string;
  method: 'MANUAL' | 'DIGITAL';
}

// Backup API Key
export interface PasswordReset extends Syncable {
  id: string;
  userId: string;
  token: string;
  expiry: string; // ISO String
  used: boolean;
}

export interface ApiKey extends Syncable {
  id: string;
  key: string;
  provider: 'GEMINI';
  status: 'ACTIVE' | 'DEAD';
  addedAt: string;
}

export interface DailyPicket extends Syncable {
  id: string;
  date: string; // YYYY-MM-DD
  schoolNpsn: string;
  officers: string[]; // Array of teacher names
  notes?: string;
}

export interface StudentIncident extends Syncable {
  id: string;
  picketId: string; // FK to DailyPicket
  studentName: string;
  className: string;
  time: string; // HH:mm
  returnTime?: string; // HH:mm for PERMIT_EXIT
  type: 'LATE' | 'PERMIT_EXIT' | 'EARLY_HOME';
  reason?: string;
}

export interface TeacherCalendarEvent extends Syncable {
  id: string;
  userId: string; // Foreign Key ke User (Guru)
  date: string;   // Format YYYY-MM-DD
  type: 'HOLIDAY' | 'LEAVE' | 'SCHOOL_EVENT' | 'OTHER';
  description: string;
}

export interface SupervisionAssignment extends Syncable {
  id: string;
  supervisorId: string; // User ID of the supervisor
  teacherId: string; // User ID of the teacher being supervised
  schoolNpsn: string;
  status: 'PENDING' | 'COMPLETED';
  startDate?: string; // Format YYYY-MM-DD
  endDate?: string;   // Format YYYY-MM-DD
  scheduledDate?: string; // Legacy field for compatibility
}

export interface SupervisionResult extends Syncable {
  id: string;
  assignmentId: string;
  supervisorId: string;
  teacherId: string;
  schoolNpsn: string;
  date: string;
  score: number; // Overall score
  notes?: string; // Overall notes
  
  // Section 1: Administrasi Perencanaan Pembelajaran
  planningAdmin?: {
    scores: Record<string, number>;
    comments: Record<string, string>;
    totalRealScore: number;
    finalScore: number;
    predicate: string;
    coachingSuggestion?: string;
  };

  // Section 2: RPP Guru
  lessonPlan?: {
    scores: Record<string, number>;
    comments: Record<string, string>;
    totalRealScore: number;
    finalScore: number;
    predicate: string;
    coachingSuggestion?: string;
  };

  // Section 3: Pelaksanaan Pembelajaran
  implementation?: {
    scores: Record<string, number>;
    comments: Record<string, string>;
    totalRealScore: number;
    finalScore: number;
    predicate: string;
    coachingSuggestion?: string;
  };

  // Legacy support
  aspects?: {
    aspect: string;
    score: number;
    comment?: string;
  }[];
}

export interface CbtExam extends Syncable {
  id: string;
  userId: string;
  title: string;
  subject: string;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK' | 'MA' | 'OTHERS';
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  token?: string;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  schoolNpsn: string;
  teacherName?: string;
  targetClassIds?: string[];
  questionsType?: 'INTERNAL' | 'EXTERNAL_LINK';
  externalLink?: string;
}

export interface CbtQuestion extends Syncable {
  id: string;
  examId: string;
  questionText: string;
  type: 'MULTIPLE_CHOICE' | 'ESSAY';
  options?: {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  };
  correctAnswer?: string; // 'a', 'b', 'c', 'd', 'e'
  imageData?: string; // Base64 Compressed Image
  sortOrder: number;
}

export interface CbtAttempt extends Syncable {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  startTime: string; // ISO String
  endTime?: string;   // ISO String
  score?: number;
  correctCount?: number;
  wrongCount?: number;
  answers: Record<string, string>; // questionId -> answer
  violationCount: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'CLOSED';
  schoolNpsn: string;
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
    classInventory?: ClassInventory[];
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
    cbtExams?: CbtExam[];
    cbtQuestions?: CbtQuestion[];
    cbtAttempts?: CbtAttempt[];
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
  rotatorId?: string; // NEW: Optional Rotator ID for Fonnte
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

export const SD_SUBJECTS_PHASE_A = [
  "Pendidikan Agama dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)",
  "Seni dan Budaya (Rupa/Musik/Teater/Tari)",
  "Bahasa Inggris (Pilihan)",
  "Muatan Lokal (Pilihan)"
];

export const SD_SUBJECTS_PHASE_BC = [
  "Pendidikan Agama dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)",
  "Seni dan Budaya (Rupa/Musik/Teater/Tari)",
  "Bahasa Inggris (Pilihan)",
  "Muatan Lokal (Pilihan)",
  "Ilmu Pengetahuan Alam dan Sosial (IPAS)"
];

export const MATH_SUBJECT_OPTIONS = [
  "Matematika Umum",
  "Matematika Tingkat Lanjut"
];
