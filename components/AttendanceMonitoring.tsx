
import React, { useState, useEffect, useMemo } from 'react';
import { User, RfidLog, SystemSettings, Student, ClassRoom } from '../types';
import { getRfidLogsByRange, getSystemSettings, getSchoolStudents, getSchoolClasses, clearAllRfidLogsByDate, clearAllRfidLogsByRange } from '../services/database';
import { 
  ClipboardList, Search, Calendar, Filter, 
  Download, Printer, CheckCircle, Clock, 
  Smartphone, Wifi, User as UserIcon, Trash2,
  ChevronLeft, ChevronRight, AlertCircle, Info,
  BookOpen, LayoutGrid, X
} from './Icons';
import * as XLSX from 'xlsx';

interface AttendanceMonitoringProps {
  user: User;
}

interface AggregatedAttendance {
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  checkIn: string | null;
  checkOut: string | null;
  presentCount?: number;
  lateCount?: number;
  earlyLeaveCount?: number;
  status: 'HADIR' | 'TERLAMBAT' | 'PULANG CEPAT' | 'TERLAMBAT & PULANG CEPAT' | 'ALFA' | 'TANPA TAP';
  photoBase64?: string;
}

const AttendanceMonitoring: React.FC<AttendanceMonitoringProps> = ({ user }) => {
  const [logs, setLogs] = useState<RfidLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterMode, setFilterMode] = useState<'DAILY' | 'MONTHLY' | 'SEMESTER'>('DAILY');
  const getLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [selectedMonth, setSelectedMonth] = useState(getLocalDate().slice(0, 7)); // YYYY-MM
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>(new Date().getMonth() >= 6 ? 'Ganjil' : 'Genap');
  const [activeClassId, setActiveClassId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HADIR' | 'TERLAMBAT' | 'PULANG CEPAT' | 'ALFA'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedMonth, selectedSemester, filterMode]);

  const fetchData = async () => {
    if (!user.schoolNpsn) return;
    setLoading(true);
    
    let startDate = selectedDate;
    let endDate = selectedDate;

    if (filterMode === 'MONTHLY') {
        startDate = `${selectedMonth}-01`;
        const dateObj = new Date(selectedMonth);
        const lastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
        endDate = `${selectedMonth}-${lastDay}`;
    } else if (filterMode === 'SEMESTER') {
        const now = new Date();
        const year = now.getFullYear();
        if (selectedSemester === 'Ganjil') { // July-Dec
            startDate = `${year}-07-01`;
            endDate = `${year}-12-31`;
        } else { // Jan-June
            startDate = `${year}-01-01`;
            endDate = `${year}-06-30`;
        }
    }

    const [logData, studentData, classData, settingsData] = await Promise.all([
      getRfidLogsByRange(user.schoolNpsn, startDate, endDate),
      getSchoolStudents(user.schoolNpsn),
      getSchoolClasses(user.schoolNpsn),
      getSystemSettings()
    ]);
    
    setLogs(logData);
    setStudents(studentData);
    setClasses(classData);
    setSettings(settingsData || null);
    setLoading(false);
  };

  const attendanceData = useMemo(() => {
    const list: AggregatedAttendance[] = [];
    const checkInStart = settings?.rfidCheckInStart || '06:00';
    const checkInLate = settings?.rfidCheckInLate || '07:30';
    const checkOutStart = settings?.rfidCheckOutStart || '14:00';

    // If daily, we show all students in the selected class (or all classes)
    // If monthly/semester, we probably should group by student and show aggregated counts?
    // User requested: "cek sisaa yang telat atau tidak absen dikelas tersebut" (who is late or hasn't tapped)
    // This usually implies a DAILY view is most common for detailed checking.
    
    const targetStudents = activeClassId === 'ALL' 
        ? students 
        : students.filter(s => s.classId === activeClassId);

    targetStudents.forEach(student => {
        const studentLogs = logs.filter(l => l.studentId === student.id);
        const className = classes.find(c => c.id === student.classId)?.name || 'TPS';
        
        if (filterMode === 'DAILY') {
            let checkIn: string | null = null;
            let checkOut: string | null = null;
            let status: AggregatedAttendance['status'] = 'ALFA';
            let photoBase64: string | undefined = undefined;

            if (studentLogs.length > 0) {
                const inLogs = studentLogs.filter(l => l.status === 'HADIR' || l.status === 'TERLAMBAT');
                if (inLogs.length > 0) {
                    const sortedIn = inLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                    checkIn = sortedIn[0].timestamp;
                    if (sortedIn[0].photoBase64) photoBase64 = sortedIn[0].photoBase64;
                    const checkInTime = new Date(checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                    status = checkInTime > checkInLate ? 'TERLAMBAT' : 'HADIR';
                }

                const outLogs = studentLogs.filter(l => l.status === 'PULANG');
                if (outLogs.length > 0) {
                    const sortedOut = outLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
                    checkOut = sortedOut[0].timestamp;
                    if (!photoBase64 && sortedOut[0].photoBase64) photoBase64 = sortedOut[0].photoBase64;
                    const checkOutTime = new Date(checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                    if (checkOutTime < checkOutStart) {
                        status = status === 'TERLAMBAT' ? 'TERLAMBAT & PULANG CEPAT' : 'PULANG CEPAT';
                    }
                }
                if (!checkIn && !checkOut) status = 'ALFA';
            }

            list.push({
                studentId: student.id,
                studentName: student.name,
                nis: student.nis || '-',
                className,
                checkIn,
                checkOut,
                status: status as any,
                photoBase64
            });
        } else {
            // Group logs by date to count days
            const daysMap: { [date: string]: RfidLog[] } = {};
            studentLogs.forEach(log => {
                const date = log.timestamp.split('T')[0];
                if (!daysMap[date]) daysMap[date] = [];
                daysMap[date].push(log);
            });

            let presentCount = 0;
            let lateCount = 0;
            let earlyLeaveCount = 0;

            Object.entries(daysMap).forEach(([date, logs]) => {
                const dayInLogs = logs.filter(l => l.status === 'HADIR' || l.status === 'TERLAMBAT');
                const dayOutLogs = logs.filter(l => l.status === 'PULANG');
                
                if (dayInLogs.length > 0 || dayOutLogs.length > 0) {
                    presentCount++;
                    
                    const firstIn = dayInLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
                    if (firstIn) {
                        const inTime = new Date(firstIn.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                        if (inTime > checkInLate) lateCount++;
                    }

                    const lastOut = dayOutLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
                    if (lastOut) {
                        const outTime = new Date(lastOut.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                        if (outTime < checkOutStart) earlyLeaveCount++;
                    }
                }
            });

            list.push({
                studentId: student.id,
                studentName: student.name,
                nis: student.nis || '-',
                className,
                presentCount,
                lateCount,
                earlyLeaveCount,
                status: presentCount > 0 ? 'HADIR' : 'ALFA'
            } as any);
        }
    });

    return list.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [logs, students, settings, activeClassId, filterMode, selectedMonth, selectedSemester]);

  const filteredData = attendanceData.filter(d => {
    const matchesSearch = d.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.nis.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
        if (filterMode === 'DAILY') {
            matchesStatus = statusFilter === 'ALFA' ? d.status === 'ALFA' : d.status.includes(statusFilter);
        } else {
            // Aggregate mode
            if (statusFilter === 'HADIR') matchesStatus = (d.presentCount || 0) > 0;
            else if (statusFilter === 'TERLAMBAT') matchesStatus = (d.lateCount || 0) > 0;
            else if (statusFilter === 'PULANG CEPAT') matchesStatus = (d.earlyLeaveCount || 0) > 0;
            else if (statusFilter === 'ALFA') matchesStatus = (d.presentCount || 0) === 0;
        }
    }
    
    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => {
      const total = attendanceData.length;
      const present = attendanceData.filter(d => d.checkIn || d.checkOut).length;
      return {
          total,
          present,
          onTime: attendanceData.filter(d => d.status === 'HADIR').length,
          late: attendanceData.filter(d => d.status.includes('TERLAMBAT')).length,
          earlyLeave: attendanceData.filter(d => d.status.includes('PULANG CEPAT')).length,
          absent: total - present
      };
  }, [attendanceData]);

  const handleExport = () => {
    const data = attendanceData.map(d => {
        if (filterMode === 'DAILY') {
            return {
                'NIS': d.nis,
                'Nama Siswa': d.studentName,
                'Kelas': d.className,
                'Jam Datang': d.checkIn ? new Date(d.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-',
                'Jam Pulang': d.checkOut ? new Date(d.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-',
                'Status': d.status
            };
        } else {
            return {
                'NIS': d.nis,
                'Nama Siswa': d.studentName,
                'Kelas': d.className,
                'Hari Hadir': d.presentCount || 0,
                'Terlambat': d.lateCount || 0,
                'Pulang Cepat': d.earlyLeaveCount || 0,
                'Status Akhir': d.status
            };
        }
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Absensi RFID");
    XLSX.writeFile(wb, `Laporan_Absensi_RFID_${filterMode}_${selectedDate || selectedMonth || selectedSemester}.xlsx`);
  };

  const handleDeleteLogs = async () => {
    const confirmMsg = filterMode === 'DAILY' 
        ? `Hapus seluruh log absensi RFID tanggal ${selectedDate}?`
        : filterMode === 'MONTHLY'
            ? `Hapus seluruh log absensi RFID bulan ${selectedMonth}?`
            : `Hapus seluruh log absensi RFID Semester ${selectedSemester}?`;

    if (!window.confirm(confirmMsg + ' Tindakan ini tidak dapat dibatalkan.')) return;
    
    try {
        if (filterMode === 'DAILY') {
            await clearAllRfidLogsByDate(user.schoolNpsn || '', selectedDate);
        } else {
            let startDate = '';
            let endDate = '';
            if (filterMode === 'MONTHLY') {
                startDate = `${selectedMonth}-01`;
                const dateObj = new Date(selectedMonth);
                const lastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
                endDate = `${selectedMonth}-${lastDay}`;
            } else {
                const year = new Date().getFullYear();
                if (selectedSemester === 'Ganjil') {
                    startDate = `${year}-07-01`; endDate = `${year}-12-31`;
                } else {
                    startDate = `${year}-01-01`; endDate = `${year}-06-30`;
                }
            }
            await clearAllRfidLogsByRange(user.schoolNpsn || '', startDate, endDate);
        }
        alert("Data berhasil dihapus.");
        fetchData();
    } catch (e) {
        alert("Gagal menghapus data.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <ClipboardList size={24} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-800">Monitoring Absensi RFID</h2>
                <p className="text-sm text-gray-500">Rekapitulasi kehadiran berdasarkan scan kartu.</p>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['DAILY', 'MONTHLY', 'SEMESTER'] as const).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setFilterMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition uppercase ${filterMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {mode === 'DAILY' ? 'Harian' : mode === 'MONTHLY' ? 'Bulanan' : 'Semester'}
                    </button>
                )) }
            </div>

            {filterMode === 'DAILY' && (
                <input 
                    type="date" 
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                />
            )}
            {filterMode === 'MONTHLY' && (
                <input 
                    type="month" 
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                />
            )}
            {filterMode === 'SEMESTER' && (
                <select 
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={selectedSemester}
                    onChange={e => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')}
                >
                    <option value="Ganjil">Semester Ganjil (Jul - Des)</option>
                    <option value="Genap">Semester Genap (Jan - Jun)</option>
                </select>
            )}

            <div className="flex gap-2">
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm"
                >
                    <Download size={18} /> Ekspor Excel
                </button>
                <button 
                    onClick={handleDeleteLogs}
                    className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 transition"
                    title="Hapus Data Periode Ini"
                >
                    <Trash2 size={18} />
                </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
                { label: 'Total Siswa', value: stats.total, color: 'gray' },
                { label: 'Hadir (Tap)', value: stats.present, color: 'blue' },
                { label: 'Tepat Waktu', value: stats.onTime, color: 'green' },
                { label: 'Terlambat', value: stats.late, color: 'orange' },
                { label: 'Pulang Cepat', value: stats.earlyLeave, color: 'red' },
                { label: 'Alpha', value: stats.absent, color: 'rose' }
            ].map((s, i) => (
                <div key={i} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{s.label}</p>
                    <p className={`text-xl font-black mt-1 text-${s.color}-600`}>{s.value}</p>
                </div>
            ))}
        </div>

        {/* Class Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide border-b border-gray-100">
            <button
                onClick={() => setActiveClassId('ALL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${activeClassId === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
                <LayoutGrid size={14} /> Semua Kelas
            </button>
            {classes.map(cls => (
                <button
                    key={cls.id}
                    onClick={() => setActiveClassId(cls.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${activeClassId === cls.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <BookOpen size={14} /> {cls.name}
                </button>
            ))}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase mr-2 tracking-wider">Filter Status:</span>
            { [
                { id: 'ALL', label: 'Semua Status', active: 'bg-gray-600 border-gray-700 text-white shadow-sm' },
                { id: 'HADIR', label: 'Tepat Waktu', active: 'bg-green-600 border-green-700 text-white shadow-sm' },
                { id: 'TERLAMBAT', label: 'Terlambat', active: 'bg-orange-600 border-orange-700 text-white shadow-sm' },
                { id: 'PULANG CEPAT', label: 'Pulang Cepat', active: 'bg-red-600 border-red-700 text-white shadow-sm' },
                { id: 'ALFA', label: 'Alpa / Tidak Tap', active: 'bg-rose-600 border-rose-700 text-white shadow-sm' }
            ].map(f => (
                <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition border ${
                        statusFilter === f.id 
                            ? f.active
                            : `bg-white border-gray-200 text-gray-500 hover:bg-gray-50`
                    }`}
                >
                    {f.label}
                </button>
            ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
            type="text" 
            placeholder="Cari nama siswa atau NIS..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Monitoring Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase text-[10px] tracking-widest">
                {filterMode === 'DAILY' && <th className="p-4 w-16 text-center">Foto</th>}
                <th className="p-4">Identitas Siswa</th>
                <th className="p-4 text-center">{filterMode === 'DAILY' ? 'Jam Datang' : 'Hari Hadir'}</th>
                <th className="p-4 text-center">{filterMode === 'DAILY' ? 'Jam Pulang' : 'Total Terlambat'}</th>
                <th className="p-4 text-center">{filterMode === 'DAILY' ? 'Status Kehadiran' : 'Total Pulang Cepat'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {filterMode === 'DAILY' && <td className="p-4"><div className="w-10 h-10 bg-gray-100 rounded-full mx-auto"></div></td>}
                    <td className="p-4"><div className="h-5 bg-gray-100 rounded w-48 mb-1"></div><div className="h-3 bg-gray-50 rounded w-24"></div></td>
                    <td className="p-4"><div className="h-5 bg-gray-100 rounded w-16 mx-auto"></div></td>
                    <td className="p-4"><div className="h-5 bg-gray-100 rounded w-16 mx-auto"></div></td>
                    <td className="p-4"><div className="h-6 bg-gray-100 rounded-full w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={filterMode === 'DAILY' ? 5 : 4} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <AlertCircle size={48} className="opacity-20" />
                        <p className="font-medium">Tidak ada data siswa ditemukan untuk kriteria ini.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.studentId} className="hover:bg-gray-50/80 transition-colors group">
                    {filterMode === 'DAILY' && (
                      <td className="p-4 text-center">
                        {item.photoBase64 ? (
                          <img 
                            src={item.photoBase64} 
                            alt="Tap Foto" 
                            className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-2 transition mx-auto border border-gray-200"
                            onClick={() => setSelectedPhoto(item.photoBase64 || null)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 mx-auto" title="Foto Otomatis Dihapus (Usang)">
                             <span className="text-[9px] text-gray-400 font-medium">Usang</span>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 items-center justify-center hidden sm:flex font-black text-sm shrink-0 shadow-sm border border-blue-100">
                          {item.studentName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-black text-gray-900 group-hover:text-blue-700 transition-colors uppercase tracking-tight">{item.studentName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-gray-400">NIS: {item.nis}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-[10px] font-bold text-blue-500 uppercase">{item.className}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {filterMode === 'DAILY' ? (
                        item.checkIn ? (
                            <div className="flex flex-col items-center">
                              <span className="font-black text-gray-800 text-sm font-mono">
                                {new Date(item.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                        ) : (
                            <span className="text-gray-300 font-medium italic text-[10px]">Belum Tap</span>
                        )
                      ) : (
                        <span className="font-bold text-blue-600">{item.presentCount || 0} Hari</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {filterMode === 'DAILY' ? (
                        item.checkOut ? (
                            <div className="flex flex-col items-center">
                              <span className="font-black text-gray-800 text-sm font-mono">
                                {new Date(item.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                        ) : (
                            <span className="text-gray-300 font-medium italic text-[10px]">Belum Tap</span>
                        )
                      ) : (
                        <span className={`font-bold ${(item.lateCount || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{item.lateCount || 0} Kali</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {filterMode === 'DAILY' ? (
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {item.status === 'ALFA' ? (
                                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-tighter border border-gray-200">
                                    TIDAK HADIR
                                </span>
                            ) : (
                                item.status.split(' & ').map((s, idx) => (
                                    <span key={idx} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border ${
                                      s === 'HADIR' ? 'bg-green-100 text-green-700 border-green-200' : 
                                      s === 'TERLAMBAT' ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                                      s === 'PULANG CEPAT' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                                    }`}>
                                      {s === 'HADIR' ? 'TEPAT WAKTU' : s}
                                    </span>
                                ))
                            )}
                        </div>
                      ) : (
                        <span className={`font-bold ${(item.earlyLeaveCount || 0) > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{item.earlyLeaveCount || 0} Kali</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Help Info Footer */}
        <div className="p-4 bg-blue-50/50 border-t border-gray-100 flex items-center gap-3">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full">
                <Info size={14} />
            </div>
            <p className="text-[10px] text-blue-700 font-medium">
                Siswa yang berstatus <span className="font-black">TIDAK HADIR</span> adalah siswa yang namanya terdaftar di manajemen kelas namun tidak melakukan tapping (Masuk/Pulang) sama sekali pada periode ini.
            </p>
        </div>
      </div>

      {/* Modal for viewing photo */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex justify-center items-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full">
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100/80 hover:bg-gray-200 rounded-full text-gray-800 transition backdrop-blur-sm"
              >
                <X size={20} />
              </button>
              <img src={selectedPhoto} alt="Full Foto" className="w-full h-auto block" />
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <p className="text-sm text-gray-500 text-center font-medium">Rekaman Kamera RFID</p>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceMonitoring;
