
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SupervisionAssignment, SupervisionResult } from '../types';
import { getAssignmentsForSupervisor, getSchoolTeachers, saveSupervisionResult } from '../services/database';
import { ClipboardCheck, User as UserIcon, Calendar, CheckCircle, AlertCircle, Loader2, ChevronRight, Save, Star } from './Icons';

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
  const [selectedAssignment, setSelectedAssignment] = useState<SupervisionAssignment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'PLANNING' | 'RPP' | 'IMPLEMENTATION'>('PLANNING');

  // Tab 1: Administrasi Perencanaan Pembelajaran
  const [planningScores, setPlanningScores] = useState<Record<string, number>>({});
  const [planningComments, setPlanningComments] = useState<Record<string, string>>({});
  const [coachingSuggestion, setCoachingSuggestion] = useState('');

  // Tab 2: RPP Guru
  const [lessonPlanScores, setLessonPlanScores] = useState<Record<string, number>>({});
  const [lessonPlanComments, setLessonPlanComments] = useState<Record<string, string>>({});
  const [lessonPlanCoaching, setLessonPlanCoaching] = useState('');

  // Tab 3: Pelaksanaan Pembelajaran
  const [implScores, setImplScores] = useState<Record<string, number>>({});
  const [implComments, setImplComments] = useState<Record<string, string>>({});
  const [implCoaching, setImplCoaching] = useState('');

  // Tab 3: Legacy/Placeholder state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!user.isSupervisor) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user.id, user.isSupervisor]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [myAssignments, schoolTeachers] = await Promise.all([
        getAssignmentsForSupervisor(user.id),
        getSchoolTeachers(user.schoolNpsn!)
      ]);
      setAssignments(myAssignments.filter(a => a.status === 'PENDING'));
      setTeachers(schoolTeachers);
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAssignment = (assignment: SupervisionAssignment) => {
    setSelectedAssignment(assignment);
    
    // Reset Tab 1
    const initialPlanningScores: Record<string, number> = {};
    PLANNING_ADMIN_COMPONENTS.forEach(c => { initialPlanningScores[c] = 0; });
    setPlanningScores(initialPlanningScores);
    setPlanningComments({});
    setCoachingSuggestion('');

    // Reset Tab 2
    const initialLessonPlanScores: Record<string, number> = {};
    LESSON_PLAN_COMPONENTS.forEach(c => { initialLessonPlanScores[c] = 0; });
    setLessonPlanScores(initialLessonPlanScores);
    setLessonPlanComments({});
    setLessonPlanCoaching('');

    // Reset Tab 3
    const initialImplScores: Record<string, number> = {};
    IMPLEMENTATION_COMPONENTS.forEach(c => { initialImplScores[c] = 1; }); // Min score is 1 for this one
    setImplScores(initialImplScores);
    setImplComments({});
    setImplCoaching('');

    // Reset Legacy
    const initialScores: Record<string, number> = {};
    SUPERVISION_ASPECTS.forEach(aspect => { initialScores[aspect] = 0; });
    setScores(initialScores);
    setComments({});
    setGeneralNotes('');
    
    setSuccessMessage('');
    setActiveTab('PLANNING');
  };

  const calculatePlanningResults = () => {
    const totalRealScore = Object.values(planningScores).reduce((a, b) => a + b, 0);
    const finalScore = (totalRealScore / 24) * 100;
    
    let predicate = 'KURANG';
    if (finalScore > 90) predicate = 'BAIK SEKALI';
    else if (finalScore > 75) predicate = 'BAIK';
    else if (finalScore > 60) predicate = 'CUKUP';

    return { totalRealScore, finalScore, predicate };
  };

  const calculateLessonPlanResults = () => {
    const totalRealScore = Object.values(lessonPlanScores).reduce((a, b) => a + b, 0);
    const finalScore = (totalRealScore / 34) * 100;
    
    let predicate = 'KURANG';
    if (finalScore > 90) predicate = 'BAIK SEKALI';
    else if (finalScore > 75) predicate = 'BAIK';
    else if (finalScore > 60) predicate = 'CUKUP';

    return { totalRealScore, finalScore, predicate };
  };

  const calculateImplementationResults = () => {
    const totalRealScore = Object.values(implScores).reduce((a, b) => a + b, 0);
    const finalScore = (totalRealScore / 76) * 100; // 19 components * 4
    
    let predicate = 'KURANG';
    if (finalScore > 90) predicate = 'BAIK SEKALI';
    else if (finalScore > 75) predicate = 'BAIK';
    else if (finalScore > 60) predicate = 'CUKUP';

    return { totalRealScore, finalScore, predicate };
  };

  const handleSubmit = async () => {
    if (!selectedAssignment) return;

    setIsSaving(true);
    try {
      const planningData = calculatePlanningResults();
      const lessonPlanData = calculateLessonPlanResults();
      const implData = calculateImplementationResults();

      const legacyAspects = SUPERVISION_ASPECTS.map(aspect => ({
        aspect,
        score: scores[aspect] || 0,
        comment: comments[aspect] || ''
      }));

      const result: Omit<SupervisionResult, 'id'|'lastModified'|'isSynced'> = {
        assignmentId: selectedAssignment.id,
        supervisorId: user.id,
        teacherId: selectedAssignment.teacherId,
        schoolNpsn: user.schoolNpsn!,
        date: new Date().toISOString().split('T')[0],
        score: (planningData.finalScore + lessonPlanData.finalScore + implData.finalScore) / 3, // Combined average
        notes: generalNotes,
        planningAdmin: {
          scores: planningScores,
          comments: planningComments,
          totalRealScore: planningData.totalRealScore,
          finalScore: planningData.finalScore,
          predicate: planningData.predicate,
          coachingSuggestion
        },
        lessonPlan: {
          scores: lessonPlanScores,
          comments: lessonPlanComments,
          totalRealScore: lessonPlanData.totalRealScore,
          finalScore: lessonPlanData.finalScore,
          predicate: lessonPlanData.predicate,
          coachingSuggestion: lessonPlanCoaching
        },
        implementation: {
          scores: implScores,
          comments: implComments,
          totalRealScore: implData.totalRealScore,
          finalScore: implData.finalScore,
          predicate: implData.predicate,
          coachingSuggestion: implCoaching
        },
        aspects: legacyAspects // Keep for backward compatibility
      };

      await saveSupervisionResult(result);
      setSuccessMessage("Penilaian supervisi berhasil disimpan!");
      setSelectedAssignment(null);
      await fetchData();
    } catch (error) {
      console.error("Failed to save supervision result:", error);
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
          <ClipboardCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Instrumen Supervisi Akademik</h2>
          <p className="text-gray-500 text-sm">
            Lakukan penilaian terhadap rekan sejawat sesuai dengan penugasan dari Wakasek Kurikulum.
          </p>
        </div>
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
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="text-blue-600" size={18} />
              Tugas Menunggu
            </h3>
            
            {assignments.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-xs text-gray-400 italic">Tidak ada penugasan supervisi yang aktif.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => {
                  const teacher = teachers.find(t => t.id === a.teacherId);
                  const isSelected = selectedAssignment?.id === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAssignment(a)}
                      className={`w-full text-left p-4 rounded-xl border transition flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-purple-50 border-purple-200 ring-2 ring-purple-100' 
                          : 'bg-white border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>
                          {teacher?.fullName || 'Guru'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                          <Calendar size={12} />
                          Rencana: {a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                        </div>
                      </div>
                      <ChevronRight size={18} className={`transition ${isSelected ? 'text-purple-500 translate-x-1' : 'text-gray-300 group-hover:text-purple-400'}`} />
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
                  Administrasi Perencanaan
                </button>
                <button
                  onClick={() => setActiveTab('RPP')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition ${
                    activeTab === 'RPP' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/30' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  RPP Guru
                </button>
                <button
                  onClick={() => setActiveTab('IMPLEMENTATION')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition ${
                    activeTab === 'IMPLEMENTATION' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/30' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Pelaksanaan Pembelajaran
                </button>
              </div>

              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">
                    {activeTab === 'PLANNING' && "Administrasi Perencanaan Pembelajaran"}
                    {activeTab === 'RPP' && "Rencana Pelaksanaan Pembelajaran (RPP) Guru"}
                    {activeTab === 'IMPLEMENTATION' && "Supervisi Pelaksanaan Pembelajaran"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Guru: <span className="font-bold text-purple-600">{teachers.find(t => t.id === selectedAssignment.teacherId)?.fullName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAssignment(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-medium"
                >
                  Batal
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'PLANNING' && (
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700">
                            <th className="border p-3 text-center w-12">No</th>
                            <th className="border p-3 text-left">Komponen</th>
                            <th className="border p-3 text-center w-48">Kriteria Nilai (0-2)</th>
                            <th className="border p-3 text-left">Catatan Perbaikan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PLANNING_ADMIN_COMPONENTS.map((comp, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="border p-3 text-center font-medium">{idx + 1}</td>
                              <td className="border p-3 font-bold text-gray-800">{comp}</td>
                              <td className="border p-3">
                                <div className="flex justify-center gap-2">
                                  {[0, 1, 2].map(val => (
                                    <button
                                      key={val}
                                      onClick={() => setPlanningScores(prev => ({ ...prev, [comp]: val }))}
                                      className={`w-8 h-8 rounded-full font-bold transition ${
                                        planningScores[comp] === val 
                                          ? 'bg-purple-600 text-white shadow-md' 
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="border p-3">
                                <input
                                  type="text"
                                  placeholder="..."
                                  className="w-full bg-transparent outline-none border-b border-transparent focus:border-purple-300"
                                  value={planningComments[comp] || ''}
                                  onChange={(e) => setPlanningComments(prev => ({ ...prev, [comp]: e.target.value }))}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                          <tr>
                            <td colSpan={2} className="border p-3 text-right">JUMLAH SKOR RIIL</td>
                            <td className="border p-3 text-center text-purple-600 text-lg">
                              {Object.values(planningScores).reduce((a, b) => a + b, 0)}
                            </td>
                            <td className="border p-3"></td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border p-3 text-right">JUMLAH SKOR IDEAL</td>
                            <td className="border p-3 text-center">24</td>
                            <td className="border p-3"></td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border p-3 text-right">NILAI AKHIR</td>
                            <td className="border p-3 text-center text-blue-600 text-lg">
                              {calculatePlanningResults().finalScore.toFixed(2)}
                            </td>
                            <td className="border p-3 bg-black text-white text-center uppercase tracking-widest">
                              {calculatePlanningResults().predicate}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                      <label className="block text-sm font-bold text-gray-800 mb-2">Saran Pembinaan</label>
                      <textarea
                        placeholder="Berikan saran pembinaan untuk guru..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        rows={4}
                        value={coachingSuggestion}
                        onChange={(e) => setCoachingSuggestion(e.target.value)}
                      />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h5 className="text-xs font-black text-blue-600 uppercase mb-2 tracking-widest">Keterangan Nilai:</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-[10px]"><span className="font-bold">A (Baik Sekali):</span> 90.01 - 100.00</div>
                        <div className="text-[10px]"><span className="font-bold">B (Baik):</span> 75.01 - 90.00</div>
                        <div className="text-[10px]"><span className="font-bold">C (Cukup):</span> 60.01 - 75.00</div>
                        <div className="text-[10px]"><span className="font-bold">D (Kurang):</span> 0.00 - 60.00</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'RPP' && (
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700">
                            <th className="border p-3 text-center w-12">No</th>
                            <th className="border p-3 text-left">Komponen</th>
                            <th className="border p-3 text-center w-48">Kriteria Nilai (0-2)</th>
                            <th className="border p-3 text-left">Catatan Perbaikan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {LESSON_PLAN_COMPONENTS.map((comp, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="border p-3 text-center font-medium">{idx + 1}</td>
                              <td className="border p-3 font-bold text-gray-800">{comp}</td>
                              <td className="border p-3">
                                <div className="flex justify-center gap-2">
                                  {[0, 1, 2].map(val => (
                                    <button
                                      key={val}
                                      onClick={() => setLessonPlanScores(prev => ({ ...prev, [comp]: val }))}
                                      className={`w-8 h-8 rounded-full font-bold transition ${
                                        lessonPlanScores[comp] === val 
                                          ? 'bg-blue-600 text-white shadow-md' 
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="border p-3">
                                <input
                                  type="text"
                                  placeholder="..."
                                  className="w-full bg-transparent outline-none border-b border-transparent focus:border-blue-300"
                                  value={lessonPlanComments[comp] || ''}
                                  onChange={(e) => setLessonPlanComments(prev => ({ ...prev, [comp]: e.target.value }))}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                          <tr>
                            <td colSpan={2} className="border p-3 text-right text-gray-500">JUMLAH SKOR RIIL</td>
                            <td className="border p-3 text-center text-blue-600 text-lg">
                              {Object.values(lessonPlanScores).reduce((a, b) => a + b, 0)}
                            </td>
                            <td className="border p-3"></td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border p-3 text-right text-gray-500">JUMLAH SKOR IDEAL</td>
                            <td className="border p-3 text-center">34</td>
                            <td className="border p-3"></td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border p-3 text-right">NILAI AKHIR</td>
                            <td className="border p-3 text-center text-purple-600 text-lg">
                              {calculateLessonPlanResults().finalScore.toFixed(2)}
                            </td>
                            <td className="border p-3 bg-black text-white text-center uppercase tracking-widest">
                              {calculateLessonPlanResults().predicate}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                      <label className="block text-sm font-bold text-gray-800 mb-2">Saran Pembinaan</label>
                      <textarea
                        placeholder="Berikan saran pembinaan RPP untuk guru..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        value={lessonPlanCoaching}
                        onChange={(e) => setLessonPlanCoaching(e.target.value)}
                      />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h5 className="text-xs font-black text-blue-600 uppercase mb-2 tracking-widest text-center">Instrumen Rencana Pelaksanaan Pembelajaran (RPP)</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div className="text-[10px]"><span className="font-bold">A (Baik Sekali):</span> 90.01 - 100.00</div>
                        <div className="text-[10px]"><span className="font-bold">B (Baik):</span> 75.01 - 90.00</div>
                        <div className="text-[10px]"><span className="font-bold">C (Cukup):</span> 60.01 - 75.00</div>
                        <div className="text-[10px]"><span className="font-bold">D (Kurang):</span> 0.00 - 60.00</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'IMPLEMENTATION' && (
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700">
                            <th className="border p-3 text-center w-12">No</th>
                            <th className="border p-3 text-left">Komponen</th>
                            <th className="border p-3 text-center w-56">Skor (1-4)</th>
                            <th className="border p-3 text-left">Catatan / Penguatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {IMPLEMENTATION_COMPONENTS.map((comp, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="border p-3 text-center font-medium">{idx + 1}</td>
                              <td className="border p-3 font-bold text-gray-800">{comp}</td>
                              <td className="border p-3">
                                <div className="flex justify-center gap-2">
                                  {[1, 2, 3, 4].map(val => (
                                    <button
                                      key={val}
                                      onClick={() => setImplScores(prev => ({ ...prev, [comp]: val }))}
                                      className={`w-8 h-8 rounded-full font-bold transition ${
                                        implScores[comp] === val 
                                          ? 'bg-green-600 text-white shadow-md' 
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="border p-3">
                                <input
                                  type="text"
                                  placeholder="..."
                                  className="w-full bg-transparent outline-none border-b border-transparent focus:border-green-300"
                                  value={implComments[comp] || ''}
                                  onChange={(e) => setImplComments(prev => ({ ...prev, [comp]: e.target.value }))}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                          <tr>
                            <td colSpan={2} className="border p-3 text-right text-gray-500">JUMLAH SKOR RIIL</td>
                            <td className="border p-3 text-center text-green-600 text-lg">
                              {Object.values(implScores).reduce((a, b) => a + b, 0)}
                            </td>
                            <td className="border p-3"></td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border p-3 text-right text-gray-500">JUMLAH SKOR IDEAL</td>
                            <td className="border p-3 text-center">76</td>
                            <td className="border p-3"></td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border p-3 text-right">NILAI AKHIR</td>
                            <td className="border p-3 text-center text-blue-600 text-lg">
                              {calculateImplementationResults().finalScore.toFixed(2)}
                            </td>
                            <td className="border p-3 bg-black text-white text-center uppercase tracking-widest">
                              {calculateImplementationResults().predicate}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                      <label className="block text-sm font-bold text-gray-800 mb-2">Saran Pembinaan</label>
                      <textarea
                        placeholder="Berikan saran pembinaan pelaksanaan pembelajaran untuk guru..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
                        rows={4}
                        value={implCoaching}
                        onChange={(e) => setImplCoaching(e.target.value)}
                      />
                    </div>

                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <h5 className="text-xs font-black text-green-600 uppercase mb-2 tracking-widest text-center">Instrumen Supervisi Pelaksanaan Pembelajaran</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div className="text-[10px]"><span className="font-bold">A (Baik Sekali):</span> 90.01 - 100.00</div>
                        <div className="text-[10px]"><span className="font-bold">B (Baik):</span> 75.01 - 90.00</div>
                        <div className="text-[10px]"><span className="font-bold">C (Cukup):</span> 60.01 - 75.00</div>
                        <div className="text-[10px]"><span className="font-bold">D (Kurang):</span> 0.00 - 60.00</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-8 border-t border-gray-100 mt-8">
                  <button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    Simpan Penilaian
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisionAssessment;
