
import React, { useState, useEffect } from 'react';
import { User, SupervisionAssignment, SupervisionResult } from '../types';
import { getAssignmentsForSupervisor, getSchoolTeachers, saveSupervisionResult } from '../services/database';
import { ClipboardCheck, User as UserIcon, Calendar, CheckCircle, AlertCircle, Loader2, ChevronRight, Save, Star } from './Icons';

interface SupervisionAssessmentProps {
  user: User;
}

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

  // Form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [user.id]);

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
    // Initialize scores
    const initialScores: Record<string, number> = {};
    SUPERVISION_ASPECTS.forEach(aspect => { initialScores[aspect] = 0; });
    setScores(initialScores);
    setComments({});
    setGeneralNotes('');
    setSuccessMessage('');
  };

  const handleScoreChange = (aspect: string, score: number) => {
    setScores(prev => ({ ...prev, [aspect]: score }));
  };

  const handleCommentChange = (aspect: string, comment: string) => {
    setComments(prev => ({ ...prev, [aspect]: comment }));
  };

  const handleSubmit = async () => {
    if (!selectedAssignment) return;

    // Validate all aspects have scores
    const missingScores = SUPERVISION_ASPECTS.filter(aspect => scores[aspect] === 0);
    if (missingScores.length > 0) {
      alert("Harap berikan nilai untuk semua aspek penilaian.");
      return;
    }

    setIsSaving(true);
    try {
      const aspects = SUPERVISION_ASPECTS.map(aspect => ({
        aspect,
        score: scores[aspect],
        comment: comments[aspect] || ''
      }));

      const totalScore = aspects.reduce((acc, curr) => acc + curr.score, 0) / aspects.length;

      const result: Omit<SupervisionResult, 'id'|'lastModified'|'isSynced'> = {
        assignmentId: selectedAssignment.id,
        supervisorId: user.id,
        teacherId: selectedAssignment.teacherId,
        schoolNpsn: user.schoolNpsn!,
        date: new Date().toISOString().split('T')[0],
        score: totalScore,
        notes: generalNotes,
        aspects
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
          <ClipboardCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Penilaian Supervisi Akademik</h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <div className="lg:col-span-2">
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
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">Form Penilaian Supervisi</h3>
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

              <div className="p-6 space-y-8">
                {SUPERVISION_ASPECTS.map((aspect, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-800 flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] mt-0.5">{idx + 1}</span>
                          {aspect}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => handleScoreChange(aspect, star)}
                            className={`p-1 transition ${scores[aspect] >= star ? 'text-yellow-400 scale-110' : 'text-gray-200 hover:text-yellow-200'}`}
                          >
                            <Star size={24} fill={scores[aspect] >= star ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                        <span className="ml-2 text-sm font-bold text-gray-400 w-4">{scores[aspect] || ''}</span>
                      </div>
                    </div>
                    <textarea
                      placeholder="Catatan tambahan untuk aspek ini (opsional)..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={2}
                      value={comments[aspect] || ''}
                      onChange={(e) => handleCommentChange(aspect, e.target.value)}
                    />
                  </div>
                ))}

                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-800 mb-2">Catatan & Rekomendasi Umum</label>
                  <textarea
                    placeholder="Berikan masukan konstruktif untuk pengembangan profesional guru..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    rows={4}
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end pt-4">
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
