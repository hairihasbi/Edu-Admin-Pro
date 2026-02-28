
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, UserRole, MasterSubject, ClassRoom } from '../types';
import { User as UserIcon, School, IdCard, BookOpen, CheckCircle, AlertCircle, Save, Lock, Shield, Smartphone, DatabaseBackup, Info, Layout } from './Icons';
import { updateUserProfile, updateUserPassword, getMasterSubjects, getAvailableClassesForHomeroom, claimHomeroomClass, releaseHomeroomClass } from '../services/database';
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
    phase: user.phase || '',
    teacherType: user.teacherType || 'SUBJECT'
  });

  // Master Data State
  const [availableSubjects, setAvailableSubjects] = useState<MasterSubject[]>([]);
  
  // Homeroom Data State
  const [schoolClasses, setSchoolClasses] = useState<ClassRoom[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Password Form State
  const [passData, setPassData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);

  const isBkTeacher = formData.subject === 'Bimbingan Konseling';
  const isClassTeacher = formData.teacherType === 'CLASS';
  const isAdmin = user.role === UserRole.ADMIN;

  useEffect(() => {
    const fetchMasterData = async () => {
      const subData = await getMasterSubjects();
      setAvailableSubjects(subData.sort((a, b) => a.name.localeCompare(b.name)));
    };
    
    if (user.role === UserRole.GURU) {
      fetchMasterData();
      fetchHomeroomClasses();
    }
  }, [user.role]);

  const fetchHomeroomClasses = async () => {
      setLoadingClasses(true);
      if (user.schoolNpsn) {
          const classes = await getAvailableClassesForHomeroom(user.schoolNpsn);
          setSchoolClasses(classes.sort((a,b) => a.name.localeCompare(b.name)));
      }
      setLoadingClasses(false);
  };

  // --- HOMEROOM ACTIONS ---
  const handleClaimClass = async (classId: string) => {
      if (!confirm("Apakah Anda yakin ingin menjadi Wali Kelas ini?")) return;
      
      const result = await claimHomeroomClass(classId, user);
      if (result.success && result.user) {
          onUpdateUser(result.user);
          setStatus({ type: 'success', message: 'Berhasil menjadi Wali Kelas.' });
          fetchHomeroomClasses(); // Refresh list
      } else {
          setStatus({ type: 'error', message: result.message || 'Gagal klaim kelas.' });
      }
  };

  const handleReleaseClass = async (classId: string) => {
      if (!confirm("Lepaskan jabatan Wali Kelas? Anda tidak akan bisa lagi mengakses data rapor kelas ini.")) return;

      const result = await releaseHomeroomClass(classId, user);
      if (result.success && result.user) {
          onUpdateUser(result.user);
          setStatus({ type: 'success', message: 'Jabatan Wali Kelas dilepaskan.' });
          fetchHomeroomClasses();
      } else {
          setStatus({ type: 'error', message: result.message || 'Gagal melepas kelas.' });
      }
  };

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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm bg-gray-50 cursor-not-allowed"
                        placeholder="Contoh: SMA Negeri 1 Indonesia"
                        value={formData.schoolName}
                        readOnly // School Name locked to NPSN registration usually
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Guru</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm bg-white"
                            value={formData.teacherType}
                            onChange={(e) => setFormData({ ...formData, teacherType: e.target.value as any })}
                        >
                            <option value="SUBJECT">Guru Mata Pelajaran (SMP/SMA/SMK)</option>
                            <option value="CLASS">Guru Kelas (SD)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Pilih "Guru Kelas" jika Anda mengajar semua mata pelajaran di SD.</p>
                    </div>

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

                    {/* Phase Selector for Class Teacher */}
                    {isClassTeacher && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fase / Kelas (Guru Kelas)</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm bg-white"
                                value={formData.phase}
                                onChange={(e) => setFormData({ ...formData, phase: e.target.value as any })}
                            >
                                <option value="A">Fase A (Kelas 1-2)</option>
                                <option value="B">Fase B (Kelas 3-4)</option>
                                <option value="C">Fase C (Kelas 5-6)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Menentukan mata pelajaran yang tersedia.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran</label>
                        <div className="relative">
                        <BookOpen className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <select
                            disabled={isBkTeacher || isClassTeacher}
                            className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm appearance-none ${
                                isBkTeacher || isClassTeacher ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
                            }`}
                            value={isClassTeacher ? 'Guru Kelas (SD)' : formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        >
                            {isClassTeacher ? (
                                <option value="Guru Kelas (SD)">Guru Kelas (SD)</option>
                            ) : (
                                <>
                                    <option value="">-- Pilih Mata Pelajaran --</option>
                                    {availableSubjects.map(sub => (
                                    <option key={sub.id} value={sub.name}>
                                        {sub.name}
                                    </option>
                                    ))}
                                </>
                            )}
                        </select>
                        </div>
                        {(isBkTeacher || isClassTeacher) && (
                            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                <Lock size={10} /> {isClassTeacher ? 'Mode Guru Kelas (Multi Mapel)' : 'Terkunci sebagai Guru BK.'}
                            </p>
                        )}
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

        {/* Kolom Kanan: Keamanan Password & WALI KELAS */}
        <div className="space-y-6">
            
            {/* WALI KELAS MANAGEMENT */}
            {!isAdmin && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                    <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center gap-2">
                        <Layout size={18} className="text-orange-600" />
                        <h3 className="font-semibold text-orange-800">Manajemen Wali Kelas</h3>
                    </div>
                    <div className="p-6">
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Pilih kelas yang Anda ampu sebagai Wali Kelas. Hanya bisa memilih 1 kelas.
                            </p>
                            {user.homeroomClassName ? (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-green-600 font-bold uppercase">Wali Kelas Aktif</p>
                                        <p className="text-lg font-bold text-green-800">{user.homeroomClassName}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleReleaseClass(user.homeroomClassId!)}
                                        className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded hover:bg-red-50 transition"
                                    >
                                        Lepas Jabatan
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-center text-sm text-gray-500 italic">
                                    Anda belum memilih kelas.
                                </div>
                            )}
                        </div>

                        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                            {loadingClasses ? (
                                <div className="p-4 text-center text-gray-400 text-xs">Memuat daftar kelas...</div>
                            ) : schoolClasses.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-xs">Belum ada kelas terdaftar di sekolah ini.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold text-xs sticky top-0">
                                        <tr>
                                            <th className="p-2 text-left">Nama Kelas</th>
                                            <th className="p-2 text-left">Status</th>
                                            <th className="p-2 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {schoolClasses.map(cls => {
                                            const isTaken = !!cls.homeroomTeacherId;
                                            const isMine = cls.homeroomTeacherId === user.id;
                                            
                                            return (
                                                <tr key={cls.id} className="hover:bg-gray-50">
                                                    <td className="p-2 font-medium text-gray-800">{cls.name}</td>
                                                    <td className="p-2 text-xs">
                                                        {isMine ? (
                                                            <span className="text-green-600 font-bold">Milik Anda</span>
                                                        ) : isTaken ? (
                                                            <span className="text-red-500" title={cls.homeroomTeacherName}>Diambil: {cls.homeroomTeacherName?.split(' ')[0]}</span>
                                                        ) : (
                                                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Tersedia</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        {!isTaken && !user.homeroomClassId && (
                                                            <button 
                                                                onClick={() => handleClaimClass(cls.id)}
                                                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                                                            >
                                                                Ambil
                                                            </button>
                                                        )}
                                                        {isMine && (
                                                            <button 
                                                                onClick={() => handleReleaseClass(cls.id)}
                                                                className="text-xs text-red-500 hover:underline"
                                                            >
                                                                Lepas
                                                            </button>
                                                        )}
                                                        {isTaken && !isMine && (
                                                            <span className="text-gray-300 text-xs"><Lock size={12} /></span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
