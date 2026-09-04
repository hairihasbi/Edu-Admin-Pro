
import React, { useState, useEffect } from 'react';
import { User, Student, MasterSubject, AssessmentScore, ClassRoom, StudentViolation, StudentAchievement, CounselingSession, ClassInventory, HomeVisit, ParentCall, StudentPointReduction, HomeroomGuidanceSession } from '../types';
import { 
  getStudents, getMasterSubjects, getAssessmentScores, getAllClasses, 
  getStudentViolations, getStudentAchievements, getCounselingSessions,
  getClassInventory, saveClassInventory, deleteClassInventory, getSystemSettings,
  getHomeVisits, getParentCalls, getAttendanceRecordsByRange, getRfidLogs,
  getStudentPointReductions, addStudentViolation, addStudentPointReduction,
  deleteStudentViolation, deleteStudentPointReduction, updateStudentViolation, updateStudentPointReduction,
  getHomeroomGuidanceSessions, saveHomeroomGuidanceSession, deleteHomeroomGuidanceSession
} from '../services/database';
import { 
  UserCheck, Users, GraduationCap, AlertTriangle, FileSpreadsheet, 
  Search, Filter, Printer, ShieldAlert, Trophy, MessageSquareHeart, 
  ChevronDown, ChevronUp, AlertCircle, MessageCircle, Package, Plus, Save, Trash2, X, FileText,
  HeartPulse, TrendingUp, Clock, Calendar, RefreshCcw, Pencil, ClipboardList, ClipboardCheck, CheckCircle, Download, BookOpen, Award, Check
} from './Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

interface TeacherHomeroomProps {
  user: User;
}

export interface HomeroomWorkplanItem {
  id: string;
  category: string;
  title: string;
  targetMonth: string;
  indicator: string;
  status: 'BELUM' | 'PROSES' | 'TERLAKSANA' | 'TERTUNDA';
  progress: number;
  notes?: string;
}

export interface HomeroomLpjReport {
  evaluationSummary: string;
  obstacles: string;
  solutions: string;
  recommendations: string;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DEFAULT_WORKPLAN_TEMPLATES: HomeroomWorkplanItem[] = [
  {
    id: 'wp-1',
    category: 'Organisasi & Administrasi',
    title: 'Pembentukan Pengurus Kelas & Pembagian Kelompok Piket',
    targetMonth: 'Juli',
    indicator: 'Terbentuk struktur organisasi kelas dan jadwal piket kebersihan harian',
    status: 'TERLAKSANA',
    progress: 100,
    notes: 'Berjalan lancar pada minggu pertama masuk sekolah'
  },
  {
    id: 'wp-2',
    category: 'Fisik & Kebersihan',
    title: 'Penataan Kelengkapan & Keindahan Ruang Kelas',
    targetMonth: 'Juli - Agustus',
    indicator: 'Tersedia struktur kelas, denah duduk, jadwal piket, sudut baca, dan inventaris terdata',
    status: 'TERLAKSANA',
    progress: 100,
    notes: 'Dilengkapi dengan pendataan inventaris kelas'
  },
  {
    id: 'wp-3',
    category: 'Paguyuban Ortu',
    title: 'Musyawarah Pembentukan Paguyuban Orang Tua / Wali Murid',
    targetMonth: 'Agustus',
    indicator: 'Terbentuk paguyuban ortu dan grup komunikasi WhatsApp kelas',
    status: 'TERLAKSANA',
    progress: 100,
    notes: 'Keterlibatan orang tua sangat mendukung program sekolah'
  },
  {
    id: 'wp-4',
    category: 'Karakter & Kedisiplinan',
    title: 'Pembinaan Ketertiban, Presensi & Karakter Kedisiplinan Siswa',
    targetMonth: 'Setiap Bulan',
    indicator: 'Tingkat kehadiran siswa ≥ 95% dan penurunan poin pelanggaran siswa',
    status: 'PROSES',
    progress: 85,
    notes: 'Rutin dipantau via sistem presensi RFID & koordinasi dengan BK'
  },
  {
    id: 'wp-5',
    category: 'Akademik & Bimbingan',
    title: 'Pendampingan Belajar, Monitoring Leger & Program Remedial',
    targetMonth: 'Tengah & Akhir Semester',
    indicator: 'Seluruh siswa tuntas KKM (≥ 75) dan mendapat bimbingan hasil belajar',
    status: 'PROSES',
    progress: 80,
    notes: 'Monitoring capaian nilai leger tengah semester dan koordinasi guru mapel'
  },
  {
    id: 'wp-6',
    category: 'Karakter & Kedisiplinan',
    title: 'Pelaksanaan Kunjungan Rumah (Home Visit) & Panggilan Ortu Kasus Khusus',
    targetMonth: 'Insidental / Sesuai Kebutuhan',
    indicator: 'Terlaksananya penanganan siswa bermasalah secara intensif',
    status: 'PROSES',
    progress: 75,
    notes: 'Dicatat dan tersinkronisasi di menu BK Center & Wali Kelas'
  },
  {
    id: 'wp-7',
    category: 'Organisasi & Administrasi',
    title: 'Penyusunan LPJ Wali Kelas & Pembagian Rapor Semester',
    targetMonth: 'Desember / Juni',
    indicator: 'Rapor terbagikan tepat waktu & LPJ Wali Kelas tersusun lengkap',
    status: 'PROSES',
    progress: 90,
    notes: 'Penyusunan laporan kinerja & cetak LPJ akhir semester'
  }
];

const DEFAULT_INVENTORY_ITEMS = [
  'Meja Guru', 'Kursi Guru', 'Meja Siswa', 'Kursi Siswa', 
  'Sapu', 'Pel Lantai', 'Ember', 'Jam Dinding', 
  'Kipas Angin', 'Papan Tulis'
];

const TeacherHomeroom: React.FC<TeacherHomeroomProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'academic' | 'behavior' | 'inventory' | 'health' | 'workplan'>('academic');
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [detectedSubjects, setDetectedSubjects] = useState<string[]>([]);
  
  // Health Data State
  const [todayAttendance, setTodayAttendance] = useState<{ 
    absent: number; 
    alpha: number;
    sakit: number;
    izin: number;
    late: number; 
    rfidLateDetail: string[];
    alphaDetail: string[];
    sakitDetail: string[];
    izinDetail: string[];
  }>({ 
    absent: 0, 
    alpha: 0,
    sakit: 0,
    izin: 0,
    late: 0, 
    rfidLateDetail: [],
    alphaDetail: [],
    sakitDetail: [],
    izinDetail: []
  });
  const [frequentAbsentees, setFrequentAbsentees] = useState<{ student: Student; alphaCount: number }[]>([]);
  const [disciplineTrend, setDisciplineTrend] = useState<any[]>([]);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  
  // BK Data State
  const [violations, setViolations] = useState<StudentViolation[]>([]);
  const [pointReductions, setPointReductions] = useState<StudentPointReduction[]>([]);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [homeVisits, setHomeVisits] = useState<HomeVisit[]>([]);
  const [parentCalls, setParentCalls] = useState<ParentCall[]>([]);
  const [homeroomGuidances, setHomeroomGuidances] = useState<HomeroomGuidanceSession[]>([]);

  // Simple Form Modal for Wali Kelas (Point Recording)
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [selectedStudentForForm, setSelectedStudentForForm] = useState<Student | null>(null);
  const [violationFormType, setViolationFormType] = useState<'VIOLATION' | 'REDUCTION'>('VIOLATION');
  const [editingRecord, setEditingRecord] = useState<{ type: 'VIOLATION' | 'REDUCTION', id: string, reportedBy?: string } | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [formInput, setFormInput] = useState({
    category: 'Terlambat',
    customCategory: '',
    points: 5,
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Homeroom Guidance Follow-up State
  const [guidanceSubTab, setGuidanceSubTab] = useState<'DISCIPLINE_OVERVIEW' | 'GUIDANCE_RECORDS'>('DISCIPLINE_OVERVIEW');
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);
  const [selectedStudentForGuidance, setSelectedStudentForGuidance] = useState<Student | null>(null);
  const [editingGuidanceId, setEditingGuidanceId] = useState<string | null>(null);
  const [guidanceSearchQuery, setGuidanceSearchQuery] = useState('');
  const [guidanceStatusFilter, setGuidanceStatusFilter] = useState<string>('ALL');
  const [guidanceForm, setGuidanceForm] = useState<{
    date: string;
    violationSummary: string;
    guidanceType: string;
    notes: string;
    studentCommitment: string;
    status: 'Selesai/Membaik' | 'Dalam Pantauan' | 'Perlu Eskalasi ke BK';
    followUpDate: string;
    parentInformed: boolean;
  }>({
    date: new Date().toISOString().split('T')[0],
    violationSummary: '',
    guidanceType: 'Konseling Pribadi',
    notes: '',
    studentCommitment: '',
    status: 'Dalam Pantauan',
    followUpDate: '',
    parentInformed: false
  });

  // Workplan & LPJ State
  const [workplanItems, setWorkplanItems] = useState<HomeroomWorkplanItem[]>([]);
  const [lpjReport, setLpjReport] = useState<HomeroomLpjReport>({
    evaluationSummary: '',
    obstacles: '',
    solutions: '',
    recommendations: ''
  });
  const [showWorkplanModal, setShowWorkplanModal] = useState(false);
  const [editingWorkplan, setEditingWorkplan] = useState<HomeroomWorkplanItem | null>(null);
  const [workplanForm, setWorkplanForm] = useState<{
    category: string;
    title: string;
    targetMonth: string;
    indicator: string;
    status: 'BELUM' | 'PROSES' | 'TERLAKSANA' | 'TERTUNDA';
    progress: number;
    notes: string;
  }>({
    category: 'Organisasi & Administrasi',
    title: '',
    targetMonth: 'Juli',
    indicator: '',
    status: 'BELUM',
    progress: 0,
    notes: ''
  });

  // Inventory State
  const [inventoryItems, setInventoryItems] = useState<ClassInventory[]>([]);
  const [isSavingInventory, setIsSavingInventory] = useState(false);

  // Monthly Attendance Recap State for LPJ Report
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const [recapMonth, setRecapMonth] = useState<number>(prevMonthDate.getMonth());
  const [recapYear, setRecapYear] = useState<number>(prevMonthDate.getFullYear());
  const [customEffectiveDays, setCustomEffectiveDays] = useState<number>(22);
  const [isCalculatingRecap, setIsCalculatingRecap] = useState<boolean>(false);
  const [recapSearchQuery, setRecapSearchQuery] = useState<string>('');

  const [attendanceRecapList, setAttendanceRecapList] = useState<Array<{
    studentId: string;
    nis: string;
    name: string;
    gender?: string;
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    totalDays: number;
    percentage: number;
    predicate: string;
  }>>([]);

  const [attendanceRecapSummary, setAttendanceRecapSummary] = useState({
    monthName: INDONESIAN_MONTHS[prevMonthDate.getMonth()] || '',
    year: prevMonthDate.getFullYear(),
    totalStudents: 0,
    effectiveDays: 22,
    classPercentage: 0,
    totalHadir: 0,
    totalSakit: 0,
    totalIzin: 0,
    totalAlfa: 0
  });

  const [className, setClassName] = useState('...');
  const [selectedSemester, setSelectedSemester] = useState('Ganjil');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  
  // KKM State
  const [kkm, setKkm] = useState<number>(75);
  
  // Expanded row state for Behavior tab
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Print Settings (for LPJ, Portfolio, Inventory, BK Reports)
  const [printSettings, setPrintSettings] = useState({
    showDate: true,
    showSignature: true,
    place: 'Jakarta',
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    homeroomName: user.fullName || '',
    homeroomNip: user.nip || '-',
    headmasterName: '',
    headmasterNip: '',
    bkName: '',
    bkNip: ''
  });
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Helper to update & persist print settings
  const handleUpdatePrintSetting = (field: string, value: any) => {
    setPrintSettings(prev => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem(`homeroom_print_settings_${user.schoolNpsn || 'default'}`, JSON.stringify(updated));
      } catch (e) {
        console.error("Error saving print settings", e);
      }
      return updated;
    });
  };

  // Load saved print settings on mount
  useEffect(() => {
    const key = `homeroom_print_settings_${user.schoolNpsn || 'default'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPrintSettings(prev => ({
          ...prev,
          ...parsed,
          homeroomName: parsed.homeroomName || user.fullName,
          homeroomNip: parsed.homeroomNip || user.nip || '-'
        }));
      } catch (e) {
        console.error("Error parsing saved print settings", e);
      }
    }
  }, [user.schoolNpsn, user.fullName, user.nip]);

  const visibleSubjects = filterSubject === 'ALL' 
      ? detectedSubjects 
      : detectedSubjects.filter(s => s === filterSubject);

  useEffect(() => {
    const fetchData = async () => {
      if (!user.homeroomClassId) return;
      setIsLoading(true);

      const [allClasses, studentData, scoreData, violationData, reductionData, achievementData, sessionData, inventoryData, settings, homeVisitData, parentCallData, guidanceData] = await Promise.all([
        getAllClasses(),
        getStudents(user.homeroomClassId),
        getAssessmentScores(user.homeroomClassId, selectedSemester),
        getStudentViolations(), 
        getStudentPointReductions(),
        getStudentAchievements(),
        getCounselingSessions(),
        getClassInventory(user.homeroomClassId),
        getSystemSettings(),
        getHomeVisits(user.schoolNpsn || 'DEFAULT'),
        getParentCalls(user.schoolNpsn || 'DEFAULT'),
        getHomeroomGuidanceSessions(user.schoolNpsn || 'DEFAULT', user.homeroomClassId)
      ]);

      const cls = allClasses.find(c => c.id === user.homeroomClassId);
      setClassName(cls ? cls.name : 'Unknown Class');
      setStudents(studentData);
      setScores(scoreData);
      
      // Extract unique subjects from scores
      const uniqueSubjects = Array.from(new Set((scoreData as AssessmentScore[]).map(s => s.subject || 'Umum'))).sort();
      setDetectedSubjects(uniqueSubjects);

      // Filter BK Data for current students
      const studentIds = new Set(studentData.map(s => s.id));
      setViolations(violationData.filter(v => studentIds.has(v.studentId)));
      setPointReductions(reductionData.filter(r => studentIds.has(r.studentId)));
      setAchievements(achievementData.filter(a => studentIds.has(a.studentId)));
      setSessions(sessionData.filter(s => studentIds.has(s.studentId)));
      setHomeVisits(homeVisitData.filter(hv => studentIds.has(hv.studentId)));
      setParentCalls(parentCallData.filter(pc => studentIds.has(pc.studentId)));
      setHomeroomGuidances(guidanceData.filter(g => studentIds.has(g.studentId)));

      // Initialize Inventory if empty with defaults
      if (inventoryData.length === 0) {
        const defaults = DEFAULT_INVENTORY_ITEMS.map(name => ({
          classId: user.homeroomClassId!,
          userId: user.id,
          schoolNpsn: user.schoolNpsn || 'DEFAULT',
          itemName: name,
          volume: 0,
          condition: 'BAIK' as const,
          notes: ''
        }));
        setInventoryItems(defaults as ClassInventory[]);
      } else {
        setInventoryItems(inventoryData);
      }

      if (settings) {
        setPrintSettings(prev => {
          const key = `homeroom_print_settings_${user.schoolNpsn || 'default'}`;
          const saved = localStorage.getItem(key);
          let loadedSaved: any = {};
          if (saved) {
            try { loadedSaved = JSON.parse(saved); } catch(e) {}
          }
          return {
            ...prev,
            headmasterName: loadedSaved.headmasterName !== undefined && loadedSaved.headmasterName !== '' ? loadedSaved.headmasterName : (settings.headmasterName || prev.headmasterName || ''),
            headmasterNip: loadedSaved.headmasterNip !== undefined && loadedSaved.headmasterNip !== '' ? loadedSaved.headmasterNip : (settings.headmasterNip || prev.headmasterNip || ''),
            bkName: loadedSaved.bkName !== undefined && loadedSaved.bkName !== '' ? loadedSaved.bkName : ((settings as any).bkName || prev.bkName || ''),
            bkNip: loadedSaved.bkNip !== undefined && loadedSaved.bkNip !== '' ? loadedSaved.bkNip : ((settings as any).bkNip || prev.bkNip || ''),
            place: loadedSaved.place !== undefined && loadedSaved.place !== '' ? loadedSaved.place : (settings.schoolCity && settings.schoolCity.trim() !== '' ? settings.schoolCity : prev.place)
          };
        });
      }

      // Load Workplan & LPJ from localStorage
      const wpKey = `homeroom_workplan_${user.homeroomClassId}_${selectedSemester}`;
      const lpjKey = `homeroom_lpj_${user.homeroomClassId}_${selectedSemester}`;

      const savedWp = localStorage.getItem(wpKey);
      if (savedWp) {
        try { setWorkplanItems(JSON.parse(savedWp)); } catch(e) { setWorkplanItems(DEFAULT_WORKPLAN_TEMPLATES); }
      } else {
        setWorkplanItems(DEFAULT_WORKPLAN_TEMPLATES);
      }

      const currentClassName = cls ? cls.name : 'Kelas';
      const savedLpj = localStorage.getItem(lpjKey);
      if (savedLpj) {
        try { setLpjReport(JSON.parse(savedLpj)); } catch(e) { 
          setLpjReport({
            evaluationSummary: `Pelaksanaan tugas wali kelas di ${currentClassName} semester ${selectedSemester} secara umum telah berjalan dengan baik dan lancar. Seluruh aspek pengelolaan kelas, pembinaan karakter, dan pendampingan akademik siswa dapat terealisasi secara optimal.`,
            obstacles: '1. Terdapat beberapa siswa yang masih mengalami keterlambatan sekolah berulang.\n2. Beberapa orang tua perlu koordinasi lebih aktif terkait capaian nilai akademik anak.',
            solutions: '1. Pembinaan rutin wali kelas, pencatatan poin pelanggaran, dan panggilan orang tua siswa terlambat.\n2. Mengoptimalkan peran paguyuban orang tua murid dan grup komunikasi kelas.',
            recommendations: 'Melanjutkan program kerja yang berjalan efektif serta meningkatkan pemantauan presensi dan bimbingan akademik secara berkelanjutan.'
          });
        }
      } else {
        setLpjReport({
          evaluationSummary: `Pelaksanaan tugas wali kelas di ${currentClassName} semester ${selectedSemester} secara umum telah berjalan dengan baik dan lancar. Seluruh aspek pengelolaan kelas, pembinaan karakter, dan pendampingan akademik siswa dapat terealisasi secara optimal.`,
          obstacles: '1. Terdapat beberapa siswa yang masih mengalami keterlambatan sekolah berulang.\n2. Beberapa orang tua perlu koordinasi lebih aktif terkait capaian nilai akademik anak.',
          solutions: '1. Pembinaan rutin wali kelas, pencatatan poin pelanggaran, dan panggilan orang tua siswa terlambat.\n2. Mengoptimalkan peran paguyuban orang tua murid dan grup komunikasi kelas.',
          recommendations: 'Melanjutkan program kerja yang berjalan efektif serta meningkatkan pemantauan presensi dan bimbingan akademik secara berkelanjutan.'
        });
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [user.homeroomClassId, selectedSemester]);

  const loadHealthData = async () => {
    if (!user.homeroomClassId || !user.schoolNpsn) return;
    setIsRefreshingHealth(true);
    try {
      const todayString = new Date().toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // ALWAYS fetch fresh student list to match class management perfectly
      const studentData = await getStudents(user.homeroomClassId);
      setStudents(studentData); 
      
      // Fetch latest RFID logs for today
      const rfidLogsToday = await getRfidLogs(user.schoolNpsn, todayString);
      
      // reconcile RFID logs
      const tappedStudentIds = new Set(rfidLogsToday.map(l => l.studentId));
      const lateLogs = rfidLogsToday.filter(l => l.status === 'TERLAMBAT');
      const lateStudentIds = new Set(lateLogs.map(l => l.studentId));
      
      // Calculate from manual attendance first for absences (I, S, A)
      const attendanceToday = await getAttendanceRecordsByRange(user.homeroomClassId!, todayString, todayString, user.id);
      
      const lateDetails: string[] = [];
      const alphaDetails: string[] = [];
      const sakitDetails: string[] = [];
      const izinDetails: string[] = [];

      let lateCount = 0;
      let alphaCount = 0;
      let sakitCount = 0;
      let izinCount = 0;

      studentData.forEach(s => {
        const manualAtt = attendanceToday.find(a => a.studentId === s.id);
        const hasTapped = tappedStudentIds.has(s.id);
        const isLate = lateStudentIds.has(s.id);

        if (isLate) {
          lateCount++;
          const log = lateLogs.find(l => l.studentId === s.id);
          lateDetails.push(`${s.name} (${log?.timestamp.split('T')[1].substring(0, 5) || 'Telat'})`);
        } else if (!hasTapped) {
          // If not tapped, check manual status
          if (manualAtt) {
            if (manualAtt.status === 'S') {
              sakitCount++;
              sakitDetails.push(s.name);
            } else if (manualAtt.status === 'I') {
              izinCount++;
              izinDetails.push(s.name);
            } else if (manualAtt.status === 'A') {
              alphaCount++;
              alphaDetails.push(s.name);
            }
          } else {
            // No tap AND no manual record -> Assume Alpha/Waiting
            alphaCount++;
            alphaDetails.push(s.name);
          }
        } else {
          // Tapped RFID, but check manual attendance just in case it was modified
          if (manualAtt && ['S', 'I', 'A'].includes(manualAtt.status)) {
            if (manualAtt.status === 'S') {
              sakitCount++;
              sakitDetails.push(s.name);
            } else if (manualAtt.status === 'I') {
              izinCount++;
              izinDetails.push(s.name);
            } else if (manualAtt.status === 'A') {
              alphaCount++;
              alphaDetails.push(s.name);
            }
          }
        }
      });
      
      setTodayAttendance({
        absent: alphaCount + sakitCount + izinCount,
        alpha: alphaCount,
        sakit: sakitCount,
        izin: izinCount,
        late: lateCount,
        rfidLateDetail: lateDetails,
        alphaDetail: alphaDetails,
        sakitDetail: sakitDetails,
        izinDetail: izinDetails
      });

      // Calculate long-term absences (Alpha > 3) to guide them
      const longTermStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const longTermAttendance = await getAttendanceRecordsByRange(user.homeroomClassId!, longTermStart, todayString, user.id);

      const alphaCounts: { [studentId: string]: number } = {};
      longTermAttendance.forEach(record => {
        if (record.status === 'A') {
          alphaCounts[record.studentId] = (alphaCounts[record.studentId] || 0) + 1;
        }
      });

      const frequentAbs: { student: Student; alphaCount: number }[] = [];
      studentData.forEach(s => {
        const count = alphaCounts[s.id] || 0;
        if (count > 3) {
          frequentAbs.push({ student: s, alphaCount: count });
        }
      });

      frequentAbs.sort((a, b) => b.alphaCount - a.alphaCount);
      setFrequentAbsentees(frequentAbs);

      // Update Trends
      const last30DaysAttendance = await getAttendanceRecordsByRange(user.homeroomClassId!, monthAgo, todayString, user.id);
      const trendMap: { [date: string]: { date: string; violations: number; absences: number } } = {};
      
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        const iso = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        trendMap[iso] = { date: d, violations: 0, absences: 0 };
      }

      last30DaysAttendance.forEach(a => {
        if (trendMap[a.date] && (a.status === 'A' || a.status === 'T' || a.status === 'S' || a.status === 'I')) {
          if (a.status === 'A') trendMap[a.date].absences++;
          if (a.status === 'T') trendMap[a.date].violations++;
        }
      });
      setDisciplineTrend(Object.values(trendMap));
      
    } catch (error) {
      console.error("Error loading health data:", error);
    } finally {
      setIsRefreshingHealth(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'health') {
      loadHealthData();
      
      // Auto-refresh every 30 seconds for "realtime" feel
      const timer = setInterval(() => {
        loadHealthData();
      }, 30000);
      
      return () => clearInterval(timer);
    }
  }, [activeTab]);

  // --- MONTHLY ATTENDANCE RECAP LOGIC ---
  const calculateMonthlyAttendanceRecap = async (monthIdx: number, yearNum: number, effectiveDaysOverride?: number) => {
    if (!user.homeroomClassId || students.length === 0) return;
    setIsCalculatingRecap(true);

    try {
      const startDate = `${yearNum}-${String(monthIdx + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(yearNum, monthIdx + 1, 0).getDate();
      const endDate = `${yearNum}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let countWorkDays = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dt = new Date(yearNum, monthIdx, d);
        const dayOfWeek = dt.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          countWorkDays++;
        }
      }

      const effDays = effectiveDaysOverride && effectiveDaysOverride > 0 ? effectiveDaysOverride : (countWorkDays || 22);

      const records = await getAttendanceRecordsByRange(user.homeroomClassId, startDate, endDate, user.id);

      const studentMap: Record<string, { hadir: number; sakit: number; izin: number; alfa: number }> = {};

      students.forEach(st => {
        studentMap[st.id] = { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
      });

      records.forEach(rec => {
        if (studentMap[rec.studentId]) {
          const st = rec.status ? rec.status.toUpperCase() : '';
          if (st === 'HADIR' || st === 'H') {
            studentMap[rec.studentId].hadir += 1;
          } else if (st === 'SAKIT' || st === 'S') {
            studentMap[rec.studentId].sakit += 1;
          } else if (st === 'IZIN' || st === 'I') {
            studentMap[rec.studentId].izin += 1;
          } else if (st === 'ALPA' || st === 'ALFA' || st === 'A') {
            studentMap[rec.studentId].alfa += 1;
          }
        }
      });

      let totalClassHadir = 0;
      let totalClassSakit = 0;
      let totalClassIzin = 0;
      let totalClassAlfa = 0;

      const list = students.map(st => {
        const counts = studentMap[st.id] || { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
        let hadirCount = counts.hadir;
        const nonHadir = counts.sakit + counts.izin + counts.alfa;
        if (hadirCount === 0 && nonHadir <= effDays) {
          hadirCount = Math.max(0, effDays - nonHadir);
        }

        const totalDays = effDays;
        const pct = totalDays > 0 ? Math.min(100, Math.round((hadirCount / totalDays) * 100)) : 0;

        let pred = 'Sangat Baik';
        if (pct < 75) pred = 'Sangat Kurang';
        else if (pct < 85) pred = 'Kurang';
        else if (pct < 92) pred = 'Cukup';
        else if (pct < 96) pred = 'Baik';

        totalClassHadir += hadirCount;
        totalClassSakit += counts.sakit;
        totalClassIzin += counts.izin;
        totalClassAlfa += counts.alfa;

        return {
          studentId: st.id,
          nis: st.nis || '-',
          name: st.name,
          gender: st.gender || '-',
          hadir: hadirCount,
          sakit: counts.sakit,
          izin: counts.izin,
          alfa: counts.alfa,
          totalDays: totalDays,
          percentage: pct,
          predicate: pred
        };
      });

      const avgClassPct = list.length > 0
        ? Math.round(list.reduce((sum, item) => sum + item.percentage, 0) / list.length)
        : 0;

      setAttendanceRecapList(list);
      setAttendanceRecapSummary({
        monthName: INDONESIAN_MONTHS[monthIdx] || '',
        year: yearNum,
        totalStudents: students.length,
        effectiveDays: effDays,
        classPercentage: avgClassPct,
        totalHadir: totalClassHadir,
        totalSakit: totalClassSakit,
        totalIzin: totalClassIzin,
        totalAlfa: totalClassAlfa
      });
    } catch (err) {
      console.error("Error calculating monthly attendance recap:", err);
    } finally {
      setIsCalculatingRecap(false);
    }
  };

  const handleUpdateStudentRecapItem = (studentId: string, field: 'sakit' | 'izin' | 'alfa', val: number) => {
    const numVal = Math.max(0, val);
    setAttendanceRecapList(prev => {
      const updated = prev.map(item => {
        if (item.studentId === studentId) {
          const newItem = { ...item, [field]: numVal };
          const nonHadir = newItem.sakit + newItem.izin + newItem.alfa;
          newItem.hadir = Math.max(0, newItem.totalDays - nonHadir);
          newItem.percentage = newItem.totalDays > 0 ? Math.min(100, Math.round((newItem.hadir / newItem.totalDays) * 100)) : 0;
          
          if (newItem.percentage < 75) newItem.predicate = 'Sangat Kurang';
          else if (newItem.percentage < 85) newItem.predicate = 'Kurang';
          else if (newItem.percentage < 92) newItem.predicate = 'Cukup';
          else if (newItem.percentage < 96) newItem.predicate = 'Baik';
          else newItem.predicate = 'Sangat Baik';

          return newItem;
        }
        return item;
      });

      const avgClassPct = updated.length > 0
        ? Math.round(updated.reduce((sum, item) => sum + item.percentage, 0) / updated.length)
        : 0;

      const totalH = updated.reduce((s, i) => s + i.hadir, 0);
      const totalS = updated.reduce((s, i) => s + i.sakit, 0);
      const totalI = updated.reduce((s, i) => s + i.izin, 0);
      const totalA = updated.reduce((s, i) => s + i.alfa, 0);

      setAttendanceRecapSummary(sPrev => ({
        ...sPrev,
        classPercentage: avgClassPct,
        totalHadir: totalH,
        totalSakit: totalS,
        totalIzin: totalI,
        totalAlfa: totalA
      }));

      return updated;
    });
  };

  useEffect(() => {
    if (students.length > 0 && user.homeroomClassId) {
      calculateMonthlyAttendanceRecap(recapMonth, recapYear, customEffectiveDays);
    }
  }, [students, user.homeroomClassId, recapMonth, recapYear]);

  // --- ACADEMIC CALCULATION LOGIC ---
  
  const calculateSubjectFinalGrade = (studentId: string, subject: string) => {
    // Filter scores for this student and subject
    const subjectScores = scores.filter(s => s.studentId === studentId && (s.subject === subject || (!s.subject && subject === 'Umum')));
    
    // Calculate Average LM
    const lmScores = subjectScores.filter(s => s.category === 'LM');
    const totalLM = lmScores.reduce((sum, s) => sum + s.score, 0);
    const avgLM = lmScores.length > 0 ? totalLM / lmScores.length : 0;

    // Get STS and SAS
    const sts = subjectScores.find(s => s.category === 'STS')?.score || 0;
    const sas = subjectScores.find(s => s.category === 'SAS')?.score || 0;

    // Formula: (2 * AvgLM + STS + SAS) / 4
    if (lmScores.length === 0 && sts === 0 && sas === 0) return 0; // No data at all

    const final = (2 * avgLM + sts + sas) / 4;
    return parseFloat(final.toFixed(1));
  };

  const getStudentGlobalStats = (studentId: string) => {
    let totalAllSubjects = 0;
    let subjectCount = 0;
    let belowKkmCount = 0;

    detectedSubjects.forEach(sub => {
       const grade = calculateSubjectFinalGrade(studentId, sub);
       if (grade > 0) {
          totalAllSubjects += grade;
          subjectCount++;
          if (grade < kkm) belowKkmCount++;
       }
    });

    const globalAvg = subjectCount > 0 ? parseFloat((totalAllSubjects / subjectCount).toFixed(1)) : 0;
    return { globalAvg, belowKkmCount };
  };

  // --- BEHAVIOR LOGIC ---
  const getStudentBehaviorStats = (studentId: string) => {
    const studentViolations = violations.filter(v => v.studentId === studentId);
    const studentReductions = pointReductions.filter(r => r.studentId === studentId);
    
    const violationPoints = studentViolations.reduce((sum, v) => sum + v.points, 0);
    const reductionPoints = studentReductions.reduce((sum, r) => sum + r.pointsRemoved, 0);
    const totalPoints = Math.max(0, violationPoints - reductionPoints);
    
    let recommendation = "Pantau";
    let statusColor = "bg-green-100 text-green-700";

    if (totalPoints > 100) {
        recommendation = "PANGGILAN ORANG TUA 3";
        statusColor = "bg-red-100 text-red-800 font-bold border border-red-200 animate-pulse";
    } else if (totalPoints > 50) {
        recommendation = "PANGGILAN ORANG TUA 2";
        statusColor = "bg-orange-100 text-orange-800 font-bold";
    } else if (totalPoints > 20) {
        recommendation = "PANGGILAN ORANG TUA 1";
        statusColor = "bg-yellow-100 text-yellow-800 font-bold";
    } else if (totalPoints > 0) {
        recommendation = "Pembinaan Wali Kelas";
        statusColor = "bg-blue-50 text-blue-700";
    } else if (violationPoints > 0 && totalPoints === 0) {
        recommendation = "Poin Tuntas (Pemulihan)";
        statusColor = "bg-emerald-100 text-emerald-800 font-bold";
    }

    return { totalPoints, violationPoints, reductionPoints, recommendation, statusColor };
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.nis.includes(searchQuery)
  );

  const recordedStudents = filteredStudents
    .map(s => ({ 
        ...s, 
        stats: getStudentBehaviorStats(s.id),
        details: {
            violations: violations.filter(v => v.studentId === s.id),
            reductions: pointReductions.filter(r => r.studentId === s.id),
            achievements: achievements.filter(a => a.studentId === s.id),
            sessions: sessions.filter(sess => sess.studentId === s.id),
            homeVisits: homeVisits.filter(hv => hv.studentId === s.id),
            parentCalls: parentCalls.filter(pc => pc.studentId === s.id),
            guidances: homeroomGuidances.filter(g => g.studentId === s.id)
        }
    }))
    .filter(s => 
      s.stats.totalPoints > 0 || 
      s.details.violations.length > 0 || 
      s.details.reductions.length > 0 || 
      s.details.sessions.length > 0 || 
      s.details.guidances.length > 0 ||
      s.details.homeVisits.length > 0 ||
      s.details.parentCalls.length > 0
    )
    .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints || b.details.violations.length - a.details.violations.length);

  const problemStudents = recordedStudents.filter(s => s.stats.totalPoints > 0);
  const resolvedStudents = recordedStudents.filter(s => s.stats.totalPoints === 0 && (s.details.violations.length > 0 || s.details.reductions.length > 0));

  const displayedDisciplineStudents = disciplineFilter === 'ACTIVE'
    ? problemStudents
    : disciplineFilter === 'RESOLVED'
    ? resolvedStudents
    : recordedStudents;

  const exportLeger = () => {
    const headers = ['No', 'NIS', 'Nama Siswa', 'L/P', ...detectedSubjects, 'Rata-rata Total', 'Jml < KKM'];
    const data = filteredStudents.map((s, i) => {
      const row: any[] = [i + 1, s.nis, s.name, s.gender];
      
      // Add Subject Scores
      detectedSubjects.forEach(sub => {
         row.push(calculateSubjectFinalGrade(s.id, sub) || 0);
      });

      const stats = getStudentGlobalStats(s.id);
      row.push(stats.globalAvg);
      row.push(stats.belowKkmCount);
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leger Bayangan");
    XLSX.writeFile(wb, `Leger_Bayangan_${className}.xlsx`);
  };

  const handleEditRecord = (type: 'VIOLATION' | 'REDUCTION', record: any, student: Student) => {
    setEditingRecord({ type, id: record.id, reportedBy: record.reportedBy });
    setSelectedStudentForForm(student);
    setViolationFormType(type);
    
    const recordName = type === 'VIOLATION' ? record.violationName : record.activityName;
    const pointsVal = type === 'VIOLATION' ? record.points : record.pointsRemoved;
    
    const standardOptions = type === 'VIOLATION' 
      ? ['Terlambat', 'Atribut tidak lengkap', 'Membolos', 'Kerapian rambut/seragam', 'Sikap kurang sopan', 'Bermain HP saat pelajaran']
      : ['Kerja Bakti', 'Merapikan Fasilitas', 'Keaktifan Kegiatan', 'Sikap Sangat Baik'];
      
    const isStandard = standardOptions.includes(recordName);
    
    setFormInput({
      category: isStandard ? recordName : 'Lainnya',
      customCategory: isStandard ? '' : recordName,
      points: pointsVal,
      description: record.description || '',
      date: record.date || new Date().toISOString().split('T')[0]
    });
    
    setShowViolationModal(true);
  };

  const handleDeleteRecord = async (type: 'VIOLATION' | 'REDUCTION', id: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus catatan ${type === 'VIOLATION' ? 'pelanggaran' : 'pemulihan'} ini?`)) return;
    
    try {
      if (type === 'VIOLATION') {
        await deleteStudentViolation(id);
      } else {
        await deleteStudentPointReduction(id);
      }
      
      // Refresh data
      const [vData, rData] = await Promise.all([
        getStudentViolations(),
        getStudentPointReductions()
      ]);
      const studentIds = new Set(students.map(s => s.id));
      setViolations(vData.filter(v => studentIds.has(v.studentId)));
      setPointReductions(rData.filter(r => studentIds.has(r.studentId)));
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const handleSaveDisciplinePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForForm) return;

    try {
      const finalCategory = formInput.category === 'Lainnya' ? formInput.customCategory : formInput.category;
      if (!finalCategory.trim()) {
        alert('Kategori tidak boleh kosong!');
        return;
      }

      if (editingRecord) {
        if (editingRecord.type === 'VIOLATION') {
          await updateStudentViolation(editingRecord.id, {
            date: formInput.date,
            violationName: finalCategory,
            points: Number(formInput.points),
            description: formInput.description || 'Dicatat oleh Wali Kelas',
            reportedBy: editingRecord.reportedBy || (user.fullName ? `Wali Kelas (${user.fullName})` : 'Wali Kelas')
          });
        } else {
          await updateStudentPointReduction(editingRecord.id, {
            date: formInput.date,
            activityName: finalCategory,
            pointsRemoved: Number(formInput.points),
            description: formInput.description || 'Pemulihan oleh Wali Kelas',
            reportedBy: editingRecord.reportedBy || (user.fullName ? `Wali Kelas (${user.fullName})` : 'Wali Kelas')
          });
        }
      } else {
        if (violationFormType === 'VIOLATION') {
          await addStudentViolation({
            studentId: selectedStudentForForm.id,
            date: formInput.date,
            violationName: finalCategory,
            points: Number(formInput.points),
            description: formInput.description || 'Dicatat oleh Wali Kelas',
            reportedBy: user.fullName ? `Wali Kelas (${user.fullName})` : 'Wali Kelas'
          });
        } else {
          await addStudentPointReduction({
            studentId: selectedStudentForForm.id,
            date: formInput.date,
            activityName: finalCategory,
            pointsRemoved: Number(formInput.points),
            description: formInput.description || 'Pemulihan oleh Wali Kelas',
            reportedBy: user.fullName ? `Wali Kelas (${user.fullName})` : 'Wali Kelas'
          });
        }
      }

      // Refresh data
      const [vData, rData] = await Promise.all([
        getStudentViolations(),
        getStudentPointReductions()
      ]);
      const studentIds = new Set(students.map(s => s.id));
      setViolations(vData.filter(v => studentIds.has(v.studentId)));
      setPointReductions(rData.filter(r => studentIds.has(r.studentId)));

      // Close modal & reset
      setShowViolationModal(false);
      setSelectedStudentForForm(null);
      setEditingRecord(null);
      setFormInput({
        category: 'Terlambat',
        customCategory: '',
        points: 5,
        description: '',
        date: new Date().toISOString().split('T')[0]
      });

    } catch (err) {
      console.error('Error saving discipline record:', err);
    }
  };

  // --- HOMEROOM GUIDANCE HANDLERS ---
  const handleOpenGuidanceModal = (student?: Student, guidanceToEdit?: HomeroomGuidanceSession) => {
    if (guidanceToEdit) {
      const studentObj = students.find(s => s.id === guidanceToEdit.studentId) || null;
      setSelectedStudentForGuidance(studentObj);
      setEditingGuidanceId(guidanceToEdit.id);
      setGuidanceForm({
        date: guidanceToEdit.date || new Date().toISOString().split('T')[0],
        violationSummary: guidanceToEdit.violationSummary || '',
        guidanceType: guidanceToEdit.guidanceType || 'Konseling Pribadi',
        notes: guidanceToEdit.notes || '',
        studentCommitment: guidanceToEdit.studentCommitment || '',
        status: (guidanceToEdit.status as any) || 'Dalam Pantauan',
        followUpDate: guidanceToEdit.followUpDate || '',
        parentInformed: guidanceToEdit.parentInformed || false
      });
    } else if (student) {
      setSelectedStudentForGuidance(student);
      setEditingGuidanceId(null);
      const studentViols = violations.filter(v => v.studentId === student.id);
      const recentViolSummary = studentViols.length > 0 
        ? studentViols.slice(-3).map(v => v.violationName).join(', ')
        : '';
      setGuidanceForm({
        date: new Date().toISOString().split('T')[0],
        violationSummary: recentViolSummary,
        guidanceType: 'Konseling Pribadi',
        notes: '',
        studentCommitment: '',
        status: 'Dalam Pantauan',
        followUpDate: '',
        parentInformed: false
      });
    } else {
      setSelectedStudentForGuidance(students[0] || null);
      setEditingGuidanceId(null);
      setGuidanceForm({
        date: new Date().toISOString().split('T')[0],
        violationSummary: '',
        guidanceType: 'Konseling Pribadi',
        notes: '',
        studentCommitment: '',
        status: 'Dalam Pantauan',
        followUpDate: '',
        parentInformed: false
      });
    }
    setShowGuidanceModal(true);
  };

  const handleSaveGuidance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForGuidance || !user.homeroomClassId) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }

    try {
      const payload: any = {
        studentId: selectedStudentForGuidance.id,
        classId: user.homeroomClassId,
        schoolNpsn: user.schoolNpsn || 'DEFAULT',
        userId: user.id,
        date: guidanceForm.date,
        violationSummary: guidanceForm.violationSummary,
        guidanceType: guidanceForm.guidanceType,
        notes: guidanceForm.notes,
        studentCommitment: guidanceForm.studentCommitment,
        status: guidanceForm.status,
        followUpDate: guidanceForm.followUpDate || undefined,
        parentInformed: guidanceForm.parentInformed
      };

      if (editingGuidanceId) {
        payload.id = editingGuidanceId;
      }

      await saveHomeroomGuidanceSession(payload);

      // Refresh guidance list
      const gData = await getHomeroomGuidanceSessions(user.schoolNpsn || 'DEFAULT', user.homeroomClassId);
      const studentIds = new Set(students.map(s => s.id));
      setHomeroomGuidances(gData.filter(g => studentIds.has(g.studentId)));

      setShowGuidanceModal(false);
      setSelectedStudentForGuidance(null);
      setEditingGuidanceId(null);
    } catch (err) {
      console.error('Error saving homeroom guidance:', err);
      alert('Gagal menyimpan data pembinaan.');
    }
  };

  const handleDeleteGuidance = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data tindak lanjut pembinaan ini?')) return;
    try {
      await deleteHomeroomGuidanceSession(id);
      const gData = await getHomeroomGuidanceSessions(user.schoolNpsn || 'DEFAULT', user.homeroomClassId || undefined);
      const studentIds = new Set(students.map(s => s.id));
      setHomeroomGuidances(gData.filter(g => studentIds.has(g.studentId)));
    } catch (err) {
      console.error('Error deleting homeroom guidance:', err);
    }
  };

  const handlePrintGuidanceReport = (student: any) => {
    const printWindow = window.open('', '', 'height=850,width=850');
    if (!printWindow) return;

    const studentGuidances = (student.details?.guidances || homeroomGuidances.filter(g => g.studentId === student.id))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const bStats = student.stats || getStudentBehaviorStats(student.id);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lembar Pembinaan Siswa - ${student.name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.5; font-size: 11pt; padding: 0; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2.5px double #000; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 14pt; text-transform: uppercase; font-weight: bold; }
            .header h2 { margin: 4px 0 0 0; font-size: 12pt; text-transform: uppercase; font-weight: bold; }
            .header p { margin: 2px 0 0 0; font-size: 10pt; font-style: italic; color: #333; }
            
            .student-info { margin-bottom: 20px; border: 1px solid #999; padding: 10px 14px; background: #fafafa; }
            .student-info table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
            .student-info td { padding: 3px 6px; vertical-align: top; }
            
            .badge { display: inline-block; padding: 2px 6px; font-size: 9pt; font-weight: bold; border-radius: 3px; border: 1px solid #ccc; }
            .badge-green { background: #dcfce7; color: #15803d; border-color: #86efac; }
            .badge-yellow { background: #fef9c3; color: #854d0e; border-color: #fde047; }
            .badge-red { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }

            .session-card { border: 1px solid #000; margin-bottom: 15px; page-break-inside: avoid; }
            .session-header { background: #f0f0f0; border-bottom: 1px solid #000; padding: 6px 10px; font-weight: bold; display: flex; justify-content: space-between; }
            .session-body { padding: 10px; }
            .session-row { margin-bottom: 8px; }
            .session-label { font-weight: bold; color: #333; font-size: 10pt; margin-bottom: 2px; }
            .session-val { background: #fff; padding: 4px 8px; border: 1px dashed #ccc; font-size: 10pt; min-height: 24px; white-space: pre-line; }

            .signature-grid { margin-top: 35px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; page-break-inside: avoid; text-align: center; font-size: 10.5pt; }
            .sign-box { min-height: 90px; display: flex; flex-direction: column; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${user.schoolName || 'PEMERINTAH DAERAH PROVINSI / KABUPATEN'}</h1>
            <h2>LEMBAR CATATAN TINDAK LANJUT PEMBINAAN SISWA OLEH WALI KELAS</h2>
            <p>Tahun Pelajaran ${printSettings.date ? printSettings.date.split('-')[0] : new Date().getFullYear()} / Kelas: ${className}</p>
          </div>

          <div class="student-info">
            <table>
              <tr>
                <td width="20%"><strong>Nama Siswa</strong></td>
                <td width="2%">:</td>
                <td width="48%"><strong>${student.name}</strong></td>
                <td width="15%"><strong>Total Poin Aktif</strong></td>
                <td width="2%">:</td>
                <td width="13%"><strong>${bStats.totalPoints} Poin</strong></td>
              </tr>
              <tr>
                <td><strong>NIS / NISN</strong></td>
                <td>:</td>
                <td>${student.nis} / ${student.nisn || '-'}</td>
                <td><strong>Status / Rekomendasi</strong></td>
                <td>:</td>
                <td><span class="badge ${bStats.totalPoints > 20 ? 'badge-red' : 'badge-yellow'}">${bStats.recommendation}</span></td>
              </tr>
              <tr>
                <td><strong>Kelas</strong></td>
                <td>:</td>
                <td>${className}</td>
                <td><strong>Wali Kelas</strong></td>
                <td>:</td>
                <td>${user.fullName}</td>
              </tr>
            </table>
          </div>

          <div style="font-weight: bold; text-transform: uppercase; font-size: 11pt; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 12px;">
            RIWAYAT & TINDAK LANJUT PEMBINAAN WALI KELAS (${studentGuidances.length} Kegiatan)
          </div>

          ${studentGuidances.length === 0 ? `
            <div style="text-align: center; padding: 25px; border: 1px dashed #999; font-style: italic; color: #666;">
              Belum ada catatan pembinaan khusus yang tersimpan untuk siswa ini.
            </div>
          ` : studentGuidances.map((g: any, i: number) => `
            <div class="session-card">
              <div class="session-header">
                <span>Pembinaan #${studentGuidances.length - i} — Tanggal: ${g.date}</span>
                <span>Bentuk: ${g.guidanceType}</span>
              </div>
              <div class="session-body">
                ${g.violationSummary ? `
                  <div class="session-row">
                    <div class="session-label">1. Masalah / Pelanggaran Terkait:</div>
                    <div class="session-val">${g.violationSummary}</div>
                  </div>
                ` : ''}
                <div class="session-row">
                  <div class="session-label">2. Uraian Proses Pembinaan & Nasihat Wali Kelas:</div>
                  <div class="session-val">${g.notes || '-'}</div>
                </div>
                ${g.studentCommitment ? `
                  <div class="session-row">
                    <div class="session-label">3. Komitmen / Kesepakatan / Janji Perbaikan Siswa:</div>
                    <div class="session-val" style="font-style: italic; background: #fdfdfd;">"${g.studentCommitment}"</div>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 9.5pt; background: #f9f9f9; padding: 6px 8px; border: 1px solid #eee;">
                  <div><strong>Status Hasil:</strong> <span class="badge ${g.status === 'Selesai/Membaik' ? 'badge-green' : g.status === 'Perlu Eskalasi ke BK' ? 'badge-red' : 'badge-yellow'}">${g.status}</span></div>
                  <div><strong>Rencana Pantauan Lanjutan:</strong> ${g.followUpDate || '-'}</div>
                  <div><strong>Koordinasi Ortu:</strong> ${g.parentInformed ? 'Sudah Diberitahu' : 'Belum / Tidak Perlu'}</div>
                </div>
              </div>
            </div>
          `).join('')}

          <div class="signature-grid">
            <div class="sign-box">
              <div>Siswa Yang Dibina,</div>
              <div style="margin-top: 45px; font-weight: bold; text-decoration: underline;">${student.name}</div>
            </div>
            <div class="sign-box">
              <div>Orang Tua / Wali Siswa,</div>
              <div style="margin-top: 45px; font-weight: bold; text-decoration: underline;">( .................................................. )</div>
            </div>
            <div class="sign-box">
              <div>Guru Bimbingan Konseling (BK),</div>
              <div style="margin-top: 45px; font-weight: bold; text-decoration: underline;">( .................................................. )</div>
            </div>
            <div class="sign-box">
              <div>${printSettings.place}, ${printSettings.date || new Date().toLocaleDateString('id-ID')}<br/>Wali Kelas ${className},</div>
              <div style="margin-top: 45px; font-weight: bold; text-decoration: underline;">${user.fullName}</div>
              <div style="font-size: 9pt;">NIP. ${user.nip || '...........................................'}</div>
            </div>
          </div>

          <div style="margin-top: 25px; text-align: center; page-break-inside: avoid;">
            <div>Mengetahui,</div>
            <div><strong>Kepala Sekolah</strong></div>
            <div style="margin-top: 50px; font-weight: bold; text-decoration: underline;">( ................................................................ )</div>
            <div style="font-size: 9.5pt;">NIP. .........................................................</div>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintAllGuidanceReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const allRecords = homeroomGuidances
      .map(g => {
        const s = students.find(st => st.id === g.studentId);
        return {
          ...g,
          studentName: s ? s.name : 'Siswa Tidak Ditemukan',
          studentNis: s ? s.nis : '-',
          gender: s ? s.gender : '-'
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const completedCount = allRecords.filter(r => r.status === 'Selesai/Membaik').length;
    const monitoringCount = allRecords.filter(r => r.status === 'Dalam Pantauan').length;
    const escalatedCount = allRecords.filter(r => r.status === 'Perlu Eskalasi ke BK').length;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rekapitulasi Tindak Lanjut Pembinaan Siswa - Kelas ${className}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.35; font-size: 9.5pt; padding: 0; margin: 0; }
            
            .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #000; padding-bottom: 6px; }
            .header h1 { margin: 0; font-size: 13pt; text-transform: uppercase; font-weight: bold; }
            .header h2 { margin: 2px 0 0 0; font-size: 11pt; text-transform: uppercase; font-weight: bold; }
            .header p { margin: 2px 0 0 0; font-size: 9pt; font-style: italic; color: #333; }

            .stat-box { display: flex; justify-content: space-around; border: 1px solid #000; background: #f9f9f9; padding: 6px; margin-bottom: 12px; font-size: 9pt; text-align: center; }
            .stat-item strong { display: block; font-size: 11pt; }

            table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 15px; }
            th, td { border: 1px solid #000; padding: 4.5px 5px; vertical-align: top; }
            th { background: #ececec; font-weight: bold; text-align: center; }

            .badge { display: inline-block; padding: 1px 4px; font-size: 7.5pt; font-weight: bold; border-radius: 2px; }
            .badge-green { background: #dcfce7; color: #15803d; }
            .badge-yellow { background: #fef9c3; color: #854d0e; }
            .badge-red { background: #fee2e2; color: #b91c1c; }

            .signature-box { margin-top: 25px; display: flex; justify-content: space-between; page-break-inside: avoid; font-size: 9.5pt; }
            .sign-col { text-align: center; width: 250px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${user.schoolName || 'LEMBAGA PENDIDIKAN & KEMENTERIAN PENDIDIKAN'}</h1>
            <h2>LAPORAN REKAPITULASI TINDAK LANJUT PEMBINAAN SISWA WALI KELAS</h2>
            <p>Kelas: ${className} • Wali Kelas: ${user.fullName} • Semester: ${selectedSemester} • Tahun Ajaran: ${printSettings.date ? printSettings.date.split('-')[0] : new Date().getFullYear()}</p>
          </div>

          <div class="stat-box">
            <div class="stat-item">Total Kegiatan Pembinaan: <strong>${allRecords.length}</strong></div>
            <div class="stat-item">Selesai / Membaik: <strong style="color: #15803d;">${completedCount}</strong></div>
            <div class="stat-item">Dalam Pemantauan: <strong style="color: #854d0e;">${monitoringCount}</strong></div>
            <div class="stat-item">Perlu Eskalasi ke BK: <strong style="color: #b91c1c;">${escalatedCount}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="3%">No</th>
                <th width="8%">Tanggal</th>
                <th width="14%">Nama Siswa (NIS)</th>
                <th width="12%">Bentuk Pembinaan</th>
                <th width="15%">Masalah / Pelanggaran</th>
                <th width="20%">Uraian & Nasihat Wali Kelas</th>
                <th width="16%">Komitmen Siswa</th>
                <th width="12%">Status & Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              ${allRecords.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; padding: 15px;">Tidak ada data catatan pembinaan wali kelas.</td></tr>
              ` : allRecords.map((r, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td style="text-align: center;">${r.date}</td>
                  <td><strong>${r.studentName}</strong><br/><span style="font-size: 7.5pt; color: #555;">NIS: ${r.studentNis} (${r.gender || '-'})</span></td>
                  <td><strong>${r.guidanceType}</strong></td>
                  <td>${r.violationSummary || '-'}</td>
                  <td>${r.notes || '-'}</td>
                  <td>${r.studentCommitment ? `<em>"${r.studentCommitment}"</em>` : '-'}</td>
                  <td>
                    <span class="badge ${r.status === 'Selesai/Membaik' ? 'badge-green' : r.status === 'Perlu Eskalasi ke BK' ? 'badge-red' : 'badge-yellow'}">${r.status}</span>
                    ${r.followUpDate ? `<div style="font-size: 7.5pt; color: #555; margin-top: 2px;">Pantau: ${r.followUpDate}</div>` : ''}
                    ${r.parentInformed ? `<div style="font-size: 7.5pt; color: #1e40af; font-weight: bold;">(Ortu Diberitahu)</div>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signature-box">
            <div class="sign-col">
              <p>Mengetahui,<br/><strong>Kepala Sekolah</strong></p>
              <br/><br/><br/>
              <p style="font-weight: bold; text-decoration: underline;">( ..................................................... )</p>
              <p style="font-size: 8.5pt;">NIP. .................................................</p>
            </div>
            <div class="sign-col">
              <p>${printSettings.place}, ${printSettings.date || new Date().toLocaleDateString('id-ID')}<br/><strong>Wali Kelas ${className}</strong></p>
              <br/><br/><br/>
              <p style="font-weight: bold; text-decoration: underline;">${user.fullName}</p>
              <p style="font-size: 8.5pt;">NIP. ${user.nip || '.................................................'}</p>
            </div>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportGuidanceExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rekap Pembinaan
    const guidanceRows = homeroomGuidances.map((g, i) => {
      const st = students.find(s => s.id === g.studentId);
      return {
        No: i + 1,
        Tanggal: g.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : g.studentId,
        Gender: st ? st.gender || '-' : '-',
        BentukPembinaan: g.guidanceType,
        PelanggaranTerkait: g.violationSummary || '-',
        UraianPembinaan: g.notes || '-',
        KomitmenSiswa: g.studentCommitment || '-',
        StatusHasil: g.status,
        TanggalEvaluasiLanjutan: g.followUpDate || '-',
        KoordinasiOrangTua: g.parentInformed ? 'Ya' : 'Tidak'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guidanceRows.length ? guidanceRows : [{ Info: "Tidak ada data pembinaan" }]), "Rekap Pembinaan");

    // Sheet 2: Ringkasan Status
    const summaryStatus = [
      { Status: 'Selesai / Membaik', Jumlah: homeroomGuidances.filter(g => g.status === 'Selesai/Membaik').length },
      { Status: 'Dalam Pantauan', Jumlah: homeroomGuidances.filter(g => g.status === 'Dalam Pantauan').length },
      { Status: 'Perlu Eskalasi ke BK', Jumlah: homeroomGuidances.filter(g => g.status === 'Perlu Eskalasi ke BK').length },
      { Status: 'Total Kegiatan', Jumlah: homeroomGuidances.length }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryStatus), "Ringkasan Status");

    XLSX.writeFile(wb, `Rekap_Pembinaan_WaliKelas_${className.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePrintBKReport = (student: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sViolations = student.details?.violations || violations.filter(v => v.studentId === student.id);
    const sReductions = student.details?.reductions || pointReductions.filter(r => r.studentId === student.id);
    const sSessions = student.details?.sessions || sessions.filter(sess => sess.studentId === student.id);
    const sHomeVisits = student.details?.homeVisits || homeVisits.filter(hv => hv.studentId === student.id);
    const sParentCalls = student.details?.parentCalls || parentCalls.filter(pc => pc.studentId === student.id);
    const studentGuidances = student.details?.guidances || homeroomGuidances.filter(g => g.studentId === student.id);

    const totalViolPoints = sViolations.reduce((sum: number, v: any) => sum + (v.points || 0), 0);
    const totalReducPoints = sReductions.reduce((sum: number, r: any) => sum + (r.pointsRemoved || 0), 0);
    const netPoints = Math.max(0, totalViolPoints - totalReducPoints);
    const bStats = student.stats || getStudentBehaviorStats(student.id);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan BK & Kedisiplinan - ${student.name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.45; font-size: 10.5pt; padding: 0; margin: 0; }
            .header { text-align: center; margin-bottom: 18px; border-bottom: 2.5px solid #000; padding-bottom: 8px; }
            .header h1 { margin: 0; font-size: 14pt; text-transform: uppercase; font-weight: bold; }
            .header h2 { margin: 2px 0 0 0; font-size: 11.5pt; text-transform: uppercase; font-weight: bold; }
            .header p { margin: 2px 0 0 0; font-size: 9.5pt; font-style: italic; color: #333; }
            
            .student-info-box { border: 1.5px solid #000; padding: 10px 14px; margin-bottom: 16px; background: #fafafa; display: flex; justify-content: space-between; align-items: flex-start; }
            .student-info-table { border: none; font-size: 10pt; }
            .student-info-table td { border: none; padding: 2px 5px; }
            
            .points-summary-badge { border: 1.5px solid #000; padding: 8px 12px; text-align: center; background: #fff; min-width: 170px; }
            .points-summary-badge .total-num { font-size: 16pt; font-weight: bold; margin: 2px 0; }

            .section { margin-top: 16px; page-break-inside: avoid; }
            .section-title { font-weight: bold; font-size: 10.5pt; text-transform: uppercase; background: #f2f2f2; padding: 4px 8px; border-left: 4px solid #000; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; }
            th, td { border: 1px solid #000; padding: 4.5px 6.5px; text-align: left; vertical-align: top; }
            th { background: #f5f5f5; font-weight: bold; text-align: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            
            .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 30px; text-align: center; font-size: 9.5pt; page-break-inside: avoid; }
            .signature-box { display: flex; flex-direction: column; justify-content: space-between; height: 105px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LAPORAN BIMBINGAN KONSELING & KEDISIPLINAN SISWA</h1>
            <h2>${user.schoolName || 'EduAdmin Pro'}</h2>
            <p>Kelas ${className} • Semester ${selectedSemester.toUpperCase()} Tahun Ajaran 2025/2026 • Dicetak: ${printSettings.date}</p>
          </div>

          <div class="student-info-box">
            <table class="student-info-table">
              <tr>
                <td width="130"><strong>Nama Siswa</strong></td>
                <td width="10">:</td>
                <td><strong>${student.name}</strong></td>
              </tr>
              <tr>
                <td><strong>NIS / NISN</strong></td>
                <td>:</td>
                <td>${student.nis} / ${student.nisn || '-'}</td>
              </tr>
              <tr>
                <td><strong>Kelas / Rombel</strong></td>
                <td>:</td>
                <td>${className}</td>
              </tr>
              <tr>
                <td><strong>Jenis Kelamin</strong></td>
                <td>:</td>
                <td>${student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : student.gender || '-'}</td>
              </tr>
            </table>

            <div class="points-summary-badge">
              <div style="font-size: 8.5pt; text-transform: uppercase; font-weight: bold; color: #444;">Akumulasi Poin Aktif</div>
              <div class="total-num" style="color: ${netPoints > 50 ? '#dc2626' : netPoints > 20 ? '#d97706' : netPoints > 0 ? '#2563eb' : '#16a34a'};">
                ${netPoints} Pts
              </div>
              <div style="font-size: 8.5pt; font-weight: bold; margin-top: 2px;">
                Status: ${bStats.recommendation}
              </div>
              <div style="font-size: 8pt; color: #666; margin-top: 2px;">
                Pelanggaran: +${totalViolPoints} | Pemulihan: -${totalReducPoints}
              </div>
            </div>
          </div>

          <!-- A. PELANGGARAN KEDISIPLINAN -->
          <div class="section">
            <div class="section-title">A. CATATAN PELANGGARAN KEDISIPLINAN SISWA</div>
            <table>
              <thead>
                <tr>
                  <th width="4%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="24%">Bentuk Pelanggaran</th>
                  <th width="18%">Diinput Oleh</th>
                  <th width="32%">Keterangan & Kejadian</th>
                  <th width="10%">Poin (+)</th>
                </tr>
              </thead>
              <tbody>
                ${sViolations.length === 0 ? `
                  <tr><td colspan="6" class="text-center" style="font-style: italic;">Tidak ada catatan pelanggaran siswa yang dibukukan.</td></tr>
                ` : sViolations.map((v: any, i: number) => `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${v.date}</td>
                    <td><strong>${v.violationName}</strong></td>
                    <td>${v.reportedBy || 'Guru BK / Wali Kelas'}</td>
                    <td>${v.description || '-'}</td>
                    <td class="text-center" style="font-weight: bold; color: #dc2626;">+${v.points}</td>
                  </tr>
                `).join('')}
              </tbody>
              ${sViolations.length > 0 ? `
                <tfoot>
                  <tr style="font-weight: bold; background: #f9f9f9;">
                    <td colspan="5" class="text-right">TOTAL POIN PELANGGARAN :</td>
                    <td class="text-center" style="color: #dc2626;">+${totalViolPoints}</td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>

          <!-- B. PENGURANGAN / PEMULIHAN POIN -->
          <div class="section">
            <div class="section-title">B. CATATAN PENGURANGAN / PEMULIHAN POIN KEDISIPLINAN</div>
            <table>
              <thead>
                <tr>
                  <th width="4%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="24%">Bentuk Kegiatan Pemulihan</th>
                  <th width="18%">Penginput / Rekomendasi</th>
                  <th width="32%">Keterangan & Catatan</th>
                  <th width="10%">Poin (-)</th>
                </tr>
              </thead>
              <tbody>
                ${sReductions.length === 0 ? `
                  <tr><td colspan="6" class="text-center" style="font-style: italic;">Belum ada catatan pengurangan / pemulihan poin untuk siswa ini.</td></tr>
                ` : sReductions.map((r: any, i: number) => `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${r.date}</td>
                    <td><strong>${r.activityName}</strong></td>
                    <td>${r.reportedBy || 'Wali Kelas / Guru BK'}</td>
                    <td>${r.description || '-'}</td>
                    <td class="text-center" style="font-weight: bold; color: #16a34a;">-${r.pointsRemoved}</td>
                  </tr>
                `).join('')}
              </tbody>
              ${sReductions.length > 0 ? `
                <tfoot>
                  <tr style="font-weight: bold; background: #f9f9f9;">
                    <td colspan="5" class="text-right">TOTAL PENGURANGAN / PEMULIHAN POIN :</td>
                    <td class="text-center" style="color: #16a34a;">-${totalReducPoints}</td>
                  </tr>
                  <tr style="font-weight: bold; background: #e5e7eb;">
                    <td colspan="5" class="text-right">AKUMULASI POIN BERSIH AKHIR (Pelanggaran - Pemulihan) :</td>
                    <td class="text-center" style="color: #111;">${netPoints} Poin</td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>

          <!-- C. LAYANAN KONSELING GURU BK -->
          <div class="section">
            <div class="section-title">C. CATATAN LAYANAN BIMBINGAN & KONSELING (INPUTAN GURU BK)</div>
            <table>
              <thead>
                <tr>
                  <th width="4%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="25%">Pokok Masalah / Konseling</th>
                  <th width="32%">Catatan Diagnosis & Konseling BK</th>
                  <th width="17%">Rencana Tindak Lanjut</th>
                  <th width="10%">Status</th>
                </tr>
              </thead>
              <tbody>
                ${sSessions.length === 0 ? `
                  <tr><td colspan="6" class="text-center" style="font-style: italic;">Belum ada sesi bimbingan & konseling khusus yang dicatat oleh Guru BK.</td></tr>
                ` : sSessions.map((sess: any, i: number) => `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${sess.date}</td>
                    <td><strong>${sess.issue}</strong></td>
                    <td>${sess.notes}</td>
                    <td>${sess.followUp || '-'}</td>
                    <td class="text-center" style="font-weight: bold;">
                      ${sess.status === 'CLOSED' ? '<span style="color:#16a34a">Tuntas</span>' : '<span style="color:#d97706">Proses (OPEN)</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- D. TINDAK LANJUT PEMBINAAN WALI KELAS -->
          <div class="section">
            <div class="section-title">D. TINDAK LANJUT PEMBINAAN OLEH WALI KELAS</div>
            <table>
              <thead>
                <tr>
                  <th width="4%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="20%">Bentuk Pembinaan</th>
                  <th width="28%">Uraian Pembinaan Wali Kelas</th>
                  <th width="22%">Komitmen Siswa</th>
                  <th width="14%">Status & Evaluasi</th>
                </tr>
              </thead>
              <tbody>
                ${studentGuidances.length === 0 ? `
                  <tr><td colspan="6" class="text-center" style="font-style: italic;">Tidak ada catatan pembinaan khusus wali kelas yang dibukukan.</td></tr>
                ` : studentGuidances.map((g: any, i: number) => `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${g.date}</td>
                    <td><strong>${g.guidanceType}</strong></td>
                    <td>${g.notes || '-'}</td>
                    <td>${g.studentCommitment ? `<em>"${g.studentCommitment}"</em>` : '-'}</td>
                    <td>
                      <strong>${g.status}</strong>
                      ${g.followUpDate ? `<div style="font-size: 8pt; color: #555;">Pantau: ${g.followUpDate}</div>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- E. HOME VISIT -->
          <div class="section">
            <div class="section-title">E. DAFTAR KUNJUNGAN RUMAH (HOME VISIT)</div>
            <table>
              <thead>
                <tr>
                  <th width="4%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="22%">Alamat Kunjungan</th>
                  <th width="20%">Alasan Kunjungan</th>
                  <th width="24%">Hasil Kunjungan</th>
                  <th width="18%">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>
                ${sHomeVisits.length === 0 ? `
                  <tr><td colspan="6" class="text-center" style="font-style: italic;">Tidak ada riwayat kunjungan rumah (home visit).</td></tr>
                ` : sHomeVisits.map((hv: any, i: number) => `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${hv.date}</td>
                    <td>${hv.address}</td>
                    <td>${hv.reason}</td>
                    <td>${hv.result}</td>
                    <td>${hv.followUp || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- F. PANGGILAN ORANG TUA -->
          <div class="section">
            <div class="section-title">F. DAFTAR PANGGILAN ORANG TUA / WALI</div>
            <table>
              <thead>
                <tr>
                  <th width="4%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="20%">Nama Orang Tua / Wali</th>
                  <th width="22%">Permasalahan Dibahas</th>
                  <th width="24%">Solusi & Kesepakatan</th>
                  <th width="18%">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>
                ${sParentCalls.length === 0 ? `
                  <tr><td colspan="6" class="text-center" style="font-style: italic;">Tidak ada riwayat surat / pemanggilan orang tua ke sekolah.</td></tr>
                ` : sParentCalls.map((pc: any, i: number) => `
                  <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${pc.date}</td>
                    <td><strong>${pc.parentName}</strong> <br/><span style="font-size: 8pt; color: #555;">${pc.parentPhone || ''}</span></td>
                    <td>${pc.problem}</td>
                    <td>${pc.solution}</td>
                    <td>${pc.followUp || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="signature-grid">
            <div class="signature-box">
              <div>
                <p>Mengetahui,</p>
                <p><strong>Kepala Sekolah</strong></p>
              </div>
              <div>
                <p><strong>${printSettings.headmasterName || '__________________________'}</strong></p>
                <p>NIP. ${printSettings.headmasterNip || '.....................................'}</p>
              </div>
            </div>

            <div class="signature-box">
              <div>
                <p>Mengetahui,</p>
                <p><strong>Guru / Koordinator BK</strong></p>
              </div>
              <div>
                <p>__________________________</p>
                <p>NIP. .....................................</p>
              </div>
            </div>

            <div class="signature-box">
              <div>
                <p>${printSettings.place}, ${printSettings.date}</p>
                <p><strong>Wali Kelas ${className}</strong></p>
              </div>
              <div>
                <p><strong>${user.fullName}</strong></p>
                <p>NIP. ${user.nip || '-'}</p>
              </div>
            </div>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExcelBKReport = (student: any) => {
    const wb = XLSX.utils.book_new();

    const sViolations = student.details?.violations || violations.filter(v => v.studentId === student.id);
    const sReductions = student.details?.reductions || pointReductions.filter(r => r.studentId === student.id);
    const sSessions = student.details?.sessions || sessions.filter(sess => sess.studentId === student.id);
    const sHomeVisits = student.details?.homeVisits || homeVisits.filter(hv => hv.studentId === student.id);
    const sParentCalls = student.details?.parentCalls || parentCalls.filter(pc => pc.studentId === student.id);
    const studentGuidances = student.details?.guidances || homeroomGuidances.filter(g => g.studentId === student.id);

    // Sheet 1: Pelanggaran
    const vRows = sViolations.map((v: any, i: number) => ({
      No: i + 1,
      Tanggal: v.date,
      Pelanggaran: v.violationName,
      'Penginput Data': v.reportedBy || 'Guru BK / Wali Kelas',
      Poin: v.points,
      Keterangan: v.description || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vRows.length ? vRows : [{ Info: "Tidak ada data pelanggaran" }]), "Pelanggaran");

    // Sheet 2: Pemulihan Poin
    const rRows = sReductions.map((r: any, i: number) => ({
      No: i + 1,
      Tanggal: r.date,
      KegiatanPemulihan: r.activityName,
      'Penginput Data': r.reportedBy || 'Wali Kelas / Guru BK',
      PoinDikurangi: r.pointsRemoved,
      Keterangan: r.description || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rRows.length ? rRows : [{ Info: "Tidak ada data pemulihan poin" }]), "Pemulihan Poin");

    // Sheet 3: Layanan Konseling Guru BK
    const sessRows = sSessions.map((sess: any, i: number) => ({
      No: i + 1,
      Tanggal: sess.date,
      PokokMasalah: sess.issue,
      CatatanKonselingBK: sess.notes,
      RencanaTindakLanjut: sess.followUp || '-',
      Status: sess.status === 'CLOSED' ? 'Tuntas / Selesai' : 'Dalam Pemantauan (OPEN)'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessRows.length ? sessRows : [{ Info: "Tidak ada data konseling BK" }]), "Konseling Guru BK");

    // Sheet 4: Pembinaan Wali Kelas
    const gRows = studentGuidances.map((g: any, i: number) => ({
      No: i + 1,
      Tanggal: g.date,
      BentukPembinaan: g.guidanceType,
      PelanggaranTerkait: g.violationSummary || '-',
      UraianPembinaan: g.notes || '-',
      KomitmenSiswa: g.studentCommitment || '-',
      Status: g.status,
      EvaluasiLanjutan: g.followUpDate || '-',
      KoordinasiOrtu: g.parentInformed ? 'Ya' : 'Tidak'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gRows.length ? gRows : [{ Info: "Tidak ada data pembinaan" }]), "Pembinaan Wali Kelas");

    // Sheet 5: Home Visits
    const hvRows = sHomeVisits.map((hv: any, i: number) => ({
      No: i + 1,
      Tanggal: hv.date,
      Alamat: hv.address,
      Alasan: hv.reason,
      Hasil: hv.result,
      TindakLanjut: hv.followUp,
      Keterangan: hv.notes || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hvRows.length ? hvRows : [{ Info: "Tidak ada data" }]), "Home Visit");

    // Sheet 6: Parent Calls
    const pcRows = sParentCalls.map((pc: any, i: number) => ({
      No: i + 1,
      Tanggal: pc.date,
      OrangTua: pc.parentName,
      NoHP: pc.parentPhone,
      Masalah: pc.problem,
      Solusi: pc.solution,
      TindakLanjut: pc.followUp,
      Keterangan: pc.notes || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pcRows.length ? pcRows : [{ Info: "Tidak ada data" }]), "Panggilan Ortu");

    XLSX.writeFile(wb, `Laporan_BK_${student.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePrintAllBKReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const allStudentsWithDetails = students.map((s, idx) => {
      const bStats = getStudentBehaviorStats(s.id);
      const sViolations = violations.filter(v => v.studentId === s.id);
      const sReductions = pointReductions.filter(r => r.studentId === s.id);
      const sSessions = sessions.filter(sess => sess.studentId === s.id);
      const sGuidances = homeroomGuidances.filter(g => g.studentId === s.id);
      const sHomeVisits = homeVisits.filter(hv => hv.studentId === s.id);
      const sParentCalls = parentCalls.filter(pc => pc.studentId === s.id);
      const totalViolPoints = sViolations.reduce((sum, v) => sum + v.points, 0);
      const totalReducPoints = sReductions.reduce((sum, r) => sum + r.pointsRemoved, 0);

      return {
        idx: idx + 1,
        student: s,
        stats: bStats,
        violPoints: totalViolPoints,
        reducPoints: totalReducPoints,
        violations: sViolations,
        reductions: sReductions,
        sessions: sSessions,
        guidances: sGuidances,
        homeVisits: sHomeVisits,
        parentCalls: sParentCalls,
        hasRecords: sViolations.length > 0 || sReductions.length > 0 || sSessions.length > 0 || sGuidances.length > 0 || sHomeVisits.length > 0 || sParentCalls.length > 0
      };
    });

    const studentsWithRecords = allStudentsWithDetails.filter(d => d.hasRecords);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan BK & Kedisiplinan Seluruh Siswa Kelas ${className}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.4; font-size: 10.5pt; padding: 0; margin: 0; }
            
            .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
            .header h1 { margin: 0; font-size: 14pt; text-transform: uppercase; font-weight: bold; }
            .header h2 { margin: 3px 0 0 0; font-size: 11.5pt; text-transform: uppercase; font-weight: bold; }
            .header p { margin: 3px 0 0 0; font-size: 9.5pt; font-style: italic; color: #333; }

            .summary-box { border: 1px solid #000; padding: 8px; margin-bottom: 16px; background: #f9f9f9; display: flex; justify-content: space-around; font-size: 9pt; text-align: center; }
            .summary-item strong { display: block; font-size: 11.5pt; margin-top: 2px; }

            .section-title { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-top: 18px; margin-bottom: 8px; }

            table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 10px; font-size: 9pt; font-family: 'Times New Roman', Times, serif; }
            th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
            th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }

            .student-card { border: 1px solid #666; padding: 8px; margin-bottom: 14px; page-break-inside: avoid; background: #fff; }
            .student-card-header { font-weight: bold; font-size: 9.5pt; background: #eee; padding: 4px 8px; margin: -8px -8px 6px -8px; border-bottom: 1px solid #666; display: flex; justify-content: space-between; }

            .signature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 25px; text-align: center; font-size: 10pt; page-break-inside: avoid; }
            .signature-box { display: flex; flex-direction: column; justify-content: space-between; height: 105px; }

            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LAPORAN REKAPITULASI BIMBINGAN KONSELING & KEDISIPLINAN SISWA</h1>
            <h2>KELAS ${className} - SEMESTER ${selectedSemester.toUpperCase()} T.A 2025/2026</h2>
            <p>${user.schoolName || 'EduAdmin Pro'} • Tanggal Cetak: ${printSettings.date}</p>
          </div>

          <div class="summary-box">
            <div class="summary-item">Total Siswa Kelas<strong>${students.length} Siswa</strong></div>
            <div class="summary-item">Siswa Berpoin Aktif<strong>${problemStudents.length} Siswa</strong></div>
            <div class="summary-item">Total Kasus Pelanggaran<strong>${violations.length} Kasus</strong></div>
            <div class="summary-item">Pemulihan Poin<strong>${pointReductions.length} Kegiatan</strong></div>
            <div class="summary-item">Layanan Konseling BK<strong>${sessions.length} Sesi</strong></div>
            <div class="summary-item">Pembinaan Wali Kelas<strong>${homeroomGuidances.length} Sesi</strong></div>
          </div>

          <div class="section-title">BAGIAN I : REKAPITULASI AKUMULASI POIN KEDISIPLINAN SELURUH SISWA</div>
          <table>
            <thead>
              <tr>
                <th width="30">NO</th>
                <th width="75">NIS</th>
                <th>NAMA SISWA</th>
                <th width="35">L/P</th>
                <th width="80">PELANGGARAN</th>
                <th width="80">PEMULIHAN</th>
                <th width="80">POIN BERSIH</th>
                <th width="150">STATUS / REKOMENDASI BK</th>
              </tr>
            </thead>
            <tbody>
              ${allStudentsWithDetails.map((item) => `
                <tr>
                  <td class="text-center">${item.idx}</td>
                  <td class="text-center">${item.student.nis}</td>
                  <td><strong>${item.student.name}</strong></td>
                  <td class="text-center">${item.student.gender || '-'}</td>
                  <td class="text-center" style="color: ${item.violPoints > 0 ? '#dc2626' : '#555'}; font-weight: ${item.violPoints > 0 ? 'bold' : 'normal'};">
                    ${item.violPoints > 0 ? `+${item.violPoints}` : '0'}
                  </td>
                  <td class="text-center" style="color: ${item.reducPoints > 0 ? '#16a34a' : '#555'}; font-weight: ${item.reducPoints > 0 ? 'bold' : 'normal'};">
                    ${item.reducPoints > 0 ? `-${item.reducPoints}` : '0'}
                  </td>
                  <td class="text-center"><strong>${item.stats.totalPoints}</strong></td>
                  <td>${item.stats.recommendation}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">BAGIAN II : RINCIAN CATATAN KEDISIPLINAN, PEMULIHAN & BK SISWA</div>
          ${studentsWithRecords.length === 0 ? `
            <p style="font-style: italic; color: #555;">Tidak ada siswa yang memiliki catatan kedisiplinan, pemulihan poin, atau bimbingan konseling pada semester ini.</p>
          ` : `
            ${studentsWithRecords.map((item) => `
              <div class="student-card">
                <div class="student-card-header">
                  <span>${item.student.name} (NIS: ${item.student.nis})</span>
                  <span>Poin Bersih Aktif: ${item.stats.totalPoints} Poin (+${item.violPoints} / -${item.reducPoints}) • Status: ${item.stats.recommendation}</span>
                </div>

                ${item.violations.length > 0 ? `
                  <p style="margin: 3px 0; font-weight: bold; font-size: 8.5pt;">• Catatan Pelanggaran Kedisiplinan (${item.violations.length} Kasus):</p>
                  <table style="margin-bottom: 6px;">
                    <thead>
                      <tr>
                        <th width="25">No</th>
                        <th width="75">Tanggal</th>
                        <th>Jenis Pelanggaran</th>
                        <th width="120">Diinput Oleh</th>
                        <th>Keterangan</th>
                        <th width="40">Poin (+)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.violations.map((v, i) => `
                        <tr>
                          <td class="text-center">${i + 1}</td>
                          <td class="text-center">${v.date}</td>
                          <td><strong>${v.violationName}</strong></td>
                          <td><span style="font-weight:600; color:#1e1b4b;">${v.reportedBy || 'Guru BK / Wali Kelas'}</span></td>
                          <td>${v.description || '-'}</td>
                          <td class="text-center" style="font-weight:bold; color:#dc2626;">+${v.points}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}

                ${item.reductions.length > 0 ? `
                  <p style="margin: 3px 0; font-weight: bold; font-size: 8.5pt;">• Catatan Pengurangan / Pemulihan Poin (${item.reductions.length} Kegiatan):</p>
                  <table style="margin-bottom: 6px;">
                    <thead>
                      <tr>
                        <th width="25">No</th>
                        <th width="75">Tanggal</th>
                        <th>Bentuk Kegiatan Pemulihan</th>
                        <th width="120">Diinput Oleh</th>
                        <th>Keterangan & Catatan</th>
                        <th width="40">Poin (-)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.reductions.map((r, i) => `
                        <tr>
                          <td class="text-center">${i + 1}</td>
                          <td class="text-center">${r.date}</td>
                          <td><strong>${r.activityName}</strong></td>
                          <td><span style="font-weight:600; color:#065f46;">${r.reportedBy || 'Wali Kelas / Guru BK'}</span></td>
                          <td>${r.description || '-'}</td>
                          <td class="text-center" style="font-weight:bold; color:#16a34a;">-${r.pointsRemoved}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}

                ${item.sessions.length > 0 ? `
                  <p style="margin: 3px 0; font-weight: bold; font-size: 8.5pt;">• Catatan Layanan Konseling Guru BK (${item.sessions.length} Sesi):</p>
                  <table style="margin-bottom: 6px;">
                    <thead>
                      <tr>
                        <th width="25">No</th>
                        <th width="75">Tanggal</th>
                        <th>Pokok Masalah / Konseling</th>
                        <th>Catatan Diagnosis & Konseling BK</th>
                        <th>Rencana Tindak Lanjut</th>
                        <th width="75">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.sessions.map((sess, i) => `
                        <tr>
                          <td class="text-center">${i + 1}</td>
                          <td class="text-center">${sess.date}</td>
                          <td><strong>${sess.issue}</strong></td>
                          <td>${sess.notes}</td>
                          <td>${sess.followUp || '-'}</td>
                          <td class="text-center" style="font-weight: bold;">
                            ${sess.status === 'CLOSED' ? '<span style="color:#16a34a">Tuntas</span>' : '<span style="color:#d97706">Proses (OPEN)</span>'}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}

                ${item.guidances.length > 0 ? `
                  <p style="margin: 3px 0; font-weight: bold; font-size: 8.5pt;">• Catatan Pembinaan Khusus Wali Kelas (${item.guidances.length} Sesi):</p>
                  <table style="margin-bottom: 6px;">
                    <thead>
                      <tr>
                        <th width="25">No</th>
                        <th width="75">Tanggal</th>
                        <th>Bentuk Pembinaan</th>
                        <th>Uraian Pembinaan Wali Kelas</th>
                        <th>Komitmen Siswa</th>
                        <th width="85">Status Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.guidances.map((g, i) => `
                        <tr>
                          <td class="text-center">${i + 1}</td>
                          <td class="text-center">${g.date}</td>
                          <td><strong>${g.guidanceType}</strong></td>
                          <td>${g.notes || '-'}</td>
                          <td>${g.studentCommitment ? `<em>"${g.studentCommitment}"</em>` : '-'}</td>
                          <td class="text-center">
                            <strong>${g.status}</strong>
                            ${g.followUpDate ? `<div style="font-size: 7.5pt; color: #555;">Pantau: ${g.followUpDate}</div>` : ''}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}

                ${item.homeVisits.length > 0 ? `
                  <p style="margin: 3px 0; font-weight: bold; font-size: 8.5pt;">• Kunjungan Rumah / Home Visit (${item.homeVisits.length} Kali):</p>
                  <table style="margin-bottom: 6px;">
                    <thead>
                      <tr>
                        <th width="25">No</th>
                        <th width="75">Tanggal</th>
                        <th>Alamat Kunjungan</th>
                        <th>Alasan Kunjungan</th>
                        <th>Hasil & Tindak Lanjut</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.homeVisits.map((hv, i) => `
                        <tr>
                          <td class="text-center">${i + 1}</td>
                          <td class="text-center">${hv.date}</td>
                          <td>${hv.address}</td>
                          <td>${hv.reason}</td>
                          <td>${hv.result} (${hv.followUp || '-'})</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}

                ${item.parentCalls.length > 0 ? `
                  <p style="margin: 3px 0; font-weight: bold; font-size: 8.5pt;">• Panggilan Orang Tua (${item.parentCalls.length} Kali):</p>
                  <table>
                    <thead>
                      <tr>
                        <th width="25">No</th>
                        <th width="75">Tanggal</th>
                        <th>Nama Orang Tua</th>
                        <th>Permasalahan Dibahas</th>
                        <th>Solusi & Kesepakatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.parentCalls.map((pc, i) => `
                        <tr>
                          <td class="text-center">${i + 1}</td>
                          <td class="text-center">${pc.date}</td>
                          <td>${pc.parentName} (${pc.parentPhone || '-'})</td>
                          <td>${pc.problem}</td>
                          <td>${pc.solution} (${pc.followUp || '-'})</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}
              </div>
            `).join('')}
          `}

          <div class="signature-grid">
            <div class="signature-box">
              <div>
                <p>Mengetahui,</p>
                <p><strong>Guru / Koordinator BK</strong></p>
              </div>
              <div>
                <p>__________________________</p>
                <p>NIP. .....................................</p>
              </div>
            </div>

            <div class="signature-box">
              <div>
                <p>${printSettings.place}, ${printSettings.date}</p>
                <p><strong>Wali Kelas ${className}</strong></p>
              </div>
              <div>
                <p><strong>${user.fullName}</strong></p>
                <p>NIP. ${user.nip || '-'}</p>
              </div>
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExcelAllBKReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rekap Poin Seluruh Siswa
    const summaryRows = students.map((s, i) => {
      const bStats = getStudentBehaviorStats(s.id);
      const sViolations = violations.filter(v => v.studentId === s.id);
      const sReductions = pointReductions.filter(r => r.studentId === s.id);
      const totalViol = sViolations.reduce((sum, v) => sum + v.points, 0);
      const totalReduc = sReductions.reduce((sum, r) => sum + r.pointsRemoved, 0);

      return {
        No: i + 1,
        NIS: s.nis,
        NamaSiswa: s.name,
        Gender: s.gender || '-',
        TotalPoinPelanggaran: totalViol,
        TotalPemulihanPoin: totalReduc,
        PoinBersihAktif: bStats.totalPoints,
        RekomendasiStatusBK: bStats.recommendation
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Rekap Poin Siswa");

    // Sheet 2: Detail Pelanggaran
    const violRows = violations.map((v, i) => {
      const st = students.find(s => s.id === v.studentId);
      return {
        No: i + 1,
        Tanggal: v.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : v.studentId,
        JenisPelanggaran: v.violationName,
        PenginputData: v.reportedBy || 'Guru BK / Wali Kelas',
        Poin: v.points,
        Keterangan: v.description || '-'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(violRows.length ? violRows : [{ Info: "Tidak ada data" }]), "Detail Pelanggaran");

    // Sheet 3: Detail Pemulihan Poin
    const reducRows = pointReductions.map((r, i) => {
      const st = students.find(s => s.id === r.studentId);
      return {
        No: i + 1,
        Tanggal: r.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : r.studentId,
        KegiatanPemulihan: r.activityName,
        PenginputData: r.reportedBy || 'Wali Kelas / Guru BK',
        PoinDikurangi: r.pointsRemoved,
        Keterangan: r.description || '-'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reducRows.length ? reducRows : [{ Info: "Tidak ada data" }]), "Detail Pemulihan");

    // Sheet 4: Detail Layanan Konseling Guru BK
    const sessRows = sessions.map((sess, i) => {
      const st = students.find(s => s.id === sess.studentId);
      return {
        No: i + 1,
        Tanggal: sess.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : sess.studentId,
        PokokMasalah: sess.issue,
        CatatanKonselingBK: sess.notes,
        RencanaTindakLanjut: sess.followUp || '-',
        Status: sess.status === 'CLOSED' ? 'Tuntas / Selesai' : 'Dalam Pemantauan (OPEN)'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessRows.length ? sessRows : [{ Info: "Tidak ada data konseling BK" }]), "Detail Konseling Guru BK");

    // Sheet 5: Detail Pembinaan Wali Kelas
    const guidanceRows = homeroomGuidances.map((g, i) => {
      const st = students.find(s => s.id === g.studentId);
      return {
        No: i + 1,
        Tanggal: g.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : g.studentId,
        Gender: st ? st.gender || '-' : '-',
        BentukPembinaan: g.guidanceType,
        PelanggaranTerkait: g.violationSummary || '-',
        UraianPembinaan: g.notes || '-',
        KomitmenSiswa: g.studentCommitment || '-',
        StatusHasil: g.status,
        TanggalEvaluasiLanjutan: g.followUpDate || '-',
        KoordinasiOrangTua: g.parentInformed ? 'Ya' : 'Tidak'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guidanceRows.length ? guidanceRows : [{ Info: "Tidak ada data" }]), "Pembinaan Wali Kelas");

    // Sheet 6: Detail Home Visit
    const hvRows = homeVisits.map((hv, i) => {
      const st = students.find(s => s.id === hv.studentId);
      return {
        No: i + 1,
        Tanggal: hv.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : hv.studentId,
        Alamat: hv.address,
        Alasan: hv.reason,
        Hasil: hv.result,
        TindakLanjut: hv.followUp,
        Keterangan: hv.notes || '-'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hvRows.length ? hvRows : [{ Info: "Tidak ada data" }]), "Detail Home Visit");

    // Sheet 7: Detail Panggilan Ortu
    const pcRows = parentCalls.map((pc, i) => {
      const st = students.find(s => s.id === pc.studentId);
      return {
        No: i + 1,
        Tanggal: pc.date,
        NIS: st ? st.nis : '-',
        NamaSiswa: st ? st.name : pc.studentId,
        OrangTua: pc.parentName,
        NoHP: pc.parentPhone,
        Masalah: pc.problem,
        Solusi: pc.solution,
        TindakLanjut: pc.followUp,
        Keterangan: pc.notes || '-'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pcRows.length ? pcRows : [{ Info: "Tidak ada data" }]), "Detail Panggilan Ortu");

    XLSX.writeFile(wb, `Laporan_BK_Seluruh_Siswa_${className.replace(/\s+/g, '_')}.xlsx`);
  };

  // --- INVENTORY LOGIC ---
  const handleAddInventoryRow = () => {
    const newItem: any = {
      classId: user.homeroomClassId!,
      userId: user.id,
      schoolNpsn: user.schoolNpsn || 'DEFAULT',
      itemName: '',
      volume: 0,
      condition: 'BAIK',
      notes: ''
    };
    setInventoryItems([...inventoryItems, newItem]);
  };

  const handleUpdateInventoryItem = (index: number, field: keyof ClassInventory, value: any) => {
    const newItems = [...inventoryItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setInventoryItems(newItems);
  };

  const handleRemoveInventoryItem = async (index: number) => {
    const item = inventoryItems[index];
    if (item.id) {
      if (confirm('Hapus barang ini dari inventaris?')) {
        await deleteClassInventory(item.id);
      } else {
        return;
      }
    }
    const newItems = inventoryItems.filter((_, i) => i !== index);
    setInventoryItems(newItems);
  };

  const handleSaveInventory = async () => {
    setIsSavingInventory(true);
    try {
      // Filter out empty item names
      const validItems = inventoryItems.filter(item => item.itemName.trim() !== '');
      await saveClassInventory(validItems);
      alert('Inventaris berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan inventaris.');
    } finally {
      setIsSavingInventory(false);
    }
  };

  const handlePrintInventory = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Inventaris Kelas ${className}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            .header p { margin: 5px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; text-align: center; }
            .text-center { text-align: center; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature-box { text-align: center; width: 200px; }
            .signature-space { height: 80px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAFTAR INVENTARIS KELAS</h1>
            <p>KELAS: ${className} | SEMESTER: ${selectedSemester}</p>
            <p>${user.schoolName || ''}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th width="40">NO</th>
                <th>NAMA BARANG</th>
                <th width="60">VOL</th>
                <th width="60">BAIK</th>
                <th width="60">RR</th>
                <th width="60">RS</th>
                <th width="60">RB</th>
                <th>KETERANGAN</th>
              </tr>
            </thead>
            <tbody>
              ${inventoryItems.map((item, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${item.itemName}</td>
                  <td class="text-center">${item.volume}</td>
                  <td class="text-center">${item.condition === 'BAIK' ? '✓' : ''}</td>
                  <td class="text-center">${item.condition === 'RUSAK_RINGAN' ? '✓' : ''}</td>
                  <td class="text-center">${item.condition === 'RUSAK_SEDANG' ? '✓' : ''}</td>
                  <td class="text-center">${item.condition === 'RUSAK_BERAT' ? '✓' : ''}</td>
                  <td>${item.notes || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${printSettings.showSignature ? `
          <div class="footer">
            <div class="signature-box">
              <p>Mengetahui,</p>
              <p>Kepala Sekolah</p>
              <div class="signature-space"></div>
              <p style="white-space: nowrap;"><strong>${printSettings.headmasterName || '................................'}</strong></p>
              <p>NIP. ${printSettings.headmasterNip || '................................'}</p>
            </div>
            <div class="signature-box">
              <p>${printSettings.place}, ${printSettings.date}</p>
              <p>Wali Kelas</p>
              <div class="signature-space"></div>
              <p style="white-space: nowrap;"><strong>${printSettings.homeroomName}</strong></p>
              <p>NIP. ${printSettings.homeroomNip}</p>
            </div>
          </div>
          ` : ''}

          <script>
            window.onload = () => {
              window.print();
              // window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- WORKPLAN & LPJ LOGIC ---
  const handleSaveWorkplanList = (items: HomeroomWorkplanItem[]) => {
    setWorkplanItems(items);
    if (user.homeroomClassId) {
      const wpKey = `homeroom_workplan_${user.homeroomClassId}_${selectedSemester}`;
      localStorage.setItem(wpKey, JSON.stringify(items));
    }
  };

  const handleOpenAddWorkplan = () => {
    setEditingWorkplan(null);
    setWorkplanForm({
      category: 'Organisasi & Administrasi',
      title: '',
      targetMonth: 'Juli',
      indicator: '',
      status: 'BELUM',
      progress: 0,
      notes: ''
    });
    setShowWorkplanModal(true);
  };

  const handleOpenEditWorkplan = (item: HomeroomWorkplanItem) => {
    setEditingWorkplan(item);
    setWorkplanForm({
      category: item.category,
      title: item.title,
      targetMonth: item.targetMonth,
      indicator: item.indicator,
      status: item.status,
      progress: item.progress,
      notes: item.notes || ''
    });
    setShowWorkplanModal(true);
  };

  const handleSaveWorkplanForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workplanForm.title.trim()) {
      alert('Nama program kerja harus diisi!');
      return;
    }

    let updatedList: HomeroomWorkplanItem[];
    if (editingWorkplan) {
      updatedList = workplanItems.map(item => 
        item.id === editingWorkplan.id 
          ? { ...item, ...workplanForm }
          : item
      );
    } else {
      const newItem: HomeroomWorkplanItem = {
        id: `wp-${Date.now()}`,
        ...workplanForm
      };
      updatedList = [...workplanItems, newItem];
    }

    handleSaveWorkplanList(updatedList);
    setShowWorkplanModal(false);
  };

  const handleDeleteWorkplan = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus program kerja ini?')) {
      const updated = workplanItems.filter(item => item.id !== id);
      handleSaveWorkplanList(updated);
    }
  };

  const handleResetWorkplans = () => {
    if (confirm('Apakah Anda yakin ingin memuat ulang template program kerja standar? Data yang sudah ada akan digantikan.')) {
      handleSaveWorkplanList(DEFAULT_WORKPLAN_TEMPLATES);
    }
  };

  const handleSaveLpj = () => {
    if (user.homeroomClassId) {
      const lpjKey = `homeroom_lpj_${user.homeroomClassId}_${selectedSemester}`;
      localStorage.setItem(lpjKey, JSON.stringify(lpjReport));
      alert('Laporan Kinerja & Evaluasi LPJ Wali Kelas berhasil disimpan!');
    }
  };

  // Class Summary Calculations for LPJ
  const totalStudentsCount = students.length;
  
  // Class Average
  const classAverages = students.map(s => getStudentGlobalStats(s.id).globalAvg).filter(a => a > 0);
  const classOverallAverage = classAverages.length > 0 
    ? (classAverages.reduce((sum, a) => sum + a, 0) / classAverages.length).toFixed(1)
    : '-';

  // Completed Workplans %
  const completedWorkplansCount = workplanItems.filter(w => w.status === 'TERLAKSANA').length;
  const workplanProgressPercent = workplanItems.length > 0 
    ? Math.round((completedWorkplansCount / workplanItems.length) * 100)
    : 0;

  // Good Inventory %
  const goodInventoryCount = inventoryItems.filter(i => i.condition === 'BAIK').length;
  const inventoryGoodPercent = inventoryItems.length > 0 
    ? Math.round((goodInventoryCount / inventoryItems.length) * 100)
    : 0;

  const handlePrintLpj = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>LPJ Wali Kelas ${className} - Semester ${selectedSemester}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; font-size: 13px; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #0f172a; padding-bottom: 12px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
            .header h2 { margin: 4px 0 0 0; font-size: 15px; font-weight: 600; color: #334155; }
            .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
            
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 20px; font-size: 12px; padding: 12px; }
            .meta-item { display: flex; gap: 8px; }
            .meta-label { font-weight: bold; width: 110px; color: #475569; }

            .section-title { font-size: 14px; font-weight: bold; background: #e2e8f0; padding: 6px 12px; border-left: 4px solid #2563eb; margin: 20px 0 10px 0; color: #0f172a; text-transform: uppercase; }

            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; background: #fff; }
            .card-val { font-size: 18px; font-weight: bold; color: #1e3a8a; }
            .card-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }

            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            th, td { border: 1px solid #94a3b8; padding: 7px 9px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; text-align: center; color: #1e293b; }
            .text-center { text-align: center; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-align: center; }
            .badge-success { background: #dcfce7; color: #15803d; }
            .badge-blue { background: #dbeafe; color: #1d4ed8; }
            .badge-warning { background: #fef3c7; color: #b45309; }
            .badge-gray { background: #f1f5f9; color: #475569; }

            .text-block { background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-top: 6px; white-space: pre-line; line-height: 1.6; }

            .footer { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .signature-box { text-align: center; width: 220px; }
            .signature-space { height: 75px; }

            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LAPORAN PERTANGGUNGJAWABAN (LPJ) & KINERJA WALI KELAS</h1>
            <h2>SEMESTER ${selectedSemester.toUpperCase()} - TAHUN AJARAN 2025/2026</h2>
            <p>${user.schoolName || 'EduAdmin Pro'}</p>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Nama Wali Kelas</span>: <strong>${user.fullName}</strong></div>
            <div class="meta-item"><span class="meta-label">NIP Wali Kelas</span>: ${user.nip || '-'}</div>
            <div class="meta-item"><span class="meta-label">Kelas Perwalian</span>: <strong>${className}</strong></div>
            <div class="meta-item"><span class="meta-label">Jumlah Siswa</span>: ${totalStudentsCount} Siswa</div>
          </div>

          <div class="section-title">I. RINGKASAN CAPAIAN & STATISTIKA KINERJA KELAS</div>
          <div class="summary-cards">
            <div class="card">
              <div class="card-val">${workplanProgressPercent}%</div>
              <div class="card-lbl">Capaian Program Kerja</div>
            </div>
            <div class="card">
              <div class="card-val">${classOverallAverage}</div>
              <div class="card-lbl">Rata-Rata Leger Akademik</div>
            </div>
            <div class="card">
              <div class="card-val">${violations.length} Pelanggaran</div>
              <div class="card-lbl">Catatan BK & Kedisiplinan</div>
            </div>
            <div class="card">
              <div class="card-val">${inventoryGoodPercent}% Baik</div>
              <div class="card-lbl">Kelayakan Inventaris</div>
            </div>
          </div>

          <div class="section-title">II. MATRIKS PROGRAM KERJA & REALISASI WALI KELAS</div>
          <table>
            <thead>
              <tr>
                <th width="30">NO</th>
                <th width="140">BIDANG KEGIATAN</th>
                <th>NAMA PROGRAM KERJA</th>
                <th width="90">TARGET WAKTU</th>
                <th>INDIKATOR KEBERHASILAN</th>
                <th width="90">STATUS</th>
                <th width="50">%</th>
              </tr>
            </thead>
            <tbody>
              ${workplanItems.map((item, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><strong>${item.category}</strong></td>
                  <td>${item.title}</td>
                  <td class="text-center">${item.targetMonth}</td>
                  <td>${item.indicator}</td>
                  <td class="text-center">
                    <span class="badge ${
                      item.status === 'TERLAKSANA' ? 'badge-success' :
                      item.status === 'PROSES' ? 'badge-blue' :
                      item.status === 'TERTUNDA' ? 'badge-warning' : 'badge-gray'
                    }">${item.status}</span>
                  </td>
                  <td class="text-center"><strong>${item.progress}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">III. EVALUASI KINERJA, HAMBATAN & SOLUSI WALI KELAS</div>
          
          <p><strong>A. Ringkasan Capaian & Pelaksanaan Tugas Wali Kelas:</strong></p>
          <div class="text-block">${lpjReport.evaluationSummary || 'Belum ada ringkasan'}</div>

          <p style="margin-top: 12px;"><strong>B. Hambatan & Kendala Dalam Kelas:</strong></p>
          <div class="text-block">${lpjReport.obstacles || 'Tidak ada hambatan berarti'}</div>

          <p style="margin-top: 12px;"><strong>C. Solusi & Tindak Lanjut Yang Dilakukan:</strong></p>
          <div class="text-block">${lpjReport.solutions || 'Solusi berjalan dengan baik'}</div>

          <p style="margin-top: 12px;"><strong>D. Rekomendasi & Rencana Langkah Selanjutnya:</strong></p>
          <div class="text-block">${lpjReport.recommendations || 'Melanjutkan program kerja secara konsisten'}</div>

          ${printSettings.showSignature ? `
          <div class="footer" style="margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; page-break-inside: avoid;">
            <div class="signature-box" style="width: auto;">
              <p>Mengetahui,</p>
              <p><strong>Koordinator BK / Guru BK</strong></p>
              <div class="signature-space"></div>
              <p style="white-space: nowrap;"><strong>${printSettings.bkName || '................................'}</strong></p>
              <p>NIP. ${printSettings.bkNip || '................................'}</p>
            </div>
            <div class="signature-box" style="width: auto;">
              <p>Disetujui Oleh,</p>
              <p><strong>Kepala Sekolah</strong></p>
              <div class="signature-space"></div>
              <p style="white-space: nowrap;"><strong>${printSettings.headmasterName || '................................'}</strong></p>
              <p>NIP. ${printSettings.headmasterNip || '................................'}</p>
            </div>
            <div class="signature-box" style="width: auto;">
              <p>${printSettings.place}, ${printSettings.date}</p>
              <p><strong>Wali Kelas ${className}</strong></p>
              <div class="signature-space"></div>
              <p style="white-space: nowrap;"><strong>${printSettings.homeroomName || user.fullName}</strong></p>
              <p>NIP. ${printSettings.homeroomNip || user.nip || '-'}</p>
            </div>
          </div>
          ` : ''}

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintOfficialPortfolio = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalMaleStudents = students.filter(s => (s.gender as any) === 'L' || (s.gender as any) === 'M' || (s.gender && String(s.gender).toLowerCase().startsWith('l'))).length;
    const totalFemaleStudents = students.filter(s => (s.gender as any) === 'P' || (s.gender as any) === 'F' || (s.gender && String(s.gender).toLowerCase().startsWith('p'))).length;

    // Group BK Violations by Student
    const studentViolationMap: Record<string, {
      studentName: string;
      nis: string;
      totalViolations: number;
      totalPoints: number;
      details: { date: string; category: string; description: string; points: number; reportedBy?: string }[];
      recommendation: string;
    }> = {};

    violations.forEach(v => {
      const st = students.find(s => s.id === v.studentId);
      if (!studentViolationMap[v.studentId]) {
        studentViolationMap[v.studentId] = {
          studentName: st ? st.name : v.studentId,
          nis: st ? st.nis : '-',
          totalViolations: 0,
          totalPoints: 0,
          details: [],
          recommendation: ''
        };
      }

      const cat = (v as any).category || v.violationName || 'Pelanggaran';
      const desc = v.description || '';
      const pts = v.points || 0;

      studentViolationMap[v.studentId].details.push({
        date: v.date,
        category: cat,
        description: desc,
        points: pts,
        reportedBy: v.reportedBy || 'Guru BK / Wali Kelas'
      });
      studentViolationMap[v.studentId].totalViolations += 1;
      studentViolationMap[v.studentId].totalPoints += pts;
    });

    const groupedViolationsList = Object.values(studentViolationMap).map(grp => {
      let rec = '';
      if (grp.totalPoints >= 75) {
        rec = 'Panggilan Orang Tua Ke-3, Konferensi Kasus BK & SK Skorsing / Pembinaan Khusus';
      } else if (grp.totalPoints >= 50) {
        rec = 'Panggilan Orang Tua Ke-2, Surat Peringatan II (SP 2) & Konseling Intensif BK';
      } else if (grp.totalPoints >= 25) {
        rec = 'Panggilan Orang Tua Ke-1, Surat Peringatan I (SP 1) & Pembinaan Wali Kelas';
      } else if (grp.totalPoints >= 10) {
        rec = 'Teguran Lisan Tegas, Pembinaan Wali Kelas & Komitmen Tertulis Siswa';
      } else {
        rec = 'Pembinaan Wali Kelas & Bimbingan Konseling Rutin';
      }
      return { ...grp, recommendation: rec };
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Portofolio Administrasi Wali Kelas ${className} - ${user.schoolName || 'Sekolah'}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.6; font-size: 12pt; padding: 0; margin: 0; }
            
            /* COVER STYLING */
            .cover-container { min-height: 90vh; display: flex; flex-direction: column; justify-content: space-between; text-align: center; page-break-after: always; break-after: page; padding: 20px 10px; box-sizing: border-box; }
            .cover-header { border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 30px; }
            .cover-header h3 { margin: 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
            .cover-header h2 { margin: 4px 0 0 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
            .cover-header p { margin: 4px 0 0 0; font-size: 11pt; font-style: italic; color: #333; }
            
            .cover-title-box { margin: 40px 0; }
            .cover-title-box h1 { font-size: 18pt; font-weight: bold; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 1px; line-height: 1.3; }
            .cover-title-box h2 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 0; color: #222; }

            .cover-identity-box { border: 2px solid #000; padding: 20px; margin: 30px auto; max-width: 480px; text-align: left; background: #fafafa; }
            .cover-identity-box table { width: 100%; border: none; font-size: 11pt; font-family: 'Times New Roman', Times, serif; }
            .cover-identity-box td { border: none; padding: 5px 8px; vertical-align: top; }

            .cover-footer { margin-top: 40px; font-size: 12pt; font-weight: bold; text-transform: uppercase; }

            /* DOCUMENT CONTENT STYLING */
            .page-break { page-break-after: always; break-after: page; }
            .doc-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .doc-header h2 { margin: 0; font-size: 15pt; text-transform: uppercase; }
            .doc-header h3 { margin: 5px 0 0 0; font-size: 12pt; font-weight: normal; }

            .chapter-title { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: 25px; margin-bottom: 12px; border-bottom: 1.5px solid #000; padding-bottom: 4px; color: #000; }
            .subchapter-title { font-size: 11.5pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; }

            p.paragraph { text-align: justify; text-indent: 30px; margin: 6px 0; line-height: 1.6; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; font-size: 10.5pt; font-family: 'Times New Roman', Times, serif; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
            th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }

            .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 40px; text-align: center; font-size: 11pt; page-break-inside: avoid; }
            .signature-box { display: flex; flex-direction: column; justify-content: space-between; height: 160px; }

            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          
          <!-- COVER / HALAMAN DEPAN -->
          <div class="cover-container">
            <div class="cover-header">
              <h3>DOKUMEN STANDAR ADMINISTRASI SEKOLAH</h3>
              2. LAPORAN PERTANGGUNGJAWABAN (LPJ) & PORTOFOLIO KINERJA WALI KELAS
              <h2>${user.schoolName || 'SMA / SMK / SMP NEGERI'}</h2>
              <p>Sistem Informasi Manajemen Portofolio & Perwalian Kelas</p>
            </div>

            <div class="cover-title-box">
              <h1>PORTOFOLIO ADMINISTRASI & LAPORAN PERTANGGUNGJAWABAN (LPJ) WALI KELAS</h1>
              <h2>SEMESTER ${selectedSemester.toUpperCase()} - TAHUN AJARAN 2025/2026</h2>
            </div>

            <div class="cover-identity-box">
              <table>
                <tr>
                  <td width="140"><strong>Nama Sekolah</strong></td>
                  <td width="15">:</td>
                  <td>${user.schoolName || 'EduAdmin Pro'}</td>
                </tr>
                <tr>
                  <td><strong>Kelas Perwalian</strong></td>
                  <td>:</td>
                  <td><strong>${className}</strong></td>
                </tr>
                <tr>
                  <td><strong>Nama Wali Kelas</strong></td>
                  <td>:</td>
                  <td><strong>${user.fullName}</strong></td>
                </tr>
                <tr>
                  <td><strong>NIP Wali Kelas</strong></td>
                  <td>:</td>
                  <td>${user.nip || '-'}</td>
                </tr>
                <tr>
                  <td><strong>Jumlah Siswa</strong></td>
                  <td>:</td>
                  <td>${totalStudentsCount} Orang (${totalMaleStudents} L / ${totalFemaleStudents} P)</td>
                </tr>
                <tr>
                  <td><strong>Semester / Tahun</strong></td>
                  <td>:</td>
                  <td>${selectedSemester} / 2025-2026</td>
                </tr>
              </table>
            </div>

            <div class="cover-footer">
              <p>${printSettings.place.toUpperCase()}, 2026</p>
            </div>
          </div>

          <!-- LEMBAR PENGESAHAN -->
          <div class="page-break">
            <div class="doc-header">
              <h2>LEMBAR PENGESAHAN DOKUMEN PORTOFOLIO ADMINISTRASI WALI KELAS</h2>
              <h3>Tahun Ajaran 2025/2026 - Semester ${selectedSemester}</h3>
            </div>

            <p class="paragraph">
              Dokumen Portofolio Administrasi dan Laporan Pertanggungjawaban (LPJ) Kinerja Wali Kelas <strong>${className}</strong> 
              pada semester <strong>${selectedSemester}</strong> Tahun Ajaran 2025/2026 yang disusun oleh <strong>${user.fullName}</strong> 
              telah diperiksa, dievaluasi, dan disahkan sebagai dokumen portofolio pertanggungjawaban resmi sekolah.
            </p>

            <br />
            <table style="width: 80%; margin: 20px auto; border: none;">
              <tr style="border: none;">
                <td style="border: none;" width="180"><strong>Dibuat Di</strong></td>
                <td style="border: none;" width="15">:</td>
                <td style="border: none;">${printSettings.place}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Pada Tanggal</strong></td>
                <td style="border: none;">:</td>
                <td style="border: none;">${printSettings.date}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Status Dokumen</strong></td>
                <td style="border: none;">:</td>
                <td style="border: none;">Lengkap & Disahkan (Portofolio Resmi)</td>
              </tr>
            </table>

            <div class="signature-grid">
              <div class="signature-box">
                <div>
                  <p>Mengetahui,</p>
                  <p><strong>Koordinator BK / Guru BK</strong></p>
                </div>
                <div>
                  <p><strong>${printSettings.bkName || '.....................................'}</strong></p>
                  <p>NIP. ${printSettings.bkNip || '.....................................'}</p>
                </div>
              </div>

              <div class="signature-box">
                <div>
                  <p>Disetujui Oleh,</p>
                  <p><strong>Kepala Sekolah</strong></p>
                </div>
                <div>
                  <p><strong>${printSettings.headmasterName || '.....................................'}</strong></p>
                  <p>NIP. ${printSettings.headmasterNip || '.....................................'}</p>
                </div>
              </div>

              <div class="signature-box">
                <div>
                  <p>${printSettings.place}, ${printSettings.date}</p>
                  <p><strong>Wali Kelas ${className}</strong></p>
                </div>
                <div>
                  <p><strong>${printSettings.homeroomName || user.fullName}</strong></p>
                  <p>NIP. ${printSettings.homeroomNip || user.nip || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- BAB I - PENDAHULUAN -->
          <div class="page-break">
            <div class="chapter-title">BAB I : PENDAHULUAN</div>

            <div class="subchapter-title">1.1 Latar Belakang & Keadaan Umum Kelas</div>
            <p class="paragraph">
              Wali kelas memiliki peran strategis dalam sistem pengelolaan pendidikan di sekolah. Selain bertindak sebagai pendamping akademik, 
              wali kelas berperan sebagai pengasuh, pembina karakter, serta jembatan komunikasi antara sekolah, siswa, dan orang tua/wali murid. 
              Dokumen portofolio ini disusun sebagai wujud akuntabilitas dan transparansi pelaksanaan tugas wali kelas di <strong>${className}</strong> 
              selama Semester ${selectedSemester} Tahun Ajaran 2025/2026.
            </p>

            <div class="subchapter-title">1.2 Profil & Demografi Siswa Kelas</div>
            <p class="paragraph">
              Kelas <strong>${className}</strong> memiliki total <strong>${totalStudentsCount}</strong> siswa terdaftar dengan rincian komposisi gender dan status perwalian sebagai berikut:
            </p>
            <table>
              <thead>
                <tr>
                  <th width="40">NO</th>
                  <th>DESKRIPSI PARAMETER DEMOGRAFI KELAS</th>
                  <th width="150">JUMLAH / RINCIAN</th>
                  <th width="120">PERSENTASE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-center">1</td>
                  <td>Jumlah Siswa Laki-Laki (L)</td>
                  <td class="text-center">${totalMaleStudents} Siswa</td>
                  <td class="text-center">${totalStudentsCount > 0 ? Math.round((totalMaleStudents/totalStudentsCount)*100) : 0}%</td>
                </tr>
                <tr>
                  <td class="text-center">2</td>
                  <td>Jumlah Siswa Perempuan (P)</td>
                  <td class="text-center">${totalFemaleStudents} Siswa</td>
                  <td class="text-center">${totalStudentsCount > 0 ? Math.round((totalFemaleStudents/totalStudentsCount)*100) : 0}%</td>
                </tr>
                <tr>
                  <td class="text-center">3</td>
                  <td><strong>Total Keseluruhan Siswa Kelas</strong></td>
                  <td class="text-center"><strong>${totalStudentsCount} Siswa</strong></td>
                  <td class="text-center"><strong>100%</strong></td>
                </tr>
                <tr>
                  <td class="text-center">4</td>
                  <td>Rata-Rata Nilai Leger Akademik Kelas</td>
                  <td class="text-center"><strong>${classOverallAverage}</strong></td>
                  <td class="text-center">SKBM ≥ ${kkm}</td>
                </tr>
                <tr>
                  <td class="text-center">5</td>
                  <td>Tingkat Kelayakan Sarpras Inventaris Kelas</td>
                  <td class="text-center">${inventoryGoodPercent}% Layak Baik</td>
                  <td class="text-center">${inventoryItems.length} Item</td>
                </tr>
              </tbody>
            </table>

            <div class="subchapter-title">1.3 Visi, Misi & Target Pengelolaan Kelas</div>
            <p class="paragraph">
              <strong>Visi Perwalian Kelas:</strong> "Mewujudkan kelas ${className} yang berakhlak mulia, disiplin tinggi, unggul secara akademik, serta memiliki solidaritas kekeluargaan yang erat."
            </p>
            <p class="paragraph">
              <strong>Target Utama Semester Ini:</strong> (1) Memastikan seluruh siswa tuntas secara akademik dengan nilai di atas KKM (${kkm}); 
              (2) Menekan tingkat ketidakhadiran dan pelanggaran disiplin hingga &lt; 5%; (3) Membangun kemitraan sinergis dengan Paguyuban Orang Tua Murid.
            </p>
          </div>

          <!-- BAB II - PELAKSANAAN PROGRAM KERJA -->
          <div>
            <div class="chapter-title">BAB II : PELAKSANAAN PROGRAM KERJA WALI KELAS</div>
            <p class="paragraph">
              Berikut adalah rekapitulasi pelaksanaan program kerja wali kelas yang telah direalisasikan sepanjang Semester ${selectedSemester}:
            </p>

            <table>
              <thead>
                <tr>
                  <th width="30">NO</th>
                  <th width="140">BIDANG KEGIATAN</th>
                  <th>NAMA PROGRAM KERJA</th>
                  <th width="90">TARGET WAKTU</th>
                  <th>INDIKATOR KEBERHASILAN</th>
                  <th width="80">STATUS</th>
                  <th width="50">%</th>
                </tr>
              </thead>
              <tbody>
                ${workplanItems.map((item, idx) => `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><strong>${item.category}</strong></td>
                    <td>${item.title}</td>
                    <td class="text-center">${item.targetMonth}</td>
                    <td>${item.indicator}</td>
                    <td class="text-center"><strong>${item.status}</strong></td>
                    <td class="text-center">${item.progress}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- BAB III - REKAPITULASI PEMBINAAN & DINAMIKA KELAS -->
          <div>
            <div class="chapter-title">BAB III : REKAPITULASI PEMBINAAN & DINAMIKA KELAS</div>

            <div class="subchapter-title">3.1 Capaian Akademik & Leger Kelas</div>
            <p class="paragraph">
              Berdasarkan hasil pengolahan leger nilai semester ${selectedSemester}, rata-rata nilai pencapaian akademik siswa kelas ${className} mencapai <strong>${classOverallAverage}</strong>.
            </p>

            <div class="subchapter-title">3.2 Kedisiplinan & Catatan Pelanggaran BK (${groupedViolationsList.length} Siswa Terdata - Total ${violations.length} Kasus)</div>
            ${groupedViolationsList.length === 0 ? `
              <p class="paragraph">Selama semester ini, tidak tercatat adanya kasus pelanggaran disiplin pada siswa kelas ${className}. Seluruh siswa senantiasa menjaga kedisiplinan dan tata tertib sekolah dengan baik.</p>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th width="30">NO</th>
                    <th width="150">NAMA SISWA & NIS</th>
                    <th width="85">JUMLAH & TOTAL POIN</th>
                    <th>RINCIAN TANGGAL, JENIS & KETERANGAN PELANGGARAN</th>
                    <th width="180">REKOMENDASI TINDAKAN WALI KELAS & BK</th>
                  </tr>
                </thead>
                <tbody>
                  ${groupedViolationsList.map((grp, idx) => `
                    <tr>
                      <td class="text-center">${idx + 1}</td>
                      <td>
                        <strong>${grp.studentName}</strong>
                        <br/><span style="font-size: 10px; color: #64748b;">NIS: ${grp.nis}</span>
                      </td>
                      <td class="text-center">
                        <strong>${grp.totalViolations} Kasus</strong>
                        <br/><span style="font-size: 11px; color: #dc2626; font-weight: bold;">+${grp.totalPoints} Poin</span>
                      </td>
                      <td>
                        <ul style="margin: 0; padding-left: 15px; font-size: 11px; line-height: 1.5;">
                          ${grp.details.map((d: any) => `
                            <li>
                              <strong>[${d.date}]</strong> ${d.category} ${d.description ? `(${d.description})` : ''} 
                              <span style="color: #dc2626; font-weight: bold;">(+${d.points} Poin)</span>
                              <span style="color: #4338ca; font-weight: 600; font-size: 10px;"> [Input: ${d.reportedBy}]</span>
                            </li>
                          `).join('')}
                        </ul>
                      </td>
                      <td>
                        <span style="font-size: 11px; color: #1e3a8a; font-weight: 600;">${grp.recommendation}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}

            <div class="subchapter-title">3.3 Rekapitulasi Home Visit & Panggilan Orang Tua (${homeVisits.length + parentCalls.length} Kegiatan)</div>
            <p class="paragraph">
              Untuk mempererat hubungan dan menangani permasalahan siswa secara komprehensif, wali kelas bekerjasama dengan Guru BK telah melaksanakan <strong>${homeVisits.length}</strong> kali kunjungan rumah (home visit) dan <strong>${parentCalls.length}</strong> kali panggilan orang tua ke sekolah.
            </p>

            <div class="subchapter-title">3.4 Rekapitulasi Prestasi Siswa (${achievements.length} Prestasi)</div>
            ${achievements.length === 0 ? `
              <p class="paragraph">Belum ada catatan prestasi kompetisi resmi yang dibukukan pada semester ini.</p>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th width="30">NO</th>
                    <th>NAMA SISWA</th>
                    <th>NAMA PRESTASI / KEJUARAAN</th>
                    <th width="100">TINGKAT</th>
                    <th width="80">JUARA</th>
                  </tr>
                </thead>
                <tbody>
                  ${achievements.map((a, idx) => {
                    const st = students.find(s => s.id === a.studentId);
                    return `
                      <tr>
                        <td class="text-center">${idx + 1}</td>
                        <td><strong>${st ? st.name : a.studentId}</strong></td>
                        <td>${a.title}</td>
                        <td class="text-center">${a.level}</td>
                        <td class="text-center"><strong>${(a as any).rank || a.description || 'Juara'}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}

            <div class="subchapter-title">3.5 Rekapitulasi Presensi / Kehadiran Siswa Bulan ${attendanceRecapSummary.monthName} ${attendanceRecapSummary.year}</div>
            <p class="paragraph">
              Berikut rekapitulasi tingkat kehadiran siswa kelas ${className} pada bulan <strong>${attendanceRecapSummary.monthName} ${attendanceRecapSummary.year}</strong> dengan total ${attendanceRecapSummary.effectiveDays} hari efektif belajar dan rata-rata kehadiran kelas mencapai <strong>${attendanceRecapSummary.classPercentage}%</strong>:
            </p>
            <table>
              <thead>
                <tr>
                  <th width="30">NO</th>
                  <th width="80">NIS</th>
                  <th>NAMA SISWA</th>
                  <th width="40">L/P</th>
                  <th width="45">HADIR</th>
                  <th width="45">SAKIT</th>
                  <th width="45">IZIN</th>
                  <th width="45">ALPA</th>
                  <th width="60">EFEKTIF</th>
                  <th width="70">% HADIR</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceRecapList.map((st, idx) => `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td class="text-center">${st.nis}</td>
                    <td><strong>${st.name}</strong></td>
                    <td class="text-center">${st.gender || '-'}</td>
                    <td class="text-center">${st.hadir}</td>
                    <td class="text-center">${st.sakit}</td>
                    <td class="text-center">${st.izin}</td>
                    <td class="text-center">${st.alfa}</td>
                    <td class="text-center">${st.totalDays}</td>
                    <td class="text-center"><strong>${st.percentage}%</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- BAB IV - EVALUASI, KENDALA & SOLUSI -->
          <div>
            <div class="chapter-title">BAB IV : EVALUASI, KENDALA & SOLUSI</div>

            <div class="subchapter-title">4.1 Evaluasi Capaian & Pelaksanaan Tugas Wali Kelas</div>
            <p class="paragraph" style="white-space: pre-line;">${lpjReport.evaluationSummary || 'Belum ada catatan evaluasi.'}</p>

            <div class="subchapter-title">4.2 Hambatan & Kendala Dalam Mengelola Kelas</div>
            <p class="paragraph" style="white-space: pre-line;">${lpjReport.obstacles || 'Tidak ada kendala berarti.'}</p>

            <div class="subchapter-title">4.3 Solusi & Langkah Penyelesaian Yang Dilakukan</div>
            <p class="paragraph" style="white-space: pre-line;">${lpjReport.solutions || 'Solusi berjalan dengan baik.'}</p>

            <div class="subchapter-title">4.4 Rekomendasi & Rencana Langkah Semester Berikutnya</div>
            <p class="paragraph" style="white-space: pre-line;">${lpjReport.recommendations || 'Melanjutkan program kerja secara konsisten.'}</p>
          </div>

          <!-- BAB V - PENUTUP & LAMPIRAN -->
          <div>
            <div class="chapter-title">BAB V : PENUTUP & LAMPIRAN</div>

            <div class="subchapter-title">5.1 Kesimpulan & Penutup</div>
            <p class="paragraph">
              Demikian Laporan Pertanggungjawaban (LPJ) dan Portofolio Administrasi Wali Kelas ini disusun dengan sebenarnya. 
              Diharapkan dokumen ini dapat memberikan gambaran utuh mengenai perkembangan kelas ${className} serta menjadi bahan evaluasi peningkatan mutu perwalian di masa mendatang.
            </p>

            <div class="subchapter-title">5.2 Lampiran I: Inventory & Sarana Prasarana Kelas (${inventoryItems.length} Item)</div>
            <table>
              <thead>
                <tr>
                  <th width="30">NO</th>
                  <th>NAMA BARANG / SARPRAS</th>
                  <th width="80">JUMLAH</th>
                  <th width="100">KONDISI</th>
                  <th>KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                ${inventoryItems.map((item, idx) => `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td>${item.itemName}</td>
                    <td class="text-center">${(item as any).quantity || item.volume} ${(item as any).unit || 'Unit'}</td>
                    <td class="text-center"><strong>${item.condition}</strong></td>
                    <td>${item.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportLpjExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Program Kerja
    const wpRows = workplanItems.map((item, idx) => ({
      No: idx + 1,
      'Bidang Kegiatan': item.category,
      'Nama Program Kerja': item.title,
      'Target Waktu': item.targetMonth,
      'Indikator Keberhasilan': item.indicator,
      'Status Realisasi': item.status,
      'Progress (%)': item.progress,
      'Catatan / Keterangan': item.notes || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wpRows), "Program Kerja Wali Kelas");

    // Sheet 2: Rekap Absensi Bulan Sebelumnya
    const attRows = attendanceRecapList.map((st, idx) => ({
      No: idx + 1,
      NIS: st.nis,
      'Nama Siswa': st.name,
      'L/P': st.gender || '-',
      'Hadir (H)': st.hadir,
      'Sakit (S)': st.sakit,
      'Izin (I)': st.izin,
      'Alpa (A)': st.alfa,
      'Total Hari Efektif': st.totalDays,
      'Persentase Kehadiran (%)': `${st.percentage}%`,
      'Status Predikat': st.predicate
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows), `Rekap Absen ${attendanceRecapSummary.monthName}`);

    // Sheet 3: Ringkasan LPJ & Evaluasi
    const summaryRows = [
      { Parameter: 'Nama Wali Kelas', Nilai: user.fullName },
      { Parameter: 'NIP Wali Kelas', Nilai: user.nip || '-' },
      { Parameter: 'Kelas Perwalian', Nilai: className },
      { Parameter: 'Semester / Tahun', Nilai: `${selectedSemester} / 2025-2026` },
      { Parameter: 'Total Siswa', Nilai: totalStudentsCount },
      { Parameter: 'Capaian Program Kerja (%)', Nilai: `${workplanProgressPercent}%` },
      { Parameter: 'Rata-Rata Kehadiran Kelas (%)', Nilai: `${attendanceRecapSummary.classPercentage}%` },
      { Parameter: 'Rata-Rata Leger Akademik Kelas', Nilai: classOverallAverage },
      { Parameter: 'Total Catatan Pelanggaran BK', Nilai: violations.length },
      { Parameter: 'Total Home Visit / Panggilan Ortu', Nilai: homeVisits.length + parentCalls.length },
      { Parameter: 'Kondisi Inventaris Layak (%)', Nilai: `${inventoryGoodPercent}%` },
      { Parameter: '---', Nilai: '---' },
      { Parameter: 'EVALUASI CAPAIAN WALI KELAS', Nilai: lpjReport.evaluationSummary },
      { Parameter: 'HAMBATAN & KENDALA', Nilai: lpjReport.obstacles },
      { Parameter: 'SOLUSI & TINDAK LANJUT', Nilai: lpjReport.solutions },
      { Parameter: 'REKOMENDASI SEMESTER DEPAN', Nilai: lpjReport.recommendations }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Laporan LPJ Evaluasi");

    // Sheet 4: Rekap Pelanggaran BK Siswa
    const excelViolationMap: Record<string, {
      studentName: string;
      nis: string;
      totalViolations: number;
      totalPoints: number;
      details: { date: string; category: string; description: string; points: number; reportedBy?: string }[];
    }> = {};

    violations.forEach(v => {
      const st = students.find(s => s.id === v.studentId);
      if (!excelViolationMap[v.studentId]) {
        excelViolationMap[v.studentId] = {
          studentName: st ? st.name : v.studentId,
          nis: st ? st.nis : '-',
          totalViolations: 0,
          totalPoints: 0,
          details: []
        };
      }

      const cat = (v as any).category || v.violationName || 'Pelanggaran';
      const desc = v.description || '';
      const pts = v.points || 0;

      excelViolationMap[v.studentId].details.push({
        date: v.date,
        category: cat,
        description: desc,
        points: pts,
        reportedBy: v.reportedBy || 'Guru BK / Wali Kelas'
      });
      excelViolationMap[v.studentId].totalViolations += 1;
      excelViolationMap[v.studentId].totalPoints += pts;
    });

    const violGroupedRows = Object.values(excelViolationMap).map((grp, idx) => {
      let rec = '';
      if (grp.totalPoints >= 75) {
        rec = 'Panggilan Orang Tua Ke-3, Konferensi Kasus BK & SK Skorsing / Pembinaan Khusus';
      } else if (grp.totalPoints >= 50) {
        rec = 'Panggilan Orang Tua Ke-2, Surat Peringatan II (SP 2) & Konseling Intensif BK';
      } else if (grp.totalPoints >= 25) {
        rec = 'Panggilan Orang Tua Ke-1, Surat Peringatan I (SP 1) & Pembinaan Wali Kelas';
      } else if (grp.totalPoints >= 10) {
        rec = 'Teguran Lisan Tegas, Pembinaan Wali Kelas & Komitmen Tertulis Siswa';
      } else {
        rec = 'Pembinaan Wali Kelas & Bimbingan Konseling Rutin';
      }
      return {
        No: idx + 1,
        NIS: grp.nis,
        'Nama Siswa': grp.studentName,
        'Total Kasus Pelanggaran': grp.totalViolations,
        'Total Poin Akumulasi': grp.totalPoints,
        'Rincian Pelanggaran (Tanggal & Jenis)': grp.details.map((d: any) => `[${d.date}] ${d.category}${d.description ? ' (' + d.description + ')' : ''} (+${d.points} Pts) [Penginput: ${d.reportedBy}]`).join('; '),
        'Rekomendasi Tindakan Wali Kelas & BK': rec
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(violGroupedRows.length ? violGroupedRows : [{ Info: "Tidak ada pelanggaran" }]), "Pelanggaran BK Siswa");

    XLSX.writeFile(wb, `LPJ_Wali_Kelas_${className.replace(/\s+/g, '_')}_Sem_${selectedSemester}.xlsx`);
  };

  if (!user.homeroomClassId) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <UserCheck size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-800">Kelas Belum Diatur</h3>
        <p className="text-gray-500">Silakan atur "Kelas Perwalian" Anda di menu <strong>Profil & Akun</strong> terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <UserCheck size={28} className="text-white" />
               </div>
               <h1 className="text-3xl font-bold">Wali Kelas Center</h1>
            </div>
            <p className="text-indigo-100 text-lg">
               Dashboard monitoring kelas <strong>{className}</strong>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
             <div className="flex bg-white/20 backdrop-blur-md rounded-lg p-1">
                <button 
                    onClick={() => setSelectedSemester('Ganjil')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${selectedSemester === 'Ganjil' ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-white/10'}`}
                >
                    Ganjil
                </button>
                <button 
                    onClick={() => setSelectedSemester('Genap')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${selectedSemester === 'Genap' ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-white/10'}`}
                >
                    Genap
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('academic')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'academic' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <GraduationCap size={16} /> Akademik (Leger)
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'behavior' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <ShieldAlert size={16} /> Kedisiplinan & BK
          {problemStudents.length > 0 && (
             <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{problemStudents.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'health' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <HeartPulse size={16} /> Kesehatan Kelas
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'inventory' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Package size={16} /> Inventaris Kelas
        </button>
        <button
          onClick={() => setActiveTab('workplan')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'workplan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <ClipboardList size={16} /> Program Kerja & LPJ
        </button>
      </div>

      {/* --- TAB: ACADEMIC --- */}
      {activeTab === 'academic' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Users size={20} /></div>
                  <div><p className="text-xs text-gray-500">Total Siswa</p><h4 className="font-bold text-lg">{students.length}</h4></div>
               </div>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-full"><FileSpreadsheet size={20} /></div>
                  <div><p className="text-xs text-gray-500">Mapel Masuk</p><h4 className="font-bold text-lg">{detectedSubjects.length}</h4></div>
               </div>
               {/* Input KKM */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 col-span-2">
                  <div className="p-2 bg-yellow-50 text-yellow-600 rounded-full"><AlertTriangle size={20} /></div>
                  <div className="flex-1">
                     <p className="text-xs text-gray-500 mb-1">Simulasi KKM (Highlight Nilai &lt; KKM)</p>
                     <input 
                        type="range" min="60" max="90" 
                        value={kkm} 
                        onChange={(e) => setKkm(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                     />
                  </div>
                  <div className="font-bold text-xl w-12 text-center text-yellow-700">{kkm}</div>
               </div>
            </div>

            {/* Leger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" /> Leger Nilai Per Mapel
                        </h3>
                        <p className="text-sm text-gray-500">Nilai Akhir = (2×LM + STS + SAS) / 4. Data dinamis dari input Guru Mapel.</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Subject Filter */}
                        <select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="ALL">Semua Mapel</option>
                            {detectedSubjects.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Cari Siswa..." 
                                className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={exportLeger}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition"
                        >
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    {isLoading ? (
                    <div className="p-10 text-center text-gray-400">Memuat data nilai...</div>
                    ) : detectedSubjects.length === 0 ? (
                       <div className="p-16 text-center">
                          <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500">Belum ada nilai yang masuk dari guru mata pelajaran.</p>
                       </div>
                    ) : (
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 border-b border-gray-300">
                                <th className="p-3 border-r border-gray-300 sticky left-0 bg-gray-100 z-20 w-10 text-center">No</th>
                                <th className="p-3 border-r border-gray-300 sticky left-10 bg-gray-100 z-20 min-w-[200px]">Nama Siswa</th>
                                
                                {/* Dynamic Subject Columns */}
                                {visibleSubjects.map(sub => (
                                   <th key={sub} className="p-2 border-r border-gray-300 text-center min-w-[80px] font-bold" title={sub}>
                                      {sub.length > 15 ? sub.substring(0, 12) + '...' : sub}
                                   </th>
                                ))}
                                
                                <th className="p-3 bg-blue-50 border-r border-gray-300 text-center font-bold text-blue-800 min-w-[60px]">Rata2</th>
                                <th className="p-3 bg-red-50 text-center font-bold text-red-800 min-w-[60px]">&lt; {kkm}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredStudents.map((student, idx) => {
                                const stats = getStudentGlobalStats(student.id);
                                return (
                                <tr key={student.id} className="hover:bg-gray-50 transition border-b border-gray-100">
                                    <td className="p-3 text-center border-r border-gray-200 sticky left-0 bg-white z-10">{idx + 1}</td>
                                    <td className="p-3 font-medium text-gray-800 border-r border-gray-200 sticky left-10 bg-white z-10 truncate max-w-[200px]">
                                       {student.name}
                                       <div className="text-[10px] text-gray-500">{student.nis}</div>
                                    </td>
                                    
                                    {/* Subject Grades */}
                                    {visibleSubjects.map(sub => {
                                       const grade = calculateSubjectFinalGrade(student.id, sub);
                                       const isLow = grade > 0 && grade < kkm;
                                       return (
                                          <td key={sub} className={`p-2 text-center border-r border-gray-200 ${isLow ? 'bg-red-50 text-red-600 font-bold' : ''}`}>
                                             {grade > 0 ? grade : '-'}
                                          </td>
                                       );
                                    })}

                                    <td className="p-3 text-center border-r border-gray-200 bg-blue-50/50 font-bold text-blue-700">
                                       {stats.globalAvg > 0 ? stats.globalAvg : '-'}
                                    </td>
                                    <td className="p-3 text-center bg-red-50/50 font-bold text-red-700">
                                       {stats.belowKkmCount > 0 ? stats.belowKkmCount : '-'}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- TAB: BEHAVIOR & COUNSELING (Same as before) --- */}
      {activeTab === 'behavior' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Header / Announcement & Global Print Actions */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-sm">
               <div className="flex items-start gap-3">
                  <ShieldAlert className="text-red-600 shrink-0 mt-1" />
                  <div>
                     <h3 className="font-bold text-red-800 text-base">Manajemen Kedisiplinan & Bimbingan (BK)</h3>
                     <p className="text-xs sm:text-sm text-red-700 mt-0.5">
                        Wali Kelas dapat mencatatkan pelanggaran (+), pemulihan poin (-), serta tindak lanjut pembinaan siswa secara terintegrasi dengan Guru BK.
                     </p>
                  </div>
               </div>
               <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                     onClick={() => handleOpenGuidanceModal()}
                     className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                     title="Catat Pembinaan Baru Untuk Siswa Walian"
                  >
                     <Pencil size={15} /> Catat Pembinaan
                  </button>
                  <button
                     onClick={handlePrintAllGuidanceReport}
                     className="px-3.5 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                     title="Cetak Rekap Laporan Tindak Lanjut Pembinaan Seluruh Siswa"
                  >
                     <Printer size={15} /> Cetak Rekap Pembinaan
                  </button>
                  <button
                     onClick={handleExportGuidanceExcel}
                     className="px-3.5 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                     title="Export File Excel Rekap Pembinaan Wali Kelas"
                  >
                     <FileSpreadsheet size={15} /> Excel Pembinaan
                  </button>
                  <button
                     onClick={handlePrintAllBKReport}
                     className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                     title="Cetak Laporan Rekapitulasi BK & Kedisiplinan Seluruh Siswa Dalam Satu File"
                  >
                     <Printer size={15} /> Cetak BK Keseluruhan
                  </button>
                  <button
                     onClick={handleExcelAllBKReport}
                     className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                     title="Export File Excel Rekap BK & Detail Pelanggaran Seluruh Siswa"
                  >
                     <FileSpreadsheet size={15} /> Excel BK Keseluruhan
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* COLUMN 1: ALL HOMEROOM STUDENTS (Fast recording list) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full text-left">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="font-bold text-gray-800 text-base">Pencatatan Poin Siswa Walian</h3>
                        <div className="text-xs bg-gray-100 text-gray-600 font-bold px-2 py-1 rounded-lg">Kelas {className}</div>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Klik tombol di samping nama siswa untuk mencatat pelanggaran atau memulihkan poin.</p>
                    
                    <div className="space-y-2 overflow-y-auto max-h-[600px] pr-2">
                        {filteredStudents.map((student) => {
                            const bStats = getStudentBehaviorStats(student.id);
                            return (
                                <div key={student.id} className="flex items-center justify-between p-3 border border-gray-100 hover:border-red-100 rounded-xl hover:bg-gray-50/50 transition duration-150 group">
                                    <div className="min-w-0 flex-1 pr-4">
                                        <div className="font-extrabold text-gray-800 truncate text-sm group-hover:text-red-600 transition-colors">{student.name}</div>
                                        <div className="text-[11px] text-gray-500">NIS: {student.nis} • {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                                bStats.totalPoints > 50 
                                                ? 'bg-red-100 text-red-700' 
                                                : bStats.totalPoints > 20 
                                                ? 'bg-yellow-100 text-yellow-800' 
                                                : bStats.totalPoints > 0 
                                                ? 'bg-blue-50 text-blue-700' 
                                                : 'bg-green-50 text-green-700'
                                            }`}>
                                                {bStats.totalPoints} Poin
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleOpenGuidanceModal(student)}
                                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200"
                                            title="Catat Pembinaan Siswa"
                                        >
                                            <Pencil size={13} /> Bina
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedStudentForForm(student);
                                                setViolationFormType('VIOLATION');
                                                setShowViolationModal(true);
                                            }}
                                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200"
                                            title="Catat Pelanggaran / Pengurangan Poin"
                                        >
                                            <Plus size={14} /> Poin
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* COLUMN 2: PROBLEM STUDENTS LIST (Leaderboard & Filter) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full text-left flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="font-bold text-gray-800 text-base">
                                {disciplineFilter === 'ACTIVE' 
                                    ? 'Peringkat Poin Pelanggaran Aktif' 
                                    : disciplineFilter === 'RESOLVED' 
                                    ? 'Daftar Siswa Poin Tuntas (Pemulihan)' 
                                    : 'Rekapitulasi Kedisiplinan & Bimbingan'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {disciplineFilter === 'ACTIVE'
                                    ? 'Siswa yang masih memiliki akumulasi poin pelanggaran aktif saat ini.'
                                    : disciplineFilter === 'RESOLVED'
                                    ? 'Siswa yang telah menyelesaikan/memulihkan seluruh poin pelanggarannya.'
                                    : 'Seluruh siswa yang memiliki catatan kedisiplinan, pemulihan poin, atau konseling BK.'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handlePrintAllBKReport}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200"
                                title="Cetak Laporan Rekapitulasi Seluruh Siswa Dalam 1 File"
                            >
                                <Printer size={13} /> Cetak Seluruh Siswa
                            </button>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 px-6 py-2.5 bg-gray-50/70 border-b border-gray-100 text-xs">
                        <span className="text-gray-500 font-semibold mr-1">Filter Tampilan:</span>
                        <button
                            type="button"
                            onClick={() => setDisciplineFilter('ALL')}
                            className={`px-3 py-1 rounded-lg font-bold transition ${
                                disciplineFilter === 'ALL'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            Semua ({recordedStudents.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisciplineFilter('ACTIVE')}
                            className={`px-3 py-1 rounded-lg font-bold transition ${
                                disciplineFilter === 'ACTIVE'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            Poin Aktif ({problemStudents.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisciplineFilter('RESOLVED')}
                            className={`px-3 py-1 rounded-lg font-bold transition ${
                                disciplineFilter === 'RESOLVED'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            Poin Tuntas / Pemulihan ({resolvedStudents.length})
                        </button>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        {displayedDisciplineStudents.length === 0 ? (
                            <div className="p-16 text-center">
                                <ShieldAlert size={48} className="mx-auto text-green-200 mb-4 animate-bounce" />
                                <h4 className="text-base font-bold text-gray-800">
                                    {disciplineFilter === 'ACTIVE'
                                        ? 'Kelas Aman & Kondusif!'
                                        : disciplineFilter === 'RESOLVED'
                                        ? 'Belum Ada Siswa Pemulihan Poin'
                                        : 'Belum Ada Catatan Kedisiplinan'}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    {disciplineFilter === 'ACTIVE'
                                        ? 'Tidak ada siswa yang tercatat memiliki poin aktif saat ini.'
                                        : disciplineFilter === 'RESOLVED'
                                        ? 'Tidak ada siswa dengan poin tuntas di kelas ini.'
                                        : 'Tidak ada data kedisiplinan atau bimbingan yang tercatat.'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 w-8 text-center">No</th>
                                        <th className="p-3">Siswa</th>
                                        <th className="p-3 text-center">Poin</th>
                                        <th className="p-3">Rekomendasi / Status</th>
                                        <th className="p-3 text-center">Tindakan</th>
                                        <th className="p-3 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayedDisciplineStudents.map((s, idx) => (
                                        <React.Fragment key={s.id}>
                                            <tr 
                                                className={`hover:bg-gray-50 transition cursor-pointer ${expandedStudentId === s.id ? 'bg-blue-50/30' : ''}`}
                                                onClick={() => setExpandedStudentId(expandedStudentId === s.id ? null : s.id)}
                                            >
                                                <td className="p-3 text-center font-bold text-gray-500">{idx + 1}</td>
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800">{s.name}</div>
                                                    <div className="text-[10px] text-gray-500">NIS: {s.nis}</div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                                                        s.stats.totalPoints > 0 
                                                            ? 'text-red-600 bg-red-50 border border-red-200' 
                                                            : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                                    }`}>
                                                        {s.stats.totalPoints}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${s.stats.statusColor}`}>
                                                        {s.stats.recommendation}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => handleOpenGuidanceModal(s)}
                                                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded text-[11px] font-bold transition flex items-center gap-1 border border-indigo-200"
                                                            title="Catat Tindak Lanjut Pembinaan Wali Kelas"
                                                        >
                                                            <Pencil size={12} /> Catat Pembinaan
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintGuidanceReport(s)}
                                                            className="p-1 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                                                            title="Cetak Lembar Catatan Pembinaan Siswa"
                                                        >
                                                            <Printer size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center text-gray-400">
                                                    {expandedStudentId === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </td>
                                            </tr>
                                            {expandedStudentId === s.id && (
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <td colSpan={6} className="p-4 cursor-default">
                                                        <div className="space-y-4">
                                                            {/* SECTION: VIOLATIONS */}
                                                            <div>
                                                                <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-xs">
                                                                    <AlertCircle size={14} className="text-red-600" /> Rincian Pelanggaran ({s.details.violations.length})
                                                                </h4>
                                                                {s.details.violations.length === 0 ? (
                                                                    <p className="text-[11px] text-gray-400 italic pl-5">Tidak ada catatan pelanggaran.</p>
                                                                ) : (
                                                                    <div className="space-y-1.5 pl-2 border-l-2 border-red-200">
                                                                        {s.details.violations.map(v => (
                                                                            <div key={v.id} className="group flex justify-between items-center p-2 rounded-lg hover:bg-red-50/50 transition">
                                                                                <div className="text-[11px] text-gray-700">
                                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                                        <span className="font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded text-[10px]">{v.date}</span>
                                                                                        <span className="font-semibold text-gray-900">{v.violationName}</span>
                                                                                        <span className="text-red-600 font-bold">(+{v.points} pts)</span>
                                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                                                            <UserCheck size={11} className="text-indigo-600" />
                                                                                            Penginput: <span className="font-bold">{v.reportedBy || 'Guru BK / Wali Kelas'}</span>
                                                                                        </span>
                                                                                    </div>
                                                                                    {v.description && <span className="text-gray-500 block mt-0.5 ml-1">— {v.description}</span>}
                                                                                </div>
                                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <button
                                                                                        onClick={() => handleEditRecord('VIOLATION', v, s)}
                                                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                                                                                        title="Edit Catatan"
                                                                                    >
                                                                                        <Pencil size={12} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteRecord('VIOLATION', v.id)}
                                                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                                                                        title="Hapus Catatan"
                                                                                    >
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* SECTION: POINT REDUCTIONS */}
                                                            {s.details.reductions && s.details.reductions.length > 0 && (
                                                                <div>
                                                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-xs">
                                                                        <RefreshCcw size={14} className="text-green-600 animate-spin-slow" /> Rincian Pemulihan Poin ({s.details.reductions.length})
                                                                    </h4>
                                                                    <div className="space-y-1.5 pl-2 border-l-2 border-green-200">
                                                                        {s.details.reductions.map(r => (
                                                                            <div key={r.id} className="group flex justify-between items-center p-2 rounded-lg hover:bg-green-50/50 transition">
                                                                                <div className="text-[11px] text-gray-700">
                                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                                        <span className="font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded text-[10px] mr-1">{r.date}</span>
                                                                                        <span className="font-semibold text-gray-900">{r.activityName}</span>
                                                                                        <span className="text-green-600 font-bold">(-{r.pointsRemoved} pts)</span>
                                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                                                            <UserCheck size={11} className="text-emerald-600" />
                                                                                            Penginput: <span className="font-bold">{r.reportedBy || 'Guru BK / Wali Kelas'}</span>
                                                                                        </span>
                                                                                    </div>
                                                                                    {r.description && <span className="text-gray-500 block mt-0.5 ml-1">— {r.description}</span>}
                                                                                </div>
                                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <button
                                                                                        onClick={() => handleEditRecord('REDUCTION', r, s)}
                                                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                                                                                        title="Edit Catatan"
                                                                                    >
                                                                                        <Pencil size={12} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteRecord('REDUCTION', r.id)}
                                                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                                                                        title="Hapus Catatan"
                                                                                    >
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* SECTION: BK COUNSELING SESSIONS (FROM GURU BK) */}
                                                            {s.details.sessions && s.details.sessions.length > 0 && (
                                                                <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-sm">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <h4 className="font-bold text-sky-900 flex items-center gap-2 text-xs">
                                                                            <MessageSquareHeart size={14} className="text-sky-600" /> Riwayat Konseling BK (Guru BK)
                                                                            <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                                                                                {s.details.sessions.length}
                                                                            </span>
                                                                        </h4>
                                                                    </div>
                                                                    <div className="space-y-2 mt-2">
                                                                        {s.details.sessions.map((cs: CounselingSession) => (
                                                                            <div key={cs.id} className="p-2.5 rounded-lg border border-sky-100 bg-sky-50/40 text-[11px] text-gray-700">
                                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                                        <span className="font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded text-[10px]">{cs.date}</span>
                                                                                        <span className="font-bold text-gray-900">Masalah: {cs.issue}</span>
                                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                                            cs.status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                                                        }`}>
                                                                                            {cs.status === 'CLOSED' ? 'Selesai' : 'Terbuka / Proses'}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                {cs.notes && (
                                                                                    <div className="text-gray-800 mt-1 bg-white p-2 rounded border border-gray-100">
                                                                                        <span className="font-semibold text-gray-900">Catatan Konseling:</span> {cs.notes}
                                                                                    </div>
                                                                                )}
                                                                                {cs.followUp && (
                                                                                    <div className="text-gray-700 mt-1 pl-2 border-l-2 border-sky-300">
                                                                                        <span className="font-semibold text-gray-900">Tindak Lanjut:</span> {cs.followUp}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* SECTION: HOMEROOM GUIDANCE HISTORY */}
                                                            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <h4 className="font-bold text-indigo-900 flex items-center gap-2 text-xs">
                                                                        <BookOpen size={14} className="text-indigo-600" /> Riwayat Pembinaan Wali Kelas
                                                                        <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                                                                            {s.details.guidances ? s.details.guidances.length : 0}
                                                                        </span>
                                                                    </h4>
                                                                    <button
                                                                        onClick={() => handleOpenGuidanceModal(s)}
                                                                        className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700 transition flex items-center gap-1 shadow-sm"
                                                                    >
                                                                        <Plus size={11} /> Catat Pembinaan Baru
                                                                    </button>
                                                                </div>

                                                                {(!s.details.guidances || s.details.guidances.length === 0) ? (
                                                                    <p className="text-[11px] text-gray-400 italic pl-2 py-1">
                                                                        Belum ada catatan pembinaan khusus oleh wali kelas untuk siswa ini.
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-2 mt-2">
                                                                        {s.details.guidances.map((g: HomeroomGuidanceSession) => (
                                                                            <div key={g.id} className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/70 hover:bg-white hover:border-indigo-200 transition text-[11px] text-gray-700">
                                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                                        <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{g.date}</span>
                                                                                        <span className="font-bold text-gray-900">{g.guidanceType}</span>
                                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                                            g.status === 'Selesai/Membaik' ? 'bg-green-100 text-green-700' :
                                                                                            g.status === 'Perlu Eskalasi ke BK' ? 'bg-red-100 text-red-700' :
                                                                                            'bg-amber-100 text-amber-700'
                                                                                        }`}>
                                                                                            {g.status}
                                                                                        </span>
                                                                                        {g.parentInformed && (
                                                                                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                                                                                                Ortu Diberitahu
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                                        <button
                                                                                            onClick={() => handleOpenGuidanceModal(s, g)}
                                                                                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                                                                                            title="Edit Catatan Pembinaan"
                                                                                        >
                                                                                            <Pencil size={12} />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleDeleteGuidance(g.id)}
                                                                                            className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                                                                            title="Hapus Catatan Pembinaan"
                                                                                        >
                                                                                            <Trash2 size={12} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                {g.violationSummary && (
                                                                                    <div className="text-gray-600 mt-0.5">
                                                                                        <span className="font-semibold text-gray-800">Masalah:</span> {g.violationSummary}
                                                                                    </div>
                                                                                )}
                                                                                <div className="text-gray-800 mt-1 bg-white p-2 rounded border border-gray-100">
                                                                                    <span className="font-semibold text-gray-900">Uraian Pembinaan:</span> {g.notes}
                                                                                </div>
                                                                                {g.studentCommitment && (
                                                                                    <div className="text-gray-700 mt-1 italic pl-2 border-l-2 border-indigo-300">
                                                                                        <span className="font-semibold not-italic text-gray-900">Komitmen Siswa:</span> "{g.studentCommitment}"
                                                                                    </div>
                                                                                )}
                                                                                {g.followUpDate && (
                                                                                    <div className="text-[10px] text-gray-500 mt-1 font-medium">
                                                                                        📅 Rencana Pantauan: <span className="font-bold text-gray-700">{g.followUpDate}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {s.details.homeVisits.length > 0 && (
                                                                <div>
                                                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-xs">
                                                                        <Package size={14} className="text-blue-600" /> Daftar Home Visit
                                                                    </h4>
                                                                    <ul className="list-disc pl-5 text-[11px] text-gray-600 space-y-1">
                                                                        {s.details.homeVisits.map(hv => (
                                                                            <li key={hv.id}>
                                                                                <span className="font-bold">{hv.date}:</span> {hv.address} - {hv.reason} (Hasil: {hv.result})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {s.details.parentCalls.length > 0 && (
                                                                <div>
                                                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-xs">
                                                                        <MessageCircle size={14} className="text-purple-600" /> Panggilan Orang Tua
                                                                    </h4>
                                                                    <ul className="list-disc pl-5 text-[11px] text-gray-600 space-y-1">
                                                                        {s.details.parentCalls.map(pc => (
                                                                            <li key={pc.id}>
                                                                                <span className="font-bold">{pc.date}:</span> {pc.parentName} ({pc.parentPhone}) - Masalah: {pc.problem} (Solusi: {pc.solution})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                                                                <button 
                                                                    onClick={() => handlePrintGuidanceReport(s)}
                                                                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1.5 rounded text-[11px] font-bold hover:bg-indigo-700 transition shadow-sm"
                                                                >
                                                                    <Printer size={12} /> Cetak Lembar Pembinaan Siswa
                                                                </button>
                                                                <button 
                                                                    onClick={() => handlePrintBKReport(s)}
                                                                    className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1.5 rounded text-[11px] font-bold hover:bg-blue-700 transition"
                                                                >
                                                                    <Printer size={12} /> Cetak Laporan BK Siswa
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleExcelBKReport(s)}
                                                                    className="flex items-center gap-1.5 bg-green-600 text-white px-2.5 py-1.5 rounded text-[11px] font-bold hover:bg-green-700 transition"
                                                                >
                                                                    <FileSpreadsheet size={12} /> Export Excel BK
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* POPUP FORM MODAL FOR WALI KELAS POIN RECORDING */}
            {showViolationModal && selectedStudentForForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`p-6 bg-gradient-to-r text-white flex justify-between items-center ${
                            violationFormType === 'VIOLATION' ? 'from-red-600 to-red-700' : 'from-green-600 to-green-700'
                        }`}>
                            <div>
                                <h3 className="text-lg font-extrabold flex items-center gap-2">
                                    <AlertTriangle size={20} /> {editingRecord ? 'Edit Catatan Poin' : 'Catat Pelanggaran / Poin'}
                                </h3>
                                <p className="text-xs text-red-100 mt-1 font-medium">Siswa: {selectedStudentForForm.name} (NIS: {selectedStudentForForm.nis})</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowViolationModal(false);
                                    setSelectedStudentForForm(null);
                                    setEditingRecord(null);
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveDisciplinePoint} className="p-6 space-y-4 text-left">
                            {!editingRecord && (
                                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViolationFormType('VIOLATION');
                                            setFormInput(prev => ({ ...prev, category: 'Terlambat', points: 5 }));
                                        }}
                                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                                            violationFormType === 'VIOLATION' 
                                            ? 'bg-red-600 text-white shadow' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        Catat Pelanggaran
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViolationFormType('REDUCTION');
                                            setFormInput(prev => ({ ...prev, category: 'Kerja Bakti', points: 5 }));
                                        }}
                                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                                            violationFormType === 'REDUCTION' 
                                            ? 'bg-green-600 text-white shadow' 
                                            : 'text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        Pengurangan Poin (Pemulihan)
                                    </button>
                                </div>
                            )}

                            {editingRecord && (
                                <div className={`p-3 rounded-xl border text-xs font-bold ${
                                    editingRecord.type === 'VIOLATION' 
                                        ? 'bg-red-50 text-red-700 border-red-100' 
                                        : 'bg-green-50 text-green-700 border-green-100'
                                }`}>
                                    Tipe Catatan: {editingRecord.type === 'VIOLATION' ? 'Pelanggaran Siswa' : 'Pemulihan / Pengurangan Poin'}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tanggal</label>
                                    <input 
                                        type="date" 
                                        required 
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500" 
                                        value={formInput.date} 
                                        onChange={e => setFormInput({ ...formInput, date: e.target.value })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Poin</label>
                                    <input 
                                        type="number" 
                                        required 
                                        min="1" 
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 text-gray-800" 
                                        value={formInput.points} 
                                        onChange={e => setFormInput({ ...formInput, points: parseInt(e.target.value) || 0 })} 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Kategori / Kegiatan</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 text-gray-800"
                                    value={formInput.category}
                                    onChange={e => setFormInput({ ...formInput, category: e.target.value })}
                                >
                                    {violationFormType === 'VIOLATION' ? (
                                        <>
                                            <option value="Terlambat">Terlambat masuk kelas</option>
                                            <option value="Atribut tidak lengkap">Atribut seragam tidak lengkap</option>
                                            <option value="Membolos">Membolos / Keluar kelas tanpa izin</option>
                                            <option value="Kerapian rambut/seragam">Kerapian rambut / kuku / pakaian</option>
                                            <option value="Sikap kurang sopan">Sikap kurang sopan kepada guru/teman</option>
                                            <option value="Bermain HP saat pelajaran">Bermain HP saat jam pelajaran</option>
                                            <option value="Lainnya">Lainnya (Ketik sendiri)</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="Kerja Bakti">Mengikuti Kerja Bakti sekolah</option>
                                            <option value="Merapikan Fasilitas">Membantu merapikan fasilitas kelas/sekolah</option>
                                            <option value="Keaktifan Kegiatan">Sangat aktif dalam kegiatan sekolah / OSIS</option>
                                            <option value="Sikap Sangat Baik">Menunjukkan kemajuan sikap / perilaku terpuji</option>
                                            <option value="Lainnya">Lainnya (Ketik sendiri)</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {formInput.category === 'Lainnya' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Ketik Kategori Kustom</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="Misal: Berkelahi di kantin"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 text-gray-800" 
                                        value={formInput.customCategory} 
                                        onChange={e => setFormInput({ ...formInput, customCategory: e.target.value })} 
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Catatan Detail (Kejadian / Kegiatan)</label>
                                <textarea 
                                    required 
                                    rows={3}
                                    placeholder={violationFormType === 'VIOLATION' ? "Misal: Terlambat masuk kelas 15 menit tanpa keterangan" : "Misal: Membantu membersihkan ruang perpustakaan sekolah"}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 text-gray-800" 
                                    value={formInput.description} 
                                    onChange={e => setFormInput({ ...formInput, description: e.target.value })} 
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowViolationModal(false);
                                        setSelectedStudentForForm(null);
                                        setEditingRecord(null);
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit" 
                                    className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition shadow-md ${
                                        violationFormType === 'VIOLATION' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                                    }`}
                                >
                                    {editingRecord ? 'Update Catatan' : 'Simpan Catatan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* POPUP MODAL FOR WALI KELAS GUIDANCE RECORDING */}
            {showGuidanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-extrabold flex items-center gap-2">
                                    <BookOpen size={20} className="text-indigo-300" />
                                    {editingGuidanceId ? 'Edit Tindak Lanjut Pembinaan' : 'Catat Tindak Lanjut Pembinaan Wali Kelas'}
                                </h3>
                                <p className="text-xs text-indigo-200 mt-1 font-medium">
                                    {selectedStudentForGuidance ? `Siswa: ${selectedStudentForGuidance.name} (NIS: ${selectedStudentForGuidance.nis})` : 'Pilih siswa yang akan dibina'}
                                </p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowGuidanceModal(false);
                                    setSelectedStudentForGuidance(null);
                                    setEditingGuidanceId(null);
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition text-indigo-100 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveGuidance} className="p-6 space-y-4 text-left max-h-[80vh] overflow-y-auto">
                            {/* Student selector if not set or allow change */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Siswa Walian</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800 font-medium"
                                    value={selectedStudentForGuidance?.id || ''}
                                    onChange={e => {
                                        const s = students.find(st => st.id === e.target.value);
                                        setSelectedStudentForGuidance(s || null);
                                    }}
                                    required
                                >
                                    <option value="">-- Pilih Siswa --</option>
                                    {students.map(s => {
                                        const pts = getStudentBehaviorStats(s.id).totalPoints;
                                        return (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.nis}) {pts > 0 ? `— [${pts} Poin Aktif]` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Pembinaan</label>
                                    <input 
                                        type="date" 
                                        required 
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800" 
                                        value={guidanceForm.date} 
                                        onChange={e => setGuidanceForm({ ...guidanceForm, date: e.target.value })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Bentuk / Jenis Pembinaan</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800"
                                        value={guidanceForm.guidanceType}
                                        onChange={e => setGuidanceForm({ ...guidanceForm, guidanceType: e.target.value })}
                                        required
                                    >
                                        <option value="Konseling Pribadi">Konseling Pribadi</option>
                                        <option value="Pemberian Tugas Positif">Pemberian Tugas Positif / Edukatif</option>
                                        <option value="Pembuatan Surat Perjanjian">Pembuatan Surat Perjanjian Siswa</option>
                                        <option value="Kesepakatan Wali Kelas">Kesepakatan / Kontrak Perilaku</option>
                                        <option value="Restitusi Disiplin Positif">Restitusi Disiplin Positif</option>
                                        <option value="Bimbingan Karakter">Bimbingan Karakter & Motivasi</option>
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Masalah / Pelanggaran Terkait <span className="text-gray-400 font-normal">(Opsional / Ringkasan)</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Misal: Sering terlambat masuk sekolah, bermain HP di kelas"
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800" 
                                    value={guidanceForm.violationSummary} 
                                    onChange={e => setGuidanceForm({ ...guidanceForm, violationSummary: e.target.value })} 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Uraian Pembinaan & Nasihat Wali Kelas <span className="text-red-500">*</span>
                                </label>
                                <textarea 
                                    required 
                                    rows={3}
                                    placeholder="Tuliskan uraian proses pembinaan, alasan dari siswa, nasihat dan arahan wali kelas..."
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800" 
                                    value={guidanceForm.notes} 
                                    onChange={e => setGuidanceForm({ ...guidanceForm, notes: e.target.value })} 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Komitmen & Janji Perbaikan Siswa <span className="text-gray-400 font-normal">(Pernyataan siswa)</span>
                                </label>
                                <textarea 
                                    rows={2}
                                    placeholder="Misal: Siswa berjanji akan bangun lebih pagi, tidak membawa HP ke kelas, dan siap ditegur jika mengulangi..."
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800" 
                                    value={guidanceForm.studentCommitment} 
                                    onChange={e => setGuidanceForm({ ...guidanceForm, studentCommitment: e.target.value })} 
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Status / Hasil Pembinaan</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800 font-medium"
                                        value={guidanceForm.status}
                                        onChange={e => setGuidanceForm({ ...guidanceForm, status: e.target.value as any })}
                                    >
                                        <option value="Dalam Pantauan">Dalam Pantauan Wali Kelas</option>
                                        <option value="Selesai/Membaik">Selesai / Perilaku Membaik</option>
                                        <option value="Perlu Eskalasi ke BK">Perlu Eskalasi / Koordinasi ke Guru BK</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Tanggal Evaluasi Lanjutan <span className="text-gray-400 font-normal">(Opsional)</span>
                                    </label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-800" 
                                        value={guidanceForm.followUpDate} 
                                        onChange={e => setGuidanceForm({ ...guidanceForm, followUpDate: e.target.value })} 
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={guidanceForm.parentInformed} 
                                        onChange={e => setGuidanceForm({ ...guidanceForm, parentInformed: e.target.checked })} 
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    <span>Telah menginformasikan / mengoordinasikan hal ini dengan Orang Tua Siswa</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowGuidanceModal(false);
                                        setSelectedStudentForGuidance(null);
                                        setEditingGuidanceId(null);
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-md flex items-center gap-1.5"
                                >
                                    <Check size={15} /> {editingGuidanceId ? 'Update Pembinaan' : 'Simpan Pembinaan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* --- TAB: HEALTH & MONITORING --- */}
      {activeTab === 'health' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Summary Harian Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
               <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-50 rounded-full opacity-50 blur-3xl"></div>
               <div className="relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                     <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                           <HeartPulse size={24} />
                        </div>
                        <div>
                           <h3 className="text-xl font-bold text-gray-800">Summary Kesehatan Kelas Hari Ini</h3>
                           <p className="text-sm text-gray-500">Monitor kehadiran dan kedisiplinan harian</p>
                        </div>
                     </div>
                     <button 
                       onClick={loadHealthData}
                       disabled={isRefreshingHealth}
                       className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                         isRefreshingHealth 
                           ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                           : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                       }`}
                     >
                       <RefreshCcw size={14} className={isRefreshingHealth ? 'animate-spin' : ''} />
                       {isRefreshingHealth ? 'Sinkronisasi...' : 'Refresh Data RFID'}
                     </button>
                  </div>

                  <div className="mt-6 flex flex-col md:flex-row gap-8 items-start">
                     <div className="space-y-1">
                        <p className="text-4xl font-black text-gray-800">{todayAttendance.alpha + todayAttendance.sakit + todayAttendance.izin + todayAttendance.late}</p>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Anomali Hari Ini</p>
                     </div>
                     <div className="flex-1 w-full space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {/* Alpha */}
                           <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                 <div className="flex items-center gap-2">
                                    <ShieldAlert className="text-red-500" size={16} />
                                    <span className="text-xs font-bold text-red-700">Tidak Hadir (Alpha)</span>
                                 </div>
                                 <span className="text-xs font-black text-red-800 bg-red-100 px-1.5 py-0.5 rounded">{todayAttendance.alpha} Siswa</span>
                              </div>
                              {todayAttendance.alphaDetail.length > 0 ? (
                                <p className="text-[10px] text-red-600 mt-1 font-semibold leading-relaxed bg-white/60 p-1.5 rounded-lg border border-red-200/40">
                                  Detail: {todayAttendance.alphaDetail.join(', ')}
                                </p>
                              ) : (
                                <p className="text-[10px] text-red-400 mt-1 italic font-medium">Nihil / Hadir Semua</p>
                              )}
                           </div>

                           {/* Sakit */}
                           <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                 <div className="flex items-center gap-2">
                                    <HeartPulse className="text-amber-500" size={16} />
                                    <span className="text-xs font-bold text-amber-700">Sakit</span>
                                 </div>
                                 <span className="text-xs font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">{todayAttendance.sakit} Siswa</span>
                              </div>
                              {todayAttendance.sakitDetail.length > 0 ? (
                                <p className="text-[10px] text-amber-600 mt-1 font-semibold leading-relaxed bg-white/60 p-1.5 rounded-lg border border-amber-200/40">
                                  Detail: {todayAttendance.sakitDetail.join(', ')}
                                </p>
                              ) : (
                                <p className="text-[10px] text-amber-400 mt-1 italic font-medium">Nihil / Sehat Semua</p>
                              )}
                           </div>

                           {/* Izin */}
                           <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                 <div className="flex items-center gap-2">
                                    <Calendar className="text-blue-500" size={16} />
                                    <span className="text-xs font-bold text-blue-700">Izin</span>
                                 </div>
                                 <span className="text-xs font-black text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">{todayAttendance.izin} Siswa</span>
                              </div>
                              {todayAttendance.izinDetail.length > 0 ? (
                                <p className="text-[10px] text-blue-600 mt-1 font-semibold leading-relaxed bg-white/60 p-1.5 rounded-lg border border-blue-200/40">
                                  Detail: {todayAttendance.izinDetail.join(', ')}
                                </p>
                              ) : (
                                <p className="text-[10px] text-blue-400 mt-1 italic font-medium">Nihil / Tidak Ada Izin</p>
                              )}
                           </div>

                           {/* Terlambat */}
                           <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                 <div className="flex items-center gap-2">
                                    <Clock className="text-orange-500" size={16} />
                                    <span className="text-xs font-bold text-orange-700">Terlambat Scan RFID</span>
                                 </div>
                                 <span className="text-xs font-black text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded">{todayAttendance.late} Siswa</span>
                              </div>
                              {todayAttendance.rfidLateDetail.length > 0 ? (
                                <p className="text-[10px] text-orange-600 mt-1 font-semibold leading-relaxed bg-white/60 p-1.5 rounded-lg border border-orange-200/40">
                                  Detail: {todayAttendance.rfidLateDetail.join(', ')}
                                </p>
                              ) : (
                                <p className="text-[10px] text-orange-400 mt-1 italic font-medium">Nihil / Tepat Waktu Semua</p>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>

                  <p className="mt-6 text-xs text-gray-400 italic flex items-center gap-1 group">
                     <AlertCircle size={12} className="group-hover:animate-pulse" /> Tips: Wali Kelas dapat mengonfirmasi data ketidakhadiran di atas secara langsung ke wali murid.
                  </p>
               </div>
            </div>

            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between">
               <div>
                  <h4 className="text-indigo-100 text-sm font-bold uppercase tracking-wider mb-4">Status Kelas</h4>
                  <div className="space-y-6">
                     <div className="flex justify-between items-end border-b border-white/10 pb-4">
                        <div>
                           <p className="text-xs text-indigo-200 uppercase">Tingkat Absensi</p>
                           <p className="text-2xl font-bold">{students.length > 0 ? ((todayAttendance.absent / students.length) * 100).toFixed(1) : 0}%</p>
                        </div>
                        <div className={`text-[10px] px-2 py-1 rounded-full ${todayAttendance.absent === 0 ? 'bg-emerald-400 text-emerald-950' : 'bg-red-400 text-red-950 font-bold'}`}>
                           {todayAttendance.absent === 0 ? 'Optimal' : 'Waspada'}
                        </div>
                     </div>
                     <div className="flex justify-between items-end">
                        <div>
                           <p className="text-xs text-indigo-200 uppercase">Input Nilai</p>
                           <p className="text-2xl font-bold">{detectedSubjects.length} <span className="text-xs font-normal opacity-70">Mapel</span></p>
                        </div>
                        <FileText size={24} className="opacity-30" />
                     </div>
                  </div>
               </div>
               <button 
                  onClick={() => {
                     setSearchQuery('');
                     setActiveTab('behavior');
                  }}
                  className="mt-8 w-full bg-white text-indigo-600 py-3 rounded-xl font-bold text-sm shadow-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
               >
                  Buka Folder BK <Users size={16} />
               </button>
            </div>
          </div>

          {/* Siswa Memerlukan Pembinaan Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                      <ShieldAlert size={24} />
                   </div>
                   <div>
                      <h3 className="text-lg font-extrabold text-gray-800">Siswa Memerlukan Pembinaan (Lebih dari 3x Alfa)</h3>
                      <p className="text-xs text-gray-500">Berdasarkan data absensi kumulatif harian semester berjalan</p>
                   </div>
                </div>
                <div className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 shrink-0">
                   Total: {frequentAbsentees.length} Siswa
                </div>
             </div>

             {frequentAbsentees.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {frequentAbsentees.map(({ student, alphaCount }) => (
                      <div key={student.id} className="p-4 rounded-xl border border-red-100 bg-red-50/20 hover:bg-red-50/40 transition duration-150 flex flex-col justify-between gap-3">
                         <div>
                            <div className="flex items-start justify-between gap-2">
                               <div>
                                  <h4 className="font-extrabold text-sm text-gray-900">{student.name}</h4>
                                  <p className="text-[11px] text-gray-500">NIS: {student.nis} • {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                               </div>
                               <span className="text-xs bg-red-100 text-red-700 font-black px-2.5 py-1 rounded-lg shrink-0">
                                  {alphaCount}x Alfa
                               </span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  alphaCount > 5 
                                     ? 'bg-red-600 text-white' 
                                     : 'bg-amber-100 text-amber-800'
                               }`}>
                                  {alphaCount > 5 ? 'Pembinaan Intensif' : 'Pembinaan Tahap 1'}
                               </span>
                            </div>
                         </div>
                         
                         <button
                            onClick={() => {
                               setSearchQuery(student.name);
                               setActiveTab('behavior');
                            }}
                            className="w-full mt-2 bg-white hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 py-2 rounded-lg text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 shadow-sm"
                         >
                            <Users size={14} /> Hubungi BK / Mulai Pembinaan
                         </button>
                      </div>
                   ))}
                </div>
             ) : (
                <div className="py-8 text-center bg-emerald-50/30 rounded-xl border border-dashed border-emerald-100">
                   <HeartPulse size={36} className="text-emerald-500 mx-auto mb-2" />
                   <p className="text-sm font-bold text-emerald-800">Kondisi Kelas Sangat Baik!</p>
                   <p className="text-xs text-emerald-600 mt-1">Tidak ada siswa yang tidak hadir (Alpha) lebih dari 3 kali.</p>
                </div>
             )}
          </div>

          {/* Trend Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="text-indigo-600" /> Tren Kedisiplinan (30 Hari Terakhir)
                   </h3>
                   <p className="text-xs text-gray-500">Grafik fluktuasi ketidakhadiran dan keterlambatan kelas</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                   <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div> Keterlambatan</div>
                   <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> Absensi (A)</div>
                </div>
             </div>

             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={disciplineTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#9ca3af'}} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#9ca3af'}} 
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px'}}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="violations" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: '#6366f1' }} 
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        name="Keterlambatan"
                    />
                      <Line 
                        type="monotone" 
                        dataKey="absences" 
                        stroke="#f87171" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: '#f87171' }} 
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        name="Absensi (Alpha)"
                    />
                   </LineChart>
                </ResponsiveContainer>
             </div>
             
             <div className="mt-8 pt-6 border-t border-gray-50 flex flex-wrap gap-6">
                <div className="flex-1 min-w-[200px] bg-gray-50 p-4 rounded-xl border border-gray-100">
                   <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Insight Minggu Ini</h5>
                   <p className="text-xs text-gray-600 leading-relaxed">
                      {disciplineTrend.length > 7 ? (
                        (() => {
                           const thisWeek = disciplineTrend.slice(-7);
                           const lastWeek = disciplineTrend.slice(-14, -7);
                           const thisTotal = thisWeek.reduce((s, d) => s + d.violations + d.absences, 0);
                           const lastTotal = lastWeek.reduce((s, d) => s + d.violations + d.absences, 0);
                           
                           if (thisTotal < lastTotal) return "Tren kedisiplinan meningkat! Terjadi penurunan anomali sebesar " + (lastTotal - thisTotal) + " kasus dibanding minggu lalu.";
                           if (thisTotal > lastTotal) return "Perhatian: Pelanggaran kedisiplinan meningkat " + (thisTotal - lastTotal) + " kasus. Segera bahas saat jam pimpinan kelas.";
                           return "Data kedisiplinan stabil dibanding minggu lalu.";
                        })()
                      ) : "Data belum cukup untuk analisis tren."}
                   </p>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-xl border border-emerald-100 min-w-[100px]">
                     <Trophy className="text-emerald-500 mb-1" size={20} />
                     <p className="text-lg font-black text-emerald-800">
                        {students.filter(s => violations.filter(v => v.studentId === s.id).length === 0).length}
                     </p>
                     <p className="text-[9px] font-bold text-emerald-600 uppercase">Siswa Teladan</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-orange-50 rounded-xl border border-orange-100 min-w-[100px]">
                     <Calendar className="text-orange-500 mb-1" size={20} />
                     <p className="text-lg font-black text-orange-800">
                        {disciplineTrend.reduce((s, d) => s + d.absences, 0)}
                     </p>
                     <p className="text-[9px] font-bold text-orange-600 uppercase">Izin/Alpha Bln Ini</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- TAB: INVENTORY --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Package className="text-orange-600" /> Inventaris Kelas {className}
                </h3>
                <p className="text-sm text-gray-500">Kelola daftar sarana dan prasarana di dalam ruang kelas.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowPrintModal(true)}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                >
                  <Printer size={16} /> Cetak
                </button>
                <button 
                  onClick={handleSaveInventory}
                  disabled={isSavingInventory}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isSavingInventory ? 'Menyimpan...' : <><Save size={16} /> Simpan Inventaris</>}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                    <th className="p-4 w-12 text-center">NO</th>
                    <th className="p-4 min-w-[200px]">NAMA BARANG</th>
                    <th className="p-4 w-24 text-center">VOL</th>
                    <th className="p-4 text-center">BAIK</th>
                    <th className="p-4 text-center">RR</th>
                    <th className="p-4 text-center">RS</th>
                    <th className="p-4 text-center">RB</th>
                    <th className="p-4 min-w-[200px]">KETERANGAN</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="p-2">
                        <input 
                          type="text"
                          value={item.itemName}
                          onChange={(e) => handleUpdateInventoryItem(idx, 'itemName', e.target.value)}
                          placeholder="Nama Barang..."
                          className="w-full px-3 py-2 border border-transparent focus:border-indigo-300 rounded-md outline-none bg-transparent focus:bg-white transition"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number"
                          value={item.volume}
                          onChange={(e) => handleUpdateInventoryItem(idx, 'volume', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-2 border border-transparent focus:border-indigo-300 rounded-md text-center outline-none bg-transparent focus:bg-white transition"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="radio"
                          name={`condition-${idx}`}
                          checked={item.condition === 'BAIK'}
                          onChange={() => handleUpdateInventoryItem(idx, 'condition', 'BAIK')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="radio"
                          name={`condition-${idx}`}
                          checked={item.condition === 'RUSAK_RINGAN'}
                          onChange={() => handleUpdateInventoryItem(idx, 'condition', 'RUSAK_RINGAN')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="radio"
                          name={`condition-${idx}`}
                          checked={item.condition === 'RUSAK_SEDANG'}
                          onChange={() => handleUpdateInventoryItem(idx, 'condition', 'RUSAK_SEDANG')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="radio"
                          name={`condition-${idx}`}
                          checked={item.condition === 'RUSAK_BERAT'}
                          onChange={() => handleUpdateInventoryItem(idx, 'condition', 'RUSAK_BERAT')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateInventoryItem(idx, 'notes', e.target.value)}
                          placeholder="Keterangan..."
                          className="w-full px-3 py-2 border border-transparent focus:border-indigo-300 rounded-md outline-none bg-transparent focus:bg-white transition"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleRemoveInventoryItem(idx)}
                          className="text-gray-400 hover:text-red-500 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={handleAddInventoryRow}
                className="flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700 transition text-sm"
              >
                <Plus size={16} /> Tambah Barang Baru
              </button>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-700">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>
              <strong>Keterangan Kondisi:</strong> Baik (B), Rusak Ringan (RR), Rusak Sedang (RS), Rusak Berat (RB). 
              Pastikan klik tombol <strong>Simpan Inventaris</strong> setelah melakukan perubahan data.
            </p>
          </div>
        </div>
      )}

      {/* --- TAB: WORKPLAN & LPJ --- */}
      {activeTab === 'workplan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Header Action Bar */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ClipboardList className="text-indigo-600" size={24} /> Program Kerja & Laporan Kinerja (LPJ) Wali Kelas
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Kelola perencanaan kerja semester, pantau indikator ketercapaian, dan susun Laporan Pertanggungjawaban (LPJ) wali kelas secara otomatis.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={handleResetWorkplans}
                className="px-3.5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2"
                title="Muat ulang 7 program baku standar wali kelas"
              >
                <RefreshCcw size={16} /> Reset Template
              </button>
              <button
                onClick={handleOpenAddWorkplan}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
              >
                <Plus size={16} /> Tambah Program Kerja
              </button>
              <button
                onClick={handleExportLpjExcel}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm"
              >
                <FileSpreadsheet size={16} /> Excel LPJ
              </button>
              <button
                onClick={() => setShowPrintModal(true)}
                className="px-3.5 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition flex items-center gap-1.5 shadow-sm"
                title="Atur Tempat, Tanggal, serta NIP/Nama Kepsek, Guru BK & Wali Kelas"
              >
                <Printer size={16} /> Legalisasi Cetak
              </button>
              <button
                onClick={handlePrintLpj}
                className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
                title="Cetak Laporan Pertanggungjawaban ringkas"
              >
                <Printer size={16} /> Cetak LPJ Ringkas
              </button>
              <button
                onClick={handlePrintOfficialPortfolio}
                className="px-3.5 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 transition flex items-center gap-1.5 shadow-sm"
                title="Cetak Portofolio Lengkap Standar Administrasi Sekolah (Cover, Lembar Pengesahan, BAB I - V, Lampiran)"
              >
                <BookOpen size={16} /> Cetak Portofolio Standar Administrasi
              </button>
            </div>
          </div>

          {/* Real-time KPI Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Award size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Capaian Workplan</p>
                <h4 className="font-extrabold text-2xl text-gray-800">{workplanProgressPercent}%</h4>
                <p className="text-xs text-gray-500 mt-0.5">{completedWorkplansCount} dari {workplanItems.length} Terlaksana</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <GraduationCap size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rata-Rata Leger</p>
                <h4 className="font-extrabold text-2xl text-gray-800">{classOverallAverage}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{totalStudentsCount} Siswa Terdata</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Disiplin & BK</p>
                <h4 className="font-extrabold text-2xl text-gray-800">{violations.length} <span className="text-xs font-normal text-gray-500">Kasus</span></h4>
                <p className="text-xs text-gray-500 mt-0.5">{homeVisits.length + parentCalls.length} HomeVisit & Ortu</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Package size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Kondisi Inventaris</p>
                <h4 className="font-extrabold text-2xl text-gray-800">{inventoryGoodPercent}% <span className="text-xs font-normal text-gray-500">Baik</span></h4>
                <p className="text-xs text-gray-500 mt-0.5">{inventoryItems.length} Item Sarpras Kelas</p>
              </div>
            </div>
          </div>

          {/* Table: Workplan Programs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <CheckCircle className="text-emerald-500" size={18} /> Matriks Program Kerja Wali Kelas ({workplanItems.length})
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">Program kerja berbasis target semester dan indikator capaian kelas.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                Semester {selectedSemester}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/70 text-gray-700 border-b border-gray-200 text-xs uppercase font-semibold">
                    <th className="p-3 text-center w-12">No</th>
                    <th className="p-3 min-w-[160px]">Bidang / Kategori</th>
                    <th className="p-3 min-w-[220px]">Program Kerja</th>
                    <th className="p-3 min-w-[120px] text-center">Target Waktu</th>
                    <th className="p-3 min-w-[240px]">Indikator Keberhasilan</th>
                    <th className="p-3 min-w-[130px] text-center">Status</th>
                    <th className="p-3 min-w-[120px] text-center">Progress</th>
                    <th className="p-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {workplanItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        Belum ada program kerja. Klik <strong>Tambah Program Kerja</strong> atau <strong>Reset Template</strong>.
                      </td>
                    </tr>
                  ) : (
                    workplanItems.map((item, idx) => {
                      const statusColor = 
                        item.status === 'TERLAKSANA' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        item.status === 'PROSES' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        item.status === 'TERTUNDA' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        'bg-gray-100 text-gray-700 border-gray-200';

                      return (
                        <tr key={item.id} className="hover:bg-indigo-50/30 transition">
                          <td className="p-3 text-center font-bold text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-semibold text-indigo-900">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 text-[11px] inline-block">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-gray-800">
                            {item.title}
                            {item.notes && <p className="text-[11px] font-normal text-gray-500 mt-0.5">{item.notes}</p>}
                          </td>
                          <td className="p-3 text-center font-medium text-gray-600 bg-gray-50/50 rounded">{item.targetMonth}</td>
                          <td className="p-3 text-gray-600 leading-relaxed">{item.indicator}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusColor}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-2 rounded-full ${item.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                                  style={{ width: `${item.progress}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-[11px] w-8 text-right">{item.progress}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditWorkplan(item)}
                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                title="Edit Program Kerja"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkplan(item.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                title="Hapus Program Kerja"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Attendance Recap Card for LPJ Report */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <ClipboardCheck className="text-emerald-600" size={20} /> Rekapitulasi Presensi & Kehadiran Siswa Bulan Sebelumnya
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Perhitungan otomatis akumulasi presensi siswa berdasarkan log absensi harian. Digunakan untuk melengkapi laporan LPJ Wali Kelas.
                </p>
              </div>

              {/* Month / Year / Effective Days Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={recapMonth}
                  onChange={(e) => setRecapMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {INDONESIAN_MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>

                <select
                  value={recapYear}
                  onChange={(e) => setRecapYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>

                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                  <span className="text-[11px] font-semibold text-gray-600">Hari Efektif:</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={customEffectiveDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setCustomEffectiveDays(val);
                      calculateMonthlyAttendanceRecap(recapMonth, recapYear, val);
                    }}
                    className="w-12 text-center text-xs font-bold bg-white border border-gray-300 rounded p-1 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  onClick={() => calculateMonthlyAttendanceRecap(recapMonth, recapYear, customEffectiveDays)}
                  disabled={isCalculatingRecap}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-xs hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  title="Hitung Ulang Presensi"
                >
                  <RefreshCcw size={14} className={isCalculatingRecap ? "animate-spin" : ""} />
                  {isCalculatingRecap ? "Menghitung..." : "Hitung"}
                </button>
              </div>
            </div>

            {/* Attendance KPI Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Rata-Rata Kehadiran</p>
                <h5 className="text-xl font-extrabold text-emerald-900 mt-0.5">{attendanceRecapSummary.classPercentage}%</h5>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-blue-700 uppercase">Hari Efektif</p>
                <h5 className="text-xl font-extrabold text-blue-900 mt-0.5">{attendanceRecapSummary.effectiveDays} Hari</h5>
              </div>

              <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-teal-700 uppercase">Total Hadir</p>
                <h5 className="text-xl font-extrabold text-teal-900 mt-0.5">{attendanceRecapSummary.totalHadir}</h5>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-amber-700 uppercase">Sakit (S)</p>
                <h5 className="text-xl font-extrabold text-amber-900 mt-0.5">{attendanceRecapSummary.totalSakit}</h5>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-indigo-700 uppercase">Izin (I)</p>
                <h5 className="text-xl font-extrabold text-indigo-900 mt-0.5">{attendanceRecapSummary.totalIzin}</h5>
              </div>

              <div className="p-3 bg-red-50/70 border border-red-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-red-700 uppercase">Alpa (A)</p>
                <h5 className="text-xl font-extrabold text-red-900 mt-0.5">{attendanceRecapSummary.totalAlfa}</h5>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari siswa..."
                    value={recapSearchQuery}
                    onChange={(e) => setRecapSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-gray-500 italic">
                  *Anda dapat mengedit angka Sakit, Izin, dan Alpa secara manual jika ada penyesuaian khusus.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 uppercase font-semibold border-b border-gray-200">
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5 w-24">NIS</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5 text-center w-12">L/P</th>
                      <th className="p-2.5 text-center w-16 bg-emerald-50 text-emerald-800">Hadir</th>
                      <th className="p-2.5 text-center w-16 bg-amber-50 text-amber-800">Sakit</th>
                      <th className="p-2.5 text-center w-16 bg-indigo-50 text-indigo-800">Izin</th>
                      <th className="p-2.5 text-center w-16 bg-red-50 text-red-800">Alpa</th>
                      <th className="p-2.5 text-center w-20">Total Hari</th>
                      <th className="p-2.5 text-center w-20">% Kehadiran</th>
                      <th className="p-2.5 text-center w-28">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceRecapList.filter(item => 
                      item.name.toLowerCase().includes(recapSearchQuery.toLowerCase()) || 
                      item.nis.includes(recapSearchQuery)
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-6 text-center text-gray-400">
                          Tidak ada data presensi siswa ditemukan.
                        </td>
                      </tr>
                    ) : (
                      attendanceRecapList.filter(item => 
                        item.name.toLowerCase().includes(recapSearchQuery.toLowerCase()) || 
                        item.nis.includes(recapSearchQuery)
                      ).map((st, idx) => {
                        const predBadge = 
                          st.percentage >= 96 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          st.percentage >= 92 ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          st.percentage >= 85 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          'bg-red-100 text-red-800 border-red-200';

                        return (
                          <tr key={st.studentId} className="hover:bg-emerald-50/30 transition">
                            <td className="p-2.5 text-center font-bold text-gray-500">{idx + 1}</td>
                            <td className="p-2.5 font-medium text-gray-600">{st.nis}</td>
                            <td className="p-2.5 font-bold text-gray-800">{st.name}</td>
                            <td className="p-2.5 text-center font-medium text-gray-600">{st.gender}</td>
                            
                            {/* Hadir */}
                            <td className="p-2 text-center font-bold text-emerald-700 bg-emerald-50/30">
                              {st.hadir}
                            </td>

                            {/* Sakit */}
                            <td className="p-1.5 text-center bg-amber-50/30">
                              <input
                                type="number"
                                min={0}
                                max={st.totalDays}
                                value={st.sakit}
                                onChange={(e) => handleUpdateStudentRecapItem(st.studentId, 'sakit', parseInt(e.target.value) || 0)}
                                className="w-12 p-1 text-center font-bold text-amber-800 border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                              />
                            </td>

                            {/* Izin */}
                            <td className="p-1.5 text-center bg-indigo-50/30">
                              <input
                                type="number"
                                min={0}
                                max={st.totalDays}
                                value={st.izin}
                                onChange={(e) => handleUpdateStudentRecapItem(st.studentId, 'izin', parseInt(e.target.value) || 0)}
                                className="w-12 p-1 text-center font-bold text-indigo-800 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              />
                            </td>

                            {/* Alpa */}
                            <td className="p-1.5 text-center bg-red-50/30">
                              <input
                                type="number"
                                min={0}
                                max={st.totalDays}
                                value={st.alfa}
                                onChange={(e) => handleUpdateStudentRecapItem(st.studentId, 'alfa', parseInt(e.target.value) || 0)}
                                className="w-12 p-1 text-center font-bold text-red-800 border border-red-200 rounded outline-none focus:ring-1 focus:ring-red-500 bg-white"
                              />
                            </td>

                            <td className="p-2.5 text-center font-semibold text-gray-700">{st.totalDays} Hari</td>
                            <td className="p-2.5 text-center font-extrabold text-gray-900">{st.percentage}%</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${predBadge}`}>
                                {st.predicate}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* LPJ Evaluation Narrative Inputs */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <BookOpen className="text-indigo-600" size={20} /> Laporan Kinerja & Catatan LPJ Wali Kelas
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Catatan kualitatif evaluasi kelas yang akan secara otomatis dimasukkan ke dalam dokumen cetak LPJ Wali Kelas.
                </p>
              </div>
              <button
                onClick={handleSaveLpj}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm shrink-0"
              >
                <Save size={16} /> Simpan Evaluasi LPJ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                  <Award size={14} className="text-indigo-600" /> A. Ringkasan Capaian & Pelaksanaan Tugas Wali Kelas
                </label>
                <textarea
                  rows={4}
                  value={lpjReport.evaluationSummary}
                  onChange={(e) => setLpjReport({ ...lpjReport, evaluationSummary: e.target.value })}
                  placeholder="Tuliskan ringkasan umum pelaksanaan tugas perwalian kelas selama semester ini..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600" /> B. Hambatan & Kendala Dalam Kelas
                </label>
                <textarea
                  rows={4}
                  value={lpjReport.obstacles}
                  onChange={(e) => setLpjReport({ ...lpjReport, obstacles: e.target.value })}
                  placeholder="Tuliskan kendala atau hambatan utama yang dihadapi di kelas..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-600" /> C. Solusi & Tindak Lanjut Yang Dilakukan
                </label>
                <textarea
                  rows={4}
                  value={lpjReport.solutions}
                  onChange={(e) => setLpjReport({ ...lpjReport, solutions: e.target.value })}
                  placeholder="Tuliskan solusi atau langkah penyelesaian masalah yang telah dilakukan..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-blue-600" /> D. Rekomendasi & Rencana Semester Berikutnya
                </label>
                <textarea
                  rows={4}
                  value={lpjReport.recommendations}
                  onChange={(e) => setLpjReport({ ...lpjReport, recommendations: e.target.value })}
                  placeholder="Tuliskan rekomendasi dan rencana perbaikan untuk semester mendatang..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Legalisasi & Tanda Tangan Cetak Laporan Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <FileText className="text-indigo-600" size={20} /> Pengaturan Legalisasi & Tanda Tangan Cetak Laporan
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Atur tempat penerbitan (kota/kabupaten), tanggal cetak, serta nama & NIP Kepala Sekolah, Guru BK, dan Wali Kelas untuk Lembar Pengesahan.
                </p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-semibold border border-emerald-100 shrink-0 flex items-center gap-1.5">
                <Check size={14} /> Otomatis Tersimpan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Tempat Dibuat (Kota)</label>
                <input
                  type="text"
                  value={printSettings.place}
                  onChange={(e) => handleUpdatePrintSetting('place', e.target.value)}
                  placeholder="Contoh: Jakarta / Bandung / Malang"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Tanggal Dokumen</label>
                <input
                  type="text"
                  value={printSettings.date}
                  onChange={(e) => handleUpdatePrintSetting('date', e.target.value)}
                  placeholder="Contoh: 5 Agustus 2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={printSettings.headmasterName}
                  onChange={(e) => handleUpdatePrintSetting('headmasterName', e.target.value)}
                  placeholder="Nama & Gelar Kepsek"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">NIP Kepala Sekolah</label>
                <input
                  type="text"
                  value={printSettings.headmasterNip}
                  onChange={(e) => handleUpdatePrintSetting('headmasterNip', e.target.value)}
                  placeholder="NIP Kepala Sekolah"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Nama Guru / Koordinator BK</label>
                <input
                  type="text"
                  value={printSettings.bkName}
                  onChange={(e) => handleUpdatePrintSetting('bkName', e.target.value)}
                  placeholder="Nama & Gelar Guru BK"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">NIP Guru / Koordinator BK</label>
                <input
                  type="text"
                  value={printSettings.bkNip}
                  onChange={(e) => handleUpdatePrintSetting('bkNip', e.target.value)}
                  placeholder="NIP Guru BK"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Nama Wali Kelas</label>
                <input
                  type="text"
                  value={printSettings.homeroomName}
                  onChange={(e) => handleUpdatePrintSetting('homeroomName', e.target.value)}
                  placeholder="Nama Wali Kelas"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">NIP Wali Kelas</label>
                <input
                  type="text"
                  value={printSettings.homeroomNip}
                  onChange={(e) => handleUpdatePrintSetting('homeroomNip', e.target.value)}
                  placeholder="NIP Wali Kelas"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workplan Form Modal */}
      {showWorkplanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
              <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                <ClipboardList size={20} /> {editingWorkplan ? 'Edit Program Kerja' : 'Tambah Program Kerja Baru'}
              </h3>
              <button onClick={() => setShowWorkplanModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveWorkplanForm} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Bidang / Kategori</label>
                  <select
                    value={workplanForm.category}
                    onChange={(e) => setWorkplanForm({ ...workplanForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Organisasi & Administrasi">Organisasi & Administrasi</option>
                    <option value="Fisik & Kebersihan">Fisik & Kebersihan</option>
                    <option value="Paguyuban Ortu">Paguyuban Ortu</option>
                    <option value="Karakter & Kedisiplinan">Karakter & Kedisiplinan</option>
                    <option value="Akademik & Bimbingan">Akademik & Bimbingan</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Target Waktu</label>
                  <input
                    type="text"
                    value={workplanForm.targetMonth}
                    onChange={(e) => setWorkplanForm({ ...workplanForm, targetMonth: e.target.value })}
                    placeholder="Contoh: Juli - Agustus"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase">Nama Program Kerja</label>
                <input
                  type="text"
                  value={workplanForm.title}
                  onChange={(e) => setWorkplanForm({ ...workplanForm, title: e.target.value })}
                  placeholder="Contoh: Musyawarah Pembentukan Paguyuban Orang Tua"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase">Indikator Keberhasilan</label>
                <textarea
                  rows={2}
                  value={workplanForm.indicator}
                  onChange={(e) => setWorkplanForm({ ...workplanForm, indicator: e.target.value })}
                  placeholder="Target konkret output keberhasilan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Status Realisasi</label>
                  <select
                    value={workplanForm.status}
                    onChange={(e) => setWorkplanForm({ ...workplanForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="BELUM">BELUM</option>
                    <option value="PROSES">PROSES</option>
                    <option value="TERLAKSANA">TERLAKSANA</option>
                    <option value="TERTUNDA">TERTUNDA</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Progress ({workplanForm.progress}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={workplanForm.progress}
                    onChange={(e) => setWorkplanForm({ ...workplanForm, progress: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-3"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase">Catatan / Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={workplanForm.notes}
                  onChange={(e) => setWorkplanForm({ ...workplanForm, notes: e.target.value })}
                  placeholder="Catatan pelaksanaan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="p-4 bg-gray-50 -mx-6 -mb-6 border-t border-gray-100 flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowWorkplanModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Simpan Program Kerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Settings Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
              <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                <Printer size={20} /> Pengaturan Legalisasi & Cetak
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Tempat Dibuat (Kota)</label>
                  <input 
                    type="text" 
                    value={printSettings.place}
                    onChange={(e) => handleUpdatePrintSetting('place', e.target.value)}
                    placeholder="misal: Jakarta / Bandung"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Tanggal Dokumen</label>
                  <input 
                    type="text" 
                    value={printSettings.date}
                    onChange={(e) => handleUpdatePrintSetting('date', e.target.value)}
                    placeholder="misal: 5 Agustus 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Nama Kepala Sekolah</label>
                  <input 
                    type="text" 
                    value={printSettings.headmasterName}
                    onChange={(e) => handleUpdatePrintSetting('headmasterName', e.target.value)}
                    placeholder="Nama & Gelar Kepsek"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">NIP Kepala Sekolah</label>
                  <input 
                    type="text" 
                    value={printSettings.headmasterNip}
                    onChange={(e) => handleUpdatePrintSetting('headmasterNip', e.target.value)}
                    placeholder="NIP Kepsek"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Nama Guru / Koordinator BK</label>
                  <input 
                    type="text" 
                    value={printSettings.bkName}
                    onChange={(e) => handleUpdatePrintSetting('bkName', e.target.value)}
                    placeholder="Nama & Gelar Guru BK"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">NIP Guru / Koordinator BK</label>
                  <input 
                    type="text" 
                    value={printSettings.bkNip}
                    onChange={(e) => handleUpdatePrintSetting('bkNip', e.target.value)}
                    placeholder="NIP Guru BK"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">Nama Wali Kelas</label>
                  <input 
                    type="text" 
                    value={printSettings.homeroomName}
                    onChange={(e) => handleUpdatePrintSetting('homeroomName', e.target.value)}
                    placeholder="Nama Wali Kelas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase">NIP Wali Kelas</label>
                  <input 
                    type="text" 
                    value={printSettings.homeroomNip}
                    onChange={(e) => handleUpdatePrintSetting('homeroomNip', e.target.value)}
                    placeholder="NIP Wali Kelas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input 
                  type="checkbox" 
                  id="showSignature"
                  checked={printSettings.showSignature}
                  onChange={(e) => handleUpdatePrintSetting('showSignature', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="showSignature" className="text-sm text-gray-700">Tampilkan Blok Tanda Tangan Pada Laporan</label>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                Tutup & Simpan
              </button>
              <button 
                onClick={() => {
                  setShowPrintModal(false);
                  handlePrintInventory();
                }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Cetak Inventaris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherHomeroom;
