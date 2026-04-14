
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { getLearningStyleAssessments, saveLearningStyleAssessment, deleteLearningStyleAssessment } from '../services/database';
import { Student, ClassRoom, LearningStyleAssessment, User } from '../types';
import { VAK_QUESTIONS, getStyleDescription, calculateDominantStyle } from '../services/assessmentService';
import QRCodeDisplay from './QRCodeDisplay';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { 
  Users, QrCode, ClipboardList, Plus, Trash2, Info, 
  Eye, Ear, Activity, ChevronRight, Search, Filter,
  Download, RefreshCw, X
} from 'lucide-react';

interface LearningStyleManagerProps {
  user: User;
}

const LearningStyleManager: React.FC<LearningStyleManagerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STUDENTS' | 'QR'>('OVERVIEW');
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<LearningStyleAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedStudentForManual, setSelectedStudentForManual] = useState<Student | null>(null);
  const [manualScores, setManualScores] = useState({ visual: 0, auditory: 0, kinesthetic: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!user.homeroomClassId) {
        setLoading(false);
        return;
      }
      try {
        const cls = await db.classes.get(user.homeroomClassId);
        if (cls) setSelectedClass(cls);

        const stds = await db.students.where('classId').equals(user.homeroomClassId).toArray();
        setStudents(stds.sort((a, b) => a.name.localeCompare(b.name)));

        const asms = await getLearningStyleAssessments(user.homeroomClassId);
        setAssessments(asms);
      } catch (err) {
        console.error("Failed to load homeroom data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user.homeroomClassId]);

  const handleSaveManual = async () => {
    if (!selectedStudentForManual || !selectedClass) return;

    const dominantStyle = calculateDominantStyle(manualScores);

    await saveLearningStyleAssessment({
      studentId: selectedStudentForManual.id,
      classId: selectedClass.id,
      schoolNpsn: selectedClass.schoolNpsn || '',
      userId: user.id,
      visualScore: manualScores.visual,
      auditoryScore: manualScores.auditory,
      kinestheticScore: manualScores.kinesthetic,
      dominantStyle,
      date: new Date().toISOString(),
      method: 'MANUAL'
    });

    // Refresh data
    const updatedAsms = await getLearningStyleAssessments(selectedClass.id);
    setAssessments(updatedAsms);
    setShowManualModal(false);
    setSelectedStudentForManual(null);
    setManualScores({ visual: 0, auditory: 0, kinesthetic: 0 });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus data asesmen ini?")) {
      await deleteLearningStyleAssessment(id);
      setAssessments(prev => prev.filter(a => a.id !== id));
    }
  };

  const getChartData = () => {
    const counts = { VISUAL: 0, AUDITORI: 0, KINESTETIK: 0 };
    assessments.forEach(a => {
      counts[a.dominantStyle]++;
    });
    return [
      { name: 'Visual', value: counts.VISUAL, color: '#6366f1' },
      { name: 'Auditori', value: counts.AUDITORI, color: '#f59e0b' },
      { name: 'Kinestetik', value: counts.KINESTETIK, color: '#10b981' }
    ];
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.nis.includes(searchQuery)
  );

  if (!user.homeroomClassId) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300">
        <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Bukan Wali Kelas</h3>
        <p className="text-gray-500 max-w-xs mx-auto mt-1">
          Fitur ini hanya tersedia untuk guru yang terdaftar sebagai Wali Kelas.
        </p>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center">Memuat data...</div>;

  const assessmentUrl = `${window.location.origin}/#/asesmen/${user.homeroomClassId}`;

  return (
    <div className="space-y-6">
      {/* Header & Stats Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Asesmen Gaya Belajar</h2>
          <p className="text-gray-500">Pemetaan karakteristik belajar kelas {selectedClass?.name}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('QR')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Buka QR Code
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { id: 'OVERVIEW', label: 'Ringkasan', icon: BarChart },
          { id: 'STUDENTS', label: 'Daftar Siswa', icon: Users },
          { id: 'QR', label: 'Mode Digital', icon: QrCode }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'OVERVIEW' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Chart Card */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <BarChart className="w-5 h-5 text-indigo-600" />
                Distribusi Gaya Belajar
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#f9fafb'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {getChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500 font-medium mb-1">Total Partisipasi</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-900">{assessments.length}</span>
                  <span className="text-gray-400 mb-1">/ {students.length} Siswa</span>
                </div>
                <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full" 
                    style={{ width: `${(assessments.length / students.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-100">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Saran Strategi
                </h4>
                <p className="text-sm text-indigo-100 leading-relaxed">
                  {assessments.length === 0 
                    ? "Lakukan asesmen untuk mendapatkan rekomendasi strategi pembelajaran yang tepat bagi kelas Anda."
                    : "Gunakan data ini untuk menyusun Modul Ajar yang berdiferensiasi sesuai kebutuhan murid."
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'STUDENTS' && (
          <motion.div
            key="students"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Cari nama atau NIS..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => {
                  setSelectedStudentForManual(null);
                  setShowManualModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Input Manual
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Siswa</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Gaya Belajar</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Metode</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Skor (V/A/K)</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStudents.map(student => {
                    const assessment = assessments.find(a => a.studentId === student.id);
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-400">NIS: {student.nis}</div>
                        </td>
                        <td className="px-6 py-4">
                          {assessment ? (
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                                assessment.dominantStyle === 'VISUAL' ? 'bg-indigo-100 text-indigo-700' :
                                assessment.dominantStyle === 'AUDITORI' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {assessment.dominantStyle === 'VISUAL' && <Eye className="w-3 h-3" />}
                                {assessment.dominantStyle === 'AUDITORI' && <Ear className="w-3 h-3" />}
                                {assessment.dominantStyle === 'KINESTETIK' && <Activity className="w-3 h-3" />}
                                {assessment.dominantStyle}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Belum diisi</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {assessment ? (
                            <span className="text-xs font-medium text-gray-500">{assessment.method}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {assessment ? (
                            <div className="flex gap-2 text-xs font-mono">
                              <span className="text-indigo-600">V:{assessment.visualScore}</span>
                              <span className="text-amber-600">A:{assessment.auditoryScore}</span>
                              <span className="text-emerald-600">K:{assessment.kinestheticScore}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {assessment ? (
                              <button 
                                onClick={() => handleDelete(assessment.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => {
                                  setSelectedStudentForManual(student);
                                  setShowManualModal(true);
                                }}
                                className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                                title="Input Manual"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'QR' && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Mode Digital (QR Code)</h3>
                <p className="text-gray-500">Siswa dapat mengisi asesmen secara mandiri melalui perangkat masing-masing.</p>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <QRCodeDisplay url={assessmentUrl} size={250} />
                
                <div className="w-full max-w-sm p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex-1 truncate text-left">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Link Asesmen</p>
                    <p className="text-sm text-gray-600 truncate">{assessmentUrl}</p>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(assessmentUrl);
                      alert("Link berhasil disalin!");
                    }}
                    className="p-2 bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="text-indigo-600 font-bold text-xl mb-1">1</div>
                    <p className="text-xs text-indigo-800 font-medium leading-tight">Tampilkan QR ini di depan kelas</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="text-amber-600 font-bold text-xl mb-1">2</div>
                    <p className="text-xs text-amber-800 font-medium leading-tight">Siswa scan & pilih nama mereka</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="text-emerald-600 font-bold text-xl mb-1">3</div>
                    <p className="text-xs text-emerald-800 font-medium leading-tight">Hasil muncul otomatis di sini</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Input Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Input Manual Asesmen</h3>
              <button onClick={() => setShowManualModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Siswa</label>
                <select 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedStudentForManual?.id || ''}
                  onChange={(e) => {
                    const std = students.find(s => s.id === e.target.value);
                    setSelectedStudentForManual(std || null);
                  }}
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.nis})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-bold text-gray-700">Skor Hasil Tes Offline (VAK)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1">Visual</label>
                    <input 
                      type="number"
                      min="0"
                      max="10"
                      className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center font-bold text-indigo-700"
                      value={manualScores.visual}
                      onChange={(e) => setManualScores(prev => ({ ...prev, visual: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Auditori</label>
                    <input 
                      type="number"
                      min="0"
                      max="10"
                      className="w-full p-3 bg-amber-50 border border-amber-100 rounded-xl text-center font-bold text-amber-700"
                      value={manualScores.auditory}
                      onChange={(e) => setManualScores(prev => ({ ...prev, auditory: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Kinestetik</label>
                    <input 
                      type="number"
                      min="0"
                      max="10"
                      className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center font-bold text-emerald-700"
                      value={manualScores.kinesthetic}
                      onChange={(e) => setManualScores(prev => ({ ...prev, kinesthetic: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 italic">
                  *Masukkan jumlah jawaban A (Visual), B (Auditori), dan C (Kinestetik) dari lembar kertas siswa.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveManual}
                  disabled={!selectedStudentForManual}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100"
                >
                  Simpan Hasil
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default LearningStyleManager;
