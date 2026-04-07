
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, BookOpen, Plus, Trash2, 
  Save, AlertCircle, CheckCircle, Info, Filter,
  ChevronDown, ChevronUp, Download, Upload, X
} from 'lucide-react';
import { 
  getTeachersBySchool, getClasses, getSchoolSchedules, 
  saveBulkSchedules, deleteTeachingSchedule, clearSchoolSchedules,
  getAvailableClassesForHomeroom, getMasterSubjects
} from '../services/database';
import { User as UserType, ClassRoom, TeachingSchedule, MasterSubject } from '../types';

interface WakasekScheduleManagerProps {
  user: UserType;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const WakasekScheduleManager: React.FC<WakasekScheduleManagerProps> = ({ user }) => {
  const [teachers, setTeachers] = useState<UserType[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<MasterSubject[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDay, setSelectedDay] = useState('Senin');
  const [meetingNo, setMeetingNo] = useState(1);
  const [timeStart, setTimeStart] = useState('07:30');
  const [timeEnd, setTimeEnd] = useState('08:15');
  const [subject, setSubject] = useState('');

  // Filter State
  const [filterTeacherId, setFilterTeacherId] = useState('ALL');
  const [activeTab, setActiveTab] = useState('Senin');

  const getSchoolLevel = () => {
    const name = (user.schoolName || '').toUpperCase();
    if (name.includes('SD')) return 'SD';
    if (name.includes('SMP')) return 'SMP';
    if (name.includes('SMA')) return 'SMA';
    if (name.includes('SMK')) return 'SMK';
    
    // Fallback: Check class names (SD: 1-6, SMP: 7-9, SMA/SMK: 10-12)
    const classNums = classes.map(c => parseInt(c.name.replace(/\D/g, ''))).filter(n => !isNaN(n));
    if (classNums.length > 0) {
      if (classNums.some(n => n >= 1 && n <= 6)) return 'SD';
      if (classNums.some(n => n >= 7 && n <= 9)) return 'SMP';
      if (classNums.some(n => n >= 10 && n <= 12)) return 'SMA';
    }
    return 'SEMUA';
  };

  const schoolLevel = getSchoolLevel();

  const filteredMasterSubjects = masterSubjects.filter(s => 
    s.level === 'SEMUA' || s.level === schoolLevel
  );

  useEffect(() => {
    loadData();
  }, [user.schoolNpsn]);

  const loadData = async () => {
    if (!user.schoolNpsn) return;
    setLoading(true);
    try {
      const [tData, cData, sData, mData] = await Promise.all([
        getTeachersBySchool(user.schoolNpsn),
        getAvailableClassesForHomeroom(user.schoolNpsn),
        getSchoolSchedules(user.schoolNpsn),
        getMasterSubjects()
      ]);
      setTeachers(tData);
      setClasses(cData);
      setSchedules(sData);
      setMasterSubjects(mData);
    } catch (error) {
      console.error('Failed to load schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-suggest subjects based on selected teacher
  useEffect(() => {
    if (selectedTeacherId) {
      const teacher = teachers.find(t => t.id === selectedTeacherId);
      if (teacher) {
        if (schoolLevel === 'SD' || teacher.teacherType === 'CLASS') {
          setSubject('Guru Kelas');
        } else if (teacher.subjects && teacher.subjects.length > 0) {
          setSubject(teacher.subjects[0]);
        } else if (teacher.subject) {
          setSubject(teacher.subject);
        }
      }
    }
  }, [selectedTeacherId, teachers, schoolLevel]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedClassId || !subject) {
      setMessage({ type: 'error', text: 'Mohon lengkapi semua data' });
      return;
    }

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    const cls = classes.find(c => c.id === selectedClassId);

    if (!teacher || !cls) return;

    const newSchedule: Omit<TeachingSchedule, 'id' | 'lastModified' | 'isSynced'> = {
      userId: selectedTeacherId,
      schoolNpsn: user.schoolNpsn,
      day: selectedDay,
      meetingNo,
      timeStart,
      timeEnd,
      className: cls.name,
      subject
    };

    try {
      await saveBulkSchedules([newSchedule]);
      setMessage({ type: 'success', text: 'Jadwal berhasil ditambahkan' });
      loadData();
      // Reset some fields
      setSubject('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal menambahkan jadwal' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus jadwal ini?')) return;
    try {
      await deleteTeachingSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      setMessage({ type: 'success', text: 'Jadwal berhasil dihapus' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal menghapus jadwal' });
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('PERINGATAN: Hapus SEMUA jadwal untuk sekolah ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await clearSchoolSchedules(user.schoolNpsn!);
      setSchedules([]);
      setMessage({ type: 'success', text: 'Semua jadwal berhasil dihapus' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal menghapus semua jadwal' });
    }
  };

  const filteredSchedules = schedules.filter(s => {
    const matchTeacher = filterTeacherId === 'ALL' || s.userId === filterTeacherId;
    const matchDay = s.day === activeTab;
    return matchTeacher && matchDay;
  }).sort((a, b) => {
    if (a.meetingNo && b.meetingNo) return a.meetingNo - b.meetingNo;
    return a.timeStart.localeCompare(b.timeStart);
  });

  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.fullName || 'Unknown';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Jadwal Mengajar</h1>
          <p className="text-gray-500 text-sm">Input dan kelola jadwal mengajar seluruh guru secara terpusat</p>
        </div>
        <button 
          onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium"
        >
          <Trash2 size={16} /> Kosongkan Semua Jadwal
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}><X size={18} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-purple-600" /> Tambah Jadwal Baru
            </h2>
            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guru</label>
                <select 
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  required
                >
                  <option value="">Pilih Guru</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kelas</label>
                <select 
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  required
                >
                  <option value="">Pilih Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hari</label>
                  <select 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jam Ke</label>
                  <select 
                    value={meetingNo}
                    onChange={(e) => setMeetingNo(Number(e.target.value))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Jam Ke-{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mata Pelajaran</label>
                <div className="relative">
                  <select 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    required
                  >
                    <option value="">Pilih Mata Pelajaran</option>
                    {/* Teacher's specific subjects */}
                    {selectedTeacherId && teachers.find(t => t.id === selectedTeacherId)?.subjects?.map(s => (
                      <option key={s} value={s}>{s} (Guru)</option>
                    ))}
                    {selectedTeacherId && teachers.find(t => t.id === selectedTeacherId)?.subject && (
                      <option value={teachers.find(t => t.id === selectedTeacherId)?.subject}>
                        {teachers.find(t => t.id === selectedTeacherId)?.subject} (Utama)
                      </option>
                    )}
                    {/* Master subjects */}
                    <optgroup label={`Daftar Mata Pelajaran (${schoolLevel})`}>
                      {filteredMasterSubjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </optgroup>
                    {schoolLevel === 'SD' && (
                      <optgroup label="Khusus SD / Guru Kelas">
                        <option value="Guru Kelas">Guru Kelas</option>
                        <option value="Tematik">Tematik</option>
                        <option value="PABP">PABP (Agama)</option>
                        <option value="PJOK">PJOK (Olahraga)</option>
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jam Mulai</label>
                  <input 
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jam Selesai</label>
                  <input 
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition shadow-md flex items-center justify-center gap-2"
              >
                <Save size={18} /> Simpan Jadwal
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex gap-2 text-blue-700">
                <Info size={18} className="flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Tips:</p>
                  <p>Jadwal yang diinput di sini akan muncul otomatis di dashboard masing-masing guru sesuai hari yang ditentukan.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar size={18} className="text-purple-600" /> Daftar Jadwal Terinput
              </h3>
              <div className="flex items-center gap-2">
                <select 
                  value={filterTeacherId}
                  onChange={(e) => setFilterTeacherId(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">Semua Guru</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </select>
              </div>
            </div>

            {/* Day Tabs */}
            <div className="flex border-b border-gray-100 bg-white overflow-x-auto">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setActiveTab(day)}
                  className={`px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                    activeTab === day 
                      ? 'border-purple-600 text-purple-600 bg-purple-50/30' 
                      : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Jam Ke</th>
                    <th className="px-6 py-3">Waktu</th>
                    <th className="px-6 py-3">Guru</th>
                    <th className="px-6 py-3">Kelas & Mapel</th>
                    <th className="px-6 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Memuat data...</td>
                    </tr>
                  ) : filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Belum ada jadwal untuk hari {activeTab}</td>
                    </tr>
                  ) : (
                    filteredSchedules.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                            {s.meetingNo || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                            <Clock size={12} /> {s.timeStart} - {s.timeEnd}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-700">{getTeacherName(s.userId)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-purple-700">{s.subject}</div>
                          <div className="text-[10px] text-gray-500">{s.className}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleDelete(s.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                            title="Hapus Jadwal"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WakasekScheduleManager;
