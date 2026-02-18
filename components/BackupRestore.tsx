
import React, { useState, useRef } from 'react';
import { User, UserRole, BackupData } from '../types';
import { createBackup, restoreBackup, resetSystemData } from '../services/database';
import { DatabaseBackup, Download, Upload, AlertCircle, CheckCircle, RefreshCcw, FileText, Trash2, AlertTriangle } from './Icons';

interface BackupRestoreProps {
  user: User;
}

const BackupRestore: React.FC<BackupRestoreProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'delete'>('backup');
  const [selectedSemester, setSelectedSemester] = useState('Ganjil');
  const [isLoading, setIsLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  
  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- BACKUP HANDLER ---
  const handleBackup = async () => {
    setIsLoading(true);
    try {
      const semesterFilter = (selectedSemester === 'Semua' || selectedSemester === 'FULL_YEAR') ? undefined : selectedSemester;
      const backupData = await createBackup(user, semesterFilter);
      
      if (backupData) {
        // Trigger Download
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `EduAdmin_Backup_${user.role}_${dateStr}${semesterFilter ? '_' + semesterFilter : '_FULL'}.json`;
        
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Gagal membuat backup. Cek konsol atau koneksi database.");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat proses backup.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- RESTORE HANDLER ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const parsedData = JSON.parse(jsonContent) as BackupData;

        // Basic Validation
        if (!parsedData.meta || !parsedData.data) {
          setRestoreStatus({ type: 'error', message: "Format file tidak valid. Pastikan file berasal dari aplikasi ini." });
          return;
        }

        // Confirmation
        if (window.confirm(`Anda akan memulihkan data dari tanggal ${new Date(parsedData.meta.date).toLocaleDateString()}. \n\nData yang ada dengan ID sama akan ditimpa. Lanjutkan?`)) {
           setIsLoading(true);
           const result = await restoreBackup(parsedData);
           setRestoreStatus({ 
             type: result.success ? 'success' : 'error', 
             message: result.message 
           });
           setIsLoading(false);
        }
      } catch (err) {
        setRestoreStatus({ type: 'error', message: "Gagal membaca file JSON." });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- DELETE HANDLER (ADMIN ONLY) ---
  const handleDeleteData = async (scope: 'SEMESTER' | 'ALL') => {
      if (user.role !== UserRole.ADMIN) return;

      let confirmMessage = "";
      
      if (scope === 'ALL') {
          confirmMessage = "PERINGATAN KERAS: Anda akan melakukan FACTORY RESET. Semua data Guru, Siswa, Kelas, Nilai, dan Jurnal akan DIHAPUS PERMANEN. Hanya akun Admin Anda yang tersisa.\n\nApakah Anda benar-benar yakin?";
      } else if (selectedSemester === 'FULL_YEAR') {
          confirmMessage = "PERINGATAN: Anda memilih opsi '1 Tahun Penuh'.\n\nTindakan ini akan menghapus:\n1. Seluruh Data KELAS\n2. Seluruh Data SISWA\n3. Seluruh Data AKADEMIK (Nilai, Jurnal, Absensi)\n4. Seluruh Data BK\n\nData Akun Guru TETAP ADA. Gunakan ini saat pergantian tahun ajaran baru.\n\nLanjutkan?";
      } else {
          confirmMessage = `PERINGATAN: Anda akan menghapus data akademik (Nilai & Lingkup Materi) untuk Semester ${selectedSemester}.\n\nData Kelas dan Siswa TIDAK dihapus. Pastikan guru sudah melakukan backup. Lanjutkan?`;
      }

      if (window.confirm(confirmMessage)) {
          // Double confirmation for FULL RESET
          if (scope === 'ALL') {
              const confirmText = prompt("Ketik 'HAPUS SEMUA' untuk konfirmasi penghapusan total:");
              if (confirmText !== 'HAPUS SEMUA') {
                  alert("Penghapusan dibatalkan. Kode konfirmasi salah.");
                  return;
              }
          } else if (selectedSemester === 'FULL_YEAR') {
              const confirmText = prompt("Ketik 'GANTI TAHUN' untuk konfirmasi reset tahun ajaran:");
              if (confirmText !== 'GANTI TAHUN') {
                  alert("Penghapusan dibatalkan.");
                  return;
              }
          }

          setIsLoading(true);
          const result = await resetSystemData(scope, selectedSemester);
          alert(result.message);
          setIsLoading(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
          <DatabaseBackup size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Backup, Restore & Reset</h2>
          <p className="text-gray-500">
            Kelola keamanan data, pulihkan cadangan, atau bersihkan sistem.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'backup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Backup Data
        </button>
        <button
          onClick={() => { setActiveTab('restore'); setRestoreStatus({type:null, message:''}); }}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition ${
            activeTab === 'restore' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Restore Data
        </button>
        {user.role === UserRole.ADMIN && (
            <button
            onClick={() => setActiveTab('delete')}
            className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'delete' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
            >
            <Trash2 size={16} /> Hapus Data
            </button>
        )}
      </div>

      {/* BACKUP CONTENT */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in zoom-in duration-200">
           <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Download className="text-indigo-600" /> Unduh Cadangan Data
                 </h3>
                 <p className="text-gray-600 text-sm leading-relaxed">
                    {user.role === UserRole.ADMIN 
                      ? "Sebagai Admin, Anda akan membackup SELURUH data sistem termasuk User, Kelas, Siswa, dan Nilai dari semua guru."
                      : "Anda akan membackup data Kelas, Siswa, Jurnal, dan Nilai yang terkait dengan akun Anda saja."
                    }
                 </p>
                 
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-blue-800 mb-2">Pilih Filter Semester (Opsional)</label>
                    <select 
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="w-full border border-blue-200 rounded-lg p-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                       <option value="Ganjil">Semester Ganjil</option>
                       <option value="Genap">Semester Genap</option>
                       {user.role === UserRole.ADMIN && (
                           <>
                               <option value="FULL_YEAR">1 Tahun (Ganjil & Genap)</option>
                               <option value="Semua">Semua Data (Full Backup)</option>
                           </>
                       )}
                    </select>
                    <p className="text-xs text-blue-600 mt-2">
                       *Data Master (User, Kelas, Siswa) akan selalu ikut terunduh untuk menjaga integritas data.
                    </p>
                 </div>

                 <button 
                    onClick={handleBackup}
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                 >
                    {isLoading ? (
                       <RefreshCcw className="animate-spin" />
                    ) : (
                       <Download />
                    )}
                    {isLoading ? 'Memproses Backup...' : 'Download File Backup (.json)'}
                 </button>
              </div>

              <div className="hidden md:flex justify-center flex-1">
                 <div className="bg-indigo-50 p-8 rounded-full">
                    <DatabaseBackup size={120} className="text-indigo-200" />
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* RESTORE CONTENT */}
      {activeTab === 'restore' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in zoom-in duration-200">
           <div className="text-center max-w-xl mx-auto space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-left flex gap-3">
                 <AlertCircle className="text-yellow-600 flex-shrink-0" />
                 <div className="text-sm text-yellow-800">
                    <p className="font-bold mb-1">Perhatian!</p>
                    <p>Proses Restore akan menggabungkan data dari file backup ke database saat ini.</p>
                    <ul className="list-disc ml-4 mt-2">
                       <li>Data dengan ID yang sama akan diperbarui (ditimpa).</li>
                       <li>Data baru akan ditambahkan.</li>
                       <li>Data yang ada di database tapi tidak ada di file backup <strong>TIDAK AKAN</strong> dihapus.</li>
                    </ul>
                 </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center hover:bg-gray-50 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                 <input 
                   type="file" 
                   accept=".json" 
                   ref={fileInputRef}
                   className="hidden" 
                   onChange={handleFileChange}
                 />
                 <Upload size={48} className="text-gray-400 mb-4" />
                 <p className="text-gray-600 font-medium">Klik untuk upload file .json</p>
                 <p className="text-xs text-gray-400 mt-1">Hanya file hasil backup EduAdmin yang didukung</p>
              </div>

              {isLoading && (
                 <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                    <RefreshCcw className="animate-spin" /> Sedang memulihkan data...
                 </div>
              )}

              {restoreStatus.message && (
                 <div className={`p-4 rounded-lg flex items-center gap-3 text-left ${
                    restoreStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                 }`}>
                    {restoreStatus.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <p>{restoreStatus.message}</p>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* DELETE CONTENT (Admin Only) */}
      {activeTab === 'delete' && user.role === UserRole.ADMIN && (
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-8 animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                      <div>
                          <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
                              <AlertTriangle size={24} /> Danger Zone: Hapus Data Sistem
                          </h3>
                          <p className="text-red-700 text-sm mt-2 leading-relaxed">
                              Menu ini digunakan untuk membersihkan data sistem pada akhir semester atau akhir tahun ajaran. 
                              Tindakan ini <strong>tidak dapat dibatalkan</strong>. Pastikan Anda sudah melakukan backup terlebih dahulu.
                          </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Option 1: Per Semester / Full Year */}
                          <div className="bg-white p-5 rounded-lg border border-red-200 shadow-sm">
                              <h4 className="font-bold text-gray-800 mb-2">Hapus Data Berkala</h4>
                              <p className="text-xs text-gray-500 mb-4">
                                  Pilih cakupan data yang ingin dihapus.
                              </p>
                              <div className="mb-4">
                                  <select 
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 text-sm"
                                  >
                                      <option value="Ganjil">Semester Ganjil (Hanya Data Nilai & Materi)</option>
                                      <option value="Genap">Semester Genap (Hanya Data Nilai & Materi)</option>
                                      <option value="FULL_YEAR" className="font-bold text-red-600 bg-red-50">1 Tahun Penuh (Reset Tahun Ajaran)</option>
                                  </select>
                              </div>
                              <div className="bg-yellow-50 p-2 rounded text-[10px] text-yellow-800 mb-3 border border-yellow-200">
                                {selectedSemester === 'FULL_YEAR' 
                                    ? "Opsi ini menghapus Kelas, Siswa, Jurnal, Absensi, Nilai, dan BK. Akun Guru TIDAK dihapus." 
                                    : "Opsi ini hanya menghapus Nilai & Lingkup Materi. Data Siswa & Kelas AMAN."
                                }
                              </div>
                              <button 
                                onClick={() => handleDeleteData('SEMESTER')}
                                disabled={isLoading}
                                className="w-full bg-red-100 text-red-700 font-bold py-2 rounded border border-red-200 hover:bg-red-200 transition"
                              >
                                  {isLoading ? 'Memproses...' : `Eksekusi Penghapusan`}
                              </button>
                          </div>

                          {/* Option 2: Full Reset */}
                          <div className="bg-white p-5 rounded-lg border border-red-200 shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-2 py-1 font-bold">FACTORY RESET</div>
                              <h4 className="font-bold text-gray-800 mb-2">Hapus Total (Instal Ulang)</h4>
                              <p className="text-xs text-gray-500 mb-4">
                                  Menghapus <strong>SEMUA</strong> data: Guru, Siswa, Kelas, Nilai, Jurnal, dan Absensi. Sistem akan kembali kosong seperti baru instalasi (kecuali akun Admin ini).
                              </p>
                              <button 
                                onClick={() => handleDeleteData('ALL')}
                                disabled={isLoading}
                                className="w-full bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 transition shadow-sm mt-8"
                              >
                                  {isLoading ? 'Memproses...' : 'HAPUS SEMUA DATA'}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default BackupRestore;
