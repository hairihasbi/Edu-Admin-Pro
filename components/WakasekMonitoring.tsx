
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, TeachingJournal, AttendanceRecord } from '../types';
import { getSchoolTeachers, getSchoolJournals, getSchoolAttendance, syncAllData } from '../services/database';
import { Activity, CheckCircle, XCircle, Calendar, Users, Search, Filter, Clock, Info, AlertCircle, RefreshCcw, Loader2 } from './Icons';

interface WakasekMonitoringProps {
  user: User;
}

const WakasekMonitoring: React.FC<WakasekMonitoringProps> = ({ user }) => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user.schoolNpsn) return;
      setLoading(true);
      try {
        const schoolTeachers = await getSchoolTeachers(user.schoolNpsn);
        const teacherIds = schoolTeachers.map(t => t.id);
        
        const [schoolJournals, schoolAttendance] = await Promise.all([
          getSchoolJournals(teacherIds, selectedDate),
          getSchoolAttendance(teacherIds, selectedDate)
        ]);

        setTeachers(schoolTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setJournals(schoolJournals);
        setAttendance(schoolAttendance);
      } catch (error) {
        console.error("Failed to fetch monitoring data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.schoolNpsn, selectedDate]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncAllData(true);
      // After sync, re-fetch data
      if (!user.schoolNpsn) return;
      const schoolTeachers = await getSchoolTeachers(user.schoolNpsn);
      const teacherIds = schoolTeachers.map(t => t.id);
      
      const [schoolJournals, schoolAttendance] = await Promise.all([
        getSchoolJournals(teacherIds, selectedDate),
        getSchoolAttendance(teacherIds, selectedDate)
      ]);

      setTeachers(schoolTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setJournals(schoolJournals);
      setAttendance(schoolAttendance);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.subject && t.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getJournalStatus = (teacherId: string) => {
    return journals.some(j => j.userId === teacherId);
  };

  const getAttendanceStatus = (teacherId: string) => {
    return attendance.some(a => a.userId === teacherId);
  };

  const stats = {
    total: teachers.length,
    filledJournal: teachers.filter(t => getJournalStatus(t.id)).length,
    filledAttendance: teachers.filter(t => getAttendanceStatus(t.id)).length
  };

  if (!user.schoolNpsn) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <AlertCircle size={48} className="text-orange-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Data Sekolah Tidak Ditemukan</h2>
        <p className="text-gray-600 mb-6">
          NPSN sekolah Anda belum terdaftar di profil. Silakan lengkapi data sekolah di menu Profil terlebih dahulu.
        </p>
        <button 
          onClick={() => navigate('/profile')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Lengkapi Profil
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
            <Activity size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Monitoring Kurikulum</h2>
            <p className="text-gray-500 text-sm">
              Pantau keaktifan guru dalam mengisi jurnal mengajar dan absensi siswa di {user.schoolName}.
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
          >
            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
            {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan Data'}
          </button>

          <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
            <Calendar size={18} className="text-gray-400 ml-2" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-medium text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Guru</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Isi Jurnal</p>
            <p className="text-2xl font-bold text-gray-800">{stats.filledJournal}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Isi Absensi</p>
            <p className="text-2xl font-bold text-gray-800">{stats.filledAttendance}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Cari nama guru atau mapel..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-500 italic flex items-center gap-1">
            <Info size={14} /> Menampilkan data per tanggal {new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Nama Guru</th>
                <th className="px-6 py-4">Mata Pelajaran Utama</th>
                <th className="px-6 py-4 text-center">Jurnal Mengajar</th>
                <th className="px-6 py-4 text-center">Absensi Siswa</th>
                <th className="px-6 py-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                  </tr>
                ))
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={32} className="text-gray-300" />
                      <p className="font-medium">Data guru tidak ditemukan.</p>
                      <p className="text-xs max-w-xs mx-auto">
                        Silakan klik tombol <strong>Sinkronkan Data</strong> di atas untuk menarik data terbaru dari server.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map(teacher => {
                  const hasJournal = getJournalStatus(teacher.id);
                  const hasAttendance = getAttendanceStatus(teacher.id);
                  
                  return (
                    <tr key={teacher.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">{teacher.fullName}</div>
                        <div className="text-[10px] text-gray-400">NIP: {teacher.nip || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {teacher.subject || (teacher.teacherType === 'CLASS' ? 'Guru Kelas' : '-')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasJournal ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-bold border border-green-100">
                            <CheckCircle size={12} /> SUDAH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-100">
                            <XCircle size={12} /> BELUM
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasAttendance ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-bold border border-green-100">
                            <CheckCircle size={12} /> SUDAH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-100">
                            <XCircle size={12} /> BELUM
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!hasJournal && !hasAttendance ? (
                          <span className="text-[10px] text-red-500 font-medium italic">Belum ada aktivitas</span>
                        ) : (
                          <span className="text-[10px] text-green-600 font-medium italic">Aktif mengajar</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-start gap-2 text-[10px] text-gray-500">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <p>
              Data ini diambil secara real-time berdasarkan entri Jurnal Mengajar dan Absensi Siswa yang dilakukan oleh masing-masing guru. 
              Jika guru mengajar di beberapa kelas dalam satu hari, status akan berubah menjadi "SUDAH" jika minimal satu kelas sudah diisi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WakasekMonitoring;
