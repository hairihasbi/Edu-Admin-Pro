import React, { useState, useEffect } from 'react';
import { 
  getMenteesByGuruWali, 
  saveMentoringJournal, 
  getMentoringJournals,
  updateMentoringActionStatus,
  saveGraduateProfileAssessment,
  getGraduateProfileAssessments,
  getClasses,
  bulkUpdateTeacherMentees,
  removeMenteeFromGuruWali,
  triggerDebouncedSync
} from '../services/database';
import { db } from '../services/db';
import { Student, User, MentoringJournal, MentoringTopic, GraduateProfileAssessment, ClassRoom } from '../types';
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
  Activity,
  UserPlus,
  UserMinus,
  Search,
  Filter,
  X,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  Info
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
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'FORM' | 'ASSESSMENT'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal Select Mentee States
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [allSchoolStudents, setAllSchoolStudents] = useState<Student[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalClassFilter, setModalClassFilter] = useState('ALL');
  const [modalStatusFilter, setModalStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'MY_MENTEES' | 'OTHER'>('ALL');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [savingMentees, setSavingMentees] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    loadInitialData();
  }, [user.id, user.schoolNpsn]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [menteeList, classList] = await Promise.all([
        getMenteesByGuruWali(user.id),
        getClasses(user.id, user.schoolNpsn)
      ]);
      
      setMentees(menteeList);
      setClasses(classList);
      
      const cMap: Record<string, string> = {};
      classList.forEach(c => {
        cMap[c.id] = c.name;
      });
      setClassMap(cMap);
    } catch (e) {
      console.error('Failed to load initial guru wali data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllStudentsForModal = async () => {
    try {
      let studentList: Student[] = [];
      if (user.schoolNpsn && user.schoolNpsn !== 'DEFAULT') {
        studentList = await db.students.where('schoolNpsn').equals(user.schoolNpsn).toArray();
      } else {
        studentList = await db.students.toArray();
      }
      setAllSchoolStudents(studentList);
      // Pre-select students who are already mentees of this teacher
      const currentMenteeIds = studentList
        .filter(s => s.guruWaliId === user.id)
        .map(s => s.id);
      setTempSelectedIds(currentMenteeIds);
    } catch (e) {
      console.error('Failed to load all students for modal:', e);
    }
  };

  const handleOpenSelectModal = async () => {
    await loadAllStudentsForModal();
    setModalSearchTerm('');
    setModalClassFilter('ALL');
    setModalStatusFilter('ALL');
    setIsSelectModalOpen(true);
  };

  const toggleStudentSelection = (studentId: string) => {
    setTempSelectedIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllVisible = (visibleIds: string[]) => {
    setTempSelectedIds(prev => {
      const set = new Set(prev);
      visibleIds.forEach(id => set.add(id));
      return Array.from(set);
    });
  };

  const handleDeselectAllVisible = (visibleIds: string[]) => {
    setTempSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
  };

  const handleSaveMenteeSelection = async () => {
    setSavingMentees(true);
    try {
      // Find original mentees
      const currentMenteeIds = mentees.map(m => m.id);
      
      // Determine what to add and what to remove
      const toAssignIds = tempSelectedIds.filter(id => !currentMenteeIds.includes(id));
      const toRemoveIds = currentMenteeIds.filter(id => !tempSelectedIds.includes(id));

      if (toAssignIds.length === 0 && toRemoveIds.length === 0) {
        setIsSelectModalOpen(false);
        setSavingMentees(false);
        return;
      }

      await bulkUpdateTeacherMentees(user, toAssignIds, toRemoveIds);
      
      // Refresh mentees
      const updatedMentees = await getMenteesByGuruWali(user.id);
      setMentees(updatedMentees);
      
      setFeedbackMessage({
        type: 'success',
        text: `Berhasil memperbarui siswa bimbingan (+${toAssignIds.length} ditambah, -${toRemoveIds.length} dilepas). Total: ${updatedMentees.length} siswa.`
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      setIsSelectModalOpen(false);
    } catch (e: any) {
      console.error(e);
      alert('Gagal menyimpan perubahan siswa bimbingan: ' + (e.message || 'Terjadi kesalahan'));
    } finally {
      setSavingMentees(false);
    }
  };

  const handleRemoveSingleMentee = async (student: Student, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin melepas ${student.name} dari daftar siswa bimbingan Anda?`)) {
      return;
    }

    try {
      await removeMenteeFromGuruWali(user, student.id);
      setMentees(prev => prev.filter(m => m.id !== student.id));
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(null);
        setView('LIST');
      }
      setFeedbackMessage({
        type: 'success',
        text: `Siswa ${student.name} telah dilepas dari bimbingan Anda.`
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (e) {
      console.error(e);
      alert('Gagal melepas siswa bimbingan.');
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
      setFeedbackMessage({
        type: 'success',
        text: 'Catatan jurnal bimbingan berhasil disimpan.'
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
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
      setFeedbackMessage({
        type: 'success',
        text: 'Evaluasi 8 Dimensi Profil Lulusan berhasil disimpan.'
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
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

  // Filtered mentees on main screen
  const filteredMentees = mentees.filter(m => {
    const q = searchTerm.toLowerCase();
    const className = (classMap[m.classId] || '').toLowerCase();
    return m.name.toLowerCase().includes(q) || m.nis.includes(q) || className.includes(q);
  });

  // Filtered students inside modal
  const filteredModalStudents = allSchoolStudents.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
                          s.nis.includes(modalSearchTerm);
    const matchesClass = modalClassFilter === 'ALL' || s.classId === modalClassFilter;
    
    let matchesStatus = true;
    if (modalStatusFilter === 'UNASSIGNED') {
      matchesStatus = !s.guruWaliId;
    } else if (modalStatusFilter === 'MY_MENTEES') {
      matchesStatus = s.guruWaliId === user.id || tempSelectedIds.includes(s.id);
    } else if (modalStatusFilter === 'OTHER') {
      matchesStatus = !!s.guruWaliId && s.guruWaliId !== user.id && !tempSelectedIds.includes(s.id);
    }
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  const visibleModalStudentIds = filteredModalStudents.map(s => s.id);
  const allVisibleSelected = visibleModalStudentIds.length > 0 && visibleModalStudentIds.every(id => tempSelectedIds.includes(id));

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="p-1 hover:bg-black/5 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'LIST' && (
        <>
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">Bimbingan Guru Wali</h2>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">
                    {mentees.length} Siswa Bimbingan
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Pendampingan personal, evaluasi profil lulusan, dan catatan bimbingan berkala.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenSelectModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm shadow-indigo-200 hover:shadow-indigo-300"
              >
                <UserPlus className="w-4 h-4" />
                <span>Pilih Siswa Bimbingan</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          {mentees.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, NIS, atau kelas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 self-end sm:self-center">
                Menampilkan <strong>{filteredMentees.length}</strong> dari <strong>{mentees.length}</strong> siswa
              </p>
            </div>
          )}

          {/* Mentees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl"></div>
              ))
            ) : mentees.length === 0 ? (
              <div className="col-span-full py-16 px-6 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-sm space-y-4">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">Belum Ada Siswa Bimbingan</h3>
                  <p className="text-sm text-gray-500">
                    Anda belum memiliki siswa yang terdaftar dalam bimbingan Guru Wali. Anda dapat memilih siswa binaan Anda sendiri sekarang secara mandiri.
                  </p>
                </div>
                <button
                  onClick={handleOpenSelectModal}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-100"
                >
                  <UserPlus className="w-4 h-4" />
                  Pilih Siswa Bimbingan Sekarang
                </button>
              </div>
            ) : filteredMentees.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl text-gray-500 text-sm">
                Tidak ada siswa bimbingan yang cocok dengan pencarian "<strong>{searchTerm}</strong>".
              </div>
            ) : (
              filteredMentees.map((student) => {
                const className = classMap[student.classId] || 'Kelas';
                return (
                  <motion.div
                    key={student.id}
                    whileHover={{ y: -2 }}
                    className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between group relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold">
                            {className}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">
                            NIS: {student.nis}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {student.name}
                        </h4>
                      </div>

                      <button
                        onClick={(e) => handleRemoveSingleMentee(student, e)}
                        title="Lepas dari Siswa Bimbingan Saya"
                        className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <button
                        onClick={() => handleSelectStudent(student)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group/btn"
                      >
                        <span>Buka Bimbingan</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>

                      <Link
                        to={`/student-360/${student.id}`}
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1"
                      >
                        <Activity className="w-3 h-3 text-indigo-500" />
                        <span>Profil 360</span>
                      </Link>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Detail / Action View */}
      {selectedStudent && view !== 'LIST' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setView('LIST');
                  setSelectedStudent(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                title="Kembali ke Daftar"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h2>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">
                    {classMap[selectedStudent.classId] || 'Kelas'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">NIS: {selectedStudent.nis} • Siswa Bimbingan Guru Wali</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRemoveSingleMentee(selectedStudent)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Lepas Bimbingan</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button 
              onClick={() => setView('DETAIL')} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${view === 'DETAIL' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              Riwayat & Ringkasan
            </button>
            <button 
              onClick={() => setView('FORM')} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'FORM' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              <Plus className="w-4 h-4" /> Catat Bimbingan
            </button>
            <button 
              onClick={() => setView('ASSESSMENT')} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'ASSESSMENT' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              <Star className="w-4 h-4" /> Evaluasi 8 Dimensi
            </button>
            <Link 
              to={`/student-360/${selectedStudent.id}`}
              className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all whitespace-nowrap"
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
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History className="w-5 h-5 text-indigo-600" />
                        <span>Jurnal Mentoring ({journals.length} Catatan)</span>
                      </div>
                      <button
                        onClick={() => setView('FORM')}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Sesi
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                      {journals.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 space-y-2">
                          <BookOpen className="w-8 h-8 mx-auto text-gray-300" />
                          <p>Belum ada catatan bimbingan untuk siswa ini.</p>
                          <button
                            onClick={() => setView('FORM')}
                            className="text-xs font-bold text-indigo-600 hover:underline"
                          >
                            Mulai Catat Sesi Bimbingan Pertama
                          </button>
                        </div>
                      ) : (
                        journals.map((journal) => (
                          <div key={journal.id} className="p-4 space-y-3 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${getTopicColor(journal.topic)}`}>
                                  {getTopicIcon(journal.topic)}
                                  {journal.topic}
                                </span>
                                {journal.isPrivate && (
                                  <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold uppercase bg-red-50 px-2 py-0.5 rounded-full">
                                    <Shield className="w-3 h-3" /> Privasi
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(journal.date), 'dd MMM yyyy', { locale: id })}
                              </span>
                            </div>
                            <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">{journal.notes}</p>
                            {journal.actionPlan && (
                              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Rencana Tindak Lanjut:</p>
                                <div className="flex items-start justify-between gap-4">
                                  <p className="text-sm text-indigo-900">{journal.actionPlan}</p>
                                  <button
                                    onClick={() => handleUpdateStatus(journal.id, journal.actionStatus === 'OPEN' ? 'RESOLVED' : 'OPEN')}
                                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
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
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span>Statistik 8 Dimensi</span>
                      </div>
                      <button
                        onClick={() => setView('ASSESSMENT')}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        {assessments.length === 0 ? 'Mulai Nilai' : 'Update Nilai'}
                      </button>
                    </div>

                    {assessments.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-sm space-y-2">
                        <Star className="w-7 h-7 mx-auto text-gray-300" />
                        <p>Belum ada evaluasi dimensi profil lulusan.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(assessments[assessments.length - 1].scores).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-gray-600 font-medium">{dimensionLabels[key as keyof typeof scores]}</span>
                              <span className="font-bold text-indigo-600">{value}/5</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
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
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg max-w-2xl mx-auto"
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
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' 
                            : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {getTopicIcon(t)}
                          <span className="text-xs font-bold">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Catatan / Observasi</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Apa yang dibahas dalam sesi bimbingan ini? Bagaimana perkembangan kondisi siswa?"
                      rows={4}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Rencana Tindak Lanjut (Opsional)</label>
                    <input
                      type="text"
                      value={actionPlan}
                      onChange={(e) => setActionPlan(e.target.value)}
                      placeholder="Contoh: Remedial pekan depan / Konseling lanjutan"
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isPrivate ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                        {isPrivate ? <Shield className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Privasi Catatan</p>
                        <p className="text-[10px] text-gray-500">Hanya bisa dilihat oleh Anda, BK, dan Wakasek/Kepala Sekolah.</p>
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
                      className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleSaveJournal}
                      disabled={!notes}
                      className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 text-sm"
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
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg max-w-3xl mx-auto"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Evaluasi 8 Dimensi Profil Lulusan
                </h3>
                <p className="text-xs text-gray-500 mb-8 border-b border-gray-50 pb-4">
                  Berikan penilaian skala 1-5 berdasarkan perkembangan terbaru siswa {selectedStudent.name}.
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
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSaveAssessment}
                    className="flex-[2] px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition-all text-sm"
                  >
                    Simpan Evaluasi
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Modal: Pilih Siswa Bimbingan */}
      <AnimatePresence>
        {isSelectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-200">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Pilih Siswa Bimbingan Guru Wali</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pilih siswa di sekolah ini yang akan menjadi binaan mentor personal Anda.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSelectModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Search and Filters */}
              <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama atau NIS..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Filter Kelas */}
                  <div>
                    <select
                      value={modalClassFilter}
                      onChange={(e) => setModalClassFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">Semua Kelas ({allSchoolStudents.length} Siswa)</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Status */}
                  <div>
                    <select
                      value={modalStatusFilter}
                      onChange={(e) => setModalStatusFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">Semua Status Bimbingan</option>
                      <option value="UNASSIGNED">Belum Ada Guru Wali</option>
                      <option value="MY_MENTEES">Bimbingan Saya (Dipilih)</option>
                      <option value="OTHER">Sudah Dibimbing Guru Lain</option>
                    </select>
                  </div>
                </div>

                {/* Quick Selection Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => allVisibleSelected ? handleDeselectAllVisible(visibleModalStudentIds) : handleSelectAllVisible(visibleModalStudentIds)}
                      disabled={visibleModalStudentIds.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                    >
                      {allVisibleSelected ? <Square className="w-3.5 h-3.5 text-indigo-600" /> : <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />}
                      <span>{allVisibleSelected ? 'Batalkan Pilihan yang Ditampilkan' : 'Pilih Semua yang Ditampilkan'}</span>
                    </button>
                  </div>

                  <div className="text-xs text-gray-500">
                    Ditemukan: <strong>{filteredModalStudents.length}</strong> siswa • Dipilih: <strong className="text-indigo-600 font-bold">{tempSelectedIds.length}</strong> siswa
                  </div>
                </div>
              </div>

              {/* Modal Student List */}
              <div className="p-4 overflow-y-auto flex-1 max-h-[480px]">
                {filteredModalStudents.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-gray-300" />
                    <p className="text-sm">Tidak ada siswa yang sesuai kriteria filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredModalStudents.map(student => {
                      const isSelected = tempSelectedIds.includes(student.id);
                      const className = classMap[student.classId] || 'Kelas';
                      const isMyCurrentMentee = student.guruWaliId === user.id;
                      const hasOtherMentor = student.guruWaliId && student.guruWaliId !== user.id;

                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected 
                              ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400 shadow-sm' 
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {student.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
                                <span className="font-semibold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.2 rounded text-[11px]">
                                  {className}
                                </span>
                                <span>NIS: {student.nis}</span>
                                <span>({student.gender === 'L' ? 'Laki-laki' : 'Perempuan'})</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            {isSelected ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Terpilih
                              </span>
                            ) : hasOtherMentor ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded-full truncate max-w-[120px]" title={`Guru Wali: ${student.guruWaliName || 'Guru Lain'}`}>
                                {student.guruWaliName || 'Guru Lain'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full">
                                Belum Ada
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Total Siswa Terpilih: <strong>{tempSelectedIds.length} Siswa</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setIsSelectModalOpen(false)}
                    disabled={savingMentees}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveMenteeSelection}
                    disabled={savingMentees}
                    className="flex-1 sm:flex-none px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingMentees ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Simpan Siswa Bimbingan ({tempSelectedIds.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
