import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, ClassRoom, CocurricularJournal, SystemSettings } from '../types';
import { 
  getCocurricularJournals, 
  saveCocurricularJournal, 
  bulkSaveCocurricularJournals, 
  deleteCocurricularJournal, 
  getClasses, 
  getTeachersOnly,
  getPrincipalTeacher,
  getSystemSettings, 
  getLocalDate,
  runManualSync,
  db
} from '../services/database';
import { MathView, normalizeGeminiMathText } from './MathRenderer';
import { 
  Calendar, Clock, BookOpen, User as UserIcon, Plus, Printer, 
  Trash2, Edit3, CheckCircle2, AlertCircle, Search, 
  Filter, Sparkles, FileText, ChevronRight, Share2, 
  RefreshCw, Check, ArrowRight, Layers, Award, Info, X,
  MapPin, RotateCcw, Building2, Copy, CopyCheck, Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CocurricularJournalManagerProps {
  user: User;
}

const P5_THEMES = [
  'Gaya Hidup Berkelanjutan',
  'Kearifan Lokal',
  'Bhinneka Tunggal Ika',
  'Bangunlah Jiwa dan Raganya',
  'Suara Demokrasi',
  'Rekayasa dan Teknologi',
  'Kewirausahaan',
  'Kebekerjaan'
];

const ACTIVITY_TEMPLATES = [
  'Sosialisasi panduan proyek, penjelasan tujuan dan tahapan kegiatan kokurikuler.',
  'Eksplorasi isu kontekstual, observasi lapangan, dan pengumpulan data awal kelompok.',
  'Brainstorming ide kreatif dan perancangan desain prototipe/karya solusi.',
  'Praktik pembuatan karya/produk proyek secara kolaboratif dalam kelompok.',
  'Uji coba prototipe, evaluasi fungsi, dan perbaikan hasil karya proyek.',
  'Presentasi hasil karya, gelar karya (showcase), dan penerimaan umpan balik.',
  'Refleksi diri, asesmen formatif dimensi Profil Pelajar Pancasila, dan penyusunan laporan.'
];

export const CocurricularJournalManager: React.FC<CocurricularJournalManagerProps> = ({ user }) => {
  // --- STATE ---
  const [journals, setJournals] = useState<CocurricularJournal[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [principalUser, setPrincipalUser] = useState<User | null>(null);
  const [printSchoolName, setPrintSchoolName] = useState<string>('');
  const [printPrincipalName, setPrintPrincipalName] = useState<string>('');
  const [printPrincipalNip, setPrintPrincipalNip] = useState<string>('');
  const [printCity, setPrintCity] = useState<string>('');
  const [printDateRaw, setPrintDateRaw] = useState<string>('');
  const [printDateText, setPrintDateText] = useState<string>('');
  const [printCoordinatorName, setPrintCoordinatorName] = useState<string>('');
  const [printCoordinatorNip, setPrintCoordinatorNip] = useState<string>('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Selected date & class context
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Current date in YYYY-MM-DD
    return getLocalDate() || new Date().toISOString().split('T')[0];
  });
  const [selectedClass, setSelectedClass] = useState<string>('XII');
  const [filterMode, setFilterMode] = useState<'DATE_AND_CLASS' | 'ALL_CLASSES' | 'ALL_DATES'>('DATE_AND_CLASS');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: selectedDate,
    className: 'XII',
    classId: 'XII',
    startHour: 2,
    endHour: 2,
    isSeparateHours: true, // Split 2 to 4 into 3 individual rows for NO 1, 2, 3...
    facilitatorName: (user.role === 'GURU' || (user.role as string) === UserRole.GURU) ? (user.fullName || '') : '',
    projectTheme: 'Gaya Hidup Berkelanjutan',
    activities: '',
    notes: ''
  });

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printIncludeEmptyRows, setPrintIncludeEmptyRows] = useState(true);
  const [printMaxHour, setPrintMaxHour] = useState(10);
  const [printThemeTitle, setPrintThemeTitle] = useState('');

  // Copy Modal State (Salin Jurnal Antar-Kelas)
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceClass, setCopySourceClass] = useState<string>('');
  const [copySourceDate, setCopySourceDate] = useState<string>(selectedDate);
  const [copyTargetClasses, setCopyTargetClasses] = useState<string[]>([selectedClass]);
  const [copyTargetDate, setCopyTargetDate] = useState<string>(selectedDate);
  const [copySelectedJournalIds, setCopySelectedJournalIds] = useState<string[]>([]);
  const [copyFacilitatorMode, setCopyFacilitatorMode] = useState<'ME' | 'ORIGINAL' | 'CUSTOM'>('ME');
  const [copyCustomFacilitator, setCopyCustomFacilitator] = useState<string>('');
  const [copyConflictMode, setCopyConflictMode] = useState<'SKIP' | 'OVERWRITE'>('SKIP');
  const [copySourceAvailableJournals, setCopySourceAvailableJournals] = useState<CocurricularJournal[]>([]);
  const [sourceClassDatesWithData, setSourceClassDatesWithData] = useState<string[]>([]);
  const [isLoadingSourceJournals, setIsLoadingSourceJournals] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [classesJournalCounts, setClassesJournalCounts] = useState<Record<string, { today: number; total: number }>>({});

  // Jurnal kelas lain untuk fitur salin cepat & rekomendasi salin otomatis
  const [otherClassesJournals, setOtherClassesJournals] = useState<CocurricularJournal[]>([]);
  const [recentOtherJournals, setRecentOtherJournals] = useState<CocurricularJournal[]>([]);
  const [isQuickCopying, setIsQuickCopying] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Notification / Feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSyncPull = async (showNotification = false) => {
    setIsSyncing(true);
    try {
      await runManualSync('PULL', () => {}, [
        'eduadmin_cocurricular_journals',
        'eduadmin_classes',
        'eduadmin_users'
      ]);
      await loadBaseData();
      await loadJournals();
      if (showNotification) {
        showToast('success', 'Data jurnal dari guru lain berhasil disinkronkan');
      }
    } catch (err) {
      console.warn('Sync pull error:', err);
      if (showNotification) {
        showToast('error', 'Gagal menyinkronkan data dengan server');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // --- INITIAL DATA LOADING ---
  useEffect(() => {
    loadBaseData();
    // Sinkronkan data otomatis dari cloud saat membuka halaman agar entri dari rekan guru langsung muncul
    handleSyncPull(false);
  }, [user.id, user.schoolNpsn]);

  useEffect(() => {
    loadJournals();
  }, [user.schoolNpsn, selectedDate, selectedClass, filterMode]);

  const loadBaseData = async () => {
    try {
      const [classList, teacherList, principalTeacher, sysSettings] = await Promise.all([
        getClasses(user.id, user.schoolNpsn),
        getTeachersOnly(user.schoolNpsn),
        getPrincipalTeacher(user.schoolNpsn),
        getSystemSettings()
      ]);

      // Kumpulkan juga nama kelas dari jurnal kokurikuler yang sudah pernah diinput oleh guru lain
      const existingJournals = await db.cocurricularJournals.filter(j => !j.deleted && !!j.className).toArray();
      const existingClassNames = Array.from(new Set(existingJournals.map(j => (j.className || '').trim()).filter(Boolean)));
      
      // Gabungkan kelas master dan kelas yang ada di jurnal sehingga guru lain selalu bisa memilih kelas tersebut
      const combinedClasses: ClassRoom[] = [...(classList || [])];
      for (const clsName of existingClassNames) {
        if (!combinedClasses.some(c => c.name.trim().toLowerCase() === clsName.toLowerCase())) {
          combinedClasses.push({
            id: clsName,
            name: clsName,
            userId: user.id,
            schoolNpsn: user.schoolNpsn || 'DEFAULT',
            studentCount: 0,
            academicYear: '',
            major: '',
            level: ''
          } as ClassRoom);
        }
      }
      setClasses(combinedClasses);

      // HANYA akun user level GURU (tidak menampilkan user level TENDIK)
      const guruOnly = (teacherList || []).filter(t => 
        (t.role === 'GURU' || (t.role as string) === UserRole.GURU) && 
        t.role !== 'TENDIK' && 
        (t.role as string) !== 'TENDIK'
      );

      // Jika user yang aktif saat ini adalah Guru, pastikan masuk ke daftar jika belum ada
      const isCurrentGuru = user.role === 'GURU' || (user.role as string) === UserRole.GURU;
      if (isCurrentGuru && !guruOnly.some(t => t.id === user.id)) {
        guruOnly.unshift(user);
      }
      setTeachers(guruOnly);

      // Ambil data Kepala Sekolah otomatis dari akun user guru yang memiliki tugas tambahan kepala sekolah
      const isCurrentKepsek = user.additionalRole === 'KEPALA_SEKOLAH' || 
                              user.additionalRole?.toLowerCase() === 'kepala_sekolah' || 
                              user.additionalRole?.toLowerCase() === 'kepala sekolah';
      const principal = isCurrentKepsek ? user : principalTeacher;

      if (principal) {
        setPrincipalUser(principal);
        setPrintPrincipalName(principal.fullName || '');
        setPrintPrincipalNip(principal.nip || '');
      } else if (sysSettings) {
        setPrintPrincipalName(sysSettings.headmasterName || '');
        setPrintPrincipalNip(sysSettings.headmasterNip || '');
      }

      // Deteksi otomatis Nama Sekolah yang aktif sesuai data riil pengguna & sekolah
      const isGenericSchool = (s?: string | null) => {
        if (!s) return true;
        const norm = s.trim().toLowerCase();
        return !norm || norm === 'sekolah indonesia' || norm === 'sistem sekolah' || norm === 'eduadmin' || norm === 'sekolah';
      };

      let activeSchool = '';
      if (user.schoolName && !isGenericSchool(user.schoolName)) {
        activeSchool = user.schoolName.trim();
      } else if (principal?.schoolName && !isGenericSchool(principal.schoolName)) {
        activeSchool = principal.schoolName.trim();
      } else if (guruOnly && guruOnly.length > 0) {
        const found = guruOnly.find(g => g.schoolName && !isGenericSchool(g.schoolName));
        if (found?.schoolName) {
          activeSchool = found.schoolName.trim();
        }
      }

      if (!activeSchool && user.schoolNpsn && user.schoolNpsn !== 'DEFAULT') {
        try {
          const sameSchoolUsers = await db.users.where('schoolNpsn').equals(user.schoolNpsn).toArray();
          const uSchool = sameSchoolUsers.find(u => u.schoolName && !isGenericSchool(u.schoolName));
          if (uSchool?.schoolName) {
            activeSchool = uSchool.schoolName.trim();
          }
        } catch (e) {
          // ignore
        }
      }

      if (!activeSchool && sysSettings?.schoolName && !isGenericSchool(sysSettings.schoolName)) {
        activeSchool = sysSettings.schoolName.trim();
      }

      if (!activeSchool && user.schoolName && user.schoolName.trim()) {
        activeSchool = user.schoolName.trim();
      }

      if (activeSchool) {
        setPrintSchoolName(activeSchool);
      }

      setSettings(sysSettings || null);

      if (combinedClasses && combinedClasses.length > 0 && selectedClass === 'XII') {
        const hasXII = combinedClasses.some(c => c.name.toUpperCase().includes('XII'));
        if (!hasXII && combinedClasses[0]) {
          setSelectedClass(combinedClasses[0].name);
          setFormData(prev => ({ ...prev, className: combinedClasses[0].name, classId: combinedClasses[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load base data:', err);
    }
  };

  const loadJournals = async () => {
    setIsLoading(true);
    try {
      let filterParams: any = {};
      if (user.schoolNpsn && user.schoolNpsn !== 'DEFAULT') {
        filterParams.schoolNpsn = user.schoolNpsn;
      }

      if (filterMode === 'DATE_AND_CLASS') {
        filterParams.date = selectedDate;
        filterParams.className = selectedClass;
      } else if (filterMode === 'ALL_CLASSES') {
        filterParams.date = selectedDate;
      } else if (filterMode === 'ALL_DATES') {
        filterParams.className = selectedClass;
      }

      const list = await getCocurricularJournals(filterParams);
      setJournals(list);
    } catch (err) {
      console.error('Failed to load cocurricular journals:', err);
      showToast('error', 'Gagal memuat data jurnal');
    } finally {
      setIsLoading(false);
    }
  };

  // Muat data jurnal dari kelas lain untuk fitur salin cepat
  const loadOtherClassesJournals = async () => {
    try {
      const activeCls = (selectedClass || '').trim().toLowerCase();
      // Jurnal dari kelas lain pada tanggal yang sama
      const allOnDate = await db.cocurricularJournals
        .filter(j => !j.deleted && 
          j.date === selectedDate &&
          (j.className || '').trim().toLowerCase() !== activeCls &&
          (j.classId || '').trim().toLowerCase() !== activeCls
        )
        .toArray();
      allOnDate.sort((a, b) => (Number(a.meetingNo) || 0) - (Number(b.meetingNo) || 0));
      setOtherClassesJournals(allOnDate);

      // Jurnal dari kelas lain terkini (arsip terbaru untuk bantuan input formulir jika tanggal ini masih kosong)
      const allRecent = await db.cocurricularJournals
        .filter(j => !j.deleted &&
          (j.className || '').trim().toLowerCase() !== activeCls &&
          (j.classId || '').trim().toLowerCase() !== activeCls
        )
        .reverse()
        .sortBy('date');
      setRecentOtherJournals(allRecent.slice(0, 10));
    } catch (err) {
      console.warn('Failed to load other classes journals:', err);
    }
  };

  useEffect(() => {
    loadOtherClassesJournals();
  }, [selectedDate, selectedClass, journals]);

  // Kelompokkan jurnal kelas lain per nama kelas
  const otherClassesWithData = useMemo(() => {
    const map = new Map<string, { className: string; count: number; items: CocurricularJournal[] }>();
    otherClassesJournals.forEach(j => {
      const c = (j.className || '').trim() || 'Kelas Lain';
      if (!map.has(c)) {
        map.set(c, { className: c, count: 0, items: [] });
      }
      const obj = map.get(c)!;
      obj.count++;
      obj.items.push(j);
    });
    return Array.from(map.values());
  }, [otherClassesJournals]);

  // Salin otomatis seluruh jam kegiatan dari kelas sumber tertentu ke kelas yang sedang aktif (1-Klik)
  const handleQuickCopyAllFromClass = async (sourceClassName: string) => {
    const itemsToCopy = otherClassesJournals.filter(
      j => (j.className || '').trim().toLowerCase() === sourceClassName.trim().toLowerCase()
    );
    if (itemsToCopy.length === 0) {
      showToast('error', `Tidak ada data kegiatan dari kelas ${sourceClassName} untuk disalin.`);
      return;
    }

    setIsQuickCopying(true);
    try {
      const dayName = getDayName(selectedDate);
      const targetClassObj = classes.find(c => c.name.toLowerCase() === selectedClass.toLowerCase());
      const targetClassId = targetClassObj?.id || selectedClass;
      const facilitator = user.fullName || user.username || 'Guru';

      // Cek entri yang sudah ada di kelas aktif pada tanggal ini
      const existingInTarget = await db.cocurricularJournals
        .filter(j => !j.deleted && 
          ((j.className || '').trim().toLowerCase() === selectedClass.trim().toLowerCase() || 
           (j.classId || '').trim().toLowerCase() === selectedClass.trim().toLowerCase()) &&
          j.date === selectedDate
        )
        .toArray();

      const existingHourMap = new Map<number, CocurricularJournal>();
      existingInTarget.forEach(ex => {
        const s = Number(ex.meetingNo) || 1;
        const e = Number(ex.meetingNoEnd) || s;
        for (let h = s; h <= e; h++) {
          existingHourMap.set(h, ex);
        }
      });

      let totalCopied = 0;
      let totalSkipped = 0;
      const batchToSave: any[] = [];

      for (const src of itemsToCopy) {
        const startHour = Number(src.meetingNo) || 1;
        const endHour = Number(src.meetingNoEnd) || startHour;

        let hasConflict = false;
        for (let h = startHour; h <= endHour; h++) {
          if (existingHourMap.has(h)) {
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          totalSkipped++;
          continue;
        }

        batchToSave.push({
          schoolNpsn: user.schoolNpsn || 'DEFAULT',
          userId: user.id,
          createdByName: user.fullName || user.username || 'Guru',
          facilitatorName: facilitator,
          classId: targetClassId,
          className: selectedClass,
          date: selectedDate,
          dayName,
          meetingNo: startHour,
          meetingNoEnd: endHour > startHour ? endHour : undefined,
          activities: src.activities,
          projectTheme: src.projectTheme,
          targetDimension: src.targetDimension,
          notes: src.notes
        });
        totalCopied++;
      }

      if (batchToSave.length > 0) {
        await bulkSaveCocurricularJournals(batchToSave);
      }

      await loadJournals();
      await loadOtherClassesJournals();

      if (totalCopied > 0) {
        showToast('success', `Berhasil menyalin ${totalCopied} entri kegiatan dari Kelas ${sourceClassName} ke Kelas ${selectedClass}!${totalSkipped > 0 ? ` (${totalSkipped} jam dilewati karena sudah terisi)` : ''}`);
      } else if (totalSkipped > 0) {
        showToast('error', `Semua jam kegiatan sudah terisi di Kelas ${selectedClass}. Buka dialog salin jika ingin menimpa.`);
      }
    } catch (err) {
      console.error('Quick copy error:', err);
      showToast('error', 'Gagal menyalin jurnal dari kelas lain');
    } finally {
      setIsQuickCopying(false);
    }
  };

  // Sync formData date/class when context changes
  const handleSelectClass = (cls: string) => {
    setSelectedClass(cls);
    setFormData(prev => ({ ...prev, className: cls, classId: cls }));
  };

  const handleSelectDate = (d: string) => {
    setSelectedDate(d);
    setFormData(prev => ({ ...prev, date: d }));
  };

  // Helper date formatter
  const formatIndonesianDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getDayName = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  // Compute filled hours for the selected date & class
  const dailyJournalsForActiveContext = useMemo(() => {
    const target = (selectedClass || '').trim().toLowerCase();
    const targetClean = target.replace(/[^a-zA-Z0-9]/g, '');
    return journals.filter(j => {
      if (j.date !== selectedDate) return false;
      if (selectedClass === 'ALL') return true;
      const jName = (j.className || '').trim().toLowerCase();
      const jId = (j.classId || '').trim().toLowerCase();
      const jClean = jName.replace(/[^a-zA-Z0-9]/g, '');
      return jName === target || jId === target || (targetClean && jClean && targetClean === jClean);
    });
  }, [journals, selectedDate, selectedClass]);

  const filledHourMap = useMemo(() => {
    const map = new Map<number, CocurricularJournal>();
    dailyJournalsForActiveContext.forEach(j => {
      const start = Number(j.meetingNo) || 1;
      const end = Number(j.meetingNoEnd) || start;
      for (let h = start; h <= end; h++) {
        map.set(h, j);
      }
    });
    return map;
  }, [dailyJournalsForActiveContext]);

  // Next available unfilled hour
  const nextUnfilledHour = useMemo(() => {
    for (let h = 1; h <= 10; h++) {
      if (!filledHourMap.has(h)) return h;
    }
    return 1;
  }, [filledHourMap]);

  // Helper to open print modal ensuring Kepala Sekolah, Nama Sekolah, and Titimangsa data are initialized
  const openPrintModal = () => {
    const isGenericSchool = (s?: string | null) => {
      if (!s) return true;
      const norm = s.trim().toLowerCase();
      return !norm || norm === 'sekolah indonesia' || norm === 'sistem sekolah' || norm === 'eduadmin' || norm === 'sekolah';
    };

    if (!printSchoolName || isGenericSchool(printSchoolName)) {
      const activeSchool = 
        (user.schoolName && !isGenericSchool(user.schoolName) ? user.schoolName.trim() : '') ||
        (principalUser?.schoolName && !isGenericSchool(principalUser.schoolName) ? principalUser.schoolName.trim() : '') ||
        (settings?.schoolName && !isGenericSchool(settings.schoolName) ? settings.schoolName.trim() : '') ||
        (user.schoolName ? user.schoolName.trim() : '');
      if (activeSchool) {
        setPrintSchoolName(activeSchool);
      }
    }

    if (!printPrincipalName && (principalUser?.fullName || settings?.headmasterName)) {
      setPrintPrincipalName(principalUser?.fullName || settings?.headmasterName || '');
    }
    if (!printPrincipalNip && (principalUser?.nip || settings?.headmasterNip)) {
      setPrintPrincipalNip(principalUser?.nip || settings?.headmasterNip || '');
    }
    if (!printCity) {
      setPrintCity(settings?.schoolCity || 'Sekolah');
    }
    if (!printDateRaw) {
      setPrintDateRaw(selectedDate);
    }
    if (!printDateText) {
      const formatted = formatIndonesianDate(selectedDate).split(', ')[1] || selectedDate;
      setPrintDateText(formatted);
    }
    if (!printCoordinatorName) {
      setPrintCoordinatorName(user.fullName || '');
    }
    if (!printCoordinatorNip) {
      setPrintCoordinatorNip(user.nip || '');
    }
    setShowPrintModal(true);
  };

  const handlePrintDateRawChange = (d: string) => {
    setPrintDateRaw(d);
    if (d) {
      const formatted = formatIndonesianDate(d).split(', ')[1] || d;
      setPrintDateText(formatted);
    }
  };

  const handleResetTitimangsa = () => {
    const isGenericSchool = (s?: string | null) => {
      if (!s) return true;
      const norm = s.trim().toLowerCase();
      return !norm || norm === 'sekolah indonesia' || norm === 'sistem sekolah' || norm === 'eduadmin' || norm === 'sekolah';
    };
    const activeSchool = 
      (user.schoolName && !isGenericSchool(user.schoolName) ? user.schoolName.trim() : '') ||
      (principalUser?.schoolName && !isGenericSchool(principalUser.schoolName) ? principalUser.schoolName.trim() : '') ||
      (settings?.schoolName && !isGenericSchool(settings.schoolName) ? settings.schoolName.trim() : '') ||
      (user.schoolName ? user.schoolName.trim() : '');
    if (activeSchool) {
      setPrintSchoolName(activeSchool);
    }
    setPrintCity(settings?.schoolCity || 'Sekolah');
    setPrintDateRaw(selectedDate);
    const formatted = formatIndonesianDate(selectedDate).split(', ')[1] || selectedDate;
    setPrintDateText(formatted);
  };

  // --- LOGIKA SALIN JURNAL ANTAR-KELAS ---
  const fetchSourceJournals = async (clsName: string, dateStr: string, autoSelectId?: string) => {
    if (!clsName) return;
    setIsLoadingSourceJournals(true);
    try {
      const allForClass = await db.cocurricularJournals
        .filter(j => !j.deleted && (
          (j.className || '').trim().toLowerCase() === clsName.trim().toLowerCase() ||
          (j.classId || '').trim().toLowerCase() === clsName.trim().toLowerCase()
        ))
        .toArray();

      const onDate = allForClass.filter(j => j.date === dateStr);
      onDate.sort((a, b) => (Number(a.meetingNo) || 0) - (Number(b.meetingNo) || 0));
      setCopySourceAvailableJournals(onDate);

      if (autoSelectId) {
        setCopySelectedJournalIds([autoSelectId]);
      } else {
        setCopySelectedJournalIds(onDate.map(j => j.id));
      }

      // Kumpulkan tanggal-tanggal unik yang ada datanya untuk kelas sumber ini
      const uniqueDates = Array.from(new Set(allForClass.map(j => j.date))).sort().reverse();
      setSourceClassDatesWithData(uniqueDates);
    } catch (err) {
      console.error('Failed to fetch source journals:', err);
    } finally {
      setIsLoadingSourceJournals(false);
    }
  };

  const openCopyModal = async (initialSourceClass?: string, initialJournalId?: string) => {
    try {
      // Hitung keterisian jurnal per kelas untuk indikator
      const allJournals = await db.cocurricularJournals.filter(j => !j.deleted).toArray();
      const counts: Record<string, { today: number; total: number }> = {};
      
      allJournals.forEach(j => {
        const cName = (j.className || '').trim();
        if (!cName) return;
        if (!counts[cName]) counts[cName] = { today: 0, total: 0 };
        counts[cName].total++;
        if (j.date === selectedDate) {
          counts[cName].today++;
        }
      });
      setClassesJournalCounts(counts);

      let srcCls = initialSourceClass;
      if (!srcCls) {
        // Cari kelas lain yang memiliki data hari ini selain kelas yang sedang dibuka
        const classesWithTodayData = Object.keys(counts).filter(c => counts[c].today > 0 && c !== selectedClass);
        if (classesWithTodayData.length > 0) {
          srcCls = classesWithTodayData[0];
        } else {
          // Cari kelas lain yang punya data apapun selain kelas aktif
          const anyClassWithData = Object.keys(counts).filter(c => counts[c].total > 0 && c !== selectedClass);
          if (anyClassWithData.length > 0) {
            srcCls = anyClassWithData[0];
          } else {
            const diffCls = classes.find(c => c.name !== selectedClass);
            srcCls = diffCls ? diffCls.name : selectedClass;
          }
        }
      }

      const activeSrcCls = srcCls || selectedClass;
      setCopySourceClass(activeSrcCls);
      setCopySourceDate(selectedDate);
      
      // Jika sumber adalah kelas yang sedang aktif, targetnya diarahkan ke kelas lain
      // Jika sumber dari kelas lain, targetnya otomatis ke kelas aktif saat ini
      if (activeSrcCls.trim().toLowerCase() === selectedClass.trim().toLowerCase()) {
        const otherClasses = classes.filter(c => c.name.trim().toLowerCase() !== selectedClass.trim().toLowerCase()).map(c => c.name);
        setCopyTargetClasses(otherClasses.length > 0 ? [otherClasses[0]] : [selectedClass]);
      } else {
        setCopyTargetClasses([selectedClass]);
      }

      setCopyTargetDate(selectedDate);
      setCopyFacilitatorMode('ME');
      setCopyCustomFacilitator(teachers[0]?.fullName || '');
      setCopyConflictMode('SKIP');
      setShowCopyModal(true);

      await fetchSourceJournals(activeSrcCls, selectedDate, initialJournalId);
    } catch (err) {
      console.error('Error opening copy modal:', err);
      setShowCopyModal(true);
    }
  };

  const handleQuickCopyRow = (item: CocurricularJournal) => {
    openCopyModal(item.className, item.id);
  };

  const handleUseInActiveForm = (journal: CocurricularJournal) => {
    setFormData(prev => ({
      ...prev,
      projectTheme: journal.projectTheme || prev.projectTheme,
      activities: journal.activities,
      notes: journal.notes || prev.notes
    }));
    setShowCopyModal(false);
    setIsFormOpen(true);
    showToast('success', `Isi kegiatan Jam ${journal.meetingNo} berhasil disalin ke formulir aktif`);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const toggleTargetClass = (clsName: string) => {
    setCopyTargetClasses(prev => 
      prev.includes(clsName) 
        ? (prev.length > 1 ? prev.filter(c => c !== clsName) : prev) 
        : [...prev, clsName]
    );
  };

  const toggleAllSourceJournals = () => {
    if (copySelectedJournalIds.length === copySourceAvailableJournals.length) {
      setCopySelectedJournalIds([]);
    } else {
      setCopySelectedJournalIds(copySourceAvailableJournals.map(j => j.id));
    }
  };

  const handleExecuteCopy = async () => {
    if (copySelectedJournalIds.length === 0) {
      showToast('error', 'Pilih minimal 1 entri kegiatan untuk disalin');
      return;
    }
    if (copyTargetClasses.length === 0) {
      showToast('error', 'Pilih minimal 1 kelas tujuan');
      return;
    }

    setIsCopying(true);
    try {
      const selectedSourceItems = copySourceAvailableJournals.filter(j => copySelectedJournalIds.includes(j.id));
      if (selectedSourceItems.length === 0) {
        showToast('error', 'Tidak ada data kegiatan sumber yang valid untuk disalin');
        return;
      }

      const dayName = getDayName(copyTargetDate);
      let totalCopied = 0;
      let totalSkipped = 0;
      const batchToSave: any[] = [];

      for (const targetCls of copyTargetClasses) {
        // Ambil data jurnal yang sudah ada di kelas tujuan & tanggal tujuan
        const existingInTarget = await db.cocurricularJournals
          .filter(j => !j.deleted && 
            ((j.className || '').trim().toLowerCase() === targetCls.trim().toLowerCase() || 
             (j.classId || '').trim().toLowerCase() === targetCls.trim().toLowerCase()) &&
            j.date === copyTargetDate
          )
          .toArray();

        const existingHourMap = new Map<number, CocurricularJournal>();
        existingInTarget.forEach(ex => {
          const s = Number(ex.meetingNo) || 1;
          const e = Number(ex.meetingNoEnd) || s;
          for (let h = s; h <= e; h++) {
            existingHourMap.set(h, ex);
          }
        });

        for (const src of selectedSourceItems) {
          const startHour = Number(src.meetingNo) || 1;
          const endHour = Number(src.meetingNoEnd) || startHour;

          // Cek apakah ada tabrakan jam
          let hasConflict = false;
          for (let h = startHour; h <= endHour; h++) {
            if (existingHourMap.has(h)) {
              hasConflict = true;
              break;
            }
          }

          if (hasConflict && copyConflictMode === 'SKIP') {
            totalSkipped++;
            continue;
          }

          // Tentukan fasilitator sesuai preferensi
          let facilitator = src.facilitatorName;
          if (copyFacilitatorMode === 'ME') {
            facilitator = user.fullName || user.username || 'Guru';
          } else if (copyFacilitatorMode === 'CUSTOM') {
            facilitator = copyCustomFacilitator || user.fullName || 'Guru';
          }

          // Jika timpa, hapus entri yang bertabrakan terlebih dahulu
          if (hasConflict && copyConflictMode === 'OVERWRITE') {
            for (let h = startHour; h <= endHour; h++) {
              const conflictEntry = existingHourMap.get(h);
              if (conflictEntry) {
                await deleteCocurricularJournal(conflictEntry.id);
                existingHourMap.delete(h);
              }
            }
          }

          const targetClassObj = classes.find(c => c.name.toLowerCase() === targetCls.toLowerCase());
          const targetClassId = targetClassObj?.id || targetCls;

          batchToSave.push({
            schoolNpsn: user.schoolNpsn || 'DEFAULT',
            userId: user.id,
            createdByName: user.fullName || user.username || 'Guru',
            facilitatorName: facilitator,
            classId: targetClassId,
            className: targetCls,
            date: copyTargetDate,
            dayName,
            meetingNo: startHour,
            meetingNoEnd: endHour > startHour ? endHour : undefined,
            activities: src.activities,
            projectTheme: src.projectTheme,
            targetDimension: src.targetDimension,
            notes: src.notes
          });
          totalCopied++;
        }
      }

      if (batchToSave.length > 0) {
        await bulkSaveCocurricularJournals(batchToSave);
      }

      setShowCopyModal(false);
      await loadJournals();
      await loadOtherClassesJournals();

      if (totalCopied > 0) {
        showToast('success', `Berhasil menyalin ${totalCopied} entri kegiatan ke kelas: ${copyTargetClasses.join(', ')}${totalSkipped > 0 ? ` (${totalSkipped} jam dilewati karena sudah ada isinya)` : ''}`);
      } else if (totalSkipped > 0) {
        showToast('error', `Semua ${totalSkipped} jam kegiatan dilewati karena kelas tujuan sudah memiliki isi (Opsi: Lewati).`);
      }
    } catch (err) {
      console.error('Copy journals execution error:', err);
      showToast('error', 'Gagal menyalin jurnal kokurikuler');
    } finally {
      setIsCopying(false);
    }
  };

  // Quick set hour when teacher clicks an hour pill
  const handleQuickSelectHour = (hour: number) => {
    const existing = filledHourMap.get(hour);
    if (existing) {
      handleEdit(existing);
    } else {
      setEditingId(null);
      const isGuru = user.role === 'GURU' || (user.role as string) === UserRole.GURU;
      setFormData(prev => ({
        ...prev,
        startHour: hour,
        endHour: hour,
        date: selectedDate,
        className: selectedClass,
        classId: selectedClass,
        facilitatorName: isGuru ? (user.fullName || '') : (teachers[0]?.fullName || '')
      }));
      setIsFormOpen(true);
    }
  };

  // --- FORM SUBMIT HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.activities.trim()) {
      showToast('error', 'Uraian kegiatan wajib diisi');
      return;
    }

    try {
      const dayName = getDayName(formData.date);
      const start = Number(formData.startHour);
      const end = Number(formData.endHour) >= start ? Number(formData.endHour) : start;

      if (editingId) {
        // Edit single entry
        await saveCocurricularJournal({
          id: editingId,
          schoolNpsn: user.schoolNpsn || 'DEFAULT',
          userId: user.id,
          createdByName: user.fullName || user.username || 'Guru',
          facilitatorName: formData.facilitatorName.trim() || user.fullName,
          classId: formData.classId,
          className: formData.className,
          date: formData.date,
          dayName,
          meetingNo: start,
          meetingNoEnd: end > start ? end : undefined,
          activities: formData.activities.trim(),
          projectTheme: formData.projectTheme,
          notes: formData.notes.trim()
        });
        showToast('success', 'Jurnal berhasil diperbarui');
      } else {
        // Creating new entry
        if (formData.isSeparateHours && end > start) {
          // Create multiple individual rows (Jam 2, Jam 3, Jam 4...) matching exact image table rows!
          const batchItems: any[] = [];
          for (let h = start; h <= end; h++) {
            batchItems.push({
              schoolNpsn: user.schoolNpsn || 'DEFAULT',
              userId: user.id,
              createdByName: user.fullName || user.username || 'Guru',
              facilitatorName: formData.facilitatorName.trim() || user.fullName,
              classId: formData.classId,
              className: formData.className,
              date: formData.date,
              dayName,
              meetingNo: h,
              meetingNoEnd: undefined,
              activities: formData.activities.trim(),
              projectTheme: formData.projectTheme,
              notes: formData.notes.trim()
            });
          }
          await bulkSaveCocurricularJournals(batchItems);
          showToast('success', `${batchItems.length} jam jurnal berhasil ditambahkan`);
        } else {
          // Single row or range row
          await saveCocurricularJournal({
            schoolNpsn: user.schoolNpsn || 'DEFAULT',
            userId: user.id,
            createdByName: user.fullName || user.username || 'Guru',
            facilitatorName: formData.facilitatorName.trim() || user.fullName,
            classId: formData.classId,
            className: formData.className,
            date: formData.date,
            dayName,
            meetingNo: start,
            meetingNoEnd: end > start ? end : undefined,
            activities: formData.activities.trim(),
            projectTheme: formData.projectTheme,
            notes: formData.notes.trim()
          });
          showToast('success', 'Jurnal kokurikuler berhasil disimpan');
        }
      }

      // Reset form
      setEditingId(null);
      setFormData(prev => ({
        ...prev,
        startHour: end + 1 <= 10 ? end + 1 : 1,
        endHour: end + 1 <= 10 ? end + 1 : 1,
        activities: '',
        notes: ''
      }));

      await loadJournals();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('error', 'Gagal menyimpan jurnal');
    }
  };

  const handleEdit = (journal: CocurricularJournal) => {
    setEditingId(journal.id);
    setSelectedDate(journal.date);
    setSelectedClass(journal.className);
    setFormData({
      date: journal.date,
      className: journal.className,
      classId: journal.classId,
      startHour: Number(journal.meetingNo) || 1,
      endHour: Number(journal.meetingNoEnd) || Number(journal.meetingNo) || 1,
      isSeparateHours: false,
      facilitatorName: journal.facilitatorName || '',
      projectTheme: journal.projectTheme || P5_THEMES[0],
      activities: journal.activities || '',
      notes: journal.notes || ''
    });
    setIsFormOpen(true);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus entri jurnal ini?')) return;
    try {
      await deleteCocurricularJournal(id);
      showToast('success', 'Entri jurnal telah dihapus');
      loadJournals();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('error', 'Gagal menghapus jurnal');
    }
  };

  // --- GROUPING FOR OFFICIAL TABLE VIEW WITH ROWSPAN ---
  // Group journals by Date + Class for identical look as the user's image
  const groupedJournals = useMemo(() => {
    let filtered = journals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(j => 
        j.activities?.toLowerCase().includes(q) ||
        j.facilitatorName?.toLowerCase().includes(q) ||
        j.className?.toLowerCase().includes(q) ||
        j.projectTheme?.toLowerCase().includes(q)
      );
    }

    const groups: {
      groupKey: string;
      date: string;
      dayName: string;
      className: string;
      items: CocurricularJournal[];
    }[] = [];

    const map = new Map<string, typeof groups[0]>();

    filtered.forEach(j => {
      const key = `${j.date}__${j.className}`;
      if (!map.has(key)) {
        const item = {
          groupKey: key,
          date: j.date,
          dayName: j.dayName || getDayName(j.date),
          className: j.className,
          items: []
        };
        map.set(key, item);
        groups.push(item);
      }
      map.get(key)!.items.push(j);
    });

    // Sort items inside each group by meetingNo
    groups.forEach(g => {
      g.items.sort((a, b) => (Number(a.meetingNo) || 0) - (Number(b.meetingNo) || 0));
    });

    return groups;
  }, [journals, searchQuery]);

  // Export to Excel
  const handleExportExcel = () => {
    if (journals.length === 0) {
      showToast('error', 'Tidak ada data jurnal untuk diekspor');
      return;
    }

    const rows = journals.map((j, idx) => ({
      'NO': idx + 1,
      'HARI / TANGGAL': `${j.dayName || getDayName(j.date)}, ${j.date}`,
      'KELAS': j.className,
      'JAM KE': j.meetingNoEnd ? `${j.meetingNo} - ${j.meetingNoEnd}` : j.meetingNo,
      'TEMA / PROYEK': j.projectTheme || '-',
      'URAIAN KEGIATAN': j.activities,
      'FASILITATOR': j.facilitatorName,
      'TANDA TANGAN': ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Kokurikuler');
    XLSX.writeFile(wb, `Jurnal_Kokurikuler_${selectedClass}_${selectedDate}.xlsx`);
    showToast('success', 'File Excel berhasil diunduh');
  };

  // Trigger print
  const handlePrint = () => {
    window.print();
  };

  // Build rows for print sheet according to user's uploaded image!
  const printableData = useMemo(() => {
    // Current group for active date and class
    const items = dailyJournalsForActiveContext.slice().sort((a, b) => (Number(a.meetingNo) || 0) - (Number(b.meetingNo) || 0));
    
    if (!printIncludeEmptyRows) {
      return items.map((item, idx) => ({
        no: idx + 1,
        hour: item.meetingNoEnd ? `${item.meetingNo} - ${item.meetingNoEnd}` : item.meetingNo,
        activity: item.activities,
        facilitator: item.facilitatorName,
        isFilled: true
      }));
    }

    // Build comprehensive rows up to printMaxHour (e.g. Jam 2 to 10 or Jam 1 to 10)
    // Looking at the user's uploaded image, rows start at Jam 2 up to Jam 10!
    // We can list hours 1 to printMaxHour, filling matched hours and leaving unmatched ones empty
    const rows = [];
    let rowNumber = 1;

    for (let h = 2; h <= printMaxHour; h++) {
      // Find matching journal
      const matched = items.find(j => {
        const start = Number(j.meetingNo);
        const end = Number(j.meetingNoEnd) || start;
        return h >= start && h <= end;
      });

      rows.push({
        no: rowNumber++,
        hour: h,
        activity: matched ? matched.activities : '',
        facilitator: matched ? matched.facilitatorName : '',
        isFilled: !!matched
      });
    }

    return rows;
  }, [dailyJournalsForActiveContext, printIncludeEmptyRows, printMaxHour]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Layers size={22} className="stroke-[2.2]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Jurnal Kokurikuler Bersama
                    <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Shared Workspace
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kolaborasi tim fasilitator per kelas & tanggal. Setiap guru dapat melihat dan menyambung kegiatan jam sebelumnya.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSyncPull(true)}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-xs disabled:opacity-50"
                title="Tarik data jurnal terbaru yang telah diisi oleh guru lain dari Cloud Server"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-600" : "text-indigo-600"} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
              </button>

              <button
                type="button"
                onClick={() => openCopyModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 hover:border-emerald-400 transition-colors shadow-xs"
                title="Salin jurnal yang sudah terisi dari kelas lain ke kelas ini"
              >
                <Copy size={15} className="text-emerald-700" />
                <span>Salin dari Kelas Lain</span>
              </button>

              <button
                type="button"
                onClick={openPrintModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-xs"
                title="Cetak format lembar jurnal resmi"
              >
                <Printer size={15} className="text-slate-600" />
                <span>Cetak Jurnal Resmi</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                title="Ekspor data ke Excel"
              >
                <FileText size={15} />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  const isGuru = user.role === 'GURU' || (user.role as string) === UserRole.GURU;
                  setFormData({
                    date: selectedDate,
                    className: selectedClass,
                    classId: selectedClass,
                    startHour: nextUnfilledHour,
                    endHour: nextUnfilledHour,
                    isSeparateHours: true,
                    facilitatorName: isGuru ? (user.fullName || '') : (teachers[0]?.fullName || ''),
                    projectTheme: P5_THEMES[0],
                    activities: '',
                    notes: ''
                  });
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Plus size={15} />
                <span>Input Jurnal Jam Ini</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* CONTEXT SELECTOR & FILTER BAR */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Class & Date Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Pilih Kelas / Rombel
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedClass}
                    onChange={(e) => handleSelectClass(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {classes.length > 0 ? (
                      classes.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="XII">Kelas XII</option>
                        <option value="XI">Kelas XI</option>
                        <option value="X">Kelas X</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Pilih Tanggal Kegiatan
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleSelectDate(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectDate(getLocalDate())}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 rounded border border-indigo-100"
                  >
                    Hari Ini
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cakupan Data
                </label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as any)}
                  className="bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="DATE_AND_CLASS">Tanggal & Kelas Terpilih</option>
                  <option value="ALL_CLASSES">Semua Kelas pada Tanggal Ini</option>
                  <option value="ALL_DATES">Semua Tanggal Kelas Terpilih</option>
                </select>
              </div>
            </div>

            {/* Search Filter */}
            <div className="w-full lg:w-72">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Cari Kegiatan / Fasilitator
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

          </div>
        </div>

        {/* HOUR TIMELINE TRACKER (INDIKATOR KETERISIAN JAM KOKURIKULER) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Status Alur Jam Kokurikuler
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {formatIndonesianDate(selectedDate)} • Kelas {selectedClass}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Terisi ({dailyJournalsForActiveContext.length} Jam)
              </span>
              <span className="flex items-center gap-1.5 font-medium ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                Belum Terisi
              </span>
            </div>
          </div>

          {/* Hour Pills Bar (Jam 1 to 10) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(hour => {
              const item = filledHourMap.get(hour);
              const isFilled = !!item;

              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleQuickSelectHour(hour)}
                  className={`p-2.5 rounded-lg text-left transition-all border ${
                    isFilled 
                      ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100 text-emerald-900 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500 hover:border-slate-300'
                  }`}
                  title={isFilled ? `Jam ${hour} terisi oleh: ${item.facilitatorName}. Klik untuk edit.` : `Jam ${hour} belum diisi. Klik untuk input.`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold ${isFilled ? 'text-emerald-800' : 'text-slate-600'}`}>
                      Jam {hour}
                    </span>
                    {isFilled ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">+</span>
                    )}
                  </div>
                  <div className="text-[11px] truncate font-medium">
                    {isFilled ? (
                      <span className="text-emerald-700 font-semibold">{item.facilitatorName}</span>
                    ) : (
                      <span className="text-slate-400 italic">Kosong</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Collaborative Advice Banner */}
          <div className="mt-3.5 bg-slate-50 rounded-lg p-3 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2 leading-relaxed">
              <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong>Info Jurnal Bersama:</strong> Semua fasilitator yang mengampu kelas ini dapat langsung melihat apa yang telah diajarkan pada jam sebelumnya. Fasilitator jam berikutnya (misal Jam {nextUnfilledHour}) dapat langsung menekan tombol{' '}
                <button 
                  type="button"
                  onClick={() => handleQuickSelectHour(nextUnfilledHour)}
                  className="text-indigo-600 font-bold underline hover:text-indigo-800 inline-block"
                >
                  "Isi Jam {nextUnfilledHour}"
                </button>{' '}
                untuk menjaga kesinambungan tahapan proyek.
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCopyModal()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg transition-colors shrink-0 shadow-2xs self-start sm:self-auto"
              title="Salin jurnal dari kelas lain jika kegiatan proyek paralel sama"
            >
              <Copy size={13} className="text-emerald-700" />
              <span>Salin dari Kelas Lain</span>
            </button>
          </div>

          {/* Smart Recommendation Banner jika kelas lain memiliki jurnal pada tanggal yang sama */}
          {otherClassesWithData.length > 0 && (
            <div className="mt-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border border-emerald-300/80 rounded-xl p-3.5 sm:p-4 text-xs shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
                    <Zap size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        Tersedia Jurnal Kokurikuler dari Kelas Lain pada Tanggal Ini!
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Rekomendasi Salin
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      Ditemukan data jurnal terisi dari kelas paralel untuk {formatIndonesianDate(selectedDate)}:{' '}
                      {otherClassesWithData.map(c => (
                        <span key={c.className} className="inline-flex items-center gap-1 font-semibold text-emerald-900 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded mr-1.5 mt-1 text-[11px] shadow-3xs">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Kelas {c.className} ({c.count} Jam)
                        </span>
                      ))}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
                  {otherClassesWithData.slice(0, 2).map(c => (
                    <button
                      key={c.className}
                      type="button"
                      disabled={isQuickCopying}
                      onClick={() => handleQuickCopyAllFromClass(c.className)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-2xs disabled:opacity-50 text-xs"
                      title={`Salin seluruh kegiatan dari Kelas ${c.className} ke Kelas ${selectedClass}`}
                    >
                      <Zap size={13} className={isQuickCopying ? "animate-spin" : ""} />
                      <span>{isQuickCopying ? 'Menyalin...' : `Salin dari ${c.className} (1-Klik)`}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => openCopyModal(otherClassesWithData[0]?.className)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold rounded-lg transition shadow-2xs text-xs"
                  >
                    <Copy size={13} className="text-emerald-700" />
                    <span>Pilih Jam / Kustomisasi...</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INPUT FORM (COLLAPSIBLE / MODULAR) */}
        {isFormOpen && (
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingId ? 'Edit Entri Jurnal Kokurikuler' : 'Formulir Pengisian Jurnal Kokurikuler Bersama'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCopyModal()}
                  className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md transition-colors font-medium"
                  title="Ambil atau salin uraian materi dari kelas lain ke form ini"
                >
                  <Copy size={13} />
                  <span>Ambil dari Kelas Lain</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                  title="Tutup Form"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hari & Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {formatIndonesianDate(formData.date)}
                  </span>
                </div>

                {/* Kelas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelas / Rombel
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.className}
                    onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value, classId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Contoh: XII, XII-1, Fase F"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Tampil pada kolom KELAS di cetak
                  </span>
                </div>

                {/* Jam Ke (Mulai & Selesai) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Ke (Mulai - Selesai)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.startHour}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          startHour: val,
                          endHour: prev.endHour < val ? val : prev.endHour
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                        <option key={h} value={h}>Jam {h}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400 font-bold">s/d</span>
                    <select
                      value={formData.endHour}
                      onChange={(e) => setFormData(prev => ({ ...prev, endHour: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                        <option key={h} value={h} disabled={h < formData.startHour}>
                          Jam {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.endHour > formData.startHour && !editingId && (
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSeparateHours}
                        onChange={(e) => setFormData(prev => ({ ...prev, isSeparateHours: e.target.checked }))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 text-xs"
                      />
                      <span className="text-[11px] text-indigo-700 font-medium">
                        Simpan baris per jam (Jam {formData.startHour} s.d. {formData.endHour})
                      </span>
                    </label>
                  )}
                </div>

                {/* Fasilitator */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Nama Fasilitator (Guru)</span>
                    <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Khusus Level Guru ({teachers.length})
                    </span>
                  </label>
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      value={formData.facilitatorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, facilitatorName: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Nama guru fasilitator"
                    />
                    {teachers.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData(prev => ({ ...prev, facilitatorName: e.target.value }));
                          }
                        }}
                        className="w-full text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 cursor-pointer hover:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={teachers.some(t => t.fullName === formData.facilitatorName) ? formData.facilitatorName : ""}
                      >
                        <option value="" disabled>Pilih dari daftar akun guru...</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.fullName}>
                            {t.fullName} {t.nip ? `(NIP: ${t.nip})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

              </div>

              {/* Tema / Dimensi Proyek P5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tema Proyek Kokurikuler / P5 (Opsional)
                  </label>
                  <select
                    value={formData.projectTheme}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectTheme: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {P5_THEMES.map(theme => (
                      <option key={theme} value={theme}>{theme}</option>
                    ))}
                    <option value="Lainnya">Tema Khusus Lainnya</option>
                  </select>
                </div>

                {/* Quick Templates Chips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Template Cepat Uraian Kegiatan Proyek
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {ACTIVITY_TEMPLATES.map((tmpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, activities: tmpl }))}
                        className="text-[11px] text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded border border-slate-200 transition-colors text-left truncate max-w-full"
                        title={tmpl}
                      >
                        + {tmpl.slice(0, 38)}...
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* FITUR SALIN CEPAT DARI KELAS LAIN UNTUK FORMULIR */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-md shrink-0">
                      <Copy size={13} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-950">
                        Salin Uraian Kegiatan dari Kelas Lain
                      </span>
                      <p className="text-[11px] text-emerald-700">
                        Pilih kegiatan yang sudah terisi di kelas lain agar uraian & tema langsung masuk ke form ini:
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCopyModal()}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100/70 border border-emerald-300 px-2.5 py-1 rounded-lg transition shadow-3xs self-start sm:self-auto shrink-0"
                  >
                    <Layers size={12} />
                    <span>Buka Dialog Salin Lengkap</span>
                  </button>
                </div>

                {otherClassesJournals.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      onChange={(e) => {
                        const jId = e.target.value;
                        if (!jId) return;
                        const chosen = otherClassesJournals.find(j => j.id === jId);
                        if (chosen) {
                          setFormData(prev => ({
                            ...prev,
                            projectTheme: chosen.projectTheme || prev.projectTheme,
                            activities: chosen.activities,
                            notes: chosen.notes || prev.notes
                          }));
                          showToast('success', `Uraian kegiatan dari Kelas ${chosen.className} Jam ${chosen.meetingNo} berhasil diterapkan ke formulir`);
                        }
                      }}
                      className="w-full bg-white border border-emerald-300 text-slate-800 text-xs rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        -- Pilih entri jurnal kelas lain pada {formatIndonesianDate(selectedDate)} ({otherClassesJournals.length} tersedia) --
                      </option>
                      {otherClassesJournals.map(j => (
                        <option key={j.id} value={j.id}>
                          [Kelas {j.className}] Jam {j.meetingNoEnd ? `${j.meetingNo}-${j.meetingNoEnd}` : j.meetingNo} • Fasilitator: {j.facilitatorName} — {j.activities.slice(0, 70)}...
                        </option>
                      ))}
                    </select>

                    {/* Quick click preview chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold text-emerald-800 shrink-0">Klik cepat 1-ketuk:</span>
                      {otherClassesJournals.slice(0, 4).map(j => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              projectTheme: j.projectTheme || prev.projectTheme,
                              activities: j.activities,
                              notes: j.notes || prev.notes
                            }));
                            showToast('success', `Uraian kegiatan dari Kelas ${j.className} Jam ${j.meetingNo} berhasil diterapkan ke formulir`);
                          }}
                          className="text-[10px] font-semibold bg-white hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200 px-2 py-1 rounded transition flex items-center gap-1 text-left max-w-xs truncate shadow-3xs"
                          title={j.activities}
                        >
                          <span className="font-bold text-emerald-950">[{j.className} Jam {j.meetingNo}]</span>
                          <span className="truncate">{j.activities.slice(0, 32)}...</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : recentOtherJournals.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Belum ada entri kelas lain pada tanggal ini. Anda dapat menyalin dari entri terbaru kelas lain sebelumnya:
                    </p>
                    <select
                      onChange={(e) => {
                        const jId = e.target.value;
                        if (!jId) return;
                        const chosen = recentOtherJournals.find(j => j.id === jId);
                        if (chosen) {
                          setFormData(prev => ({
                            ...prev,
                            projectTheme: chosen.projectTheme || prev.projectTheme,
                            activities: chosen.activities,
                            notes: chosen.notes || prev.notes
                          }));
                          showToast('success', `Uraian kegiatan dari Kelas ${chosen.className} (${formatIndonesianDate(chosen.date)}) berhasil diterapkan ke formulir`);
                        }
                      }}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Pilih dari arsip kegiatan kelas lain sebelumnya --</option>
                      {recentOtherJournals.map(j => (
                        <option key={j.id} value={j.id}>
                          [Kelas {j.className}] {formatIndonesianDate(j.date)} • Jam {j.meetingNo} — {j.activities.slice(0, 65)}...
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Belum ada jurnal dari kelas lain yang tersimpan di sistem.
                  </p>
                )}
              </div>

              {/* Uraian Kegiatan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Uraian Kegiatan Pembelajaran Proyek <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Mendukung rumus/simbol matematika jika menggunakan format <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">$...$</code>
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={formData.activities}
                  onChange={(e) => setFormData(prev => ({ ...prev, activities: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-normal focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                  placeholder="Tuliskan aktivitas siswa, pendampingan fasilitator, dan capaian target pada jam ini..."
                />

                {/* KaTeX Live Preview if formula present */}
                {formData.activities && /(\$|\\)/.test(formData.activities) && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Pratinjau Simbol / Rumus Eksakta:
                    </span>
                    <MathView text={formData.activities} />
                  </div>
                )}
              </div>

              {/* Submit / Reset Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData(prev => ({
                      ...prev,
                      activities: '',
                      notes: ''
                    }));
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Batal / Bersihkan
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{editingId ? 'Simpan Perubahan' : 'Simpan ke Jurnal Bersama'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TABEL RIWAYAT JURNAL BERSAMA (SESUAI DENGAN FORMAT GAMBAR) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Tabel Lembar Jurnal Kokurikuler</span>
                <span className="text-xs font-medium text-slate-500">
                  ({groupedJournals.reduce((acc, g) => acc + g.items.length, 0)} entri kegiatan)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Format tabel resmi: Hari/Tanggal & Kelas digabung secara vertikal sesuai lembar cetak fisik sekolah.
              </p>
            </div>

            <button
              type="button"
              onClick={openPrintModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors self-start sm:self-auto"
            >
              <Printer size={14} />
              <span>Pratinjau & Cetak Lembar Ini</span>
            </button>
          </div>

          {/* TABLE CONTAINER */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-12">NO</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200 w-44">HARI/TANGGAL</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-24">KELAS</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-20">JAM KE</th>
                  <th className="py-3 px-4 border-r border-slate-200">URAIAN KEGIATAN</th>
                  <th className="py-3 px-4 border-r border-slate-200 w-44">FASILITATOR</th>
                  <th className="py-3 px-3 text-center w-28">TANDA TANGAN / AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {groupedJournals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center">
                      <div className="max-w-xl mx-auto flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                          <BookOpen size={28} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            Belum Ada Entri Jurnal Kokurikuler untuk {selectedClass === 'ALL' ? 'Semua Kelas' : `Kelas ${selectedClass}`}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Tanggal: <span className="font-semibold text-slate-700">{formatIndonesianDate(selectedDate)}</span>
                          </p>
                        </div>

                        {otherClassesWithData.length > 0 ? (
                          <div className="w-full bg-emerald-50/90 border border-emerald-300 rounded-xl p-4 text-left mt-2 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="p-1 bg-emerald-600 text-white rounded-md">
                                <Zap size={13} />
                              </span>
                              <span className="text-xs font-bold text-emerald-950">
                                Rekomendasi: Tersedia Jurnal Terisi dari Kelas Lain pada Tanggal Ini!
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 mb-3">
                              Rekan guru telah mengisi kegiatan kokurikuler untuk kelas berikut. Anda dapat langsung menyalinnya ke Kelas {selectedClass}:
                            </p>
                            <div className="space-y-2">
                              {otherClassesWithData.map(c => (
                                <div 
                                  key={c.className} 
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-emerald-200"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-800">
                                        Kelas {c.className}
                                      </span>
                                      <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100/80 px-2 py-0.5 rounded">
                                        {c.count} Jam Terisi
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                      {c.items[0]?.activities || ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isQuickCopying}
                                      onClick={() => handleQuickCopyAllFromClass(c.className)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-3xs disabled:opacity-50"
                                    >
                                      <Zap size={12} className={isQuickCopying ? "animate-spin" : ""} />
                                      <span>Salin Semua Jam ({c.count})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openCopyModal(c.className)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 rounded-lg transition"
                                    >
                                      <span>Pilih Jam...</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Gunakan tombol di bawah untuk mengisi jurnal jam ini atau salin dari kelas/tanggal lain.
                          </span>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              const isGuru = user.role === 'GURU' || (user.role as string) === UserRole.GURU;
                              setFormData({
                                date: selectedDate,
                                className: selectedClass,
                                classId: selectedClass,
                                startHour: nextUnfilledHour,
                                endHour: nextUnfilledHour,
                                isSeparateHours: true,
                                facilitatorName: isGuru ? (user.fullName || '') : (teachers[0]?.fullName || ''),
                                projectTheme: P5_THEMES[0],
                                activities: '',
                                notes: ''
                              });
                              setIsFormOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-3xs"
                          >
                            <Plus size={14} />
                            <span>Input Jurnal Baru</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCopyModal()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition"
                          >
                            <Copy size={13} className="text-emerald-700" />
                            <span>Buka Dialog Salin</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedJournals.map(group => {
                    let runningNo = 1;
                    return group.items.map((item, idx) => {
                      const isFirstInGroup = idx === 0;
                      const formattedDate = formatIndonesianDate(group.date);

                      return (
                        <tr 
                          key={item.id} 
                          className="hover:bg-indigo-50/30 transition-colors group"
                        >
                          {/* NO */}
                          <td className="py-3.5 px-3 text-center font-medium text-slate-700 border-r border-slate-200">
                            {runningNo++}
                          </td>

                          {/* HARI/TANGGAL (ROW-SPANNED LIKE IN THE IMAGE) */}
                          {isFirstInGroup && (
                            <td 
                              rowSpan={group.items.length} 
                              className="py-3.5 px-4 text-slate-900 font-semibold align-middle text-center bg-white border-r border-slate-200"
                            >
                              {formattedDate}
                            </td>
                          )}

                          {/* KELAS (ROW-SPANNED LIKE IN THE IMAGE) */}
                          {isFirstInGroup && (
                            <td 
                              rowSpan={group.items.length} 
                              className="py-3.5 px-3 text-slate-900 font-bold align-middle text-center bg-white border-r border-slate-200"
                            >
                              {group.className}
                            </td>
                          )}

                          {/* JAM KE */}
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800 border-r border-slate-200">
                            {item.meetingNoEnd ? `${item.meetingNo} - ${item.meetingNoEnd}` : item.meetingNo}
                          </td>

                          {/* URAIAN KEGIATAN */}
                          <td className="py-3.5 px-4 text-slate-800 leading-relaxed border-r border-slate-200">
                            {item.projectTheme && (
                              <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5 mb-1 border border-indigo-100">
                                {item.projectTheme}
                              </span>
                            )}
                            <div className="prose prose-xs max-w-none text-slate-800">
                              <MathView text={item.activities} />
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-1">
                                Catatan: {item.notes}
                              </p>
                            )}
                          </td>

                          {/* FASILITATOR */}
                          <td className="py-3.5 px-4 font-medium text-slate-800 border-r border-slate-200">
                            <div className="flex items-center gap-1.5">
                              <UserIcon size={13} className="text-slate-400 shrink-0" />
                              <span>{item.facilitatorName}</span>
                            </div>
                          </td>

                          {/* TANDA TANGAN / AKSI */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickCopyRow(item)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="Salin entri jam ini ke kelas lain"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Edit entri ini"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Hapus entri ini"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL SALIN JURNAL DARI KELAS LAIN */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-3 sm:p-5 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Copy size={22} className="text-emerald-200" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    Salin Jurnal Kokurikuler dari Kelas Lain
                  </h2>
                  <p className="text-xs text-emerald-100/90 mt-0.5">
                    Duplikat kegiatan proyek P5 yang sudah terisi di satu rombel ke rombel tujuan agar tidak perlu mengetik ulang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Tutup Modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-5 overflow-y-auto space-y-6">

              {/* LANGKAH 1: KELAS & TANGGAL SUMBER */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">
                      Pilih Kelas & Tanggal Sumber (Asal Salin)
                    </h3>
                  </div>
                  {copySourceAvailableJournals.length > 0 && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                      {copySourceAvailableJournals.length} Jam Kegiatan Tersedia
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Kelas Sumber */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kelas Asal (Yang Sudah Terisi)
                    </label>
                    <select
                      value={copySourceClass}
                      onChange={(e) => {
                        const newCls = e.target.value;
                        setCopySourceClass(newCls);
                        fetchSourceJournals(newCls, copySourceDate);
                      }}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {classes.length > 0 ? (
                        classes.map(c => {
                          const cnt = classesJournalCounts[c.name];
                          const countLabel = cnt ? (cnt.today > 0 ? `(${cnt.today} jam hari ini)` : cnt.total > 0 ? `(${cnt.total} jam)` : '') : '';
                          return (
                            <option key={c.id} value={c.name}>
                              {c.name} {countLabel}
                            </option>
                          );
                        })
                      ) : (
                        <option value={copySourceClass}>{copySourceClass}</option>
                      )}
                    </select>
                  </div>

                  {/* Tanggal Sumber */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Kegiatan Sumber
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={copySourceDate}
                        onChange={(e) => {
                          const newD = e.target.value;
                          setCopySourceDate(newD);
                          fetchSourceJournals(copySourceClass, newD);
                        }}
                        className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCopySourceDate(selectedDate);
                          fetchSourceJournals(copySourceClass, selectedDate);
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 shrink-0 transition-colors"
                        title="Gunakan tanggal yang sedang dibuka"
                      >
                        Tanggal Aktif
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tanggal Alternatif jika tanggal terpilih kosong */}
                {sourceClassDatesWithData.length > 0 && !sourceClassDatesWithData.includes(copySourceDate) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <p>
                        Pada tanggal <strong>{formatIndonesianDate(copySourceDate)}</strong> belum ada jurnal untuk <strong>{copySourceClass}</strong>.
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="font-semibold text-amber-800">Pilih tanggal yang memiliki jurnal:</span>
                        {sourceClassDatesWithData.slice(0, 5).map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setCopySourceDate(d);
                              fetchSourceJournals(copySourceClass, d);
                            }}
                            className="bg-white border border-amber-300 hover:border-emerald-500 text-amber-900 hover:text-emerald-700 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                          >
                            {formatIndonesianDate(d)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Daftar Entri Kegiatan Tersedia */}
                <div className="pt-2 border-t border-slate-200/80">
                  {isLoadingSourceJournals ? (
                    <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-emerald-600" />
                      <span className="text-xs">Memuat jurnal kegiatan kelas sumber...</span>
                    </div>
                  ) : copySourceAvailableJournals.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 bg-white rounded-lg border border-dashed border-slate-300 p-4">
                      <BookOpen size={24} className="mx-auto text-slate-300 mb-1.5" />
                      <p className="text-xs font-semibold text-slate-600">
                        Tidak ada entri jurnal terisi untuk {copySourceClass} pada {formatIndonesianDate(copySourceDate)}.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Silakan pilih kelas asal atau tanggal kegiatan lain yang telah diisi oleh fasilitator.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="font-semibold text-slate-700">
                          Pilih Jam Kegiatan ({copySelectedJournalIds.length} dari {copySourceAvailableJournals.length} terpilih):
                        </span>
                        <button
                          type="button"
                          onClick={toggleAllSourceJournals}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline"
                        >
                          {copySelectedJournalIds.length === copySourceAvailableJournals.length ? 'Batalkan Semua' : 'Pilih Semua Jam'}
                        </button>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {copySourceAvailableJournals.map(journal => {
                          const isChecked = copySelectedJournalIds.includes(journal.id);
                          return (
                            <div
                              key={journal.id}
                              onClick={() => {
                                setCopySelectedJournalIds(prev =>
                                  isChecked ? prev.filter(id => id !== journal.id) : [...prev, journal.id]
                                );
                              }}
                              className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                                isChecked 
                                  ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs' 
                                  : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-1 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                                    Jam Ke: {journal.meetingNoEnd ? `${journal.meetingNo} - ${journal.meetingNoEnd}` : journal.meetingNo}
                                  </span>
                                  {journal.projectTheme && (
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                      {journal.projectTheme}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-auto">
                                    <UserIcon size={11} />
                                    {journal.facilitatorName}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-normal">
                                  {journal.activities}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUseInActiveForm(journal);
                                }}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded transition-colors shrink-0 shadow-2xs"
                                title="Gunakan uraian kegiatan ini ke formulir input aktif"
                              >
                                Pakai di Form
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* LANGKAH 2: TARGET SALIN */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">
                    Pilih Target Kelas Tujuan & Pengaturan
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Pilihan Kelas Tujuan */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Kelas Tujuan (Bisa pilih lebih dari satu untuk menyalin sekaligus):
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setCopyTargetClasses([selectedClass])}
                          className="text-teal-700 hover:text-teal-800 font-medium underline"
                        >
                          Hanya Kelas Ini ({selectedClass})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            const otherClasses = classes.map(c => c.name).filter(Boolean);
                            setCopyTargetClasses(otherClasses.length > 0 ? otherClasses : [selectedClass]);
                          }}
                          className="text-teal-700 hover:text-teal-800 font-medium underline"
                        >
                          Pilih Semua Kelas
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                      {classes.length > 0 ? (
                        classes.map(c => {
                          const isSelected = copyTargetClasses.includes(c.name);
                          const isSameAsSource = c.name === copySourceClass;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleTargetClass(c.name)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                isSelected 
                                  ? 'bg-teal-600 text-white border-teal-700 shadow-2xs' 
                                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {isSelected && <Check size={12} />}
                              <span>{c.name}</span>
                              {isSameAsSource && (
                                <span className="text-[10px] opacity-75 font-normal ml-0.5">
                                  (Asal)
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-500 p-2">Tidak ada daftar kelas.</span>
                      )}
                    </div>
                  </div>

                  {/* Tanggal & Fasilitator Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Tanggal Tujuan */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Target Kegiatan
                      </label>
                      <input
                        type="date"
                        value={copyTargetDate}
                        onChange={(e) => setCopyTargetDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        {formatIndonesianDate(copyTargetDate)}
                      </span>
                    </div>

                    {/* Fasilitator di Kelas Tujuan */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Fasilitator di Kelas Tujuan
                      </label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="copyFacilitator"
                            checked={copyFacilitatorMode === 'ME'}
                            onChange={() => setCopyFacilitatorMode('ME')}
                            className="text-teal-600 focus:ring-teal-500"
                          />
                          <span>Gunakan nama saya: <strong>{user.fullName || 'Saya'}</strong></span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="copyFacilitator"
                            checked={copyFacilitatorMode === 'ORIGINAL'}
                            onChange={() => setCopyFacilitatorMode('ORIGINAL')}
                            className="text-teal-600 focus:ring-teal-500"
                          />
                          <span>Pertahankan nama fasilitator asli dari kelas sumber</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="copyFacilitator"
                            checked={copyFacilitatorMode === 'CUSTOM'}
                            onChange={() => setCopyFacilitatorMode('CUSTOM')}
                            className="text-teal-600 focus:ring-teal-500"
                          />
                          <span>Pilih guru lain...</span>
                        </label>
                        {copyFacilitatorMode === 'CUSTOM' && teachers.length > 0 && (
                          <select
                            value={copyCustomFacilitator}
                            onChange={(e) => setCopyCustomFacilitator(e.target.value)}
                            className="w-full mt-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            {teachers.map(t => (
                              <option key={t.id} value={t.fullName}>
                                {t.fullName}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Penanganan Jam yang Bertabrakan */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jika jam kegiatan sudah pernah diisi pada kelas tujuan:
                    </label>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="copyConflict"
                          checked={copyConflictMode === 'SKIP'}
                          onChange={() => setCopyConflictMode('SKIP')}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <span><strong>Lewati</strong> (Aman, jangan menimpa yang sudah ada)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="copyConflict"
                          checked={copyConflictMode === 'OVERWRITE'}
                          onChange={() => setCopyConflictMode('OVERWRITE')}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <span><strong>Timpa</strong> (Ganti data jam lama dengan data baru)</span>
                      </label>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600">
                {copySelectedJournalIds.length > 0 && copyTargetClasses.length > 0 ? (
                  <span>
                    Siap menyalin <strong>{copySelectedJournalIds.length} jam kegiatan</strong> ke{' '}
                    <strong>{copyTargetClasses.length} kelas</strong> ({copyTargetClasses.join(', ')}).
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    Pilih minimal 1 entri kegiatan sumber dan 1 kelas tujuan.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isCopying || copySelectedJournalIds.length === 0 || copyTargetClasses.length === 0}
                  onClick={handleExecuteCopy}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs flex items-center gap-2"
                >
                  {isCopying ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyalin Jurnal...</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>
                        Salin {copySelectedJournalIds.length} Jam ke {copyTargetClasses.length} Kelas
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL (EXACT REPLICA OF THE IMAGE) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:w-full print:rounded-none">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Pratinjau Cetak Jurnal Kokurikuler
                </h3>
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printIncludeEmptyRows}
                    onChange={(e) => setPrintIncludeEmptyRows(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 text-xs"
                  />
                  <span>Lengkapi baris s.d. Jam {printMaxHour} (seperti gambar)</span>
                </label>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                >
                  <Printer size={14} />
                  <span>Cetak Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sub-bar Konfigurasi Cetak: Nama Sekolah, Titimangsa (Tempat/Tanggal) & Penandatangan (Hanya Tampil di Layar, Tidak Dicetak) */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 text-xs print:hidden">
              
              {/* Baris 1: Nama Sekolah (KOP) & Titimangsa (Tempat/Tanggal) */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Building2 size={13} className="text-indigo-600 shrink-0" />
                  <span>Kop Sekolah:</span>
                  <input
                    type="text"
                    value={printSchoolName}
                    onChange={(e) => setPrintSchoolName(e.target.value)}
                    placeholder="Nama Sekolah Aktif"
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52 sm:w-64"
                    title="Nama Sekolah untuk KOP Jurnal (Otomatis diambil dari data sekolah aktif, dapat diedit)"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                    <MapPin size={12} className="text-amber-600 shrink-0" />
                    <span className="text-[11px] text-slate-400 font-medium">Tempat:</span>
                    <input
                      type="text"
                      value={printCity}
                      onChange={(e) => setPrintCity(e.target.value)}
                      placeholder="Sekolah"
                      className="text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-28 font-medium"
                      title="Tempat atau Kota Cetak Dokumen"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                    <span className="text-[11px] text-slate-400 font-medium">Tanggal:</span>
                    <input
                      type="text"
                      value={printDateText}
                      onChange={(e) => setPrintDateText(e.target.value)}
                      placeholder="09 September 2026"
                      className="text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-36 font-medium"
                      title="Format teks tanggal cetak (dapat diedit manual)"
                    />
                    <input
                      type="date"
                      value={printDateRaw}
                      onChange={(e) => handlePrintDateRawChange(e.target.value)}
                      className="w-4 h-4 cursor-pointer text-slate-500 hover:text-indigo-600 border-0 bg-transparent p-0"
                      title="Pilih tanggal dari kalender"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleResetTitimangsa}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 rounded px-2 py-1 transition-colors"
                    title="Kembalikan nama sekolah, tempat & tanggal cetak ke nilai default"
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Baris 2: Pejabat Penandatangan */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-slate-200/70">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Kepala Sekolah:</span>
                  {principalUser && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-600" />
                      Otomatis dari Akun Guru
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={printPrincipalName}
                    onChange={(e) => setPrintPrincipalName(e.target.value)}
                    placeholder="Nama Kepala Sekolah"
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                    title="Nama Kepala Sekolah"
                  />
                  <input
                    type="text"
                    value={printPrincipalNip}
                    onChange={(e) => setPrintPrincipalNip(e.target.value)}
                    placeholder="NIP Kepala Sekolah"
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
                    title="NIP Kepala Sekolah"
                  />
                </div>
              </div>

            </div>

            {/* Printable Paper Canvas */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
              <div ref={printAreaRef} className="print-sheet max-w-[210mm] mx-auto bg-white text-black font-serif text-[12px] leading-snug">
                
                {/* KOP / HEADER RESMI SEKOLAH */}
                <div className="text-center mb-5 pb-3 border-b-2 border-black">
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    {/* Teks Bersih untuk Cetak Fisik / PDF */}
                    <span className="hidden print:inline">
                      {printSchoolName || user.schoolName || 'PEMERINTAH PROVINSI / KABUPATEN'}
                    </span>
                    {/* Kontrol Interaktif pada Tampilan Layar */}
                    <span 
                      className="print:hidden inline-flex items-center justify-center gap-1 bg-amber-50/80 hover:bg-amber-100 border border-dashed border-amber-300 hover:border-amber-400 rounded px-2 py-0.5 transition-all shadow-2xs group cursor-pointer"
                      title="Edit manual Nama Sekolah pada KOP di sini"
                    >
                      <Building2 size={12} className="text-amber-600 shrink-0" />
                      <input
                        type="text"
                        value={printSchoolName}
                        onChange={(e) => setPrintSchoolName(e.target.value)}
                        placeholder="NAMA SEKOLAH"
                        className="bg-transparent border-b border-amber-400 focus:border-indigo-600 font-serif font-bold uppercase text-center px-1 text-sm text-slate-800 w-72 sm:w-96 focus:outline-none"
                        title="Edit manual Nama Sekolah pada KOP (otomatis terisi dari data sekolah aktif)"
                      />
                    </span>
                  </h2>
                  <h1 className="text-base font-extrabold uppercase mt-0.5 tracking-tight">
                    JURNAL KEGIATAN KOKURIKULER / PROYEK P5
                  </h1>
                  <p className="text-[11px] font-normal text-slate-700 mt-1">
                    Kelas: <strong>{selectedClass}</strong> • Hari, Tanggal: <strong>{formatIndonesianDate(selectedDate)}</strong> • Semester: Ganjil / Genap
                  </p>
                </div>

                {/* TABEL EXACT DENGAN IMAGE YANG DIUNGGAH USER */}
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="border border-black font-bold text-center bg-slate-50 print:bg-transparent">
                      <th className="border border-black py-2 px-2 w-[5%]">NO</th>
                      <th className="border border-black py-2 px-3 w-[22%]">HARI/TANGGAL</th>
                      <th className="border border-black py-2 px-2 w-[8%]">KELAS</th>
                      <th className="border border-black py-2 px-2 w-[8%]">JAM KE</th>
                      <th className="border border-black py-2 px-4 w-[35%]">URAIAN KEGIATAN</th>
                      <th className="border border-black py-2 px-3 w-[14%]">FASILITATOR</th>
                      <th className="border border-black py-2 px-2 w-[14%]">TANDA TANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printableData.map((row, index) => {
                      const isFirstRow = index === 0;

                      return (
                        <tr key={index} className="border border-black min-h-[44px]">
                          {/* NO */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle font-medium">
                            {row.no}
                          </td>

                          {/* HARI/TANGGAL (ROW-SPAN MENCAKUP SEMUA BARIS) */}
                          {isFirstRow && (
                            <td
                              rowSpan={printableData.length}
                              className="border border-black py-3 px-3 text-center align-middle font-semibold"
                            >
                              {formatIndonesianDate(selectedDate)}
                            </td>
                          )}

                          {/* KELAS (ROW-SPAN MENCAKUP SEMUA BARIS) */}
                          {isFirstRow && (
                            <td
                              rowSpan={printableData.length}
                              className="border border-black py-3 px-2 text-center align-middle font-bold"
                            >
                              {selectedClass}
                            </td>
                          )}

                          {/* JAM KE */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle font-semibold">
                            {row.hour}
                          </td>

                          {/* URAIAN KEGIATAN */}
                          <td className="border border-black py-2.5 px-3 align-middle leading-normal">
                            {row.activity ? (
                              <MathView text={row.activity} />
                            ) : (
                              <span className="text-transparent select-none">&nbsp;</span>
                            )}
                          </td>

                          {/* FASILITATOR */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle font-medium">
                            {row.facilitator || ''}
                          </td>

                          {/* TANDA TANGAN (KOTAK PARAF MANUAL) */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle h-11">
                            {/* Kotak paraf fisik kosong untuk guru tanda tangan di kertas */}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* TITIMANGSA & TANDA TANGAN PEJABAT */}
                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-[11px] leading-relaxed break-inside-avoid">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala Sekolah</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline">
                      {printPrincipalName || principalUser?.fullName || settings?.headmasterName || '...................................................'}
                    </p>
                    <p>NIP. {printPrincipalNip || principalUser?.nip || settings?.headmasterNip || '...................................................'}</p>
                  </div>

                  <div>
                    <p className="mb-0.5">
                      {/* Teks Bersih untuk Cetak Fisik / PDF */}
                      <span className="hidden print:inline">
                        {printCity || 'Sekolah'}, {printDateText || (formatIndonesianDate(selectedDate).split(', ')[1] || selectedDate)}
                      </span>
                      {/* Kontrol Interaktif pada Tampilan Layar */}
                      <span 
                        className="print:hidden inline-flex items-center justify-center gap-1 bg-amber-50/90 hover:bg-amber-100 border border-dashed border-amber-300 hover:border-amber-400 rounded px-2 py-0.5 transition-all shadow-2xs group cursor-pointer"
                        title="Edit manual tempat dan tanggal cetak di sini"
                      >
                        <MapPin size={11} className="text-amber-600 shrink-0" />
                        <input
                          type="text"
                          value={printCity}
                          onChange={(e) => setPrintCity(e.target.value)}
                          placeholder="Tempat"
                          className="bg-transparent border-b border-amber-400 focus:border-indigo-600 font-serif text-center px-1 text-[11px] text-slate-800 w-24 focus:outline-none"
                          title="Edit manual Tempat Cetak (misal: Sekolah / Padang)"
                        />
                        <span className="font-serif text-slate-700">,</span>
                        <input
                          type="text"
                          value={printDateText}
                          onChange={(e) => setPrintDateText(e.target.value)}
                          placeholder="Tanggal Cetak"
                          className="bg-transparent border-b border-amber-400 focus:border-indigo-600 font-serif text-center px-1 text-[11px] text-slate-800 w-32 focus:outline-none"
                          title="Edit manual Tanggal Cetak (misal: 09 September 2026)"
                        />
                        <input
                          type="date"
                          value={printDateRaw}
                          onChange={(e) => handlePrintDateRawChange(e.target.value)}
                          className="w-3.5 h-3.5 cursor-pointer opacity-70 hover:opacity-100 border-0 bg-transparent p-0 text-slate-600"
                          title="Pilih tanggal dari kalender"
                        />
                      </span>
                    </p>
                    <p className="font-semibold">Koordinator Kokurikuler / P5</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline">
                      {printCoordinatorName || user.fullName || '...................................................'}
                    </p>
                    <p>NIP. {printCoordinatorNip || user.nip || '...................................................'}</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden rounded-b-2xl">
              <span className="text-xs text-slate-500">
                Format tabel disesuaikan dengan standar format lembar kokurikuler/P5.
              </span>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT CSS STYLING */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-sheet, .print-sheet * {
            visibility: visible;
          }
          .print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
          }
        }
      `}</style>

    </div>
  );
};

export default CocurricularJournalManager;
