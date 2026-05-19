
import React, { useState, useEffect } from 'react';
import { 
  getMenteesByGuruWali, 
  saveMentoringJournal, 
  getMentoringJournals,
  updateMentoringActionStatus,
  saveGraduateProfileAssessment,
  getGraduateProfileAssessments
} from '../services/database';
import { Student, User, MentoringJournal, MentoringTopic, GraduateProfileAssessment } from '../types';
import { 
  Users, 
  Plus, 
  History, 
  ChevronRight, 
  Calendar, 
  BookOpen, 
  User as UserIcon, 
  Briefcase, 
  MessageCircle,
  Shield,
  ShieldOff,
  CheckCircle2,
  Clock,
  TrendingUp,
  Star,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface GuruWaliMentoringProps {
  user: User;
}

export const GuruWaliMentoring: React.FC<GuruWaliMentoringProps> = ({ user }) => {
  const [mentees, setMentees] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [journals, setJournals] = useState<MentoringJournal[]>([]);
  const [assessments, setAssessments] = useState<GraduateProfileAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'FORM' | 'ASSESSMENT'>('LIST');
  
  // Form States
  const [topic, setTopic] = useState<MentoringTopic>('AKADEMIK');
  const [notes, setNotes] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  // Assessment States (8 Dimensions)
  const [scores, setScores] = useState({
    imanTaqwa: 3,
    kebinekaanGlobal: 3,
    gotongRoyong: 3,
    mandiri: 3,
    nalarKritis: 3,
    kreatif: 3,
    integritas: 3,
    leadershipResilience: 3
  });

  useEffect(() => {
    loadMentees();
  }, [user.id]);

  const loadMentees = async () => {
    setLoading(true);
    try {
      const data = await getMenteesByGuruWali(user.id);
      setMentees(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setLoading(true);
    try {
      const [jData, aData] = await Promise.all([
        getMentoringJournals(student.id, user),
        getGraduateProfileAssessments(student.id)
      ]);
      setJournals(jData.sort((a: MentoringJournal, b: MentoringJournal) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setAssessments(aData);
      setView('DETAIL');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJournal = async () => {
    if (!selectedStudent || !notes) return;
    try {
      await saveMentoringJournal({
        guruWaliId: user.id,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        date: new Date().toISOString(),
        topic,
        notes,
        actionPlan,
        actionStatus: 'OPEN',
        isPrivate,
        schoolNpsn: user.schoolNpsn || 'DEFAULT'
      });
      // Refresh
      handleSelectStudent(selectedStudent);
      setNotes('');
      setActionPlan('');
      setView('DETAIL');
    } catch (e) {
      alert('Gagal menyimpan jurnal.');
    }
  };

  const handleSaveAssessment = async () => {
    if (!selectedStudent) return;
    try {
      await saveGraduateProfileAssessment({
        studentId: selectedStudent.id,
        guruWaliId: user.id,
        date: new Date().toISOString(),
        scores,
        schoolNpsn: user.schoolNpsn || 'DEFAULT'
      });
      handleSelectStudent(selectedStudent);
      setView('DETAIL');
    } catch (e) {
      alert('Gagal menyimpan penilaian.');
    }
  };

  const getTopicIcon = (t: MentoringTopic) => {
    switch (t) {
      case 'AKADEMIK': return <BookOpen className="w-4 h-4" />;
      case 'PRIBADI': return <UserIcon className="w-4 h-4" />;
      case 'SOSIAL': return <MessageCircle className="w-4 h-4" />;
      case 'KARIER': return <Briefcase className="w-4 h-4" />;
    }
  };

  const getTopicColor = (t: MentoringTopic) => {
    switch (t) {
      case 'AKADEMIK': return 'bg-blue-100 text-blue-700';
      case 'PRIBADI': return 'bg-purple-100 text-purple-700';
      case 'SOSIAL': return 'bg-green-100 text-green-700';
      case 'KARIER': return 'bg-orange-100 text-orange-700';
    }
  };

  const dimensionLabels: Record<keyof typeof scores, string> = {
    imanTaqwa: 'Iman & Taqwa',
    kebinekaanGlobal: 'Kebinekaan Global',
    gotongRoyong: 'Gotong Royong',
    mandiri: 'Mandiri',
    nalarKritis: 'Bernalar Kritis',
    kreatif: 'Kreatif',
    integritas: 'Integritas',
    leadershipResilience: 'Kepemimpinan & Resiliensi'
  };

  return (
    <div className="space-y-6">
      {view === 'LIST' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bimbingan Guru Wali</h2>
              <p className="text-sm text-gray-500">Daftar siswa yang Anda bimbing (Mentees)</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-full">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
               Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl"></div>
              ))
            ) : mentees.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Anda belum memiliki daftar mentee. Hubungi Wakasek Kurikulum.</p>
              </div>
            ) : (
              mentees.map((student) => (
                <motion.button
                  key={student.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectStudent(student)}
                  className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group"
                >
                  <div>
                    <p className="font-bold text-gray-900">{student.name}</p>
                    <p className="text-xs text-gray-500">NIS: {student.nis}</p>
                  </div>
                  <div className="p-2 bg-gray-50 text-gray-400 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </>
      )}

      {selectedStudent && view !== 'LIST' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setView('LIST');
                setSelectedStudent(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h2>
              <p className="text-xs text-gray-500">NIS: {selectedStudent.nis} • Profil Mentor</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button 
              onClick={() => setView('DETAIL')} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${view === 'DETAIL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              Riwayat & Ringkasan
            </button>
            <button 
              onClick={() => setView('FORM')} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${view === 'FORM' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              <Plus className="w-4 h-4" /> Catat Bimbingan
            </button>
            <button 
              onClick={() => setView('ASSESSMENT')} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${view === 'ASSESSMENT' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              <Star className="w-4 h-4" /> Evaluasi 8 Dimensi
            </button>
            <Link 
              to={`/student-360/${selectedStudent.id}`}
              className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all whitespace-nowrap"
            >
              <Activity className="w-4 h-4" /> Profil 360
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {view === 'DETAIL' && (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History className="w-5 h-5 text-indigo-600" />
                        Jurnal Mentoring
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                      {journals.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">Belum ada catatan bimbingan.</div>
                      ) : (
                        journals.map((journal) => (
                          <div key={journal.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${getTopicColor(journal.topic)}`}>
                                  {getTopicIcon(journal.topic)}
                                  {journal.topic}
                                </span>
                                {journal.isPrivate && (
                                  <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold uppercase">
                                    <Shield className="w-3 h-3" /> Privasi
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(journal.date), 'dd MMM yyyy', { locale: id })}
                              </span>
                            </div>
                            <p className="text-gray-700 leading-relaxed text-sm lg:text-base">{journal.notes}</p>
                            {journal.actionPlan && (
                              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Rencana Tindak Lanjut:</p>
                                <div className="flex items-start justify-between gap-4">
                                  <p className="text-sm text-indigo-900">{journal.actionPlan}</p>
                                  <button
                                    onClick={() => handleUpdateStatus(journal.id, journal.actionStatus === 'OPEN' ? 'RESOLVED' : 'OPEN')}
                                    className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold transition-all ${
                                      journal.actionStatus === 'RESOLVED' 
                                      ? 'bg-green-600 text-white shadow-sm' 
                                      : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                  >
                                    {journal.actionStatus === 'RESOLVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                    {journal.actionStatus === 'RESOLVED' ? 'Selesai' : 'Terbuka'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 font-bold text-gray-800 mb-6">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Statistik 8 Dimensi
                    </div>
                    {assessments.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-sm">Belum ada evaluasi dimensi.</div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(assessments[assessments.length - 1].scores).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-gray-600 font-medium">{dimensionLabels[key as keyof typeof scores]}</span>
                              <span className="font-bold text-indigo-600">{value}/5</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(value as number) * 20}%` }}
                                className={`h-full rounded-full ${
                                  (value as number) > 3 ? 'bg-green-500' : (value as number) === 3 ? 'bg-indigo-500' : 'bg-orange-500'
                                }`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'FORM' && (
              <motion.div 
                key="form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-xl border border-gray-100 shadow-lg max-w-2xl mx-auto"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  Catat Sesi Bimbingan
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Topik Bimbingan</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(['AKADEMIK', 'PRIBADI', 'SOSIAL', 'KARIER'] as MentoringTopic[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTopic(t);
                            if (t === 'PRIBADI' || t === 'SOSIAL') setIsPrivate(true);
                          }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            topic === t 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {getTopicIcon(t)}
                          <span className="text-[10px] font-bold">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Catatan / Observasi</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Apa yang dibahas dalam sesi ini? Bagaimana kondisi siswa?"
                      rows={4}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Rencana Tindak Lanjut (Opsional)</label>
                    <input
                      type="text"
                      value={actionPlan}
                      onChange={(e) => setActionPlan(e.target.value)}
                      placeholder="Contoh: Remedial pekan depan / Rujukan ke BK"
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isPrivate ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                        {isPrivate ? <Shield className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Privasi Catatan</p>
                        <p className="text-[10px] text-gray-500">Hanya bisa dilihat oleh Anda, BK, dan Wakasek/KS.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setView('DETAIL')}
                      className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleSaveJournal}
                      disabled={!notes}
                      className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      Simpan Jurnal
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'ASSESSMENT' && (
              <motion.div 
                key="assessment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl border border-gray-100 shadow-lg max-w-3xl mx-auto"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Evaluasi 8 Dimensi Profil Lulusan
                </h3>
                <p className="text-xs text-gray-500 mb-8 border-b border-gray-50 pb-4">
                  Berikan penilaian skala 1-5 berdasarkan perkembangan terbaru siswa.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mb-8">
                  {Object.entries(dimensionLabels).map(([key, label]) => (
                    <div key={key} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{label}</label>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">{scores[key as keyof typeof scores]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => setScores(prev => ({ ...prev, [key]: val }))}
                            className={`flex-1 h-8 rounded-md text-xs font-bold transition-all ${
                              scores[key as keyof typeof scores] >= val 
                              ? val > 3 ? 'bg-green-500 text-white' : val === 3 ? 'bg-indigo-500 text-white' : 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setView('DETAIL')}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSaveAssessment}
                    className="flex-[2] px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                  >
                    Simpan Evaluasi
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  async function handleUpdateStatus(journalId: string, status: 'OPEN' | 'RESOLVED') {
    try {
      await updateMentoringActionStatus(journalId, status);
      if (selectedStudent) {
        const jData = await getMentoringJournals(selectedStudent.id, user);
        setJournals(jData.sort((a: MentoringJournal, b: MentoringJournal) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    } catch (e) {
      console.error(e);
    }
  }
};
