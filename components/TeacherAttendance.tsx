
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student, AttendanceRecord } from '../types';
import { getClasses, getStudents, saveAttendanceRecords, getAttendanceRecords, deleteAttendanceRecords, getAttendanceRecordsByRange } from '../services/database';
import { CalendarCheck, FileSpreadsheet, Printer, Save, CheckCircle, Filter, ChevronLeft, ChevronRight, User as UserIcon, X, Check, Activity, AlertCircle, RotateCcw, Trash2, FileText, Layout } from './Icons';
import * as XLSX from 'xlsx';

interface TeacherAttendanceProps {
  user: User;
}

type AttendanceStatus = 'H' | 'S' | 'I' | 'A' | ''; 

interface AttendanceState {
  [studentId: string]: {
    [day: number]: AttendanceStatus;
  };
}

interface RecapData {
    id: string;
    name: string;
    s: number;
    i: number;
    a: number;
    h: number;
    total: number;
    percent: number;
}

const TeacherAttendance: React.FC<TeacherAttendanceProps> = ({ user }) => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  
  // View Mode: 'input' (Daily/Monthly) or 'recap' (Semester/Yearly)
  const [viewMode, setViewMode] = useState<'input' | 'recap'>('input');

  // Input Mode State
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Recap Mode State
  const [recapFilter, setRecapFilter] = useState<'ganjil' | 'genap' | 'full'>('ganjil');
  const [recapYear, setRecapYear] = useState(new Date().getFullYear());
  const [recapData, setRecapData] = useState<RecapData[]>([]);

  // Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetType, setResetType] = useState<'daily' | 'monthly'>('daily');
  const [resetDay, setResetDay] = useState(new Date().getDate());

  // Mobile Swipe Mode State
  const [mobileView, setMobileView] = useState<'daily' | 'monthly'>('daily');
  const [dailyDay, setDailyDay] = useState(new Date().getDate());
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Constants
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentRealYear = new Date().getFullYear();
  const yearsList = [currentRealYear - 1, currentRealYear, currentRealYear + 1];

  // Stats
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cls = await getClasses(user.id);
      setClasses(cls);
      if (cls.length > 0) {
        setSelectedClassId(cls[0].id);
      }
      setLoading(false);
    };
    init();
  }, [user]);

  // Fetch Data Trigger
  useEffect(() => {
    if (selectedClassId) {
      if (viewMode === 'input') {
          fetchInputData(selectedClassId);
      } else {
          fetchRecapData(selectedClassId);
      }
    }
  }, [selectedClassId, selectedMonth, selectedYear, viewMode, recapFilter, recapYear]);

  // Reset index when class changes
  useEffect(() => {
    setCurrentStudentIndex(0);
  }, [selectedClassId]);

  // FETCH: Input Mode
  const fetchInputData = async (classId: string) => {
    setLoading(true);
    const [studentData, attendanceData] = await Promise.all([
      getStudents(classId),
      getAttendanceRecords(classId, selectedMonth, selectedYear)
    ]);
    
    setStudents(studentData);
    
    const attState: AttendanceState = {};
    attendanceData.forEach(record => {
      const day = new Date(record.date).getDate();
      if (!attState[record.studentId]) attState[record.studentId] = {};
      attState[record.studentId][day] = record.status;
    });
    setAttendance(attState);
    
    setMaleCount(studentData.filter(s => s.gender === 'L').length);
    setFemaleCount(studentData.filter(s => s.gender === 'P').length);

    setLoading(false);
    setHasChanges(false);
    setSaveStatus('idle');
  };

  // FETCH: Recap Mode
  const fetchRecapData = async (classId: string) => {
      setLoading(true);
      
      let startDate = '';
      let endDate = '';

      // Determine Date Range
      if (recapFilter === 'ganjil') {
          startDate = `${recapYear}-07-01`;
          endDate = `${recapYear}-12-31`;
      } else if (recapFilter === 'genap') {
          startDate = `${recapYear + 1}-01-01`; // Semester Genap starts next year usually
          endDate = `${recapYear + 1}-06-30`;
      } else {
          // Full Year
          startDate = `${recapYear}-07-01`;
          endDate = `${recapYear + 1}-06-30`;
      }

      const [studentData, attRecords] = await Promise.all([
          getStudents(classId),
          getAttendanceRecordsByRange(classId, startDate, endDate)
      ]);

      setStudents(studentData);

      // Aggregate
      const recap: RecapData[] = studentData.map(s => {
          const myRecords = attRecords.filter(r => r.studentId === s.id);
          const sCount = myRecords.filter(r => r.status === 'S').length;
          const iCount = myRecords.filter(r => r.status === 'I').length;
          const aCount = myRecords.filter(r => r.status === 'A').length;
          const hCount = myRecords.filter(r => r.status === 'H').length;
          const total = sCount + iCount + aCount + hCount;
          const percent = total > 0 ? Math.round((hCount / total) * 100) : 0;

          return {
              id: s.id,
              name: s.name,
              s: sCount,
              i: iCount,
              a: aCount,
              h: hCount,
              total,
              percent
          };
      });

      setRecapData(recap);
      setLoading(false);
  };

  // --- HANDLERS (INPUT MODE) ---

  const handleCellClick = (studentId: string, day: number) => {
    setSaveStatus('idle'); 
    setHasChanges(true);
    setAttendance(prev => {
      const currentStatus = prev[studentId]?.[day] || '';
      let nextStatus: AttendanceStatus = '';
      
      if (currentStatus === '') nextStatus = 'H';
      else if (currentStatus === 'H') nextStatus = 'S';
      else if (currentStatus === 'S') nextStatus = 'I';
      else if (currentStatus === 'I') nextStatus = 'A';
      else nextStatus = '';

      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [day]: nextStatus
        }
      };
    });
  };

  // --- SWIPE LOGIC ---
  const handleMarkDaily = (status: AttendanceStatus) => {
    const student = students[currentStudentIndex];
    if (!student) return;

    setSaveStatus('idle');
    setHasChanges(true);
    
    setAttendance(prev => ({
      ...prev,
      [student.id]: {
        ...prev[student.id],
        [dailyDay]: status
      }
    }));

    setTimeout(() => {
        setSwipeDirection(null);
        if (currentStudentIndex < students.length) {
            setCurrentStudentIndex(prev => prev + 1);
        }
    }, 200);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
        setSwipeDirection('left');
        handleMarkDaily('A');
    }
    if (isRightSwipe) {
        setSwipeDirection('right');
        handleMarkDaily('H');
    }
  };

  // --- RESET HANDLERS ---
  const handleOpenReset = () => {
      setResetType('daily');
      setResetDay(dailyDay); 
      setIsResetModalOpen(true);
  };

  const performReset = async () => {
      if (!selectedClassId) return;
      
      if (confirm(`Apakah Anda yakin ingin menghapus data absensi?`)) {
          setLoading(true);
          try {
              await deleteAttendanceRecords(
                  selectedClassId, 
                  selectedMonth, 
                  selectedYear, 
                  resetType === 'daily' ? resetDay : undefined
              );

              setAttendance(prev => {
                  const newState = { ...prev };
                  if (resetType === 'monthly') {
                      Object.keys(newState).forEach(sid => { newState[sid] = {}; });
                  } else {
                      Object.keys(newState).forEach(sid => { if (newState[sid]) delete newState[sid][resetDay]; });
                  }
                  return newState;
              });

              alert('Data absensi berhasil di-reset.');
              setIsResetModalOpen(false);
          } catch (e) {
              alert('Gagal melakukan reset.');
          } finally {
              setLoading(false);
          }
      }
  };

  // --- SAVE ---
  const handleSave = () => {
    setSaveStatus('success');
    setHasChanges(false);

    const recordsToSave: Omit<AttendanceRecord, 'id'>[] = [];
    Object.entries(attendance).forEach(([studentId, daysObj]) => {
      Object.entries(daysObj).forEach(([dayStr, status]) => {
        if (status) {
          const d = parseInt(dayStr);
          const dateObj = new Date(selectedYear, selectedMonth, d);
          const offset = dateObj.getTimezoneOffset() * 60000;
          const localDate = new Date(dateObj.getTime() - offset).toISOString().split('T')[0];

          recordsToSave.push({
            studentId,
            classId: selectedClassId,
            date: localDate,
            status: status as 'H' | 'S' | 'I' | 'A'
          });
        }
      });
    });

    saveAttendanceRecords(recordsToSave).catch(err => {
        setSaveStatus('error');
        setHasChanges(true);
        alert("Gagal menyimpan ke database lokal.");
    });

    setTimeout(() => {
        setSaveStatus(prev => prev === 'success' ? 'idle' : prev);
    }, 3000);
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'H': return 'bg-green-500 text-white';
      case 'S': return 'bg-yellow-400 text-white';
      case 'I': return 'bg-blue-400 text-white';
      case 'A': return 'bg-red-500 text-white';
      default: return 'bg-white hover:bg-gray-50';
    }
  };

  const calculateSummary = (studentId: string) => {
    const studentRecord = attendance[studentId] || {};
    let s = 0, i = 0, a = 0, h = 0;
    Object.values(studentRecord).forEach(status => {
      if (status === 'S') s++;
      if (status === 'I') i++;
      if (status === 'A') a++;
      if (status === 'H') h++;
    });
    const totalFilledDays = s + i + a + h;
    const percentage = totalFilledDays > 0 ? Math.round((h / totalFilledDays) * 100) : 0;
    return { s, i, a, h, percentage };
  };

  // --- EXPORT FUNCTIONS ---

  const exportToExcel = () => {
    if (students.length === 0) return;
    const currentClass = classes.find(c => c.id === selectedClassId);
    const className = currentClass?.name || 'Kelas';
    const period = `${monthNames[selectedMonth]} ${selectedYear}`;
    
    const header = ['No', 'Nama Siswa', ...days.map(String), 'S', 'I', 'A', 'H', '%'];
    const data = students.map((s, i) => {
      const summary = calculateSummary(s.id);
      const row = [
        i + 1,
        s.name,
        ...days.map(d => attendance[s.id]?.[d] || ''),
        summary.s,
        summary.i,
        summary.a,
        summary.h,
        `${summary.percentage}%`
      ];
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [`REKAP PRESENSI KELAS ${className}`],
      [`PERIODE: ${period}`],
      [`GURU: ${user.fullName}`],
      [],
      header,
      ...data
    ]);
    
    const wscols = [{ wch: 5 }, { wch: 25 }, ...days.map(() => ({ wch: 3 })), { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 6 }];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Absensi_${className}_${monthNames[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportRecapExcel = () => {
      if (recapData.length === 0) return;
      const currentClass = classes.find(c => c.id === selectedClassId);
      const className = currentClass?.name || 'Kelas';
      let periodLabel = '';
      if (recapFilter === 'ganjil') periodLabel = `Semester Ganjil ${recapYear}/${recapYear+1}`;
      else if (recapFilter === 'genap') periodLabel = `Semester Genap ${recapYear}/${recapYear+1}`;
      else periodLabel = `Tahun Ajaran ${recapYear}/${recapYear+1}`;

      const header = ['No', 'Nama Siswa', 'Sakit', 'Izin', 'Alpha', 'Hadir', 'Total Pertemuan', 'Persentase'];
      const data = recapData.map((d, i) => [
          i + 1, d.name, d.s, d.i, d.a, d.h, d.total, `${d.percent}%`
      ]);

      const ws = XLSX.utils.aoa_to_sheet([
          [`REKAPITULASI PRESENSI ${className.toUpperCase()}`],
          [`PERIODE: ${periodLabel.toUpperCase()}`],
          [`GURU: ${user.fullName.toUpperCase()}`],
          [],
          header,
          ...data
      ]);

      const wscols = [{ wch: 5 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 10 }];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
      XLSX.writeFile(wb, `Rekap_Absensi_${recapFilter}_${recapYear}_${className}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
           <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <CalendarCheck className="text-blue-600" />
                 Daftar Hadir Siswa
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Kelola absensi harian atau lihat rekapitulasi semester.
              </p>
           </div>
           
           <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('input')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                        viewMode === 'input' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <CalendarCheck size={16} /> Input Harian
                </button>
                <button 
                    onClick={() => setViewMode('recap')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                        viewMode === 'recap' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FileText size={16} /> Rekapitulasi
                </button>
           </div>
        </div>

        {viewMode === 'input' ? (
            /* --- INPUT MODE CONTROLS --- */
            <>
                <div className="md:hidden flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setMobileView('daily')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mobileView === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Input Swipe</button>
                    <button onClick={() => setMobileView('monthly')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mobileView === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Tabel Bulanan</button>
                </div>

                <div className="flex flex-col xl:flex-row justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                        <div className="relative w-full sm:w-auto flex-1 md:flex-none">
                            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full md:w-48 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                {classes.length === 0 && <option>Belum ada kelas</option>}
                            </select>
                            <Filter size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                        </div>
                        <div className={`flex gap-2 w-full sm:w-auto ${mobileView === 'daily' ? 'hidden md:flex' : 'flex'}`}>
                            <select className="flex-1 sm:w-32 py-2 border border-gray-300 rounded-lg bg-white text-sm px-2" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                                {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select className="w-24 py-2 border border-gray-300 rounded-lg bg-white text-sm px-2" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                                {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className={`flex gap-2 w-full items-center justify-between ${mobileView === 'daily' ? 'flex md:hidden' : 'hidden'}`}>
                            <button onClick={() => setDailyDay(d => Math.max(1, d - 1))} className="p-2 bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
                            <div className="font-bold text-gray-800">{dailyDay} {monthNames[selectedMonth]}</div>
                            <button onClick={() => setDailyDay(d => Math.min(daysInMonth, d + 1))} className="p-2 bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
                        <button onClick={handleOpenReset} disabled={students.length === 0} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center gap-2 border border-red-200">
                            <RotateCcw size={16} /> <span className="hidden md:inline">Reset</span>
                        </button>
                        <button onClick={exportToExcel} disabled={students.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50 hidden md:flex">
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                        <button onClick={handleSave} disabled={students.length === 0} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition shadow-sm ${saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : hasChanges ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {saveStatus === 'success' ? <CheckCircle size={16} /> : <Save size={16} />}
                            {saveStatus === 'success' ? 'Tersimpan!' : 'Simpan'}
                        </button>
                    </div>
                </div>
            </>
        ) : (
            /* --- RECAP MODE CONTROLS --- */
            <div className="flex flex-col xl:flex-row justify-between gap-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full md:w-48 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm">
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <Filter size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                    </div>
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                        <select className="flex-1 sm:w-40 py-2 border border-gray-300 rounded-lg bg-white text-sm px-2" value={recapFilter} onChange={(e) => setRecapFilter(e.target.value as any)}>
                            <option value="ganjil">Semester Ganjil</option>
                            <option value="genap">Semester Genap</option>
                            <option value="full">Satu Tahun Penuh</option>
                        </select>
                        <select className="w-24 py-2 border border-gray-300 rounded-lg bg-white text-sm px-2" value={recapYear} onChange={(e) => setRecapYear(Number(e.target.value))}>
                            {yearsList.map(y => <option key={y} value={y}>{y}/{y+1}</option>)}
                        </select>
                    </div>
                </div>

                <button onClick={exportRecapExcel} disabled={recapData.length === 0} className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition shadow-sm disabled:opacity-50">
                    <FileSpreadsheet size={16} /> Download Rekap (Excel)
                </button>
            </div>
        )}
      </div>

      {/* --- CONTENT AREA --- */}
      {viewMode === 'input' ? (
          /* EXISTING INPUT VIEW */
          <>
            {isResetModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><RotateCcw size={18} className="text-red-600" /> Reset Absensi</h3>
                            <button onClick={() => setIsResetModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setResetType('daily')} className={`p-3 rounded-lg border text-sm font-bold flex flex-col items-center gap-1 transition ${resetType === 'daily' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}><CalendarCheck size={20} /> Harian</button>
                                <button onClick={() => setResetType('monthly')} className={`p-3 rounded-lg border text-sm font-bold flex flex-col items-center gap-1 transition ${resetType === 'monthly' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}><Trash2 size={20} /> Bulanan</button>
                            </div>
                            {resetType === 'daily' && <div className="animate-in fade-in"><label className="block text-sm font-medium text-gray-700 mb-1">Tanggal:</label><select value={resetDay} onChange={(e) => setResetDay(parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm">{days.map(d => <option key={d} value={d}>{d} {monthNames[selectedMonth]}</option>)}</select></div>}
                            <div className="flex gap-2 pt-2"><button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold">Batal</button><button onClick={performReset} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">Hapus Data</button></div>
                        </div>
                    </div>
                </div>
            )}

            <div className={`md:hidden ${mobileView === 'daily' ? 'block' : 'hidden'}`}>
                {loading ? <div className="p-10 text-center text-gray-400">Memuat data...</div> : students.length === 0 ? <div className="p-10 text-center text-gray-400">Tidak ada siswa.</div> : currentStudentIndex < students.length ? (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="w-full max-w-sm h-80 relative perspective-1000" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                            <div className={`relative bg-white rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col items-center justify-center h-full z-10 transition-transform duration-300 ${swipeDirection === 'left' ? '-translate-x-full rotate-[-15deg] opacity-0' : swipeDirection === 'right' ? 'translate-x-full rotate-[15deg] opacity-0' : ''}`}>
                                {swipeDirection === 'right' && <div className="absolute inset-0 bg-green-500 rounded-2xl opacity-20 flex items-center justify-center"><CheckCircle size={80} className="text-green-600" /></div>}
                                {swipeDirection === 'left' && <div className="absolute inset-0 bg-red-500 rounded-2xl opacity-20 flex items-center justify-center"><X size={80} className="text-red-600" /></div>}
                                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400"><UserIcon size={48} /></div>
                                <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">{students[currentStudentIndex].name}</h3>
                                <p className="text-gray-500 font-medium">{students[currentStudentIndex].nis}</p>
                                <div className="mt-6 flex items-center gap-2 text-sm text-gray-400"><span>Siswa ke {currentStudentIndex + 1} dari {students.length}</span></div>
                                {attendance[students[currentStudentIndex].id]?.[dailyDay] && <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(attendance[students[currentStudentIndex].id][dailyDay])}`}>{attendance[students[currentStudentIndex].id][dailyDay]}</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 w-full max-w-sm px-4">
                            <button onClick={() => handleMarkDaily('S')} className="py-4 rounded-xl bg-yellow-100 text-yellow-700 font-bold flex flex-col items-center gap-1 active:scale-95 transition"><Activity size={20} /> Sakit</button>
                            <button onClick={() => handleMarkDaily('I')} className="py-4 rounded-xl bg-blue-100 text-blue-700 font-bold flex flex-col items-center gap-1 active:scale-95 transition"><FileSpreadsheet size={20} /> Izin</button>
                            <button onClick={() => handleMarkDaily('A')} className="py-4 rounded-xl bg-red-100 text-red-700 font-bold flex flex-col items-center gap-1 active:scale-95 transition"><AlertCircle size={20} /> Alpha</button>
                            <button onClick={() => handleMarkDaily('H')} className="py-4 rounded-xl bg-green-600 text-white font-bold flex flex-col items-center gap-1 shadow-lg shadow-green-200 active:scale-95 transition"><Check size={24} /> Hadir</button>
                        </div>
                        <div className="text-center text-xs text-gray-400 mt-2">Swipe Kanan (Hadir) • Swipe Kiri (Alpha)</div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-10 bg-white rounded-xl shadow-sm border border-gray-100 m-4">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"><CheckCircle size={40} className="text-green-600" /></div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Selesai!</h3>
                        <div className="flex gap-3 w-full"><button onClick={() => setCurrentStudentIndex(0)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">Ulangi</button><button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200">Simpan</button></div>
                    </div>
                )}
            </div>

            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${mobileView === 'monthly' ? 'block' : 'hidden md:block'}`}>
                {loading ? <div className="p-10 text-center text-gray-400">Memuat data absensi...</div> : students.length === 0 ? <div className="p-10 text-center text-gray-400">Tidak ada siswa.</div> : (
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs border-collapse min-w-max">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                                <th className="p-3 border-r border-gray-200 w-10 md:sticky md:left-0 bg-gray-100 z-10">No</th>
                                <th className="p-3 border-r border-gray-200 min-w-[150px] text-left md:sticky md:left-10 bg-gray-100 z-10">Nama Siswa</th>
                                {days.map(d => <th key={d} className={`p-1 border-r border-gray-200 min-w-[28px] text-center font-normal ${d === dailyDay && mobileView === 'monthly' ? 'bg-blue-200 font-bold' : ''}`}>{d}</th>)}
                                <th className="p-2 border-r border-gray-200 bg-yellow-50 min-w-[30px] text-center font-bold text-yellow-700">S</th>
                                <th className="p-2 border-r border-gray-200 bg-blue-50 min-w-[30px] text-center font-bold text-blue-700">I</th>
                                <th className="p-2 border-r border-gray-200 bg-red-50 min-w-[30px] text-center font-bold text-red-700">A</th>
                                <th className="p-2 border-r border-gray-200 bg-green-50 min-w-[30px] text-center font-bold text-green-700">H</th>
                                <th className="p-2 bg-gray-50 min-w-[40px] text-center font-bold text-gray-700">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {students.map((student, idx) => {
                                const summary = calculateSummary(student.id);
                                return (
                                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 text-center border-r border-gray-100 md:sticky md:left-0 bg-white z-10">{idx + 1}</td>
                                        <td className="p-3 border-r border-gray-100 font-medium text-gray-800 md:sticky md:left-10 bg-white z-10 truncate max-w-[150px]">{student.name}</td>
                                        {days.map(d => (
                                            <td key={d} onClick={() => handleCellClick(student.id, d)} className={`p-1 border-r border-gray-100 text-center cursor-pointer select-none transition-colors ${getStatusColor(attendance[student.id]?.[d] || '')}`}>
                                                {attendance[student.id]?.[d] || ''}
                                            </td>
                                        ))}
                                        <td className="p-2 text-center border-r border-gray-100 bg-yellow-50/50 font-medium">{summary.s}</td>
                                        <td className="p-2 text-center border-r border-gray-100 bg-blue-50/50 font-medium">{summary.i}</td>
                                        <td className="p-2 text-center border-r border-gray-100 bg-red-50/50 font-medium">{summary.a}</td>
                                        <td className="p-2 text-center border-r border-gray-100 bg-green-50/50 font-bold">{summary.h}</td>
                                        <td className="p-2 text-center bg-gray-50/50 font-bold text-gray-800">{summary.percentage}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                )}
            </div>
          </>
      ) : (
          /* --- RECAP VIEW --- */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-right-4">
              {loading ? <div className="p-10 text-center text-gray-400">Mengambil data rekap...</div> : recapData.length === 0 ? <div className="p-10 text-center text-gray-400">Tidak ada data absensi pada periode ini.</div> : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-100 text-gray-700 font-bold">
                              <tr>
                                  <th className="p-4 w-12 text-center">No</th>
                                  <th className="p-4">Nama Siswa</th>
                                  <th className="p-4 text-center bg-yellow-50 text-yellow-800">Sakit (S)</th>
                                  <th className="p-4 text-center bg-blue-50 text-blue-800">Izin (I)</th>
                                  <th className="p-4 text-center bg-red-50 text-red-800">Alpha (A)</th>
                                  <th className="p-4 text-center bg-green-50 text-green-800">Hadir (H)</th>
                                  <th className="p-4 text-center bg-gray-200">Total Pertemuan</th>
                                  <th className="p-4 text-center bg-gray-200">Persentase (%)</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {recapData.map((d, i) => (
                                  <tr key={d.id} className="hover:bg-gray-50 transition">
                                      <td className="p-4 text-center font-bold text-gray-500">{i + 1}</td>
                                      <td className="p-4 font-medium text-gray-900">{d.name}</td>
                                      <td className="p-4 text-center font-medium bg-yellow-50/30">{d.s}</td>
                                      <td className="p-4 text-center font-medium bg-blue-50/30">{d.i}</td>
                                      <td className="p-4 text-center font-medium bg-red-50/30">{d.a}</td>
                                      <td className="p-4 text-center font-bold bg-green-50/30 text-green-700">{d.h}</td>
                                      <td className="p-4 text-center font-bold text-gray-600">{d.total}</td>
                                      <td className="p-4 text-center font-bold text-gray-800 bg-gray-50">
                                          <span className={`px-2 py-1 rounded text-xs ${d.percent < 75 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                              {d.percent}%
                                          </span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default TeacherAttendance;
