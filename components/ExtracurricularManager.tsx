import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, 
  UserRole, 
  ClassRoom, 
  Student, 
  ExtracurricularMember, 
  ExtracurricularJournal, 
  ExtracurricularAchievement, 
  ExtracurricularRole,
  ExtracurricularAttendanceItem,
  ExtracurricularAttendanceStatus,
  AchievementLevel,
  AchievementRank,
  DEFAULT_EXTRACURRICULARS 
} from '../types';
import { 
  getClasses, 
  getSchoolStudents, 
  getExtracurricularMembers, 
  saveExtracurricularMember, 
  saveBulkExtracurricularMembers,
  deleteExtracurricularMember, 
  getExtracurricularJournals, 
  saveExtracurricularJournal, 
  deleteExtracurricularJournal, 
  getExtracurricularAchievements, 
  saveExtracurricularAchievement, 
  deleteExtracurricularAchievement,
  getSystemSettings
} from '../services/database';
import { 
  Trophy, 
  Users, 
  CalendarCheck, 
  FileSpreadsheet, 
  Printer, 
  Plus, 
  Trash2, 
  Pencil, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  Award, 
  Clock, 
  MapPin, 
  NotebookPen, 
  ChevronDown, 
  UserPlus, 
  BookOpen, 
  ShieldCheck, 
  X, 
  Sparkles, 
  FileText, 
  Check, 
  RotateCcw,
  BarChart3,
  ExternalLink,
  IdCard,
  ChevronRight
} from './Icons';
import * as XLSX from 'xlsx';

interface ExtracurricularManagerProps {
  user: User;
}

const ROLES: ExtracurricularRole[] = [
  'Ketua',
  'Wakil Ketua',
  'Sekretaris',
  'Bendahara',
  'Koordinator Divisi',
  'Anggota'
];

const ACHIEVEMENT_LEVELS: AchievementLevel[] = [
  'Sekolah',
  'Kecamatan',
  'Kabupaten/Kota',
  'Provinsi',
  'Nasional',
  'Internasional'
];

const RANKS: AchievementRank[] = [
  'Juara 1',
  'Juara 2',
  'Juara 3',
  'Harapan 1',
  'Harapan 2',
  'Harapan 3',
  'Juara Favorit',
  'Finalis',
  'Peserta'
];

export const ExtracurricularManager: React.FC<ExtracurricularManagerProps> = ({ user }) => {
  // Available extracurriculars list for current user
  const userEkskuls = useMemo(() => {
    const list = user.extracurriculars && user.extracurriculars.length > 0
      ? user.extracurriculars
      : DEFAULT_EXTRACURRICULARS;
    return list;
  }, [user.extracurriculars]);

  // Active state
  const [selectedEkskul, setSelectedEkskul] = useState<string>(() => {
    if (user.extracurriculars && user.extracurriculars.length > 0) {
      return user.extracurriculars[0];
    }
    return 'Pramuka';
  });

  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>(
    new Date().getMonth() >= 6 ? 'Ganjil' : 'Genap'
  );
  const currentYear = new Date().getFullYear();
  const [academicYear, setAcademicYear] = useState<string>(
    `${currentYear}/${currentYear + 1}`
  );

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'journals' | 'achievements' | 'reports'>('overview');

  // Master Data
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  // Ekskul Data
  const [members, setMembers] = useState<ExtracurricularMember[]>([]);
  const [journals, setJournals] = useState<ExtracurricularJournal[]>([]);
  const [achievements, setAchievements] = useState<ExtracurricularAchievement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & UI Form States
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedClassForAdd, setSelectedClassForAdd] = useState<string>('ALL');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [selectedStudentIdsToAdd, setSelectedStudentIdsToAdd] = useState<string[]>([]);
  const [defaultRoleToAdd, setDefaultRoleToAdd] = useState<ExtracurricularRole>('Anggota');

  // Journal Form Modal
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<ExtracurricularJournal | null>(null);
  const [journalForm, setJournalForm] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    topic: string;
    skillsTrained: string;
    isEventPrep: boolean;
    evaluationNotes: string;
    obstacles: string;
    attendanceMap: Record<string, { status: ExtracurricularAttendanceStatus; note?: string }>;
  }>({
    date: new Date().toISOString().split('T')[0],
    startTime: '15:30',
    endTime: '17:00',
    location: 'Lapangan Utama / Ruang Ekskul',
    topic: '',
    skillsTrained: '',
    isEventPrep: false,
    evaluationNotes: '',
    obstacles: '',
    attendanceMap: {}
  });

  // Achievement Form Modal
  const [isAchievementModalOpen, setIsAchievementModalOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<ExtracurricularAchievement | null>(null);
  const [achievementForm, setAchievementForm] = useState<{
    eventName: string;
    date: string;
    organizer: string;
    level: AchievementLevel;
    rank: AchievementRank;
    participantStudentIds: string[];
    description: string;
    certificateUrl: string;
  }>({
    eventName: '',
    date: new Date().toISOString().split('T')[0],
    organizer: '',
    level: 'Kabupaten/Kota',
    rank: 'Juara 1',
    participantStudentIds: [],
    description: '',
    certificateUrl: ''
  });

  // Member Filter state
  const [memberClassFilter, setMemberClassFilter] = useState<string>('ALL');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('ALL');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Print Ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load all master data
  const loadMasterData = async () => {
    try {
      const [cls, st, setts] = await Promise.all([
        getClasses(user.id, user.schoolNpsn),
        getSchoolStudents(user.schoolNpsn || 'DEFAULT'),
        getSystemSettings()
      ]);
      setClasses(cls || []);
      setAllStudents(st || []);
      setSchoolSettings(setts || null);
    } catch (e) {
      console.error('Error loading master data:', e);
    }
  };

  // Load ekskul specific data
  const loadEkskulData = async () => {
    setLoading(true);
    try {
      const [mems, jrnls, achvs] = await Promise.all([
        getExtracurricularMembers(selectedEkskul, user.schoolNpsn),
        getExtracurricularJournals(selectedEkskul, undefined, selectedSemester, user.schoolNpsn),
        getExtracurricularAchievements(selectedEkskul, user.schoolNpsn)
      ]);
      setMembers(mems || []);
      setJournals(jrnls || []);
      setAchievements(achvs || []);
    } catch (err) {
      console.error('Error loading ekskul data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, [user.schoolNpsn]);

  useEffect(() => {
    loadEkskulData();
  }, [selectedEkskul, selectedSemester, academicYear, user.schoolNpsn]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const totalMeetings = journals.length;
    const totalAchievements = achievements.length;

    // Gender breakdown
    const maleCount = members.filter(m => {
      const st = allStudents.find(s => s.id === m.studentId);
      return st?.gender === 'L';
    }).length;
    const femaleCount = totalMembers - maleCount;

    // Average attendance rate across all journals
    let totalPossibleAttendance = totalMembers * totalMeetings;
    let totalActualPresent = 0;

    journals.forEach(j => {
      const presentCount = (j.attendance || []).filter(a => a.status === 'H').length;
      totalActualPresent += presentCount;
    });

    const averageAttendanceRate = totalPossibleAttendance > 0 
      ? Math.round((totalActualPresent / totalPossibleAttendance) * 100)
      : 100;

    return {
      totalMembers,
      totalMeetings,
      totalAchievements,
      maleCount,
      femaleCount,
      averageAttendanceRate
    };
  }, [members, journals, achievements, allStudents]);

  // Member attendance rate map in the active semester
  const memberAttendanceMap = useMemo(() => {
    const map: Record<string, { present: number; sakit: number; izin: number; alfa: number; totalMeetings: number; rate: number }> = {};
    
    members.forEach(m => {
      map[m.studentId] = {
        present: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        totalMeetings: journals.length,
        rate: 100
      };
    });

    journals.forEach(j => {
      const attMap = new Map((j.attendance || []).map(a => [a.studentId, a.status]));

      members.forEach(m => {
        const item = map[m.studentId];
        if (!item) return;

        const status = attMap.get(m.studentId) || 'H';
        if (status === 'H') item.present += 1;
        else if (status === 'S') item.sakit += 1;
        else if (status === 'I') item.izin += 1;
        else if (status === 'A') item.alfa += 1;
      });
    });

    // Calculate rates
    Object.keys(map).forEach(studentId => {
      const item = map[studentId];
      if (item.totalMeetings > 0) {
        item.rate = Math.round((item.present / item.totalMeetings) * 100);
      } else {
        item.rate = 100;
      }
    });

    return map;
  }, [members, journals]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesClass = memberClassFilter === 'ALL' || m.studentClassName === memberClassFilter;
      const matchesRole = memberRoleFilter === 'ALL' || m.role === memberRoleFilter;
      const matchesSearch = !memberSearchQuery || 
        m.studentName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        (m.studentNis && m.studentNis.includes(memberSearchQuery));
      return matchesClass && matchesRole && matchesSearch;
    });
  }, [members, memberClassFilter, memberRoleFilter, memberSearchQuery]);

  // Available students to add to ekskul
  const eligibleStudentsToAdd = useMemo(() => {
    const existingIds = new Set(members.map(m => m.studentId));
    return allStudents.filter(s => {
      const notInEkskul = !existingIds.has(s.id);
      const matchesClass = selectedClassForAdd === 'ALL' || s.classId === selectedClassForAdd;
      const matchesSearch = !memberSearchTerm || 
        s.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
        (s.nis && s.nis.includes(memberSearchTerm));
      return notInEkskul && matchesClass && matchesSearch;
    });
  }, [allStudents, members, selectedClassForAdd, memberSearchTerm]);

  // Handle Add Members Bulk
  const handleSaveBulkMembers = async () => {
    if (selectedStudentIdsToAdd.length === 0) return;

    const newMembers: ExtracurricularMember[] = selectedStudentIdsToAdd.map(stId => {
      const student = allStudents.find(s => s.id === stId);
      const cls = classes.find(c => c.id === student?.classId);
      return {
        id: `ekskul-mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        extracurricularName: selectedEkskul,
        studentId: stId,
        studentName: student?.name || 'Siswa',
        studentNis: student?.nis || '',
        studentClassId: student?.classId || '',
        studentClassName: cls?.name || 'Kelas',
        role: defaultRoleToAdd,
        schoolNpsn: user.schoolNpsn,
        joinedDate: new Date().toISOString().split('T')[0]
      };
    });

    await saveBulkExtracurricularMembers(newMembers);
    await loadEkskulData();
    setSelectedStudentIdsToAdd([]);
    setIsAddMemberModalOpen(false);
  };

  // Handle Update Member Role
  const handleUpdateMemberRole = async (member: ExtracurricularMember, newRole: ExtracurricularRole) => {
    const updated = { ...member, role: newRole };
    await saveExtracurricularMember(updated);
    setMembers(prev => prev.map(m => m.id === member.id ? updated : m));
  };

  // Handle Delete Member
  const handleDeleteMember = async (memberId: string, name: string) => {
    if (!window.confirm(`Keluarkan ${name} dari keanggotaan ekskul ${selectedEkskul}?`)) return;
    await deleteExtracurricularMember(memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  // Handle Open Journal Modal for Create/Edit
  const handleOpenJournalModal = (journal?: ExtracurricularJournal) => {
    if (journal) {
      setEditingJournal(journal);
      const attMap: Record<string, { status: ExtracurricularAttendanceStatus; note?: string }> = {};
      (journal.attendance || []).forEach(a => {
        attMap[a.studentId] = { status: a.status, note: a.note };
      });

      setJournalForm({
        date: journal.date,
        startTime: journal.startTime || '15:30',
        endTime: journal.endTime || '17:00',
        location: journal.location,
        topic: journal.topic,
        skillsTrained: journal.skillsTrained || '',
        isEventPrep: journal.isEventPrep || false,
        evaluationNotes: journal.evaluationNotes || '',
        obstacles: journal.obstacles || '',
        attendanceMap: attMap
      });
    } else {
      setEditingJournal(null);
      const initialMap: Record<string, { status: ExtracurricularAttendanceStatus; note?: string }> = {};
      members.forEach(m => {
        initialMap[m.studentId] = { status: 'H' };
      });

      setJournalForm({
        date: new Date().toISOString().split('T')[0],
        startTime: '15:30',
        endTime: '17:00',
        location: 'Lapangan / Ruang Ekskul',
        topic: '',
        skillsTrained: '',
        isEventPrep: false,
        evaluationNotes: '',
        obstacles: '',
        attendanceMap: initialMap
      });
    }
    setIsJournalModalOpen(true);
  };

  // Handle Save Journal
  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalForm.topic.trim()) {
      alert('Materi atau agenda latihan wajib diisi.');
      return;
    }

    const attendanceList: ExtracurricularAttendanceItem[] = members.map(m => {
      const att = journalForm.attendanceMap[m.studentId] || { status: 'H' };
      return {
        memberId: m.id,
        studentId: m.studentId,
        studentName: m.studentName,
        status: att.status,
        note: att.note
      };
    });

    const journalToSave: ExtracurricularJournal = {
      id: editingJournal ? editingJournal.id : `ekskul-jrn-${Date.now()}`,
      extracurricularName: selectedEkskul,
      coachId: user.id,
      coachName: user.fullName,
      semester: selectedSemester,
      academicYear: academicYear,
      date: journalForm.date,
      startTime: journalForm.startTime,
      endTime: journalForm.endTime,
      location: journalForm.location,
      topic: journalForm.topic,
      skillsTrained: journalForm.skillsTrained,
      isEventPrep: journalForm.isEventPrep,
      attendance: attendanceList,
      evaluationNotes: journalForm.evaluationNotes,
      obstacles: journalForm.obstacles,
      schoolNpsn: user.schoolNpsn
    };

    await saveExtracurricularJournal(journalToSave);
    await loadEkskulData();
    setIsJournalModalOpen(false);
  };

  // Handle Delete Journal
  const handleDeleteJournal = async (journalId: string, topicName: string) => {
    if (!window.confirm(`Hapus jurnal pertemuan "${topicName}"?`)) return;
    await deleteExtracurricularJournal(journalId);
    setJournals(prev => prev.filter(j => j.id !== journalId));
  };

  // Handle Open Achievement Modal for Create/Edit
  const handleOpenAchievementModal = (achievement?: ExtracurricularAchievement) => {
    if (achievement) {
      setEditingAchievement(achievement);
      setAchievementForm({
        eventName: achievement.eventName,
        date: achievement.date,
        organizer: achievement.organizer || '',
        level: achievement.level,
        rank: achievement.rank,
        participantStudentIds: (achievement.studentParticipants || []).map(p => p.studentId),
        description: achievement.description || '',
        certificateUrl: achievement.certificateUrl || ''
      });
    } else {
      setEditingAchievement(null);
      setAchievementForm({
        eventName: '',
        date: new Date().toISOString().split('T')[0],
        organizer: '',
        level: 'Kabupaten/Kota',
        rank: 'Juara 1',
        participantStudentIds: [],
        description: '',
        certificateUrl: ''
      });
    }
    setIsAchievementModalOpen(true);
  };

  // Handle Save Achievement
  const handleSaveAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!achievementForm.eventName.trim()) {
      alert('Nama event / kejuaraan wajib diisi.');
      return;
    }

    const participants = achievementForm.participantStudentIds.map(stId => {
      const mem = members.find(m => m.studentId === stId);
      const student = allStudents.find(s => s.id === stId);
      return {
        studentId: stId,
        studentName: mem?.studentName || student?.name || 'Siswa',
        studentClassName: mem?.studentClassName || ''
      };
    });

    const achievementToSave: ExtracurricularAchievement = {
      id: editingAchievement ? editingAchievement.id : `ekskul-achv-${Date.now()}`,
      extracurricularName: selectedEkskul,
      coachId: user.id,
      coachName: user.fullName,
      eventName: achievementForm.eventName,
      date: achievementForm.date,
      organizer: achievementForm.organizer,
      level: achievementForm.level,
      rank: achievementForm.rank,
      studentParticipants: participants,
      description: achievementForm.description,
      certificateUrl: achievementForm.certificateUrl,
      schoolNpsn: user.schoolNpsn
    };

    await saveExtracurricularAchievement(achievementToSave);
    await loadEkskulData();
    setIsAchievementModalOpen(false);
  };

  // Handle Delete Achievement
  const handleDeleteAchievement = async (id: string, name: string) => {
    if (!window.confirm(`Hapus data prestasi "${name}"?`)) return;
    await deleteExtracurricularAchievement(id);
    setAchievements(prev => prev.filter(a => a.id !== id));
  };

  // Export Roster to Excel
  const exportMembersToExcel = () => {
    const headers = ['No', 'Nama Siswa', 'NIS', 'Kelas', 'Jabatan / Posisi', 'Tanggal Bergabung'];
    const rows = members.map((m, idx) => [
      idx + 1,
      m.studentName,
      m.studentNis || '-',
      m.studentClassName,
      m.role,
      m.joinedDate || '-'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      [`DAFTAR ANGGOTA EKSTRAKURIKULER ${selectedEkskul.toUpperCase()}`],
      [`SEKOLAH: ${user.schoolName || 'EduAdmin'} | PEMBINA: ${user.fullName}`],
      [],
      headers,
      ...rows
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anggota');
    XLSX.writeFile(wb, `Anggota_${selectedEkskul}_${academicYear.replace('/', '-')}.xlsx`);
  };

  // Export Attendance & Report Card Recommendation to Excel
  const exportReportRecommendationsToExcel = () => {
    const headers = [
      'No', 
      'Nama Siswa', 
      'NIS', 
      'Kelas', 
      'Jabatan', 
      'Total Pertemuan', 
      'Hadir (H)', 
      'Sakit (S)', 
      'Izin (I)', 
      'Alfa (A)', 
      '% Kehadiran', 
      'Predikat Rapor', 
      'Deskripsi Capaian Rapor'
    ];

    const rows = members.map((m, idx) => {
      const att = memberAttendanceMap[m.studentId] || { present: 0, sakit: 0, izin: 0, alfa: 0, totalMeetings: 0, rate: 100 };
      
      let predikat = 'Sangat Baik';
      let deskripsi = `Sangat aktif dan berdedikasi tinggi dalam mengikuti seluruh kegiatan ekstrakurikuler ${selectedEkskul}. Menunjukkan disiplin yang sangat baik.`;

      if (att.rate >= 85) {
        predikat = 'Sangat Baik';
        deskripsi = `Sangat aktif dalam kegiatan ekstrakurikuler ${selectedEkskul}, menunjukkan kedisiplinan dan penguasaan materi latihan dengan sangat baik.`;
      } else if (att.rate >= 70) {
        predikat = 'Baik';
        deskripsi = `Aktif mengikuti latihan ekstrakurikuler ${selectedEkskul} dengan baik dan berpartisipasi cukup antusias dalam kegiatan.`;
      } else {
        predikat = 'Cukup';
        deskripsi = `Cukup mengikuti kegiatan ekstrakurikuler ${selectedEkskul}, perlu ditingkatkan frekuensi kehadiran dan keaktifannya.`;
      }

      if (m.role === 'Ketua' || m.role === 'Wakil Ketua' || m.role === 'Sekretaris' || m.role === 'Bendahara') {
        deskripsi += ` Berperan aktif sebagai pengurus (${m.role}) organisasi ekskul.`;
      }

      return [
        idx + 1,
        m.studentName,
        m.studentNis || '-',
        m.studentClassName,
        m.role,
        att.totalMeetings,
        att.present,
        att.sakit,
        att.izin,
        att.alfa,
        `${att.rate}%`,
        predikat,
        deskripsi
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [`REKAP KEHADIRAN & REKOMENDASI NILAI RAPOR EKSTRAKURIKULER ${selectedEkskul.toUpperCase()}`],
      [`SEMESTER ${selectedSemester.toUpperCase()} TAHUN AJARAN ${academicYear}`],
      [`PEMBINA: ${user.fullName} | SEKOLAH: ${user.schoolName || 'EduAdmin'}`],
      [],
      headers,
      ...rows
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Rapor');
    XLSX.writeFile(wb, `Rekap_Nilai_Ekskul_${selectedEkskul}_${selectedSemester}_${academicYear.replace('/', '-')}.xlsx`);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-amber-600 via-amber-700 to-orange-800 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold tracking-wide">
              <Trophy size={14} className="text-yellow-300" />
              <span>Portal Pembina Ekstrakurikuler</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Manajemen & Jurnal Ekstrakurikuler
            </h1>
            <p className="text-sm text-amber-100 max-w-2xl leading-relaxed">
              Kelola anggota lintas kelas, rekam jurnal agenda & presensi latihan rutin, catat perolehan prestasi lomba, serta cetak laporan resmi dan rekomendasi nilai rapor.
            </p>
          </div>

          {/* Ekskul Selector Card */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[260px] space-y-3">
            <div>
              <label className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block mb-1">
                Pilih Ekstrakurikuler
              </label>
              <div className="relative">
                <select
                  value={selectedEkskul}
                  onChange={(e) => setSelectedEkskul(e.target.value)}
                  className="w-full bg-white text-gray-900 font-bold text-sm px-3 py-2 rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-amber-300 outline-none shadow-sm pr-8"
                >
                  {userEkskuls.map(e => (
                    <option key={e} value={e} className="font-semibold text-gray-900">{e}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
              </div>
            </div>

            {/* Academic Year & Semester Selector */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
              <div>
                <label className="text-[10px] text-amber-200 block">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')}
                  className="w-full bg-black/20 text-white text-xs font-semibold px-2 py-1 rounded border border-white/20 outline-none"
                >
                  <option value="Ganjil" className="text-gray-900">Ganjil</option>
                  <option value="Genap" className="text-gray-900">Genap</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-amber-200 block">Tahun Ajaran</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full bg-black/20 text-white text-xs font-semibold px-2 py-1 rounded border border-white/20 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeTab === 'overview'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <BarChart3 size={16} />
          Ringkasan & Statistik
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeTab === 'members'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Users size={16} />
          Manajemen Anggota ({members.length})
        </button>

        <button
          onClick={() => setActiveTab('journals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeTab === 'journals'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <NotebookPen size={16} />
          Jurnal Latihan ({journals.length})
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeTab === 'achievements'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Award size={16} />
          Prestasi & Event ({achievements.length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeTab === 'reports'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Printer size={16} />
          Rekap & Cetak Laporan
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 rounded-xl text-amber-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Total Anggota</p>
                <h3 className="text-2xl font-black text-gray-900">{stats.totalMembers}</h3>
                <p className="text-[11px] text-gray-400">{stats.maleCount} L • {stats.femaleCount} P</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600">
                <CalendarCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Total Pertemuan</p>
                <h3 className="text-2xl font-black text-gray-900">{stats.totalMeetings}</h3>
                <p className="text-[11px] text-gray-400">Semester {selectedSemester}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-emerald-50 rounded-xl text-emerald-600">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Rata-rata Kehadiran</p>
                <h3 className="text-2xl font-black text-emerald-600">{stats.averageAttendanceRate}%</h3>
                <p className="text-[11px] text-gray-400">Keaktifan latihan</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-yellow-50 rounded-xl text-yellow-600">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Prestasi Diraih</p>
                <h3 className="text-2xl font-black text-yellow-700">{stats.totalAchievements}</h3>
                <p className="text-[11px] text-gray-400">Kejuaraan & lomba</p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Quick Actions */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="text-amber-500" size={16} />
                Aksi Cepat Pembina
              </h3>

              <div className="space-y-2.5">
                <button
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 transition text-xs font-bold"
                >
                  <span className="flex items-center gap-2.5">
                    <UserPlus size={16} className="text-amber-600" />
                    Tambah Anggota Siswa Baru
                  </span>
                  <Plus size={16} />
                </button>

                <button
                  onClick={() => handleOpenJournalModal()}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 transition text-xs font-bold"
                >
                  <span className="flex items-center gap-2.5">
                    <NotebookPen size={16} className="text-blue-600" />
                    Input Jurnal Latihan Hari Ini
                  </span>
                  <Plus size={16} />
                </button>

                <button
                  onClick={() => handleOpenAchievementModal()}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-900 transition text-xs font-bold"
                >
                  <span className="flex items-center gap-2.5">
                    <Award size={16} className="text-yellow-600" />
                    Catat Perolehan Prestasi / Juara
                  </span>
                  <Plus size={16} />
                </button>

                <button
                  onClick={exportReportRecommendationsToExcel}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 transition text-xs font-bold"
                >
                  <span className="flex items-center gap-2.5">
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    Export Rekap Nilai Rapor (Excel)
                  </span>
                  <ExternalLink size={14} />
                </button>
              </div>

              {/* Info Box */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-1">
                <p className="font-bold text-gray-800">Petunjuk Pembina:</p>
                <p className="text-[11px] leading-relaxed">
                  Data presensi yang Anda input pada jurnal latihan akan otomatis diakumulasi untuk menghitung persentase keaktifan dan menghasilkan deskripsi predikat capaian rapor siswa.
                </p>
              </div>
            </div>

            {/* Middle: Recent Meeting Logs */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CalendarCheck className="text-blue-600" size={16} />
                  Pertemuan Latihan Terakhir
                </h3>
                <button
                  onClick={() => setActiveTab('journals')}
                  className="text-xs text-amber-600 hover:text-amber-700 font-bold"
                >
                  Lihat Semua
                </button>
              </div>

              {journals.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Belum ada catatan jurnal pertemuan semester ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {journals.slice(0, 4).map((j, idx) => {
                    const presentCount = (j.attendance || []).filter(a => a.status === 'H').length;
                    return (
                      <div key={j.id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1.5 hover:bg-amber-50/30 transition">
                        <div className="flex items-center justify-between font-bold text-gray-800">
                          <span>Pertemuan #{journals.length - idx}: {j.topic}</span>
                          <span className="text-gray-500 font-normal">{j.date}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {j.startTime} - {j.endTime} WIB • {j.location}
                          </span>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {presentCount} Hadir
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAJEMEN ANGGOTA */}
      {activeTab === 'members' && (
        <div className="space-y-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          {/* Header & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="text-amber-600" />
                Daftar Anggota Ekstrakurikuler {selectedEkskul}
              </h2>
              <p className="text-xs text-gray-500">
                Pilih dan tetapkan siswa dari berbagai kelas beserta jabatan kepengurusan organisasi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportMembersToExcel}
                className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl font-bold transition"
              >
                <FileSpreadsheet size={15} /> Export Excel
              </button>

              <button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold shadow-xs transition"
              >
                <Plus size={16} /> Tambah Anggota Siswa
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Cari nama atau NIS siswa..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Class Filter */}
            <div>
              <select
                value={memberClassFilter}
                onChange={(e) => setMemberClassFilter(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg outline-none font-medium"
              >
                <option value="ALL">Semua Kelas Asal</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={memberRoleFilter}
                onChange={(e) => setMemberRoleFilter(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg outline-none font-medium"
              >
                <option value="ALL">Semua Jabatan</option>
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Members Table */}
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
              <Users className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="font-semibold text-sm">Tidak ada anggota yang cocok dengan filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4">Kelas Asal</th>
                    <th className="py-3 px-4">Jabatan di Ekskul</th>
                    <th className="py-3 px-4 text-center">Kehadiran Latihan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredMembers.map((m, idx) => {
                    const att = memberAttendanceMap[m.studentId] || { present: 0, totalMeetings: 0, rate: 100 };
                    return (
                      <tr key={m.id} className="hover:bg-amber-50/30 transition">
                        <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900">{m.studentName}</p>
                          <p className="text-[10px] text-gray-400">Tgl Bergabung: {m.joinedDate || '-'}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{m.studentNis || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                            {m.studentClassName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateMemberRole(m, e.target.value as ExtracurricularRole)}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                              m.role === 'Ketua' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                              m.role === 'Wakil Ketua' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                              m.role === 'Sekretaris' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              m.role === 'Bendahara' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 font-bold">
                            <span className="text-emerald-700">{att.present}/{att.totalMeetings}</span>
                            <span className="text-gray-400">({att.rate}%)</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteMember(m.id, m.studentName)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Keluarkan dari Ekskul"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: JURNAL & PRESENSI LATIHAN */}
      {activeTab === 'journals' && (
        <div className="space-y-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <NotebookPen className="text-amber-600" />
                Jurnal Pertemuan & Presensi Latihan Rutin
              </h2>
              <p className="text-xs text-gray-500">
                Catat waktu, lokasi, agenda materi latihan, daftar presensi, dan evaluasi hasil latihan.
              </p>
            </div>

            <button
              onClick={() => handleOpenJournalModal()}
              className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold shadow-xs transition"
            >
              <Plus size={16} /> Input Jurnal Pertemuan Baru
            </button>
          </div>

          {journals.length === 0 ? (
            <div className="text-center py-16 bg-amber-50/40 rounded-2xl border border-dashed border-amber-200">
              <NotebookPen className="mx-auto text-amber-400 mb-2" size={36} />
              <p className="font-bold text-sm text-gray-800">Belum ada jurnal latihan di semester {selectedSemester}</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Klik tombol di bawah untuk mencatat agenda latihan rutin dan presensi kehadiran anggota.
              </p>
              <button
                onClick={() => handleOpenJournalModal()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Input Jurnal Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {journals.map((journal, idx) => {
                const presentCount = (journal.attendance || []).filter(a => a.status === 'H').length;
                const absentList = (journal.attendance || []).filter(a => a.status !== 'H');

                return (
                  <div 
                    key={journal.id} 
                    className="p-5 rounded-xl border border-gray-200 bg-white hover:border-amber-300 transition shadow-xs space-y-3"
                  >
                    {/* Header Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-amber-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          #{idx + 1}
                        </span>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">
                            {journal.topic}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-medium">
                            <span className="flex items-center gap-1">
                              <CalendarCheck size={13} className="text-amber-600" />
                              {journal.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={13} className="text-blue-600" />
                              {journal.startTime} - {journal.endTime} WIB
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin size={13} className="text-red-500" />
                              {journal.location}
                            </span>
                            {journal.isEventPrep && (
                              <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-200">
                                Persiapan Lomba / Event
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenJournalModal(journal)}
                          className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold transition"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteJournal(journal.id, journal.topic)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Jurnal"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-bold text-gray-700 mb-1">Materi & Agenda Latihan:</p>
                        <p className="text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-200/80 leading-relaxed font-medium">
                          {journal.topic}
                        </p>

                        {journal.skillsTrained && (
                          <div className="mt-2">
                            <p className="font-bold text-gray-700 mb-1">Keterampilan yang Dilatih:</p>
                            <p className="text-gray-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 leading-relaxed">
                              {journal.skillsTrained}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {/* Attendance Summary Badge */}
                        <div>
                          <p className="font-bold text-gray-700 mb-1">Rekapitulasi Kehadiran Peserta:</p>
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-bold text-xs">
                              {presentCount} Hadir
                            </span>
                            {absentList.length > 0 && (
                              <span className="bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 rounded-md font-bold text-xs">
                                {absentList.length} Berhalangan
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Absent members list */}
                        {absentList.length > 0 && (
                          <div className="bg-red-50/50 border border-red-100 p-2.5 rounded-lg">
                            <p className="text-[11px] font-bold text-red-800 mb-1">Siswa Berhalangan Hadir:</p>
                            <div className="flex flex-wrap gap-1">
                              {absentList.map((ab, i) => (
                                <span 
                                  key={i} 
                                  className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                    ab.status === 'S' ? 'bg-amber-100 text-amber-800' :
                                    ab.status === 'I' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                  }`}
                                  title={ab.note || ''}
                                >
                                  {ab.studentName} ({ab.status})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Evaluation note */}
                        {journal.evaluationNotes && (
                          <div>
                            <p className="font-bold text-gray-700 mb-1">Catatan Evaluasi / Dokumentasi:</p>
                            <p className="text-gray-600 italic bg-gray-50 p-2 rounded-lg border border-gray-200/80">
                              "{journal.evaluationNotes}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRESTASI & EVENT */}
      {activeTab === 'achievements' && (
        <div className="space-y-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Trophy className="text-yellow-600" />
                Pencatatan Event & Prestasi Ekskul
              </h2>
              <p className="text-xs text-gray-500">
                Dokumentasikan keikutsertaan lomba, juara yang diraih, delegasi siswa, dan nomor sertifikat.
              </p>
            </div>

            <button
              onClick={() => handleOpenAchievementModal()}
              className="flex items-center gap-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl font-bold shadow-xs transition"
            >
              <Plus size={16} /> Catat Prestasi Baru
            </button>
          </div>

          {achievements.length === 0 ? (
            <div className="text-center py-16 bg-yellow-50/40 rounded-2xl border border-dashed border-yellow-200">
              <Trophy className="mx-auto text-yellow-500 mb-2" size={36} />
              <p className="font-bold text-sm text-gray-800">Belum ada catatan prestasi atau lomba</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Catat perolehan piala, medali, atau partisipasi kejuaraan ekskul {selectedEkskul} di sini.
              </p>
              <button
                onClick={() => handleOpenAchievementModal()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Catat Prestasi Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achv) => (
                <div key={achv.id} className="p-5 rounded-2xl border border-yellow-200 bg-linear-to-br from-yellow-50/30 via-amber-50/20 to-white shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-yellow-100 text-yellow-900 border border-yellow-300 mb-1">
                        {achv.rank} • Tingkat {achv.level}
                      </span>
                      <h3 className="font-bold text-sm text-gray-900">{achv.eventName}</h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenAchievementModal(achv)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteAchievement(achv.id, achv.eventName)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1.5 pt-2 border-t border-yellow-100">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Penyelenggara: <strong>{achv.organizer || '-'}</strong></span>
                      <span>Tanggal: <strong>{achv.date}</strong></span>
                    </div>

                    {achv.certificateUrl && (
                      <p className="text-[11px] text-gray-500">
                        No. Sertifikat: <span className="font-mono font-bold text-gray-800">{achv.certificateUrl}</span>
                      </p>
                    )}

                    {achv.studentParticipants && achv.studentParticipants.length > 0 && (
                      <div className="pt-1">
                        <p className="font-bold text-gray-700 text-[11px] mb-1">Delegasi Siswa:</p>
                        <div className="flex flex-wrap gap-1">
                          {achv.studentParticipants.map((p, i) => (
                            <span key={i} className="bg-white border border-yellow-300 text-yellow-900 px-2 py-0.5 rounded-md font-semibold text-[10px] shadow-2xs">
                              {p.studentName} {p.studentClassName ? `(${p.studentClassName})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {achv.description && (
                      <p className="text-[11px] text-gray-600 italic bg-white/80 p-2 rounded border border-yellow-100 mt-2">
                        "{achv.description}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REKAPITULASI & CETAK LAPORAN */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Printer className="text-amber-600" />
                Format Cetak Buku Jurnal & Laporan Pembina Ekskul
              </h2>
              <p className="text-xs text-gray-500">
                Laporan resmi lengkap dengan kop sekolah dan kolom tanda tangan Pembina serta Kepala Sekolah.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportReportRecommendationsToExcel}
                className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl font-bold transition"
              >
                <FileSpreadsheet size={15} /> Export Nilai & Presensi (Excel)
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold shadow-xs transition"
              >
                <Printer size={15} /> Cetak / Simpan PDF
              </button>
            </div>
          </div>

          {/* Printable Report Canvas */}
          <div 
            ref={printAreaRef}
            className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-300 shadow-sm print:p-0 print:border-none print:shadow-none font-sans text-gray-900"
          >
            {/* Kop Laporan Resmi */}
            <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
                {user.schoolName || schoolSettings?.schoolName || 'LEMBAGA PENDIDIKAN'}
              </h2>
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider mt-1 text-gray-800">
                BUKU JURNAL & LAPORAN KEGIATAN EKSTRAKURIKULER {selectedEkskul.toUpperCase()}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                SEMESTER {selectedSemester.toUpperCase()} • TAHUN AJARAN {academicYear}
              </p>
              {user.schoolNpsn && (
                <p className="text-[10px] text-gray-500">NPSN: {user.schoolNpsn}</p>
              )}
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 print:bg-transparent print:border-none print:p-0">
              <div>
                <p><strong>Nama Ekstrakurikuler:</strong> {selectedEkskul}</p>
                <p><strong>Pembina Ekstrakurikuler:</strong> {user.fullName}</p>
                <p><strong>NIP:</strong> {user.nip || '-'}</p>
              </div>
              <div>
                <p><strong>Total Anggota:</strong> {members.length} Siswa</p>
                <p><strong>Total Pertemuan / Latihan:</strong> {journals.length} Kali</p>
                <p><strong>Rata-rata Kehadiran:</strong> {stats.averageAttendanceRate}%</p>
              </div>
            </div>

            {/* Bagian 1: Jurnal Pertemuan */}
            <div className="mb-8">
              <h4 className="font-bold text-sm uppercase text-gray-800 mb-2 border-b pb-1">
                I. JURNAL KEGIATAN & AGENDA LATIHAN
              </h4>
              {journals.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">Belum ada data jurnal pertemuan.</p>
              ) : (
                <table className="w-full text-[11px] border-collapse border border-gray-400 text-left">
                  <thead className="bg-gray-100 print:bg-gray-200">
                    <tr>
                      <th className="border border-gray-400 p-2 text-center w-8">No</th>
                      <th className="border border-gray-400 p-2 w-24">Hari/Tanggal</th>
                      <th className="border border-gray-400 p-2 w-20">Jam & Tempat</th>
                      <th className="border border-gray-400 p-2">Materi / Agenda Latihan</th>
                      <th className="border border-gray-400 p-2 w-28 text-center">Presensi (H/S/I/A)</th>
                      <th className="border border-gray-400 p-2 w-44">Catatan / Evaluasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map((j, idx) => {
                      const presentCount = (j.attendance || []).filter(a => a.status === 'H').length;
                      const sCount = (j.attendance || []).filter(a => a.status === 'S').length;
                      const iCount = (j.attendance || []).filter(a => a.status === 'I').length;
                      const aCount = (j.attendance || []).filter(a => a.status === 'A').length;

                      return (
                        <tr key={j.id} className="align-top">
                          <td className="border border-gray-400 p-2 text-center font-bold">{idx + 1}</td>
                          <td className="border border-gray-400 p-2">{j.date}</td>
                          <td className="border border-gray-400 p-2">
                            {j.startTime}-{j.endTime}<br />
                            <span className="text-[10px] text-gray-600">{j.location}</span>
                          </td>
                          <td className="border border-gray-400 p-2">
                            <p className="font-semibold text-gray-900">{j.topic}</p>
                            {j.skillsTrained && (
                              <p className="text-[10px] text-gray-600 mt-0.5">Target: {j.skillsTrained}</p>
                            )}
                          </td>
                          <td className="border border-gray-400 p-2 text-center font-medium">
                            <span className="font-bold text-gray-900">{presentCount}</span> / 
                            <span className="text-amber-700"> {sCount}</span> / 
                            <span className="text-blue-700"> {iCount}</span> / 
                            <span className="text-red-700 font-bold"> {aCount}</span>
                          </td>
                          <td className="border border-gray-400 p-2 text-[10px] text-gray-700 italic">
                            {j.evaluationNotes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bagian 2: Rekap Prestasi */}
            {achievements.length > 0 && (
              <div className="mb-8">
                <h4 className="font-bold text-sm uppercase text-gray-800 mb-2 border-b pb-1">
                  II. PRESTASI & KEJUARAAN YANG DIRAIH
                </h4>
                <table className="w-full text-[11px] border-collapse border border-gray-400 text-left">
                  <thead className="bg-gray-100 print:bg-gray-200">
                    <tr>
                      <th className="border border-gray-400 p-2 text-center w-8">No</th>
                      <th className="border border-gray-400 p-2">Nama Kejuaraan / Event</th>
                      <th className="border border-gray-400 p-2 w-28">Tingkat</th>
                      <th className="border border-gray-400 p-2 w-24">Peringkat / Juara</th>
                      <th className="border border-gray-400 p-2">Delegasi Siswa</th>
                      <th className="border border-gray-400 p-2 w-24">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {achievements.map((achv, idx) => (
                      <tr key={achv.id} className="align-top">
                        <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                        <td className="border border-gray-400 p-2 font-bold">{achv.eventName}</td>
                        <td className="border border-gray-400 p-2">{achv.level}</td>
                        <td className="border border-gray-400 p-2 font-semibold text-yellow-800">{achv.rank}</td>
                        <td className="border border-gray-400 p-2">
                          {(achv.studentParticipants || []).map(p => p.studentName).join(', ') || '-'}
                        </td>
                        <td className="border border-gray-400 p-2">{achv.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bagian 3: Rekap Keanggotaan & Nilai */}
            <div className="mb-8">
              <h4 className="font-bold text-sm uppercase text-gray-800 mb-2 border-b pb-1">
                III. REKAPITULASI KEHADIRAN & NILAI RAPOR ANGGOTA
              </h4>
              <table className="w-full text-[11px] border-collapse border border-gray-400 text-left">
                <thead className="bg-gray-100 print:bg-gray-200">
                  <tr>
                    <th className="border border-gray-400 p-1.5 text-center w-8">No</th>
                    <th className="border border-gray-400 p-1.5">Nama Siswa</th>
                    <th className="border border-gray-400 p-1.5 text-center w-16">Kelas</th>
                    <th className="border border-gray-400 p-1.5 w-24">Jabatan</th>
                    <th className="border border-gray-400 p-1.5 text-center w-12">Hadir</th>
                    <th className="border border-gray-400 p-1.5 text-center w-14">S/I/A</th>
                    <th className="border border-gray-400 p-1.5 text-center w-14">% Hadir</th>
                    <th className="border border-gray-400 p-1.5 text-center w-20">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => {
                    const att = memberAttendanceMap[m.studentId] || { present: 0, sakit: 0, izin: 0, alfa: 0, rate: 100 };
                    return (
                      <tr key={m.id}>
                        <td className="border border-gray-400 p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-gray-400 p-1.5 font-bold">{m.studentName}</td>
                        <td className="border border-gray-400 p-1.5 text-center">{m.studentClassName}</td>
                        <td className="border border-gray-400 p-1.5">{m.role}</td>
                        <td className="border border-gray-400 p-1.5 text-center font-bold">{att.present}</td>
                        <td className="border border-gray-400 p-1.5 text-center">{att.sakit}/{att.izin}/{att.alfa}</td>
                        <td className="border border-gray-400 p-1.5 text-center font-bold">{att.rate}%</td>
                        <td className="border border-gray-400 p-1.5 text-center font-bold">
                          {att.rate >= 85 ? 'Sangat Baik' : att.rate >= 70 ? 'Baik' : 'Cukup'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 text-xs pt-8 mt-12 border-t border-gray-300">
              <div className="text-center space-y-16">
                <p>Mengetahui,<br />Kepala Sekolah</p>
                <div>
                  <p className="font-bold underline uppercase">{schoolSettings?.principalName || '...........................................'}</p>
                  <p>NIP. {schoolSettings?.principalNip || '...........................................'}</p>
                </div>
              </div>

              <div className="text-center space-y-16">
                <p>
                  {schoolSettings?.city || 'Kota'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />
                  Pembina Ekstrakurikuler
                </p>
                <div>
                  <p className="font-bold underline uppercase">{user.fullName}</p>
                  <p>NIP. {user.nip || '...........................................'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH ANGGOTA SISWA */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">Tambah Anggota Ekstrakurikuler</h3>
                <p className="text-xs text-gray-500">Ekskul: {selectedEkskul}</p>
              </div>
              <button 
                onClick={() => setIsAddMemberModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter class & search inside modal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Filter Kelas Asal</label>
                <select
                  value={selectedClassForAdd}
                  onChange={(e) => setSelectedClassForAdd(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none font-medium"
                >
                  <option value="ALL">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Jabatan Awal</label>
                <select
                  value={defaultRoleToAdd}
                  onChange={(e) => setDefaultRoleToAdd(e.target.value as ExtracurricularRole)}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none font-bold text-amber-800"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative text-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Ketik nama atau NIS siswa..."
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg outline-none"
              />
            </div>

            {/* Student List Checkbox */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl p-2 divide-y divide-gray-100 max-h-60 text-xs">
              {eligibleStudentsToAdd.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Tidak ada siswa yang dapat ditambahkan (sudah terdaftar atau tidak cocok dengan filter).
                </div>
              ) : (
                eligibleStudentsToAdd.map(st => {
                  const isSelected = selectedStudentIdsToAdd.includes(st.id);
                  const cls = classes.find(c => c.id === st.classId);

                  return (
                    <label
                      key={st.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected ? 'bg-amber-50 text-amber-900 font-semibold' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIdsToAdd([...selectedStudentIdsToAdd, st.id]);
                            } else {
                              setSelectedStudentIdsToAdd(selectedStudentIdsToAdd.filter(id => id !== st.id));
                            }
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                        />
                        <div>
                          <p className="font-bold text-gray-900">{st.name}</p>
                          <p className="text-[10px] text-gray-400">NIS: {st.nis || '-'} • Kelas: {cls?.name || '-'}</p>
                        </div>
                      </div>

                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">
                        {cls?.name || 'Kelas'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t text-xs">
              <span className="font-bold text-gray-600">
                {selectedStudentIdsToAdd.length} siswa dipilih
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={selectedStudentIdsToAdd.length === 0}
                  onClick={handleSaveBulkMembers}
                  className="px-5 py-2 font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition"
                >
                  Tambahkan ke Ekskul
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INPUT / EDIT JURNAL PERTEMUAN */}
      {isJournalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  {editingJournal ? 'Edit Jurnal Pertemuan' : 'Input Jurnal Latihan Rutin Baru'}
                </h3>
                <p className="text-xs text-gray-500">Ekstrakurikuler: {selectedEkskul}</p>
              </div>
              <button 
                onClick={() => setIsJournalModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveJournal} className="space-y-4 overflow-y-auto pr-1">
              {/* Row 1: Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Latihan</label>
                  <input
                    type="date"
                    required
                    value={journalForm.date}
                    onChange={(e) => setJournalForm({ ...journalForm, date: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={journalForm.startTime}
                    onChange={(e) => setJournalForm({ ...journalForm, startTime: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={journalForm.endTime}
                    onChange={(e) => setJournalForm({ ...journalForm, endTime: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Location & Event Prep Checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tempat / Lokasi Latihan</label>
                  <input
                    type="text"
                    required
                    placeholder="Cth: Lapangan Basket / Lab Komputer..."
                    value={journalForm.location}
                    onChange={(e) => setJournalForm({ ...journalForm, location: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={journalForm.isEventPrep}
                      onChange={(e) => setJournalForm({ ...journalForm, isEventPrep: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span>Persiapan Lomba / Kejuaraan Khusus</span>
                  </label>
                </div>
              </div>

              {/* Row 3: Materi / Agenda Latihan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Materi / Agenda Kegiatan Latihan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Cth: Latihan teknik dasar passing & shooting, pembagian regu sparing..."
                  value={journalForm.topic}
                  onChange={(e) => setJournalForm({ ...journalForm, topic: e.target.value })}
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Row 4: Target Keterampilan & Evaluasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Keterampilan yang Dilatih</label>
                  <input
                    type="text"
                    placeholder="Cth: Akurasi operan, ketahanan fisik, kekompakan tim..."
                    value={journalForm.skillsTrained}
                    onChange={(e) => setJournalForm({ ...journalForm, skillsTrained: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Catatan Evaluasi / Kendala</label>
                  <input
                    type="text"
                    placeholder="Cth: Bola latihan kurang, antusiasme anggota tinggi..."
                    value={journalForm.evaluationNotes}
                    onChange={(e) => setJournalForm({ ...journalForm, evaluationNotes: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Presensi Anggota Section */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800">
                    Presensi Kehadiran Anggota ({members.length} Siswa)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allPresentMap: Record<string, { status: ExtracurricularAttendanceStatus }> = {};
                      members.forEach(m => {
                        allPresentMap[m.studentId] = { status: 'H' };
                      });
                      setJournalForm({ ...journalForm, attendanceMap: allPresentMap });
                    }}
                    className="text-[11px] text-emerald-700 font-bold hover:underline"
                  >
                    Set Semua Hadir (H)
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                  {members.map((m) => {
                    const currentStatus = journalForm.attendanceMap[m.studentId]?.status || 'H';

                    return (
                      <div key={m.id} className="flex items-center justify-between p-2 text-xs">
                        <div>
                          <p className="font-bold text-gray-800">{m.studentName}</p>
                          <p className="text-[10px] text-gray-400">{m.studentClassName} • {m.role}</p>
                        </div>

                        {/* Status Buttons */}
                        <div className="flex items-center gap-1">
                          {(['H', 'S', 'I', 'A'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                setJournalForm({
                                  ...journalForm,
                                  attendanceMap: {
                                    ...journalForm.attendanceMap,
                                    [m.studentId]: { status: st }
                                  }
                                });
                              }}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                                currentStatus === st
                                  ? st === 'H' ? 'bg-emerald-600 text-white shadow-xs'
                                    : st === 'S' ? 'bg-amber-500 text-white shadow-xs'
                                    : st === 'I' ? 'bg-blue-500 text-white shadow-xs'
                                    : 'bg-red-600 text-white shadow-xs'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsJournalModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition"
                >
                  Simpan Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INPUT PRESTASI & EVENT */}
      {isAchievementModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  {editingAchievement ? 'Edit Data Prestasi' : 'Catat Prestasi & Kejuaraan Baru'}
                </h3>
                <p className="text-xs text-gray-500">Ekstrakurikuler: {selectedEkskul}</p>
              </div>
              <button 
                onClick={() => setIsAchievementModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAchievement} className="space-y-3.5 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Kejuaraan / Event Lomba</label>
                <input
                  type="text"
                  required
                  placeholder="Cth: O2SN Cabang Futsal Tingkat Kabupaten..."
                  value={achievementForm.eventName}
                  onChange={(e) => setAchievementForm({ ...achievementForm, eventName: e.target.value })}
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tingkat Kejuaraan</label>
                  <select
                    value={achievementForm.level}
                    onChange={(e) => setAchievementForm({ ...achievementForm, level: e.target.value as AchievementLevel })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold"
                  >
                    {ACHIEVEMENT_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Peringkat / Juara</label>
                  <select
                    value={achievementForm.rank}
                    onChange={(e) => setAchievementForm({ ...achievementForm, rank: e.target.value as AchievementRank })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-yellow-900"
                  >
                    {RANKS.map(rk => (
                      <option key={rk} value={rk}>{rk}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Pelaksanaan</label>
                  <input
                    type="date"
                    required
                    value={achievementForm.date}
                    onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Penyelenggara</label>
                  <input
                    type="text"
                    placeholder="Cth: Dinas Pendidikan / Dispora..."
                    value={achievementForm.organizer}
                    onChange={(e) => setAchievementForm({ ...achievementForm, organizer: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nomor Piagam / Sertifikat (Opsional)</label>
                <input
                  type="text"
                  placeholder="Cth: 421.2/108/DISDIK/2025..."
                  value={achievementForm.certificateUrl}
                  onChange={(e) => setAchievementForm({ ...achievementForm, certificateUrl: e.target.value })}
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-mono"
                />
              </div>

              {/* Pilih Delegasi Siswa */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Siswa Anggota yang Terlibat:</label>
                <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                  {members.map(m => {
                    const isSelected = achievementForm.participantStudentIds.includes(m.studentId);
                    return (
                      <label 
                        key={m.id} 
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${
                          isSelected ? 'bg-yellow-100 text-yellow-900 font-bold' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAchievementForm({
                                ...achievementForm,
                                participantStudentIds: [...achievementForm.participantStudentIds, m.studentId]
                              });
                            } else {
                              setAchievementForm({
                                ...achievementForm,
                                participantStudentIds: achievementForm.participantStudentIds.filter(id => id !== m.studentId)
                              });
                            }
                          }}
                          className="rounded text-yellow-600 focus:ring-yellow-500"
                        />
                        <span>{m.studentName} ({m.studentClassName})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Keterangan Tambahan / Deskripsi</label>
                <textarea
                  rows={2}
                  placeholder="Catatan prestasi, skor final, atau dokumentasi..."
                  value={achievementForm.description}
                  onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAchievementModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl shadow-xs transition"
                >
                  Simpan Prestasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtracurricularManager;
