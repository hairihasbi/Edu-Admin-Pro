
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, TeachingJournal, AttendanceRecord, ClassRoom } from '../types';
import { getSchoolTeachers, getSchoolJournals, getSchoolAttendance, syncAllData, getAvailableClassesForHomeroom } from '../services/database';
import { Activity, CheckCircle, XCircle, Calendar, Users, Search, Filter, Clock, Info, AlertCircle, RefreshCcw, Loader2, BookOpen, LayoutGrid, List as ListIcon } from './Icons';

interface WakasekMonitoringProps {
  user: User;
}

const WakasekMonitoring: React.FC<WakasekMonitoringProps> = ({ user }) => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'GURU' | 'KELAS'>('GURU');

  useEffect(() => {
    const fetchData = async () => {
      if (!user.schoolNpsn) return;
      setLoading(true);
      try {
        const [schoolTeachers, schoolClasses] = await Promise.all([
          getSchoolTeachers(user.schoolNpsn),
          getAvailableClassesForHomeroom(user.schoolNpsn)
        ]);
        
        const teacherIds = schoolTeachers.map(t => t.id);
        
        const [schoolJournals, schoolAttendance] = await Promise.all([
          getSchoolJournals(teacherIds, selectedDate),
          getSchoolAttendance(teacherIds, selectedDate)
        ]);

        setTeachers(schoolTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setClasses(schoolClasses.sort((a, b) => a.name.localeCompare(b.name)));
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
      const [schoolTeachers, schoolClasses] = await Promise.all([
        getSchoolTeachers(user.schoolNpsn),
        getAvailableClassesForHomeroom(user.schoolNpsn)
      ]);
      
      const teacherIds = schoolTeachers.map(t => t.id);
      
      const [schoolJournals, schoolAttendance] = await Promise.all([
        getSchoolJournals(teacherIds, selectedDate),
        getSchoolAttendance(teacherIds, selectedDate)
      ]);

      setTeachers(schoolTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setClasses(schoolClasses.sort((a, b) => a.name.localeCompare(b.name)));
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

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const classNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [classes]);

  const teacherNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    teachers.forEach(t => { map[t.id] = t.fullName; });
    return map;
  }, [teachers]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Kelas</p>
            <p className="text-2xl font-bold text-gray-800">{classes.length}</p>
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

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('GURU')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'GURU' 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={18} />
          Monitoring Per Guru
        </button>
        <button
          onClick={() => setActiveTab('KELAS')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'KELAS' 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutGrid size={18} />
          Monitoring Per Kelas
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder={activeTab === 'GURU' ? "Cari nama guru atau mapel..." : "Cari nama kelas..."}
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
          {activeTab === 'GURU' ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nama Guru</th>
                  <th className="px-6 py-4">Detail Sesi (Jam Pelajaran)</th>
                  <th className="px-6 py-4 text-center">Status Jurnal</th>
                  <th className="px-6 py-4 text-center">Status Absensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                    </tr>
                  ))
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
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
                    const teacherJournals = journals.filter(j => j.userId === teacher.id).sort((a, b) => a.meetingNo.localeCompare(b.meetingNo, undefined, { numeric: true }));
                    const hasJournal = teacherJournals.length > 0;
                    const hasAttendance = attendance.some(a => a.userId === teacher.id);
                    
                    return (
                      <tr key={teacher.id} className="hover:bg-gray-50 transition align-top">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-800">{teacher.fullName}</div>
                          <div className="text-[10px] text-gray-400">NIP: {teacher.nip || '-'}</div>
                          <div className="text-[10px] text-purple-600 font-medium mt-1">{teacher.subject || (teacher.teacherType === 'CLASS' ? 'Guru Kelas' : '-')}</div>
                        </td>
                        <td className="px-6 py-4">
                          {hasJournal ? (
                            <div className="space-y-3">
                              {teacherJournals.map(journal => (
                                <div key={journal.id} className="bg-gray-50 p-2 rounded border border-gray-100">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Jam ke-{journal.meetingNo}</span>
                                    <span className="text-[10px] font-medium text-gray-500">{classNameMap[journal.classId] || 'Kelas Tidak Diketahui'}</span>
                                  </div>
                                  <div className="text-xs text-gray-700 line-clamp-1 font-medium">{journal.learningObjective}</div>
                                  <div className="text-[10px] text-gray-400 italic mt-0.5">{journal.activities.substring(0, 50)}...</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Belum ada sesi mengajar yang tercatat hari ini</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasJournal ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-bold border border-green-100">
                              <CheckCircle size={12} /> {teacherJournals.length} SESI
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nama Kelas</th>
                  <th className="px-6 py-4">Detail Sesi (Jam Pelajaran)</th>
                  <th className="px-6 py-4 text-center">Status KBM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                    </tr>
                  ))
                ) : filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={32} className="text-gray-300" />
                        <p className="font-medium">Data kelas tidak ditemukan.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map(cls => {
                    const classJournals = journals.filter(j => j.classId === cls.id).sort((a, b) => a.meetingNo.localeCompare(b.meetingNo, undefined, { numeric: true }));
                    const hasKBM = classJournals.length > 0;
                    
                    return (
                      <tr key={cls.id} className="hover:bg-gray-50 transition align-top">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-800">{cls.name}</div>
                          <div className="text-[10px] text-gray-400">{cls.studentCount} Siswa</div>
                          {cls.homeroomTeacherName && (
                            <div className="text-[10px] text-blue-600 font-medium mt-1">Wali: {cls.homeroomTeacherName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {hasKBM ? (
                            <div className="space-y-3">
                              {classJournals.map(journal => (
                                <div key={journal.id} className="bg-gray-50 p-2 rounded border border-gray-100">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Jam ke-{journal.meetingNo}</span>
                                    <span className="text-[10px] font-medium text-gray-500">{teacherNameMap[journal.userId] || 'Guru Tidak Diketahui'}</span>
                                  </div>
                                  <div className="text-xs text-gray-700 font-medium">{journal.subject}</div>
                                  <div className="text-[10px] text-gray-600 line-clamp-1">{journal.learningObjective}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Belum ada aktivitas belajar mengajar hari ini</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasKBM ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-bold border border-green-100">
                              <CheckCircle size={12} /> {classJournals.length} SESI
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-100">
                              <XCircle size={12} /> KOSONG
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-start gap-2 text-[10px] text-gray-500">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <p>
              Data ini diambil secara real-time berdasarkan entri Jurnal Mengajar dan Absensi Siswa. 
              Tab <strong>Per Guru</strong> menampilkan aktivitas mengajar setiap guru per sesi (jam pelajaran), 
              sedangkan tab <strong>Per Kelas</strong> menampilkan kronologi pembelajaran di setiap kelas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WakasekMonitoring;
