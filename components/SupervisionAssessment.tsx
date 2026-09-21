
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, SupervisionAssignment, SupervisionResult, DeepLearningFollowUpRecommendations } from '../types';
import { getSchoolTeachers, saveSupervisionResult, getSupervisionResultByAssignment, updateSupervisionAssignmentStatus, getSupervisionAssignments, runManualSync } from '../services/database';
import { ClipboardCheck, User as UserIcon, Calendar, CheckCircle, AlertCircle, Loader2, ChevronRight, Save, Star, Printer, Filter, Search, RefreshCcw, Shield, ExternalLink, Globe } from './Icons';
import { PrintManualSupervisionModal } from './PrintManualSupervisionModal';
import { 
  DEEP_LEARNING_SUPERVISION_ITEMS, 
  DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS,
  DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS,
  SCORE_DESCRIPTIONS, 
  FOLLOW_UP_QUESTIONS, 
  calculateDeepLearningScore,
  calculateDeepLearningImplementationScore,
  calculateDeepLearningFeedbackScore 
} from './deepLearningSupervisionConstants';

interface SupervisionAssessmentProps {
  user: User;
}

const PLANNING_ADMIN_COMPONENTS = [
  "Kalender Pendidikan",
  "Program Tahunan",
  "Program Semester",
  "Silabus",
  "RPP",
  "Jadwal Pelajaran",
  "Agenda Harian",
  "Daftar Nilai",
  "KKM",
  "Daftar Hadir Peserta Didik",
  "Ketersediaan Bahan Ajar",
  "Buku Pedoman Guru"
];

const LESSON_PLAN_COMPONENTS = [
  "Identitas Sekolah",
  "Identitas Mata Pelajaran",
  "Kelas/Semester",
  "Materi Pokok/Kompetensi Dasar",
  "Alokasi Waktu",
  "Tujuan Pembelajaran",
  "Metode & Model Pembelajaran",
  "Media Pembelajaran (LMS)",
  "Media Pembelajaran (Visual)",
  "Sumber Belajar",
  "Kegiatan Pembelajaran (Sistematis)",
  "Kegiatan Inti (HOTS)",
  "Langkah Integrasi (4C, PPK, Literasi)",
  "Penilaian Proses (Otentik)",
  "Penilaian Hasil (Mencerminkan Proses)",
  "Teknik Penilaian (Alat Tes/Instrumen)",
  "Kunci Jawaban/Rubrik"
];

const IMPLEMENTATION_COMPONENTS = [
  "Memberikan motivasi & menyiapkan peserta didik",
  "Mengajukan pertanyaan & mengaitkan pengetahuan sebelumnya",
  "Menjelaskan tujuan pembelajaran/KD",
  "Penanaman/Pembudayaan karakter dan literasi",
  "Menyampaikan tugas & arahan mekanisme penyelesaian",
  "Menggunakan Learning Manajemen Sistem (LMS)",
  "Memanfaatkan fasilitas akun belajar.id",
  "Memanfaatkan penggunaan video, power point, dll",
  "Metode/Pendekatan mewujudkan suasana menyenangkan (integrasi 21st Century)",
  "Menggunakan media pembelajaran sebagai alat bantu",
  "Memanfaatkan berbagai fasilitas Sumber belajar",
  "Kesimpulan bersama & manfaat pembelajaran",
  "Memberikan umpan balik proses & hasil",
  "Kegiatan tindak lanjut (tugas individu/kelompok)",
  "Rencana kegiatan pertemuan berikutnya",
  "Penilaian proses sesuai perencanaan",
  "Penilaian hasil (tes, portofolio, penugasan)",
  "Teknik Penilaian (instrumen sesuai KD)",
  "Penerapan TIK terintegrasi & efektif"
];

const SUPERVISION_ASPECTS = [
  "Penguasaan materi pembelajaran",
  "Kesesuaian metode dengan karakteristik siswa",
  "Pemanfaatan media dan sumber belajar",
  "Keterlibatan aktif siswa dalam pembelajaran",
  "Manajemen waktu dan kelas",
  "Pelaksanaan evaluasi proses pembelajaran",
  "Kesesuaian dengan Rencana Pelaksanaan Pembelajaran (RPP)"
];

const SupervisionAssessment: React.FC<SupervisionAssessmentProps> = ({ user }) => {
  const [assignments, setAssignments] = useState<SupervisionAssignment[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useState<string>('ALL');
  const [searchGuru, setSearchGuru] = useState<string>('');
  const [selectedAssignment, setSelectedAssignment] = useState<SupervisionAssignment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'PLANNING' | 'RPP' | 'IMPLEMENTATION'>('PLANNING');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [manualPrintAssignment, setManualPrintAssignment] = useState<SupervisionAssignment | null>(null);

  // Tab 1: Instrumen Supervisi Persiapan Pembelajaran Mendalam
  const [planningScores, setPlanningScores] = useState<Record<string, number>>({});
  const [planningComments, setPlanningComments] = useState<Record<string, string>>({});
  const [followUpRecommendations, setFollowUpRecommendations] = useState<DeepLearningFollowUpRecommendations>({
    weakAspects: '',
    shortTermStrategy: '',
    longTermStrategy: '',
    resourcesNeeded: ''
  });
  const [readinessCategory, setReadinessCategory] = useState<'Sangat Kurang' | 'Kurang' | 'Baik' | 'Sangat Baik'>('Sangat Kurang');
  const [coachingSuggestion, setCoachingSuggestion] = useState('');

  // Tab 2: Instrumen Supervisi Pelaksanaan Pembelajaran Mendalam (sebelumnya RPP)
  const [lessonPlanScores, setLessonPlanScores] = useState<Record<string, number>>({});
  const [lessonPlanComments, setLessonPlanComments] = useState<Record<string, string>>({});
  const [lessonPlanFollowUp, setLessonPlanFollowUp] = useState<DeepLearningFollowUpRecommendations>({
    weakAspects: '',
    shortTermStrategy: '',
    longTermStrategy: '',
    resourcesNeeded: ''
  });
  const [lessonPlanReadinessCategory, setLessonPlanReadinessCategory] = useState<'Sangat Kurang' | 'Kurang' | 'Baik' | 'Sangat Baik'>('Sangat Kurang');
  const [lessonPlanCoaching, setLessonPlanCoaching] = useState('');

  // Tab 3: Instrumen Umpan Balik Perencanaan Pembelajaran Mendalam
  const [implPlanningUrl, setImplPlanningUrl] = useState('');
  const [implLevel, setImplLevel] = useState('');
  const [implSubject, setImplSubject] = useState('');
  const [implGradeClass, setImplGradeClass] = useState('');
  const [implTitle, setImplTitle] = useState('');
  const [implScores, setImplScores] = useState<Record<string, number>>({});
  const [implComments, setImplComments] = useState<Record<string, string>>({});
  const [implAdvantages, setImplAdvantages] = useState('');
  const [implAreasToImprove, setImplAreasToImprove] = useState('');
  const [implRecommendations, setImplRecommendations] = useState('');
  const [implCoaching, setImplCoaching] = useState('');

  // Tab 3: Legacy/Placeholder state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  const isKepsek = user.additionalRole === 'KEPALA_SEKOLAH';
  const isWakasek = user.additionalRole === 'WAKASEK_KURIKULUM';
  const isAdmin = user.role === 'ADMIN';
  const isSchoolLeader = isKepsek || isWakasek || isAdmin;
  const isSupervisor = Boolean(user.isSupervisor);
  const canAccess = isSupervisor || isSchoolLeader;

  useEffect(() => {
    if (!canAccess) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user.id, user.isSupervisor, canAccess]);

  useEffect(() => {
    // Handle deep link to an assignment
    const params = new URLSearchParams(location.search);
    const assignmentId = params.get('assignmentId');
    if (assignmentId && assignments.length > 0) {
      const target = assignments.find(a => a.id === assignmentId);
      if (target && selectedAssignment?.id !== target.id) {
        handleSelectAssignment(target);
      }
    }
  }, [location.search, assignments]);

  const fetchData = async (forceSync = false) => {
    if (forceSync) setIsSyncing(true);
    else setLoading(true);

    try {
      if (forceSync || navigator.onLine) {
        try {
          await runManualSync('PULL', () => {}, [
            'eduadmin_supervision_assignments',
            'eduadmin_users',
            'eduadmin_supervision_results'
          ]);
        } catch (e) {
          console.warn("Sync pull warning in assessment:", e);
        }
      }

      const [schoolAssignments, schoolTeachers] = await Promise.all([
        getSupervisionAssignments(user.schoolNpsn!),
        getSchoolTeachers(user.schoolNpsn!)
      ]);
      
      setAssignments(schoolAssignments);
      setTeachers(schoolTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  // List of all supervisors available in the system
  const availableSupervisors = teachers.filter(t => 
    t.isSupervisor || 
    t.additionalRole === 'KEPALA_SEKOLAH' || 
    t.id === user.id ||
    assignments.some(a => a.supervisorId === t.id)
  );

  const displayedAssignments = assignments.filter(a => {
    // 1. Role / supervisor filtering
    if (!isSchoolLeader) {
      // Non-leader supervisor only sees their own assigned teachers
      if (a.supervisorId !== user.id) return false;
    } else {
      // School leader can see ALL or filter by a specific supervisor
      if (selectedSupervisorFilter !== 'ALL' && a.supervisorId !== selectedSupervisorFilter) {
        return false;
      }
    }

    // 2. Search filtering
    if (searchGuru.trim()) {
      const q = searchGuru.toLowerCase();
      const teacher = teachers.find(t => t.id === a.teacherId);
      const supervisor = teachers.find(t => t.id === a.supervisorId);
      const matchTeacher = teacher?.fullName.toLowerCase().includes(q) || (teacher?.nip && teacher.nip.includes(q)) || (teacher?.subject && teacher.subject.toLowerCase().includes(q));
      const matchSupervisor = supervisor?.fullName.toLowerCase().includes(q);
      return matchTeacher || matchSupervisor;
    }

    return true;
  }).sort((a, b) => (a.status === 'PENDING' ? -1 : 1));

  const handleSelectAssignment = async (assignment: SupervisionAssignment) => {
    setSelectedAssignment(assignment);
    setIsSaving(true);
    
    try {
      const existing = await getSupervisionResultByAssignment(assignment.id);

      if (existing) {
        // Load Tab 1: Persiapan Pembelajaran Mendalam
        const existingPlanning = existing.planningAdmin;
        setPlanningScores(existingPlanning?.scores || {});
        setPlanningComments(existingPlanning?.comments || {});
        setCoachingSuggestion(existingPlanning?.coachingSuggestion || '');
        
        if (existingPlanning?.recommendations) {
          setFollowUpRecommendations({
            weakAspects: existingPlanning.recommendations.weakAspects || '',
            shortTermStrategy: existingPlanning.recommendations.shortTermStrategy || '',
            longTermStrategy: existingPlanning.recommendations.longTermStrategy || '',
            resourcesNeeded: existingPlanning.recommendations.resourcesNeeded || ''
          });
        } else {
          setFollowUpRecommendations({
            weakAspects: existingPlanning?.coachingSuggestion || '',
            shortTermStrategy: '',
            longTermStrategy: '',
            resourcesNeeded: ''
          });
        }

        if (existingPlanning?.readinessCategory) {
          setReadinessCategory(existingPlanning.readinessCategory as any);
        } else {
          const calc = calculateDeepLearningScore(existingPlanning?.scores || {});
          setReadinessCategory(calc.readinessCategory);
        }

        // Load Tab 2: Pelaksanaan Pembelajaran Mendalam
        const existingLesson = existing.lessonPlan;
        setLessonPlanScores(existingLesson?.scores || {});
        setLessonPlanComments(existingLesson?.comments || {});
        if (existingLesson?.recommendations) {
          setLessonPlanFollowUp({
            weakAspects: existingLesson.recommendations.weakAspects || '',
            shortTermStrategy: existingLesson.recommendations.shortTermStrategy || '',
            longTermStrategy: existingLesson.recommendations.longTermStrategy || '',
            resourcesNeeded: existingLesson.recommendations.resourcesNeeded || ''
          });
        } else {
          setLessonPlanFollowUp({
            weakAspects: existingLesson?.coachingSuggestion || '',
            shortTermStrategy: '',
            longTermStrategy: '',
            resourcesNeeded: ''
          });
        }
        if (existingLesson?.readinessCategory) {
          setLessonPlanReadinessCategory(existingLesson.readinessCategory as any);
        } else {
          const calcLesson = calculateDeepLearningImplementationScore(existingLesson?.scores || {});
          setLessonPlanReadinessCategory(calcLesson.readinessCategory);
        }
        setLessonPlanCoaching(existingLesson?.coachingSuggestion || '');

        // Load Tab 3: Instrumen Umpan Balik Perencanaan Pembelajaran Mendalam
        const existingImpl = existing.implementation;
        const currentTeacher = teachers.find(t => t.id === assignment.teacherId);
        setImplPlanningUrl(existingImpl?.planningUrl || '');
        setImplLevel(existingImpl?.level || '');
        setImplSubject(existingImpl?.subject || currentTeacher?.subject || '');
        setImplGradeClass(existingImpl?.gradeClass || '');
        setImplTitle(existingImpl?.title || '');
        setImplScores(existingImpl?.scores || {});
        setImplComments(existingImpl?.comments || {});
        setImplAdvantages(existingImpl?.advantages || '');
        setImplAreasToImprove(existingImpl?.areasToImprove || '');
        setImplRecommendations(existingImpl?.recommendations || '');
        setImplCoaching(existingImpl?.coachingSuggestion || '');

        // Load Legacy/Notes
        setScores({}); // Aspect scores are legacy
        setComments({});
        setGeneralNotes(existing.notes || '');
      } else {
        const currentTeacher = teachers.find(t => t.id === assignment.teacherId);
        // Reset Tab 1: Persiapan Pembelajaran Mendalam
        const initialPlanningScores: Record<string, number> = {};
        DEEP_LEARNING_SUPERVISION_ITEMS.forEach(c => { initialPlanningScores[c.id] = 0; });
        setPlanningScores(initialPlanningScores);
        setPlanningComments({});
        setFollowUpRecommendations({
          weakAspects: '',
          shortTermStrategy: '',
          longTermStrategy: '',
          resourcesNeeded: ''
        });
        setReadinessCategory('Sangat Kurang');
        setCoachingSuggestion('');

        // Reset Tab 2: Pelaksanaan Pembelajaran Mendalam
        const initialLessonPlanScores: Record<string, number> = {};
        DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS.forEach(c => { initialLessonPlanScores[c.id] = 0; });
        setLessonPlanScores(initialLessonPlanScores);
        setLessonPlanComments({});
        setLessonPlanFollowUp({
          weakAspects: '',
          shortTermStrategy: '',
          longTermStrategy: '',
          resourcesNeeded: ''
        });
        setLessonPlanReadinessCategory('Sangat Kurang');
        setLessonPlanCoaching('');

        // Reset Tab 3: Instrumen Umpan Balik Perencanaan Pembelajaran Mendalam
        const initialImplScores: Record<string, number> = {};
        DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS.forEach(c => { initialImplScores[c.id] = 0; });
        setImplPlanningUrl('');
        setImplLevel('');
        setImplSubject(currentTeacher?.subject || '');
        setImplGradeClass('');
        setImplTitle('');
        setImplScores(initialImplScores);
        setImplComments({});
        setImplAdvantages('');
        setImplAreasToImprove('');
        setImplRecommendations('');
        setImplCoaching('');

        // Reset Legacy
        setScores({});
        setComments({});
        setGeneralNotes('');
      }
    } catch (error) {
      console.error("Error loading existing result:", error);
    } finally {
      setIsSaving(false);
      setSuccessMessage('');
      setActiveTab('PLANNING');
    }
  };

  const calculatePlanningResults = () => {
    const calc = calculateDeepLearningScore(planningScores);
    return {
      totalRealScore: calc.totalRealScore,
      scaledTo80: calc.scaledTo80,
      finalScore: calc.finalScore,
      predicate: readinessCategory || calc.readinessCategory,
      readinessCategory: readinessCategory || calc.readinessCategory
    };
  };

  const calculateLessonPlanResults = () => {
    const calc = calculateDeepLearningImplementationScore(lessonPlanScores);
    return {
      totalRealScore: calc.totalRealScore,
      maxScore: calc.maxScore,
      scaledTo80: calc.scaledTo80,
      finalScore: calc.finalScore,
      predicate: lessonPlanReadinessCategory || calc.readinessCategory,
      readinessCategory: lessonPlanReadinessCategory || calc.readinessCategory
    };
  };

  const calculateImplementationResults = () => {
    return calculateDeepLearningFeedbackScore(implScores);
  };

  const handleSaveTab = async () => {
    if (!selectedAssignment) return;

    setIsSaving(true);
    try {
      const planningData = calculatePlanningResults();
      const lessonPlanData = calculateLessonPlanResults();
      const implData = calculateImplementationResults();

      const result: Partial<SupervisionResult> & { assignmentId: string } = {
        assignmentId: selectedAssignment.id,
        supervisorId: selectedAssignment.supervisorId || user.id,
        teacherId: selectedAssignment.teacherId,
        schoolNpsn: user.schoolNpsn!,
        date: new Date().toISOString().split('T')[0],
        score: (planningData.finalScore + lessonPlanData.finalScore + implData.finalScore) / 3,
        notes: generalNotes,
        planningAdmin: {
          scores: planningScores,
          comments: planningComments,
          totalRealScore: planningData.totalRealScore,
          finalScore: planningData.finalScore,
          predicate: planningData.predicate,
          readinessCategory: planningData.readinessCategory,
          recommendations: followUpRecommendations,
          coachingSuggestion: followUpRecommendations.weakAspects || coachingSuggestion
        },
        lessonPlan: {
          scores: lessonPlanScores,
          comments: lessonPlanComments,
          totalRealScore: lessonPlanData.totalRealScore,
          maxScore: lessonPlanData.maxScore,
          scaledTo80: lessonPlanData.scaledTo80,
          finalScore: lessonPlanData.finalScore,
          predicate: lessonPlanData.predicate,
          readinessCategory: lessonPlanData.readinessCategory,
          recommendations: lessonPlanFollowUp,
          coachingSuggestion: lessonPlanFollowUp.weakAspects || lessonPlanCoaching
        },
        implementation: {
          scores: implScores,
          comments: implComments,
          totalRealScore: implData.totalRealScore,
          maxScore: implData.maxScore,
          finalScore: implData.finalScore,
          predicate: implData.predicate,
          coachingSuggestion: implRecommendations || implAreasToImprove || implCoaching,
          planningUrl: implPlanningUrl,
          level: implLevel,
          subject: implSubject,
          gradeClass: implGradeClass,
          title: implTitle,
          advantages: implAdvantages,
          areasToImprove: implAreasToImprove,
          recommendations: implRecommendations
        }
      };

      await saveSupervisionResult(result);
      setSuccessMessage(`Progres ${activeTab === 'PLANNING' ? 'Persiapan Pembelajaran Mendalam' : activeTab === 'RPP' ? 'Pelaksanaan Pembelajaran Mendalam' : 'Umpan Balik Perencanaan Pembelajaran Mendalam'} berhasil disimpan!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error("Failed to save progress:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishSupervision = async () => {
    if (!selectedAssignment) return;
    if (!confirm("Selesaikan supervisi ini? Setelah diselesaikan, hasil akan muncul di laporan monitoring.")) return;

    setIsSaving(true);
    try {
      await handleSaveTab();
      await updateSupervisionAssignmentStatus(selectedAssignment.id, 'COMPLETED');
      setSuccessMessage("Supervisi telah diselesaikan!");
      setSelectedAssignment(null);
      await fetchData();
    } catch (error) {
      console.error("Failed to finish supervision:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-purple-600 mb-4" size={40} />
        <p className="text-gray-500 font-medium">Memuat data penugasan...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Instrumen Supervisi Akademik</h2>
            <p className="text-gray-500 text-sm">
              Lakukan penilaian terhadap rekan sejawat atau cetak format instrumen manual untuk observasi fisik lapangan.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setManualPrintAssignment(selectedAssignment);
            setIsPrintModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-95 transition shadow-md shadow-purple-100 self-start md:self-auto"
        >
          <Printer size={16} />
          <span>Cetak Instrumen Manual</span>
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-100 text-green-700 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          <p className="font-medium text-sm">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Assignment List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="text-blue-600" size={18} />
                Daftar Penugasan
              </h3>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={isSyncing}
                className="p-1.5 bg-gray-50 hover:bg-purple-50 text-gray-500 hover:text-purple-600 rounded-lg border border-gray-200 transition disabled:opacity-50"
                title="Sinkronkan & Tarik Data Terbaru"
              >
                <RefreshCcw size={14} className={isSyncing ? "animate-spin text-purple-600" : ""} />
              </button>
            </div>

            {/* Supervisor Filter Dropdown (School Leader only) */}
            {isSchoolLeader && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                  <Filter size={12} className="text-gray-400" />
                  Filter Supervisor:
                </label>
                <select
                  value={selectedSupervisorFilter}
                  onChange={(e) => setSelectedSupervisorFilter(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="ALL">Semua Supervisor ({assignments.length})</option>
                  <option value={user.id}>Saya ({user.fullName}) ({assignments.filter(a => a.supervisorId === user.id).length})</option>
                  {availableSupervisors.filter(s => s.id !== user.id).map(s => {
                    const count = assignments.filter(a => a.supervisorId === s.id).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Cari guru / mapel / supervisor..."
                value={searchGuru}
                onChange={(e) => setSearchGuru(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="text-[11px] text-gray-400 font-medium">
              Menampilkan {displayedAssignments.length} dari {assignments.length} penugasan
            </div>
            
            {displayedAssignments.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-xs text-gray-400 italic">
                  {searchGuru ? "Tidak ada penugasan sesuai pencarian." : "Belum ada penugasan supervisi yang sesuai filter."}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {displayedAssignments.map(a => {
                  const teacher = teachers.find(t => t.id === a.teacherId);
                  const supervisor = teachers.find(t => t.id === a.supervisorId);
                  const isSelected = selectedAssignment?.id === a.id;
                  const isCompleted = a.status === 'COMPLETED';
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAssignment(a)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between group relative overflow-hidden ${
                        isSelected 
                          ? 'bg-purple-50 border-purple-200 ring-2 ring-purple-100' 
                          : 'bg-white border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                      }`}
                    >
                      {isCompleted && (
                        <div className="absolute top-0 right-0 p-1 bg-green-500 text-white rounded-bl-lg">
                          <CheckCircle size={10} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 pr-2">
                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>
                          {teacher?.fullName || 'Guru'}
                        </div>
                        {teacher?.subject && (
                          <div className="text-[10px] text-gray-500 truncate">
                            Mapel: {teacher.subject}
                          </div>
                        )}
                        <div className="mt-1">
                          <span className="inline-block text-[9px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded truncate max-w-full">
                            Spv: {supervisor?.fullName || 'Belum Ditentukan'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-[9px]">
                            <Calendar size={10} />
                            {a.startDate && a.endDate ? (
                              `${new Date(a.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(a.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
                            ) : (
                              `${a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}`
                            )}
                          </div>
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold w-fit ${
                            isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {isCompleted ? 'SELESAI (EDITABLE)' : 'MENUNGGU'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`transition flex-shrink-0 ${isSelected ? 'text-purple-500 translate-x-1' : 'text-gray-300 group-hover:text-purple-400'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Assessment Form */}
        <div className="lg:col-span-3">
          {!selectedAssignment ? (
            <div className="bg-white h-full min-h-[400px] rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center p-12 text-center">
              <div className="p-6 bg-gray-50 rounded-full mb-6">
                <UserIcon size={48} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">Pilih Penugasan</h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Klik salah satu nama guru di sebelah kiri untuk mulai melakukan penilaian supervisi.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab('PLANNING')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition ${
                    activeTab === 'PLANNING' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/30' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Persiapan Pembelajaran Mendalam
                </button>
                <button
                  onClick={() => setActiveTab('RPP')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition ${
                    activeTab === 'RPP' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/30' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Pelaksanaan Pembelajaran Mendalam
                </button>
                <button
                  onClick={() => setActiveTab('IMPLEMENTATION')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition ${
                    activeTab === 'IMPLEMENTATION' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/30' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Umpan Balik Perencanaan Pembelajaran Mendalam
                </button>
              </div>

              <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-800">
                    {activeTab === 'PLANNING' && "INSTRUMEN SUPERVISI PERSIAPAN PEMBELAJARAN MENDALAM"}
                    {activeTab === 'RPP' && "INSTRUMEN SUPERVISI PELAKSANAAN PEMBELAJARAN MENDALAM"}
                    {activeTab === 'IMPLEMENTATION' && "INSTRUMEN UMPAN BALIK PERENCANAAN PEMBELAJARAN MENDALAM"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                    <div>
                      Guru: <span className="font-bold text-purple-600">{teachers.find(t => t.id === selectedAssignment.teacherId)?.fullName || 'N/A'}</span>
                      {teachers.find(t => t.id === selectedAssignment.teacherId)?.subject && (
                        <span className="text-gray-400 ml-1">({teachers.find(t => t.id === selectedAssignment.teacherId)?.subject})</span>
                      )}
                    </div>
                    <div>
                      Supervisor: <span className="font-bold text-gray-700">{teachers.find(t => t.id === selectedAssignment.supervisorId)?.fullName || 'N/A'}</span>
                    </div>
                    {selectedAssignment.startDate && selectedAssignment.endDate && (
                      <div className="text-gray-400">
                        Jadwal: {new Date(selectedAssignment.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(selectedAssignment.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualPrintAssignment(selectedAssignment);
                      setIsPrintModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition shadow-sm"
                    title="Cetak format lembar instrumen lengkap untuk guru ini"
                  >
                    <Printer size={14} />
                    <span>Cetak Instrumen Guru Ini</span>
                  </button>
                  <button
                    onClick={() => setSelectedAssignment(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-medium px-2 py-1"
                  >
                    Batal
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'PLANNING' && (
                  <div className="space-y-8">
                    {/* Header Bagian 1 */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50/50 p-4 rounded-xl border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">1</span>
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                            Instrumen Penilaian
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 ml-8">
                          Beri penilaian skor 1 sampai 4 pada setiap aspek/pertanyaan sesuai bukti observasi dan telaah persiapan pembelajaran.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-8 md:ml-0">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-gray-400">Total Skor Riil</div>
                          <div className="text-base font-black text-purple-700">
                            {calculatePlanningResults().totalRealScore} <span className="text-xs font-normal text-gray-500">/ 72</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-purple-200"></div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-gray-400">Nilai Akhir</div>
                          <div className="text-base font-black text-indigo-700">
                            {calculatePlanningResults().finalScore.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tabel Instrumen Penilaian */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-purple-900 text-white font-bold">
                            <th className="border border-purple-800 p-3 text-center w-12">No</th>
                            <th className="border border-purple-800 p-3 text-left w-44">Komponen yang Dimonitor</th>
                            <th className="border border-purple-800 p-3 text-left w-44">Indikator</th>
                            <th className="border border-purple-800 p-3 text-left">Pertanyaan/Aspek yang Dinilai</th>
                            <th className="border border-purple-800 p-3 text-center w-48">Skor (1–4)*</th>
                            <th className="border border-purple-800 p-3 text-left w-56">Catatan/Temuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {DEEP_LEARNING_SUPERVISION_ITEMS.map((item) => {
                            const currentScore = planningScores[item.id] || 0;
                            return (
                              <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                                {item.isFirstInGroup && (
                                  <>
                                    <td 
                                      rowSpan={item.groupRowSpan} 
                                      className="border border-gray-200 p-3 text-center font-black text-purple-900 bg-purple-50/40 align-top text-sm"
                                    >
                                      {item.groupLetter}
                                    </td>
                                    <td 
                                      rowSpan={item.groupRowSpan} 
                                      className="border border-gray-200 p-3 font-bold text-gray-800 bg-purple-50/20 align-top leading-snug"
                                    >
                                      {item.component}
                                    </td>
                                  </>
                                )}
                                <td className="border border-gray-200 p-3 font-semibold text-gray-700 align-top leading-snug bg-gray-50/30">
                                  {item.indicator}
                                </td>
                                <td className="border border-gray-200 p-3 text-gray-800 align-top leading-relaxed">
                                  {item.question}
                                </td>
                                <td className="border border-gray-200 p-3 align-top text-center bg-gray-50/30">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {[1, 2, 3, 4].map(val => (
                                      <button
                                        key={val}
                                        type="button"
                                        title={SCORE_DESCRIPTIONS[val]}
                                        onClick={() => setPlanningScores(prev => ({ ...prev, [item.id]: val }))}
                                        className={`w-8 h-8 rounded-lg font-black text-xs transition shadow-sm ${
                                          currentScore === val
                                            ? 'bg-purple-600 text-white ring-2 ring-purple-300 scale-105'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50 hover:border-purple-300'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-1.5 text-[10px] text-gray-500 font-medium min-h-[14px]">
                                    {currentScore > 0 ? (
                                      <span className="text-purple-700 font-semibold">{SCORE_DESCRIPTIONS[currentScore]}</span>
                                    ) : (
                                      <span className="text-gray-400 italic">Pilih skor 1-4</span>
                                    )}
                                  </div>
                                </td>
                                <td className="border border-gray-200 p-2.5 align-top">
                                  <textarea
                                    rows={2}
                                    placeholder="Tulis catatan atau temuan supervisor..."
                                    className="w-full text-xs p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-y placeholder:text-gray-400 transition"
                                    value={planningComments[item.id] || ''}
                                    onChange={(e) => setPlanningComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={4} className="border border-gray-200 p-3 text-right text-gray-700">
                              JUMLAH SKOR RIIL (Maksimal: 72)
                            </td>
                            <td className="border border-gray-200 p-3 text-center text-purple-700 text-base font-black">
                              {calculatePlanningResults().totalRealScore}
                            </td>
                            <td className="border border-gray-200 p-3 text-gray-500 text-[11px] font-normal">
                              Konversi Skala 80: <strong className="text-gray-800">{calculatePlanningResults().scaledTo80.toFixed(1)} / 80</strong>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="border border-gray-200 p-3 text-right text-gray-700">
                              NILAI AKHIR = (Skor Riil / 72) × 100
                            </td>
                            <td className="border border-gray-200 p-3 text-center text-indigo-700 text-base font-black">
                              {calculatePlanningResults().finalScore.toFixed(2)}
                            </td>
                            <td className="border border-gray-200 p-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black text-white ${
                                calculatePlanningResults().predicate === 'Sangat Baik' ? 'bg-emerald-600' :
                                calculatePlanningResults().predicate === 'Baik' ? 'bg-blue-600' :
                                calculatePlanningResults().predicate === 'Kurang' ? 'bg-amber-600' : 'bg-rose-600'
                              }`}>
                                {calculatePlanningResults().predicate}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Keterangan Skor & Kategori Kesiapan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                        <h5 className="text-xs font-black text-purple-900 uppercase mb-2 tracking-wider">
                          Keterangan Skor:
                        </h5>
                        <ul className="space-y-1.5 text-xs text-gray-700">
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-purple-700 font-bold border border-purple-200 flex items-center justify-center text-[10px]">1</span>
                            <span><strong>Tidak ada</strong> (Belum tersedia sama sekali)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-purple-700 font-bold border border-purple-200 flex items-center justify-center text-[10px]">2</span>
                            <span><strong>Ada tetapi belum lengkap</strong> (Perlu pemenuhan komponen)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-purple-700 font-bold border border-purple-200 flex items-center justify-center text-[10px]">3</span>
                            <span><strong>Lengkap namun belum optimal</strong> (Cukup baik, butuh pengayaan)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-purple-700 font-bold border border-purple-200 flex items-center justify-center text-[10px]">4</span>
                            <span><strong>Lengkap dan sangat baik</strong> (Memenuhi standar pembelajaran mendalam)</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                        <h5 className="text-xs font-black text-indigo-900 uppercase mb-2 tracking-wider">
                          Kategori Kesiapan:
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { label: 'Sangat Kurang', range: '< 55', color: 'bg-rose-50 border-rose-200 text-rose-700' },
                            { label: 'Kurang', range: '55.00 - 69.99', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                            { label: 'Baik', range: '70.00 - 85.99', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                            { label: 'Sangat Baik', range: '86.00 - 100.00', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                          ].map(cat => {
                            const isSelected = readinessCategory === cat.label;
                            return (
                              <button
                                key={cat.label}
                                type="button"
                                onClick={() => setReadinessCategory(cat.label as any)}
                                className={`p-2 rounded-lg border text-left transition flex items-center justify-between ${cat.color} ${
                                  isSelected ? 'ring-2 ring-indigo-500 font-bold shadow-sm' : 'opacity-80 hover:opacity-100'
                                }`}
                              >
                                <span>{cat.label}</span>
                                <span className="text-[10px] font-mono opacity-75">{cat.range}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 italic">
                          *Kategori otomatis dihitung dari Nilai Akhir, namun supervisor dapat memilih/menyesuaikan jika ada pertimbangan khusus.
                        </p>
                      </div>
                    </div>

                    {/* Header Bagian 2 */}
                    <div className="pt-6 border-t border-gray-200 space-y-4">
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 p-4 rounded-xl border border-amber-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center">2</span>
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                            Rekomendasi Tindak Lanjut
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 ml-8">
                          Supervisor menuliskan rencana pendampingan, perbaikan, dan tindak lanjut secara manual pada 4 pertanyaan di bawah ini:
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            1. Penguatan pada Aspek yang Lemah:
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan aspek-aspek persiapan pembelajaran yang perlu penguatan intensif..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-purple-500 outline-none leading-relaxed"
                            value={followUpRecommendations.weakAspects}
                            onChange={(e) => setFollowUpRecommendations(prev => ({ ...prev, weakAspects: e.target.value }))}
                          />
                        </div>

                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            2. Strategi Perbaikan Jangka Pendek (1–4 Minggu):
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan langkah-langkah cepat perbaikan yang dapat segera dieksekusi oleh guru dalam 1-4 minggu ke depan..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-purple-500 outline-none leading-relaxed"
                            value={followUpRecommendations.shortTermStrategy}
                            onChange={(e) => setFollowUpRecommendations(prev => ({ ...prev, shortTermStrategy: e.target.value }))}
                          />
                        </div>

                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            3. Strategi Pengembangan Jangka Panjang (Satu Semester/Tahun):
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan program pengembangan kompetensi guru berkelanjutan, pelatihan, atau inovasi modul ajar jangka panjang..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-purple-500 outline-none leading-relaxed"
                            value={followUpRecommendations.longTermStrategy}
                            onChange={(e) => setFollowUpRecommendations(prev => ({ ...prev, longTermStrategy: e.target.value }))}
                          />
                        </div>

                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            4. Sumber Daya/ Dukungan yang Dibutuhkan:
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan fasilitas, bahan ajar, pendampingan MGMP/sekolah, atau sarana TIK yang dibutuhkan guru..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-purple-500 outline-none leading-relaxed"
                            value={followUpRecommendations.resourcesNeeded}
                            onChange={(e) => setFollowUpRecommendations(prev => ({ ...prev, resourcesNeeded: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Format Tanda Tangan 3 Pihak Sesuai Permintaan */}
                    <div className="pt-6 border-t border-gray-200 bg-gray-50/70 p-5 rounded-2xl border border-gray-200">
                      <div className="text-right text-xs text-gray-500 mb-4">
                        {user.schoolName || 'Sekolah'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs">
                        <div className="space-y-12">
                          <p className="font-semibold text-gray-700">Guru yang Disupervisi,</p>
                          <div>
                            <p className="font-bold underline text-gray-900">
                              {teachers.find(t => t.id === selectedAssignment.teacherId)?.fullName || 'Guru Dinilai'}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              NIP. {teachers.find(t => t.id === selectedAssignment.teacherId)?.nip || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-12">
                          <p className="font-semibold text-gray-700">Supervisor / Penilai,</p>
                          <div>
                            <p className="font-bold underline text-gray-900">
                              {teachers.find(t => t.id === selectedAssignment.supervisorId)?.fullName || user.fullName}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              NIP. {teachers.find(t => t.id === selectedAssignment.supervisorId)?.nip || user.nip || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-12">
                          <p className="font-semibold text-gray-700">
                            Mengetahui,<br /><span className="font-bold">Kepala Sekolah</span>
                          </p>
                          <div>
                            <p className="font-bold underline text-gray-900">
                              {teachers.find(t => t.additionalRole === 'KEPALA_SEKOLAH')?.fullName || 'Kepala Sekolah'}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              NIP. {teachers.find(t => t.additionalRole === 'KEPALA_SEKOLAH')?.nip || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'RPP' && (
                  <div className="space-y-8">
                    {/* Header Bagian 1 */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 rounded-xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">1</span>
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                            Instrumen Penilaian Pelaksanaan
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 ml-8">
                          Beri penilaian skor 1 sampai 4 pada setiap aspek/pertanyaan sesuai bukti observasi dan telaah pelaksanaan pembelajaran mendalam.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-8 md:ml-0">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-gray-400">Total Skor Riil</div>
                          <div className="text-base font-black text-blue-700">
                            {calculateLessonPlanResults().totalRealScore} <span className="text-xs font-normal text-gray-500">/ 68</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-blue-200"></div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-gray-400">Skala 80</div>
                          <div className="text-base font-black text-indigo-600">
                            {calculateLessonPlanResults().scaledTo80.toFixed(1)} <span className="text-xs font-normal text-gray-500">/ 80</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-blue-200"></div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-gray-400">Nilai Akhir</div>
                          <div className="text-base font-black text-purple-700">
                            {calculateLessonPlanResults().finalScore.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tabel Instrumen Penilaian Pelaksanaan Pembelajaran Mendalam */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-blue-900 text-white font-bold">
                            <th className="border border-blue-800 p-3 text-center w-12">No</th>
                            <th className="border border-blue-800 p-3 text-left w-44">Komponen yang Dimonitor</th>
                            <th className="border border-blue-800 p-3 text-left w-44">Indikator</th>
                            <th className="border border-blue-800 p-3 text-left">Pertanyaan/Aspek yang Dinilai</th>
                            <th className="border border-blue-800 p-3 text-center w-48">Skor (1–4)*</th>
                            <th className="border border-blue-800 p-3 text-left w-56">Catatan/Temuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS.map((item) => {
                            const currentScore = lessonPlanScores[item.id] || 0;
                            return (
                              <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                                {item.isFirstInGroup && (
                                  <>
                                    <td 
                                      rowSpan={item.groupRowSpan} 
                                      className="border border-gray-200 p-3 text-center font-black text-blue-900 bg-blue-50/40 align-top text-sm"
                                    >
                                      {item.groupLetter}
                                    </td>
                                    <td 
                                      rowSpan={item.groupRowSpan} 
                                      className="border border-gray-200 p-3 font-bold text-gray-800 bg-blue-50/20 align-top leading-snug"
                                    >
                                      {item.component}
                                    </td>
                                  </>
                                )}
                                <td className="border border-gray-200 p-3 font-semibold text-gray-700 align-top leading-snug bg-gray-50/30">
                                  {item.indicator}
                                </td>
                                <td className="border border-gray-200 p-3 text-gray-800 align-top leading-relaxed">
                                  {item.question}
                                </td>
                                <td className="border border-gray-200 p-3 align-top text-center bg-gray-50/30">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {[1, 2, 3, 4].map(val => (
                                      <button
                                        key={val}
                                        type="button"
                                        title={SCORE_DESCRIPTIONS[val]}
                                        onClick={() => setLessonPlanScores(prev => ({ ...prev, [item.id]: val }))}
                                        className={`w-8 h-8 rounded-lg font-black text-xs transition shadow-sm ${
                                          currentScore === val
                                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 scale-105'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-1.5 text-[10px] text-gray-500 font-medium min-h-[14px]">
                                    {currentScore > 0 ? (
                                      <span className="text-blue-700 font-semibold">{SCORE_DESCRIPTIONS[currentScore]}</span>
                                    ) : (
                                      <span className="text-gray-400 italic">Pilih skor 1-4</span>
                                    )}
                                  </div>
                                </td>
                                <td className="border border-gray-200 p-2.5 align-top">
                                  <textarea
                                    rows={2}
                                    placeholder="Tulis catatan atau temuan supervisor..."
                                    className="w-full text-xs p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-y placeholder:text-gray-400 transition"
                                    value={lessonPlanComments[item.id] || ''}
                                    onChange={(e) => setLessonPlanComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={4} className="border border-gray-200 p-3 text-right text-gray-700">
                              JUMLAH SKOR RIIL (Maksimal: 68)
                            </td>
                            <td className="border border-gray-200 p-3 text-center text-blue-700 text-base font-black">
                              {calculateLessonPlanResults().totalRealScore}
                            </td>
                            <td className="border border-gray-200 p-3 text-gray-500 text-[11px] font-normal">
                              Total Skor Skala 80: <strong className="text-gray-800">{calculateLessonPlanResults().scaledTo80.toFixed(1)} / 80</strong>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="border border-gray-200 p-3 text-right text-gray-700">
                              NILAI AKHIR = (Skor Riil / 68) × 100
                            </td>
                            <td className="border border-gray-200 p-3 text-center text-purple-700 text-base font-black">
                              {calculateLessonPlanResults().finalScore.toFixed(2)}
                            </td>
                            <td className="border border-gray-200 p-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black text-white ${
                                calculateLessonPlanResults().predicate === 'Sangat Baik' ? 'bg-emerald-600' :
                                calculateLessonPlanResults().predicate === 'Baik' ? 'bg-blue-600' :
                                calculateLessonPlanResults().predicate === 'Kurang' ? 'bg-amber-600' : 'bg-rose-600'
                              }`}>
                                {calculateLessonPlanResults().predicate}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Keterangan Skor & Kategori Kesiapan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                        <h5 className="text-xs font-black text-blue-900 uppercase mb-2 tracking-wider">
                          Keterangan Skor:
                        </h5>
                        <ul className="space-y-1.5 text-xs text-gray-700">
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-blue-700 font-bold border border-blue-200 flex items-center justify-center text-[10px]">1</span>
                            <span><strong>Tidak ada</strong> (Belum terlaksana sama sekali)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-blue-700 font-bold border border-blue-200 flex items-center justify-center text-[10px]">2</span>
                            <span><strong>Ada tetapi belum lengkap</strong> (Terlaksana sebagian / belum terstruktur)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-blue-700 font-bold border border-blue-200 flex items-center justify-center text-[10px]">3</span>
                            <span><strong>Lengkap namun belum optimal</strong> (Cukup baik, butuh pengayaan)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white text-blue-700 font-bold border border-blue-200 flex items-center justify-center text-[10px]">4</span>
                            <span><strong>Lengkap dan sangat baik</strong> (Memenuhi prinsip pembelajaran mendalam)</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                        <h5 className="text-xs font-black text-indigo-900 uppercase mb-2 tracking-wider">
                          Kategori Kesiapan:
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { label: 'Sangat Kurang', range: '< 55', color: 'bg-rose-50 border-rose-200 text-rose-700' },
                            { label: 'Kurang', range: '55.00 - 69.99', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                            { label: 'Baik', range: '70.00 - 85.99', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                            { label: 'Sangat Baik', range: '86.00 - 100.00', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                          ].map(cat => {
                            const isSelected = lessonPlanReadinessCategory === cat.label;
                            return (
                              <button
                                key={cat.label}
                                type="button"
                                onClick={() => setLessonPlanReadinessCategory(cat.label as any)}
                                className={`p-2 rounded-lg border text-left transition flex items-center justify-between ${cat.color} ${
                                  isSelected ? 'ring-2 ring-indigo-500 font-bold shadow-sm' : 'opacity-80 hover:opacity-100'
                                }`}
                              >
                                <span>{cat.label}</span>
                                <span className="text-[10px] font-mono opacity-75">{cat.range}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 italic">
                          *Total Skor: {calculateLessonPlanResults().scaledTo80.toFixed(1)} / 80. Kategori dihitung otomatis, supervisor dapat menyesuaikan.
                        </p>
                      </div>
                    </div>

                    {/* Header Bagian 2: Rekomendasi Tindak Lanjut */}
                    <div className="pt-6 border-t border-gray-200 space-y-4">
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 p-4 rounded-xl border border-amber-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center">2</span>
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                            Rekomendasi Tindak Lanjut
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 ml-8">
                          Supervisor menuliskan rencana pendampingan, perbaikan, dan tindak lanjut pelaksanaan secara manual pada 4 poin di bawah ini:
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            1. Penguatan pada Aspek yang Lemah:
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan aspek-aspek pelaksanaan pembelajaran yang perlu penguatan intensif..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none leading-relaxed"
                            value={lessonPlanFollowUp.weakAspects}
                            onChange={(e) => setLessonPlanFollowUp(prev => ({ ...prev, weakAspects: e.target.value }))}
                          />
                        </div>

                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            2. Strategi Perbaikan Jangka Pendek (1–4 Minggu):
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan langkah-langkah konkret perbaikan pelaksanaan pembelajaran dalam 1-4 minggu ke depan..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none leading-relaxed"
                            value={lessonPlanFollowUp.shortTermStrategy}
                            onChange={(e) => setLessonPlanFollowUp(prev => ({ ...prev, shortTermStrategy: e.target.value }))}
                          />
                        </div>

                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            3. Strategi Pengembangan Jangka Panjang (Satu Semester/Tahun):
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan program pengembangan kompetensi mengajar dan inovasi pedagogik jangka panjang..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none leading-relaxed"
                            value={lessonPlanFollowUp.longTermStrategy}
                            onChange={(e) => setLessonPlanFollowUp(prev => ({ ...prev, longTermStrategy: e.target.value }))}
                          />
                        </div>

                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
                          <label className="block text-xs font-bold text-gray-800 mb-1.5">
                            4. Sumber Daya/ Dukungan yang Dibutuhkan:
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tuliskan fasilitas kelas, perangkat TIK, media pembelajaran, atau pelatihan yang dibutuhkan guru..."
                            className="w-full text-xs p-3 bg-gray-50/70 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none leading-relaxed"
                            value={lessonPlanFollowUp.resourcesNeeded}
                            onChange={(e) => setLessonPlanFollowUp(prev => ({ ...prev, resourcesNeeded: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Format Tanda Tangan 3 Pihak */}
                    <div className="pt-6 border-t border-gray-200 bg-gray-50/70 p-5 rounded-2xl border border-gray-200">
                      <div className="text-right text-xs text-gray-500 mb-4">
                        {user.schoolName || 'Sekolah'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs">
                        <div className="space-y-12">
                          <p className="font-semibold text-gray-700">Guru yang Disupervisi,</p>
                          <div>
                            <p className="font-bold underline text-gray-900">
                              {teachers.find(t => t.id === selectedAssignment.teacherId)?.fullName || 'Guru Dinilai'}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              NIP. {teachers.find(t => t.id === selectedAssignment.teacherId)?.nip || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-12">
                          <p className="font-semibold text-gray-700">Supervisor / Penilai,</p>
                          <div>
                            <p className="font-bold underline text-gray-900">
                              {teachers.find(t => t.id === selectedAssignment.supervisorId)?.fullName || user.fullName}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              NIP. {teachers.find(t => t.id === selectedAssignment.supervisorId)?.nip || user.nip || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-12">
                          <p className="font-semibold text-gray-700">
                            Mengetahui,<br /><span className="font-bold">Kepala Sekolah</span>
                          </p>
                          <div>
                            <p className="font-bold underline text-gray-900">
                              {teachers.find(t => t.additionalRole === 'KEPALA_SEKOLAH')?.fullName || 'Kepala Sekolah'}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              NIP. {teachers.find(t => t.additionalRole === 'KEPALA_SEKOLAH')?.nip || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'IMPLEMENTATION' && (
                  <div className="space-y-6">
                    {/* Header Card: Metadata Perencanaan Pembelajaran */}
                    <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-blue-50/50 p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
                      <div className="border-b border-purple-100/80 pb-3">
                        <h4 className="text-sm font-black text-purple-900 uppercase tracking-wider flex items-center gap-2">
                          <ClipboardCheck size={18} className="text-purple-600" />
                          Informasi Perencanaan Pembelajaran yang Ditelaah
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Supervisor dapat mengisi atau menyesuaikan identitas dan tautan perencanaan pembelajaran yang ditelaah.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div className="md:col-span-2 lg:col-span-3">
                          <label className="block font-bold text-gray-700 mb-1">
                            Tautan Perencanaan Pembelajaran yang Ditelaah:
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="url"
                                placeholder="https://drive.google.com/... atau tautan modul/RPP online"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs font-medium text-gray-800 placeholder:text-gray-400"
                                value={implPlanningUrl}
                                onChange={(e) => setImplPlanningUrl(e.target.value)}
                              />
                            </div>
                            {implPlanningUrl && (
                              <a
                                href={implPlanningUrl.startsWith('http') ? implPlanningUrl : `https://${implPlanningUrl}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-sm text-xs whitespace-nowrap"
                              >
                                <ExternalLink size={13} />
                                Buka Tautan
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Jenjang pada Perencanaan Pembelajaran:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: SMA / SMK / SMP / SD / Fase E"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs text-gray-800"
                            value={implLevel}
                            onChange={(e) => setImplLevel(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Mata Pelajaran pada Perencanaan Pembelajaran:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Informatika / Matematika / Bahasa Indonesia"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs text-gray-800 font-semibold"
                            value={implSubject}
                            onChange={(e) => setImplSubject(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Kelas pada Perencanaan Pembelajaran:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: X-A / XI MIPA 1 / VII"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs text-gray-800"
                            value={implGradeClass}
                            onChange={(e) => setImplGradeClass(e.target.value)}
                          />
                        </div>

                        <div className="md:col-span-2 lg:col-span-3">
                          <label className="block font-bold text-gray-700 mb-1">
                            Judul Perencanaan Pembelajaran:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Modul Ajar Penerapan Algoritma dan Struktur Data dalam Pemecahan Masalah Nyata"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs font-semibold text-gray-800"
                            value={implTitle}
                            onChange={(e) => setImplTitle(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Scale Guide */}
                    <div className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 text-amber-900">
                      <div className="font-bold flex items-center gap-1.5">
                        <Star size={14} className="text-amber-600 fill-amber-600" />
                        Panduan Skala Penilaian:
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200"><strong>1</strong> = Hampir tidak ada</span>
                        <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200"><strong>2</strong> = Sedikit dan lemah</span>
                        <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200"><strong>3</strong> = Cukup</span>
                        <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200"><strong>4</strong> = Memadai</span>
                      </div>
                    </div>

                    {/* Table of 15 Feedback Items */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-purple-800 to-indigo-800 text-white">
                            <th className="border-b border-purple-700 p-3 text-center w-12 font-bold">No</th>
                            <th className="border-b border-purple-700 p-3 text-left font-bold min-w-[280px]">
                              Aspek yang Diamati
                            </th>
                            <th className="border-b border-purple-700 p-3 text-left font-bold min-w-[260px]">
                              Komentar Kritis
                            </th>
                            <th className="border-b border-purple-700 p-3 text-center font-bold w-48 whitespace-nowrap">
                              Skor (1 - 4)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS.map((item) => {
                            const score = implScores[item.id] ?? 0;
                            return (
                              <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                                <td className="p-3 text-center font-bold text-gray-600 bg-gray-50/50 align-top">
                                  {item.number}
                                </td>
                                <td className="p-3 text-gray-800 leading-relaxed align-top">
                                  <span className="font-semibold text-gray-900">{item.aspect}</span>
                                </td>
                                <td className="p-3 align-top">
                                  <textarea
                                    placeholder="Tuliskan komentar kritis supervisor terhadap aspek ini..."
                                    rows={2}
                                    className="w-full p-2 bg-gray-50/70 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent transition resize-y"
                                    value={implComments[item.id] || ''}
                                    onChange={(e) => setImplComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  />
                                </td>
                                <td className="p-3 align-middle text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {[1, 2, 3, 4].map(val => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => setImplScores(prev => ({ ...prev, [item.id]: val }))}
                                        className={`w-8 h-8 rounded-lg font-bold text-xs transition shadow-sm ${
                                          score === val 
                                            ? 'bg-purple-600 text-white ring-2 ring-purple-300 scale-105' 
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                                        }`}
                                        title={`Skor ${val}: ${
                                          val === 1 ? 'Hampir tidak ada' : val === 2 ? 'Sedikit dan lemah' : val === 3 ? 'Cukup' : 'Memadai'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
                          <tr>
                            <td colSpan={2} className="p-3 text-right text-gray-600">
                              JUMLAH SKOR RIIL (Maksimal: 60)
                            </td>
                            <td className="p-3 text-gray-500 font-normal italic text-right">
                              Total Terisi: {Object.keys(implScores).filter(k => (implScores[k] || 0) > 0).length} / 15 Aspek
                            </td>
                            <td className="p-3 text-center text-purple-700 text-base font-black">
                              {calculateImplementationResults().totalRealScore} / 60
                            </td>
                          </tr>
                          <tr className="bg-purple-50/50">
                            <td colSpan={2} className="p-3 text-right text-purple-900">
                              NILAI AKHIR = (Skor Riil / 60) × 100
                            </td>
                            <td className="p-3 text-right text-purple-900 text-base font-black">
                              {calculateImplementationResults().finalScore.toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider ${
                                calculateImplementationResults().finalScore >= 86
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : calculateImplementationResults().finalScore >= 70
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : calculateImplementationResults().finalScore >= 55
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {calculateImplementationResults().predicate}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Section Butir 16, 17, 18 Refleksi Kualitatif Manual */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
                      <div className="border-b border-gray-100 pb-3">
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle size={18} className="text-indigo-600" />
                          Umpan Balik Kualitatif & Rekomendasi Tindak Lanjut
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Isian butir reflektif nomor 16, 17, dan 18 dapat ditulis secara mandiri oleh supervisor.
                        </p>
                      </div>

                      {/* No 16 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-gray-800">
                          No 16 . Tuliskan kelebihan Perencanaan Pembelajaran:
                        </label>
                        <textarea
                          placeholder="Tuliskan kelebihan, kekuatan, dan praktik baik dari perencanaan pembelajaran yang ditelaah..."
                          rows={3}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                          value={implAdvantages}
                          onChange={(e) => setImplAdvantages(e.target.value)}
                        />
                      </div>

                      {/* No 17 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-gray-800">
                          No 17 . Tuliskan hal yang perlu ditingkatkan dari Perencanaan Pembelajaran:
                        </label>
                        <textarea
                          placeholder="Tuliskan aspek atau indikator yang masih perlu ditingkatkan, dilengkapi, atau dioptimalkan..."
                          rows={3}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                          value={implAreasToImprove}
                          onChange={(e) => setImplAreasToImprove(e.target.value)}
                        />
                      </div>

                      {/* No 18 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-gray-800">
                          No 18 . Tuliskan rekomendasi dan lanjutkan dengan revisi Perencanaan Pembelajaran sesuai prinsip PM:
                        </label>
                        <textarea
                          placeholder="Tuliskan rekomendasi perbaikan dan langkah konkret revisi perencanaan pembelajaran sesuai prinsip Pembelajaran Mendalam (PM)..."
                          rows={4}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                          value={implRecommendations}
                          onChange={(e) => setImplRecommendations(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Tanda Tangan: Hanya Pemberi Umpan Balik (Supervisor) */}
                    <div className="bg-gray-50/70 p-6 rounded-2xl border border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-end items-center">
                        <div className="text-center min-w-[260px] space-y-12">
                          <p className="font-semibold text-gray-700 text-xs">
                            Pemberi Umpan Balik,
                          </p>
                          <div className="pt-2">
                            <p className="font-bold underline text-gray-900 text-xs">
                              {teachers.find(t => t.id === selectedAssignment.supervisorId)?.fullName || user.fullName}
                            </p>
                            <p className="text-gray-500 text-[11px] mt-0.5">
                              NIP. {teachers.find(t => t.id === selectedAssignment.supervisorId)?.nip || user.nip || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-gray-100 mt-8 gap-4">
                  <div className="text-xs text-gray-500 italic max-w-sm">
                    Penilaian disimpan secara berkelanjutan. Anda bisa menyimpan tiap tab dan kembali lagi nanti untuk menyelesaikan seluruh instrumen.
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveTab}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition border border-blue-200 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Simpan Progres
                    </button>
                    <button
                      onClick={handleFinishSupervision}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                      {selectedAssignment.status === 'COMPLETED' ? 'Update & Selesai' : 'Selesaikan Supervisi'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Cetak Instrumen Manual */}
      <PrintManualSupervisionModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        currentUser={user}
        teachers={teachers}
        selectedAssignment={manualPrintAssignment}
      />
    </div>
  );
};

export default SupervisionAssessment;
