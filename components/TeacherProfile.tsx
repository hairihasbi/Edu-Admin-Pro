
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, UserRole, MasterSubject } from '../types';
import { User as UserIcon, School, IdCard, BookOpen, CheckCircle, AlertCircle, Save, Lock, Shield, Smartphone, DatabaseBackup, Info } from './Icons';
import { updateUserProfile, updateUserPassword, getMasterSubjects } from '../services/database';
import WhatsAppSettings from './WhatsAppSettings';

interface TeacherProfileProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

const TeacherProfile: React.FC<TeacherProfileProps> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  
  // Profile Form State
  const [formData, setFormData] = useState({
    fullName: user.fullName || '',
    nip: user.nip || '',
    phone: user.phone || '',
    subject: user.subject || '',
    schoolName: user.schoolName || '',
    // additionalRole and homeroomClassId kept in state for compatibility but UI is removed
    additionalRole: user.additionalRole || '',
    homeroomClassId: user.homeroomClassId || ''
  });

  // Master Data State
  const [availableSubjects, setAvailableSubjects] = useState<MasterSubject[]>([]);

  // Password Form State
  const [passData, setPassData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Check if teacher is BK
  const isBkTeacher = user.subject === 'Bimbingan Konseling';

  useEffect(() => {
    const fetchMasterData = async () => {
      const subData = await getMasterSubjects();
      setAvailableSubjects(subData.sort((a, b) => a.name.localeCompare(b.name)));
    };
    
    if (user.role === UserRole.GURU) {
      fetchMasterData();
    }
  }, [user.role]);

  // Handle Update Profile Data
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: null, message: '' });

    try {
      const dataToSave = { ...formData };
      
      const success = await updateUserProfile(user.id, dataToSave as any);

      if (success) {
        onUpdateUser({ ...user, ...dataToSave as any });
        setStatus({ type: 'success', message: 'Data identitas berhasil diperbarui!' });
      } else {
        setStatus({ type: 'error', message: 'Gagal menyimpan perubahan profil.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Update Password
  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passData.newPassword.length < 5) {
      setStatus({ type: 'error', message: 'Password harus minimal 5 karakter.' });
      return;
    }
    if (passData.newPassword !== passData.confirmPassword) {
      setStatus({ type: 'error', message: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setIsSaving(true);
    setStatus({ type: null, message: '' });

    try {
      const success = await updateUserPassword(user.id, passData.newPassword);
      if (success) {
        setStatus({ type: 'success', message: 'Password berhasil diubah! Gunakan password baru saat login berikutnya.' });
        setPassData({ newPassword: '', confirmPassword: '' });
      } else {
        setStatus({ type: 'error', message: 'Gagal mengubah password.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
          <UserIcon size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Profil & Pengaturan Akun</h2>
          <p className="text-gray-500">
            Kelola data diri, informasi sekolah, dan keamanan akun Anda.
          </p>
        </div>
      </div>

      {status.message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Kolom Kiri: Data Profil */}
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <IdCard size={18} className="text-gray-500" />
                <h3 className="font-semibold text-gray-800">Data Identitas</h3>
            </div>
            <div className="p-6">
                <form onSubmit={handleSubmitProfile} className="space-y-5">
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah</label>
                    <div className="relative">
                    <School className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                        placeholder="Contoh: SMA Negeri 1 Indonesia"
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                    <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                    placeholder="Nama Lengkap dengan Gelar"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. WhatsApp (Aktif)</label>
                    <div className="relative">
                    <Smartphone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                        placeholder="Contoh: 081234567890"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Digunakan untuk notifikasi dan data Admin.</p>
                </div>

                {/* Field Khusus Guru */}
                {!isAdmin && (
                    <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">NIP / NUPTK</label>
                        <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                        placeholder="Nomor Induk Pegawai"
                        value={formData.nip}
                        onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran</label>
                        <div className="relative">
                        <BookOpen className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <select
                            disabled={isBkTeacher}
                            className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm appearance-none ${
                                isBkTeacher ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
                            }`}
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        >
                            <option value="">-- Pilih Mata Pelajaran --</option>
                            {availableSubjects.map(sub => (
                            <option key={sub.id} value={sub.name}>
                                {sub.name}
                            </option>
                            ))}
                        </select>
                        </div>
                        {isBkTeacher && (
                            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                <Lock size={10} /> Terkunci sebagai Guru BK.
                            </p>
                        )}
                        
                        {/* ALERT LINK TO HELP CENTER */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2 text-xs text-blue-700 flex gap-2 items-start">
                            <Info size={14} className="mt-0.5 shrink-0" />
                            <p>
                                Mapel Anda tidak tersedia? <Link to="/help-center" className="font-bold underline hover:text-blue-900">Req Mapel Baru ke Admin</Link> melalui Pusat Bantuan.
                            </p>
                        </div>
                    </div>
                    </>
                )}

                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition"
                >
                    <Save size={16} /> Simpan Identitas
                </button>
                </form>
            </div>
            </div>
        </div>

        {/* Kolom Kanan: Keamanan Password & WA Config */}
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Shield size={18} className="text-gray-500" />
                    <h3 className="font-semibold text-gray-800">Keamanan Akun</h3>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSubmitPassword} className="space-y-5">
                    <div className="bg-yellow-50 p-3 rounded-md text-xs text-yellow-800 border border-yellow-200 mb-4">
                        Disarankan menggunakan kombinasi huruf dan angka agar akun lebih aman.
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                        <div className="relative">
                        <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="password"
                            required
                            minLength={5}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                            placeholder="Masukkan password baru"
                            value={passData.newPassword}
                            onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                        />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                        <div className="relative">
                        <CheckCircle className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="password"
                            required
                            minLength={5}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                            placeholder="Ulangi password baru"
                            value={passData.confirmPassword}
                            onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                        />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving || !passData.newPassword}
                        className={`w-full flex justify-center items-center gap-2 font-medium py-2.5 rounded-lg transition ${
                        !passData.newPassword 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-800 hover:bg-gray-900 text-white'
                        }`}
                    >
                        <Lock size={16} /> Ganti Password
                    </button>
                    </form>
                </div>
            </div>

            {/* WHATSAPP CONFIG FOR TEACHER */}
            {!isAdmin && (
                <WhatsAppSettings user={user} />
            )}
        </div>

        {/* BACKUP MENU (NEW) - FULL WIDTH */}
        {!isAdmin && (
            <div className="col-span-1 lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                            <DatabaseBackup size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Backup & Restore Data</h3>
                            <p className="text-sm text-gray-500">
                                Unduh cadangan data semester (Nilai, Jurnal, Absensi) atau pulihkan data dari file backup.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => navigate('/backup')}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition whitespace-nowrap shadow-sm"
                    >
                        Buka Menu Backup
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default TeacherProfile;
