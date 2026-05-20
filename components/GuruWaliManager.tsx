
import React, { useState, useEffect } from 'react';
import { 
  getStudentsWithoutGuruWali, 
  distributeGuruWaliFairly, 
  getSchoolTeachers, 
  updateUserProfile,
  addSystemLog,
  triggerDebouncedSync,
  runManualSync
} from '../services/database';
import { Student, User, UserRole } from '../types';
import { 
  Users, 
  UserPlus, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle,
  Search,
  ArrowRightLeft,
  Filter,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/db';

interface GuruWaliManagerProps {
  user: User;
}

export const GuruWaliManager: React.FC<GuruWaliManagerProps> = ({ user }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, [user.schoolNpsn]);

  const loadData = async () => {
    if (!user.schoolNpsn) return;
    setLoading(true);
    try {
      const [allStudents, allTeachers] = await Promise.all([
        db.students.where('schoolNpsn').equals(user.schoolNpsn).toArray(),
        db.users.where('schoolNpsn').equals(user.schoolNpsn).and(u => u.role === 'GURU' && u.status === 'ACTIVE').toArray()
      ]);
      setStudents(allStudents);
      setTeachers(allTeachers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!confirm('Apakah Anda yakin ingin membagikan seluruh siswa kepada semua guru secara otomatis? Hal ini akan meriset penugasan yang ada untuk memastikan pemerataan.')) return;
    
    setProcessing(true);
    try {
      const result = await distributeGuruWaliFairly(user.schoolNpsn!);
      if (result.success) {
        setMessage({ type: 'success', text: `Berhasil membagikan ${result.studentCount} siswa kepada ${result.teacherCount} guru.` });
        await loadData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Gagal melakukan distribusi.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveAndSync = async () => {
    setSavingChanges(true);
    try {
      // Direct push for assignments
      await runManualSync('PUSH', (msg) => console.log(msg), ['eduadmin_students']);
      setMessage({ type: 'success', text: 'Perubahan penugasan mentor berhasil disimpan dan disinkronkan ke server cloud.' });
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Gagal melakukan sinkronisasi dengan server.' });
    } finally {
      setSavingChanges(false);
    }
  };

  const handleManualReassign = async (studentId: string, teacherId: string) => {
    try {
      const teacher = teachers.find(t => t.id === teacherId);
      
      const updateData = {
        guruWaliId: teacherId || null,
        guruWaliName: teacher ? teacher.fullName : null,
        lastModified: Date.now(),
        isSynced: false
      };

      await db.students.update(studentId, updateData);

      setStudents(prev => prev.map(s => s.id === studentId ? { 
        ...s, 
        guruWaliId: teacherId || null, 
        guruWaliName: teacher ? teacher.fullName : null 
      } : s));

      // Log manual adjustment
      addSystemLog('AUDIT', user.fullName, 'GURU_WALI', 'Manual Adjustment', 
        teacher ? `Memindahkan siswa ${studentId} ke Guru Wali ${teacher.fullName}` : `Melepas Guru Wali untuk siswa ${studentId}`);

      // Auto trigger background sync
      triggerDebouncedSync();

    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui Guru Wali.');
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.nis.includes(searchTerm);
    const matchesFilter = filterMode === 'ALL' || 
                          (filterMode === 'UNASSIGNED' && !s.guruWaliId) || 
                          (filterMode === 'ASSIGNED' && s.guruWaliId);
    return matchesSearch && matchesFilter;
  });

  const unassignedCount = students.filter(s => !s.guruWaliId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen Guru Wali</h2>
          <p className="text-sm text-gray-500">Distribusi mentor personal siswa berdasarkan Permendikdasmen No. 11/2025</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveAndSync}
            disabled={processing || savingChanges}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm disabled:opacity-50 text-sm font-medium"
          >
            {savingChanges ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan Perubahan Mentor</span>
          </button>
          
          <button
            onClick={handleAutoDistribute}
            disabled={processing || teachers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm font-medium whitespace-nowrap"
          >
            {processing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            <span>Distribusi Merata Otomatis</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Siswa</p>
            <p className="text-2xl font-bold text-gray-900">{students.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Belum Ada Mentor</p>
            <p className="text-2xl font-bold text-gray-900">{unassignedCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Guru Aktif</p>
            <p className="text-2xl font-bold text-gray-900">{teachers.length}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto text-sm font-medium">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden text-sm lg:text-base">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama siswa atau NIS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {(['ALL', 'UNASSIGNED', 'ASSIGNED'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filterMode === mode ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode === 'ALL' ? 'Semua' : mode === 'UNASSIGNED' ? 'Belum Ada' : 'Terbagi'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700">Nama Siswa</th>
                <th className="px-6 py-4 font-semibold text-gray-700">NIS</th>
                <th className="px-6 py-4 font-semibold text-gray-700">Guru Wali (Mentor)</th>
                <th className="px-6 py-4 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                  </tr>
                ))
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada siswa yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-gray-600">{student.nis}</td>
                    <td className="px-6 py-4">
                      <select
                        value={student.guruWaliId || ''}
                        onChange={(e) => handleManualReassign(student.id, e.target.value)}
                        className={`w-full max-w-[200px] p-1 border rounded focus:ring-2 focus:ring-indigo-500 outline-none ${
                          !student.guruWaliId ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                        }`}
                      >
                        <option value="">-- Pilih Guru Wali --</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.fullName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {!student.guruWaliId && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Perlu Mentor
                        </span>
                      )}
                      {student.guruWaliId && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Sudah Terbagi
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
