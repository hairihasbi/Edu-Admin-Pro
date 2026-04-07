
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, TeachingJournal, AttendanceRecord, ClassRoom, TeachingSchedule } from '../types';
import { getSchoolTeachers, getSchoolJournals, getSchoolAttendance, syncAllData, getAvailableClassesForHomeroom, getSchoolSchedules } from '../services/database';
import { Activity, CheckCircle, XCircle, Calendar, Users, Search, Filter, Clock, Info, AlertCircle, RefreshCcw, Loader2, BookOpen, LayoutGrid, List as ListIcon, ChevronDown, ChevronUp } from './Icons';

interface WakasekMonitoringProps {
  user: User;
}

const WakasekMonitoring: React.FC<WakasekMonitoringProps> = ({ user }) => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'GURU' | 'KELAS'>('GURU');
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user.schoolNpsn) return;
      setLoading(true);
      try {
        const [schoolTeachers, schoolClasses, schoolSchedules] = await Promise.all([
          getSchoolTeachers(user.schoolNpsn),
          getAvailableClassesForHomeroom(user.schoolNpsn),
          getSchoolSchedules(user.schoolNpsn)
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
        setSchedules(schoolSchedules);
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
      const [schoolTeachers, schoolClasses, schoolSchedules] = await Promise.all([
        getSchoolTeachers(user.schoolNpsn),
        getAvailableClassesForHomeroom(user.schoolNpsn),
        getSchoolSchedules(user.schoolNpsn)
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
      setSchedules(schoolSchedules);
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

  const toggleTeacherExpansion = (id: string) => {
    setExpandedTeacherId(expandedTeacherId === id ? null : id);
  };

  const toggleClassExpansion = (id: string) => {
    setExpandedClassId(expandedClassId === id ? null : id);
  };

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

  const currentDayName = useMemo(() => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date(selectedDate).getDay()];
  }, [selectedDate]);

  const todaySchedules = useMemo(() => {
    return schedules.filter(s => s.day === currentDayName);
  }, [schedules, currentDayName]);

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
                  <th className="px-6 py-4 text-center">Status Jurnal</th>
                  <th className="px-6 py-4 text-center">Status Absensi</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
                    </tr>
                  ))
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={32} className="text-gray-300" />
                        <p className="font-medium">Data guru tidak ditemukan.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map(teacher => {
                    const teacherJournals = journals.filter(j => j.userId === teacher.id).sort((a, b) => a.meetingNo.localeCompare(b.meetingNo, undefined, { numeric: true }));
                    const teacherSchedules = todaySchedules.filter(s => s.userId === teacher.id).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
                    const hasJournal = teacherJournals.length > 0;
                    const hasAttendance = attendance.some(a => a.userId === teacher.id);
                    const isExpanded = expandedTeacherId === teacher.id;
                    
                    // Calculate compliance
                    const plannedCount = teacherSchedules.length;
                    const actualCount = teacherJournals.length;
                    const isFullyCompliant = plannedCount > 0 && actualCount >= plannedCount;
                    
                    return (
                      <React.Fragment key={teacher.id}>
                        <tr 
                          className={`hover:bg-gray-50 transition cursor-pointer ${isExpanded ? 'bg-purple-50/30' : ''}`}
                          onClick={() => toggleTeacherExpansion(teacher.id)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-800">{teacher.fullName}</div>
                            <div className="text-[10px] text-gray-400">NIP: {teacher.nip || '-'}</div>
                            <div className="text-[10px] text-purple-600 font-medium mt-1">{teacher.subject || (teacher.teacherType === 'CLASS' ? 'Guru Kelas' : '-')}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {plannedCount > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                  isFullyCompliant ? 'bg-green-50 text-green-700 border-green-100' : 
                                  actualCount > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                                  'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                  {isFullyCompliant ? <CheckCircle size={12} /> : actualCount > 0 ? <Clock size={12} /> : <XCircle size={12} />}
                                  {actualCount} / {plannedCount} SESI
                                </span>
                                <span className="text-[9px] text-gray-400">Target: {plannedCount} Sesi</span>
                              </div>
                            ) : hasJournal ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                <Info size={12} /> {actualCount} SESI (Luar Jadwal)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 text-[10px] font-bold border border-gray-100">
                                TIDAK ADA JADWAL
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
                          <td className="px-6 py-4 text-center">
                            <button className="text-purple-600 hover:text-purple-800 transition">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-4">
                                  {/* Planned Schedules */}
                                  {teacherSchedules.length > 0 && (
                                    <div>
                                      <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Rencana Jadwal Hari Ini</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                                        {teacherSchedules.map(s => {
                                          const isFilled = journals.some(j => 
                                            j.userId === teacher.id && 
                                            j.classId === classes.find(c => c.name === s.className)?.id &&
                                            j.subject === s.subject
                                          );
                                          return (
                                            <div key={s.id} className={`p-2 rounded border flex items-center justify-between ${isFilled ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                              <div>
                                                <div className="text-[10px] font-bold text-gray-800">Jam {s.meetingNo || '-'}{s.meetingNoEnd && s.meetingNoEnd !== s.meetingNo ? ` - ${s.meetingNoEnd}` : ''}: {s.subject}</div>
                                                <div className="text-[9px] text-gray-500">{s.className} | {s.timeStart}-{s.timeEnd}</div>
                                              </div>
                                              {isFilled ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-400" />}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Actual Journals */}
                                  <div>
                                    <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Realisasi Jurnal Mengajar</h5>
                                    {hasJournal ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {teacherJournals.map(journal => (
                                          <div key={journal.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">Jam ke-{journal.meetingNo}</span>
                                              <span className="text-[10px] font-bold text-gray-600">{classNameMap[journal.classId] || 'Kelas Tidak Diketahui'}</span>
                                            </div>
                                            <div className="text-xs font-bold text-gray-800 mb-1">{journal.learningObjective}</div>
                                            <div className="text-[10px] text-gray-600 line-clamp-2 mb-2">{journal.activities}</div>
                                            <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
                                              <span className="text-[9px] text-gray-400 italic">Input: {journal.lastModified ? new Date(journal.lastModified).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                              <span className="text-[9px] font-medium text-green-600">Tersimpan</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 bg-white rounded-lg border border-dashed border-gray-300">
                                        <p className="text-xs text-gray-400 italic">Belum ada sesi mengajar yang tercatat hari ini</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
                  <th className="px-6 py-4 text-center">Status KBM</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
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
                    const classSchedules = todaySchedules.filter(s => s.className === cls.name).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
                    const hasKBM = classJournals.length > 0;
                    const isExpanded = expandedClassId === cls.id;
                    
                    const plannedCount = classSchedules.length;
                    const actualCount = classJournals.length;
                    const isFullyCompliant = plannedCount > 0 && actualCount >= plannedCount;

                    return (
                      <React.Fragment key={cls.id}>
                        <tr 
                          className={`hover:bg-gray-50 transition cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                          onClick={() => toggleClassExpansion(cls.id)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-800">{cls.name}</div>
                            <div className="text-[10px] text-gray-400">{cls.studentCount} Siswa</div>
                            {cls.homeroomTeacherName && (
                              <div className="text-[10px] text-blue-600 font-medium mt-1">Wali: {cls.homeroomTeacherName}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {plannedCount > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                  isFullyCompliant ? 'bg-green-50 text-green-700 border-green-100' : 
                                  actualCount > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                                  'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                  {isFullyCompliant ? <CheckCircle size={12} /> : actualCount > 0 ? <Clock size={12} /> : <XCircle size={12} />}
                                  {actualCount} / {plannedCount} SESI
                                </span>
                                <span className="text-[9px] text-gray-400">Target: {plannedCount} Sesi</span>
                              </div>
                            ) : hasKBM ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                <Info size={12} /> {actualCount} SESI (Luar Jadwal)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 text-[10px] font-bold border border-gray-100">
                                TIDAK ADA JADWAL
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button className="text-blue-600 hover:text-blue-800 transition">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={3} className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-4">
                                  {/* Planned Schedules */}
                                  {classSchedules.length > 0 && (
                                    <div>
                                      <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Rencana Jadwal Hari Ini</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                                        {classSchedules.map(s => {
                                          const isFilled = journals.some(j => 
                                            j.classId === cls.id && 
                                            j.userId === s.userId &&
                                            j.subject === s.subject
                                          );
                                          return (
                                            <div key={s.id} className={`p-2 rounded border flex items-center justify-between ${isFilled ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                                              <div>
                                                <div className="text-[10px] font-bold text-gray-800">Jam {s.meetingNo || '-'}{s.meetingNoEnd && s.meetingNoEnd !== s.meetingNo ? ` - ${s.meetingNoEnd}` : ''}: {s.subject}</div>
                                                <div className="text-[9px] text-gray-500">{teacherNameMap[s.userId]} | {s.timeStart}-{s.timeEnd}</div>
                                              </div>
                                              {isFilled ? <CheckCircle size={14} className="text-blue-600" /> : <XCircle size={14} className="text-red-400" />}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Actual Journals */}
                                  <div>
                                    <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Kronologi Pembelajaran</h5>
                                    {hasKBM ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {classJournals.map(journal => (
                                          <div key={journal.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Jam ke-{journal.meetingNo}</span>
                                              <span className="text-[10px] font-bold text-gray-600">{teacherNameMap[journal.userId] || 'Guru Tidak Diketahui'}</span>
                                            </div>
                                            <div className="text-xs font-bold text-gray-800 mb-1">{journal.subject}</div>
                                            <div className="text-[10px] text-gray-600 line-clamp-2 mb-2">{journal.learningObjective}</div>
                                            <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
                                              <span className="text-[9px] text-gray-400 italic">Input: {journal.lastModified ? new Date(journal.lastModified).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                              <span className="text-[9px] font-medium text-blue-600">Terverifikasi</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 bg-white rounded-lg border border-dashed border-gray-300">
                                        <p className="text-xs text-gray-400 italic">Belum ada aktivitas belajar mengajar hari ini</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
