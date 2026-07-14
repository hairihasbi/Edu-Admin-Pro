
import React, { useState, useEffect, useMemo } from 'react';
import { User, Student, ClassRoom } from '../types';
import { 
  processGraduation, 
  processPromotionReset, 
  getUnassignedStudents, 
  assignStudentsByBatch,
  getAvailableClassesForHomeroom,
  addSystemLog,
  getStudentCountByClass,
  promoteStudentsClassToClass
} from '../services/database';
import { 
  GraduationCap, 
  Users, 
  ArrowUpCircle, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Trash2, 
  Save, 
  Info,
  ChevronRight,
  Filter,
  UserPlus
} from './Icons';

interface WakasekAcademicManagementProps {
  user: User;
}

const WakasekAcademicManagement: React.FC<WakasekAcademicManagementProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'GRADUATION' | 'PROMOTION' | 'MAPPING'>('GRADUATION');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  
  // Mapping State
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [mappingSearch, setMappingSearch] = useState('');

  // Mass Promotion State
  const [originClassId, setOriginClassId] = useState<string>('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [originStudentCount, setOriginStudentCount] = useState<number | null>(null);

  // Fetch classes on mount
  useEffect(() => {
    if (user.schoolNpsn) {
      getAvailableClassesForHomeroom(user.schoolNpsn).then(schoolClasses => {
        setClasses(schoolClasses.sort((a, b) => a.name.localeCompare(b.name)));
      }).catch(err => {
        console.error("Failed to load classes:", err);
      });
    }
  }, [user.schoolNpsn]);

  // Handle origin class change to fetch student count
  useEffect(() => {
    if (originClassId) {
      getStudentCountByClass(originClassId).then(count => {
        setOriginStudentCount(count);
      }).catch(() => {
        setOriginStudentCount(0);
      });
    } else {
      setOriginStudentCount(null);
    }
  }, [originClassId]);

  useEffect(() => {
    if (activeTab === 'MAPPING') {
      fetchMappingData();
    }
  }, [activeTab]);

  const fetchMappingData = async () => {
    if (!user.schoolNpsn) return;
    setLoading(true);
    try {
      const students = await getUnassignedStudents(user.schoolNpsn);
      setUnassignedStudents(students);
    } catch (error) {
      console.error("Failed to fetch mapping data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGraduation = async () => {
    if (!window.confirm("PERINGATAN: Seluruh data siswa Kelas 12 dan portofolionya akan DIHAPUS PERMANEN dari database. Aksi ini tidak dapat dibatalkan. Lanjutkan?")) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await processGraduation(user.schoolNpsn!);
      if (result.success) {
        setMessage({ type: 'success', text: `Berhasil meluluskan ${result.count} siswa. Data telah dibersihkan.` });
        addSystemLog('WARNING', user.fullName, 'ACADEMIC', 'Graduation', `Processed graduation for ${result.count} students.`);
      } else {
        setMessage({ type: 'error', text: result.message || 'Gagal memproses kelulusan.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePromotionReset = async () => {
    if (!window.confirm("Seluruh siswa Kelas 10 & 11 akan dilepas dari kelasnya (menjadi Belum Masuk Kelas). Data portofolio akan TETAP AMAN. Lanjutkan?")) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await processPromotionReset(user.schoolNpsn!);
      if (result.success) {
        setMessage({ type: 'success', text: `Berhasil meriset penempatan ${result.count} siswa. Silakan lakukan pemetaan kelas baru.` });
        addSystemLog('INFO', user.fullName, 'ACADEMIC', 'Promotion Reset', `Reset class assignment for ${result.count} students.`);
      } else {
        setMessage({ type: 'error', text: result.message || 'Gagal meriset kenaikan kelas.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  const handleMassPromotion = async () => {
    if (!originClassId || !targetClassId) {
      alert("Pilih kelas asal dan kelas tujuan terlebih dahulu.");
      return;
    }
    if (originClassId === targetClassId) {
      alert("Kelas asal dan kelas tujuan tidak boleh sama.");
      return;
    }

    const originClassName = classes.find(c => c.id === originClassId)?.name || 'Kelas Asal';
    const targetClassName = classes.find(c => c.id === targetClassId)?.name || 'Kelas Tujuan';

    if (!window.confirm(`Apakah Anda yakin ingin memindahkan SELURUH siswa dari ${originClassName} ke ${targetClassName}? Semua data prestasi, absensi, dan pelanggaran siswa akan tetap aman.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await promoteStudentsClassToClass(originClassId, targetClassId);
      if (result.success) {
        setMessage({ type: 'success', text: `Berhasil memindahkan ${result.count} siswa dari ${originClassName} ke ${targetClassName}.` });
        addSystemLog('INFO', user.fullName, 'ACADEMIC', 'Promotion', `Promoted ${result.count} students from class ${originClassName} to ${targetClassName}.`);
        setOriginClassId('');
        setTargetClassId('');
        setOriginStudentCount(null);
        if (user.schoolNpsn) {
          getUnassignedStudents(user.schoolNpsn).then(setUnassignedStudents);
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Gagal memproses kenaikan kelas.' });
      }
    } catch (error) {
      console.error("Mass promotion failed:", error);
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem saat memproses kenaikan kelas.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchAssign = async () => {
    if (!selectedClassId) {
      alert("Pilih kelas tujuan terlebih dahulu.");
      return;
    }
    if (selectedStudentIds.size === 0) {
      alert("Pilih minimal satu siswa.");
      return;
    }

    setLoading(true);
    try {
      const result = await assignStudentsByBatch(Array.from(selectedStudentIds), selectedClassId);
      if (result.success) {
        setMessage({ type: 'success', text: `Berhasil memasukkan ${result.count} siswa ke dalam kelas.` });
        setSelectedStudentIds(new Set());
        fetchMappingData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Gagal menyimpan pemetaan.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredUnassigned = useMemo(() => {
    return unassignedStudents.filter(s => 
      s.name.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      (s.nis && s.nis.includes(mappingSearch))
    );
  }, [unassignedStudents, mappingSearch]);

  const toggleStudentSelection = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudentIds(newSet);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
            <GraduationCap size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Manajemen Kenaikan & Kelulusan</h2>
            <p className="text-gray-500 text-sm dark:text-gray-400">
              Pengaturan siklus akademik tahunan untuk siswa (Khusus Wakasek Kurikulum).
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border shadow-sm animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : message.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit dark:bg-gray-700">
        <button
          onClick={() => { setActiveTab('GRADUATION'); setMessage(null); }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'GRADUATION' 
              ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Trash2 size={18} />
          Kelulusan (Kelas 12)
        </button>
        <button
          onClick={() => { setActiveTab('PROMOTION'); setMessage(null); }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'PROMOTION' 
              ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <ArrowUpCircle size={18} />
          Kenaikan & Reset (10 & 11)
        </button>
        <button
          onClick={() => { setActiveTab('MAPPING'); setMessage(null); }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'MAPPING' 
              ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <UserPlus size={18} />
          Pemetaan Kelas Baru
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        {/* TAB 1: GRADUATION */}
        {activeTab === 'GRADUATION' && (
          <div className="p-8 space-y-6">
            <div className="bg-red-50 border border-red-100 p-6 rounded-2xl dark:bg-red-900/10 dark:border-red-900/20">
               <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-100 text-red-600 rounded-full dark:bg-red-900/30">
                    <Trash2 size={24} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-400">Proses Kelulusan Masal</h3>
                    <p className="text-sm text-red-700 leading-relaxed dark:text-red-300">
                      Fitur ini akan mencari seluruh siswa di kelas tingkat 12 (XII) dan menghapus data mereka secara permanen dari pangkalan data sistem.
                    </p>
                    <ul className="text-xs text-red-600 space-y-1 list-disc pl-5 dark:text-red-400/80">
                      <li>Biodata Siswa akan dihapus selamanya.</li>
                      <li>Log RFID & Absensi akan dibersihkan.</li>
                      <li>Seluruh catatan Pelanggaran, Poin, & BK akan dibersihkan.</li>
                      <li>Tujuannya untuk pengosongan database untuk tahun ajaran baru.</li>
                    </ul>
                    <div className="pt-4 flex flex-col gap-3">
                       <button 
                         onClick={handleGraduation}
                         disabled={loading}
                         className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-red-500/20 disabled:opacity-50"
                       >
                         {loading ? <Users className="animate-spin" /> : <GraduationCap />}
                         {loading ? 'Sedang Memproses...' : 'Eksekusi Kelulusan Masal'}
                       </button>
                       <p className="text-[10px] text-red-500 font-medium italic text-center">
                         *Harap pastikan Anda sudah melakukan backup data (Export Excel) jika diperlukan arsip fisik.
                       </p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROMOTION RESET */}
        {activeTab === 'PROMOTION' && (
          <div className="p-8 space-y-8">
            {/* CARD 1: MASS PROMOTION (KENAIKAN KELAS MASAL) */}
            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm dark:bg-gray-800 dark:border-gray-700 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-full dark:bg-green-900/30 dark:text-green-400">
                  <ArrowUpCircle size={24} />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Proses Kenaikan Kelas Masal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pindahkan seluruh siswa dari satu kelas asal langsung ke kelas tujuan baru (misal: XI IPA 1 naik ke XII IPA 1).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Filter size={14} /> Kelas Asal
                  </label>
                  <select 
                    value={originClassId}
                    onChange={(e) => setOriginClassId(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">-- Pilih Kelas Asal --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Filter size={14} /> Kelas Tujuan Baru
                  </label>
                  <select 
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">-- Pilih Kelas Tujuan --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {originStudentCount !== null && (
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3 dark:bg-green-900/10 dark:border-green-900/20">
                  <Info className="text-green-600 shrink-0" size={18} />
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Ditemukan <span className="font-bold">{originStudentCount} siswa</span> di kelas asal yang siap dipindahkan.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button 
                  onClick={handleMassPromotion}
                  disabled={loading || !originClassId || !targetClassId || originClassId === targetClassId || originStudentCount === 0}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-green-500/20 disabled:opacity-50"
                >
                  {loading ? <Users className="animate-spin" /> : <ArrowUpCircle />}
                  {loading ? 'Sedang Memproses...' : 'Proses Kenaikan Kelas Masal'}
                </button>
              </div>
            </div>

            {/* CARD 2: RESET ALL PENEMPATAN */}
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl dark:bg-blue-900/10 dark:border-blue-900/20">
               <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-full dark:bg-blue-900/30">
                    <ArrowUpCircle size={24} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400">Reset Penempatan & Kenaikan Kelas (Alternatif Masal)</h3>
                    <p className="text-sm text-blue-700 leading-relaxed dark:text-blue-300">
                      Siswa di Kelas 10 & 11 akan dilepaskan dari kelas lamanya secara masal (menjadi status "Belum Masuk Kelas"). Biodata dan Portofolio tetap aman.
                    </p>
                    <ul className="text-xs text-blue-600 space-y-1 list-disc pl-5 dark:text-blue-400/80">
                      <li>Status seluruh siswa berubah menjadi "Belum Masuk Kelas".</li>
                      <li>Catatan pelanggaran & prestasi kumulatif tetap utuh.</li>
                      <li>Setelah reset, Anda dapat menggunakan tab "Pemetaan Kelas Baru" untuk menata kelas baru secara bertahap.</li>
                    </ul>
                    <div className="pt-4">
                       <button 
                         onClick={handlePromotionReset}
                         disabled={loading}
                         className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
                       >
                         {loading ? <Users className="animate-spin" /> : <ArrowUpCircle />}
                         {loading ? 'Sedang Memproses...' : 'Reset Status Seluruh Siswa'}
                       </button>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* TAB 3: MAPPING */}
        {activeTab === 'MAPPING' && (
          <div className="flex flex-col h-[700px]">
            {/* Action Bar Mapping */}
            <div className="p-6 border-b border-gray-100 bg-gray-50 space-y-4 dark:bg-gray-800/50 dark:border-gray-700">
               <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                       <Filter size={14} /> Pilih Kelas Tujuan Baru
                    </label>
                    <select 
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full p-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                       <Search size={14} /> Cari Siswa (Nama / NIS)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ketik nama atau NIS..."
                      value={mappingSearch}
                      onChange={(e) => setMappingSearch(e.target.value)}
                      className="w-full p-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <button 
                    onClick={handleBatchAssign}
                    disabled={loading || selectedStudentIds.size === 0 || !selectedClassId}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-sm disabled:opacity-50"
                  >
                    <Save size={18} /> Masukkan ke Kelas ({selectedStudentIds.size})
                  </button>
               </div>
            </div>

            {/* List Students */}
            <div className="flex-1 overflow-y-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 z-10 border-b border-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                    <tr>
                      <th className="p-4 w-10">
                         <input 
                           type="checkbox" 
                           className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                           onChange={(e) => {
                             if (e.target.checked) setSelectedStudentIds(new Set(filteredUnassigned.map(s => s.id)));
                             else setSelectedStudentIds(new Set());
                           }}
                           checked={filteredUnassigned.length > 0 && selectedStudentIds.size === filteredUnassigned.length}
                         />
                      </th>
                      <th className="p-4">Nama Siswa</th>
                      <th className="p-4">NIS / NISN</th>
                      <th className="p-4">Jenis Kelamin</th>
                      <th className="p-4">Status RFID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {loading && unassignedStudents.length === 0 ? (
                      <tr><td colSpan={5} className="p-10 text-center text-gray-400">Memuat data siswa...</td></tr>
                    ) : filteredUnassigned.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center space-y-4">
                           <div className="flex flex-col items-center gap-2 opacity-30">
                              <Users size={64} />
                              <p className="font-medium">Tidak ada siswa yang menunggu pemetaan.</p>
                           </div>
                           <p className="text-xs text-gray-400 italic">Lakukan "Reset Status" pada tab sebelumnya jika ingin merubah penempatan kelas siswa.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUnassigned.map(student => (
                        <tr 
                          key={student.id} 
                          onClick={() => toggleStudentSelection(student.id)}
                          className={`hover:bg-blue-50 cursor-pointer transition ${selectedStudentIds.has(student.id) ? 'bg-blue-50 dark:bg-blue-900/20' : 'dark:hover:bg-gray-700/50'}`}
                        >
                          <td className="p-4">
                            <input 
                              type="checkbox" 
                              checked={selectedStudentIds.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="w-5 h-5 rounded border-gray-300 text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="p-4">
                             <div className="font-bold text-gray-800 dark:text-gray-200 uppercase">{student.name}</div>
                          </td>
                          <td className="p-4 text-gray-500 font-mono text-xs dark:text-gray-400">{student.nis || '-'}</td>
                          <td className="p-4">
                             <span className={`px-2 py-1 rounded-full text-[10px] font-black ${student.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                {student.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                             </span>
                          </td>
                          <td className="p-4">
                             {student.rfidTag ? (
                               <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                                  <CheckCircle size={14} /> Terhubung
                               </span>
                             ) : (
                               <span className="text-gray-400 text-xs">-</span>
                             )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
               </table>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 dark:bg-gray-800 dark:border-gray-700">
               <div>Siswa terpilih: <span className="font-bold text-blue-600">{selectedStudentIds.size}</span> dari <span className="font-bold">{filteredUnassigned.length}</span> (Total tersedia: {unassignedStudents.length})</div>
               <div className="flex items-center gap-2">
                  <Info size={14} className="text-blue-500" />
                  <span>Siswa yang sudah ditempatkan akan hilang dari daftar ini.</span>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Data Import Alternative (Hidden/Small Note) */}
      <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex gap-3 dark:bg-yellow-900/10 dark:border-yellow-900/20">
         <Info className="text-yellow-600 shrink-0" size={20} />
         <div className="text-xs text-yellow-800 space-y-1 dark:text-yellow-400">
            <p className="font-bold">Informasi Sinkronisasi Mesin RFID:</p>
            <p>Karena pemetaan RFID melekat pada NIS/NISN siswa, maka saat Anda memasukkan siswa ke kelas baru, mesin RFID di gerbang akan <strong>otomatis</strong> mendeteksi siswa tersebut di kelas barunya. Tidak perlu setting ulang kartu.</p>
         </div>
      </div>
    </div>
  );
};

export default WakasekAcademicManagement;
