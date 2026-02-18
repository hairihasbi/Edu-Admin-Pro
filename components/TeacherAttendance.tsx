
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student, AttendanceRecord } from '../types';
import { getClasses, getStudents, saveAttendanceRecords, getAttendanceRecords } from '../services/database';
import { CalendarCheck, FileSpreadsheet, Printer, Save, CheckCircle, Filter, ChevronLeft, ChevronRight, User as UserIcon, X, Check, Activity, AlertCircle } from './Icons';
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

const TeacherAttendance: React.FC<TeacherAttendanceProps> = ({ user }) => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Attendance State
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Mobile Swipe Mode State
  const [mobileView, setMobileView] = useState<'daily' | 'monthly'>('daily');
  const [dailyDay, setDailyDay] = useState(new Date().getDate());
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Generate days array 1-31
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

  useEffect(() => {
    if (selectedClassId) {
      fetchData(selectedClassId);
    }
  }, [selectedClassId, selectedMonth, selectedYear]);

  // Reset index when class changes
  useEffect(() => {
    setCurrentStudentIndex(0);
  }, [selectedClassId]);

  const fetchData = async (classId: string) => {
    setLoading(true);
    const [studentData, attendanceData] = await Promise.all([
      getStudents(classId),
      getAttendanceRecords(classId, selectedMonth, selectedYear)
    ]);
    
    setStudents(studentData);
    
    // Map DB Records to State
    const attState: AttendanceState = {};
    attendanceData.forEach(record => {
      const day = new Date(record.date).getDate();
      if (!attState[record.studentId]) attState[record.studentId] = {};
      attState[record.studentId][day] = record.status;
    });
    setAttendance(attState);
    
    // Stats
    setMaleCount(studentData.filter(s => s.gender === 'L').length);
    setFemaleCount(studentData.filter(s => s.gender === 'P').length);

    setLoading(false);
    setHasChanges(false);
    setSaveStatus('idle');
  };

  // --- HANDLERS ---

  const handleCellClick = (studentId: string, day: number) => {
    setSaveStatus('idle'); 
    setHasChanges(true);
    setAttendance(prev => {
      const currentStatus = prev[studentId]?.[day] || '';
      let nextStatus: AttendanceStatus = '';
      
      // Cycle: Empty -> H (Hadir) -> S (Sakit) -> I (Izin) -> A (Alpa) -> Empty
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

    // Animation delay then next
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

  // --- OPTIMISTIC SAVE ---
  const handleSave = () => {
    // 1. Instant UI Feedback
    setSaveStatus('success');
    setHasChanges(false);

    // 2. Prepare Data
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

    // 3. Fire and Forget
    saveAttendanceRecords(recordsToSave).catch(err => {
        console.error("Failed to save attendance:", err);
        setSaveStatus('error');
        setHasChanges(true);
        alert("Gagal menyimpan ke database lokal.");
    });

    // Reset feedback
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
    
    // Headers
    const header = ['No', 'Nama Siswa', ...days.map(String), 'S', 'I', 'A', 'H', '%'];
    
    // Rows
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
    
    // Adjust column widths roughly
    const wscols = [
        { wch: 5 }, // No
        { wch: 25 }, // Nama
        ...days.map(() => ({ wch: 3 })), // Days
        { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 6 } // Summary
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Absensi_${className}_${monthNames[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const handlePrint = () => {
    if (students.length === 0) return;

    const currentClass = classes.find(c => c.id === selectedClassId);
    const className = currentClass?.name || 'Kelas';
    const period = `${monthNames[selectedMonth]} ${selectedYear}`;

    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;

    let tableRows = '';
    students.forEach((s, i) => {
        const summary = calculateSummary(s.id);
        let dayCells = '';
        days.forEach(d => {
            const status = attendance[s.id]?.[d] || '';
            let color = '';
            if(status === 'S') color = 'background-color: #fef08a;'; // yellow
            if(status === 'I') color = 'background-color: #bae6fd;'; // blue
            if(status === 'A') color = 'background-color: #fca5a5;'; // red
            if(status === 'H') color = 'background-color: #86efac;'; // green
            dayCells += `<td style="text-align:center; ${color}">${status}</td>`;
        });

        tableRows += `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${s.name}</td>
                ${dayCells}
                <td style="text-align:center; background-color: #fef9c3;">${summary.s}</td>
                <td style="text-align:center; background-color: #e0f2fe;">${summary.i}</td>
                <td style="text-align:center; background-color: #fee2e2;">${summary.a}</td>
                <td style="text-align:center; background-color: #dcfce7;">${summary.h}</td>
                <td style="text-align:center; font-weight:bold;">${summary.percentage}%</td>
            </tr>
        `;
    });

    const dayHeaders = days.map(d => `<th style="width: 20px; font-size: 10px;">${d}</th>`).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Absensi - ${className}</title>
          <style>
            body { font-family: sans-serif; font-size: 12px; }
            h2, h4 { text-align: center; margin: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 4px; }
            th { background-color: #f0f0f0; }
            @page { size: landscape; margin: 10mm; }
          </style>
        </head>
        <body>
          <h2>REKAPITULASI KEHADIRAN SISWA</h2>
          <h4>KELAS: ${className} | PERIODE: ${period}</h4>
          <h4>GURU: ${user.fullName.toUpperCase()}</h4>
          
          <table>
            <thead>
              <tr>
                <th width="30">No</th>
                <th width="200">Nama Siswa</th>
                ${dayHeaders}
                <th>S</th><th>I</th><th>A</th><th>H</th><th>%</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; float: right; text-align: center; width: 200px;">
             <p>Banjarbaru, ${new Date().toLocaleDateString('id-ID')}</p>
             <p>Guru Mata Pelajaran,</p>
             <br/><br/><br/>
             <p><b>${user.fullName}</b></p>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
              <p className="text-sm text-gray-500 mt-1 hidden md:block">
                Klik tanggal untuk mengubah status. Data tersimpan lokal & sinkron otomatis.
              </p>
           </div>
           
           <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-100">
                 L: {maleCount}
              </div>
              <div className="px-3 py-1 bg-pink-50 text-pink-700 rounded-md font-medium border border-pink-100">
                 P: {femaleCount}
              </div>
              <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md font-medium border border-gray-200">
                 Total: {students.length}
              </div>
           </div>
        </div>

        {/* MOBILE: View Switcher */}
        <div className="md:hidden flex bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setMobileView('daily')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mobileView === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
                Input Harian (Swipe)
            </button>
            <button 
                onClick={() => setMobileView('monthly')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mobileView === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
                Rekap Bulanan
            </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col xl:flex-row justify-between gap-4">
           <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              {/* Class Filter */}
              <div className="relative w-full sm:w-auto flex-1 md:flex-none">
                 <select 
                   value={selectedClassId}
                   onChange={(e) => setSelectedClassId(e.target.value)}
                   className="w-full md:w-48 pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                 >
                   {classes.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                   {classes.length === 0 && <option>Belum ada kelas</option>}
                 </select>
                 <Filter size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
              </div>
              
              {/* Period Filter (Hidden on Mobile Daily Mode) */}
              <div className={`flex gap-2 w-full sm:w-auto ${mobileView === 'daily' ? 'hidden md:flex' : 'flex'}`}>
                <select 
                  className="flex-1 sm:w-32 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm px-2"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {monthNames.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <select 
                  className="w-24 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm px-2"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  <option value={2023}>2023</option>
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              {/* Day Filter (Visible ONLY on Mobile Daily Mode) */}
              <div className={`flex gap-2 w-full items-center justify-between ${mobileView === 'daily' ? 'flex md:hidden' : 'hidden'}`}>
                  <button onClick={() => setDailyDay(d => Math.max(1, d - 1))} className="p-2 bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
                  <div className="font-bold text-gray-800">
                      {dailyDay} {monthNames[selectedMonth]}
                  </div>
                  <button onClick={() => setDailyDay(d => Math.min(daysInMonth, d + 1))} className="p-2 bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
              </div>
           </div>

           {/* Action Buttons */}
           <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
              <button
                onClick={exportToExcel}
                disabled={students.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50 hidden md:flex"
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button
                onClick={handlePrint}
                disabled={students.length === 0}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2 shadow-sm disabled:opacity-50 hidden md:flex"
              >
                <Printer size={16} /> Print
              </button>

              <button 
                onClick={handleSave}
                disabled={students.length === 0}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition shadow-sm ${
                  saveStatus === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                  saveStatus === 'error' ? 'bg-red-600 text-white' :
                  hasChanges ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                 {saveStatus === 'success' ? <CheckCircle size={16} /> : <Save size={16} />}
                 {saveStatus === 'success' ? 'Tersimpan!' : 'Simpan'}
              </button>
           </div>
        </div>
      </div>

      {/* --- MOBILE DAILY SWIPE MODE --- */}
      <div className={`md:hidden ${mobileView === 'daily' ? 'block' : 'hidden'}`}>
          {loading ? (
              <div className="p-10 text-center text-gray-400">Memuat data...</div>
          ) : students.length === 0 ? (
              <div className="p-10 text-center text-gray-400">Tidak ada siswa.</div>
          ) : currentStudentIndex < students.length ? (
              <div className="flex flex-col items-center gap-6 py-4">
                  {/* Card Container */}
                  <div 
                    className="w-full max-w-sm h-80 relative perspective-1000"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                      {/* Stack Effect (Next Card) */}
                      {currentStudentIndex + 1 < students.length && (
                          <div className="absolute top-4 left-4 right-4 bottom-[-16px] bg-white rounded-2xl shadow-sm border border-gray-100 opacity-50 scale-95 z-0 transform translate-y-2"></div>
                      )}

                      {/* Active Card */}
                      <div className={`relative bg-white rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col items-center justify-center h-full z-10 transition-transform duration-300 ${
                          swipeDirection === 'left' ? '-translate-x-full rotate-[-15deg] opacity-0' : 
                          swipeDirection === 'right' ? 'translate-x-full rotate-[15deg] opacity-0' : ''
                      }`}>
                          {/* Swipe Indicator Overlay */}
                          {swipeDirection === 'right' && (
                              <div className="absolute inset-0 bg-green-500 rounded-2xl opacity-20 flex items-center justify-center">
                                  <CheckCircle size={80} className="text-green-600" />
                              </div>
                          )}
                          {swipeDirection === 'left' && (
                              <div className="absolute inset-0 bg-red-500 rounded-2xl opacity-20 flex items-center justify-center">
                                  <X size={80} className="text-red-600" />
                              </div>
                          )}

                          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-400">
                              <UserIcon size={48} />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">{students[currentStudentIndex].name}</h3>
                          <p className="text-gray-500 font-medium">{students[currentStudentIndex].nis}</p>
                          <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
                              <span>Siswa ke {currentStudentIndex + 1} dari {students.length}</span>
                          </div>
                          
                          {/* Current Status Indicator */}
                          {attendance[students[currentStudentIndex].id]?.[dailyDay] && (
                              <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(attendance[students[currentStudentIndex].id][dailyDay])}`}>
                                  {attendance[students[currentStudentIndex].id][dailyDay]}
                              </span>
                          )}
                      </div>
                  </div>

                  {/* Manual Buttons */}
                  <div className="grid grid-cols-4 gap-3 w-full max-w-sm px-4">
                      <button onClick={() => handleMarkDaily('S')} className="py-4 rounded-xl bg-yellow-100 text-yellow-700 font-bold flex flex-col items-center gap-1 active:scale-95 transition">
                          <Activity size={20} /> Sakit
                      </button>
                      <button onClick={() => handleMarkDaily('I')} className="py-4 rounded-xl bg-blue-100 text-blue-700 font-bold flex flex-col items-center gap-1 active:scale-95 transition">
                          <FileSpreadsheet size={20} /> Izin
                      </button>
                      <button onClick={() => handleMarkDaily('A')} className="py-4 rounded-xl bg-red-100 text-red-700 font-bold flex flex-col items-center gap-1 active:scale-95 transition">
                          <AlertCircle size={20} /> Alpha
                      </button>
                      <button onClick={() => handleMarkDaily('H')} className="py-4 rounded-xl bg-green-600 text-white font-bold flex flex-col items-center gap-1 shadow-lg shadow-green-200 active:scale-95 transition">
                          <Check size={24} /> Hadir
                      </button>
                  </div>
                  
                  <div className="text-center text-xs text-gray-400 mt-2">
                      Swipe Kanan (Hadir) • Swipe Kiri (Alpha)
                  </div>
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center p-10 bg-white rounded-xl shadow-sm border border-gray-100 m-4">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Selesai!</h3>
                  <p className="text-gray-500 text-center mb-6">Semua siswa telah diabsen untuk tanggal {dailyDay} {monthNames[selectedMonth]}.</p>
                  <div className="flex gap-3 w-full">
                      <button onClick={() => setCurrentStudentIndex(0)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">
                          Ulangi
                      </button>
                      <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200">
                          Simpan
                      </button>
                  </div>
              </div>
          )}
      </div>

      {/* --- TABLE VIEW (Desktop & Mobile Monthly) --- */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${mobileView === 'monthly' ? 'block' : 'hidden md:block'}`}>
        {loading ? (
           <div className="p-10 text-center text-gray-400">Memuat data absensi...</div>
        ) : students.length === 0 ? (
           <div className="p-10 text-center text-gray-400">Tidak ada siswa di kelas ini.</div>
        ) : (
           <div className="overflow-x-auto w-full">
              <table className="w-full text-xs border-collapse min-w-max">
                 <thead>
                    <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                       <th className="p-3 border-r border-gray-200 w-10 md:sticky md:left-0 bg-gray-100 z-10">No</th>
                       <th className="p-3 border-r border-gray-200 min-w-[150px] text-left md:sticky md:left-10 bg-gray-100 z-10">Nama Siswa</th>
                       
                       {/* Dates */}
                       {days.map(d => (
                          <th key={d} className={`p-1 border-r border-gray-200 min-w-[28px] text-center font-normal ${d === dailyDay && mobileView === 'monthly' ? 'bg-blue-200 font-bold' : ''}`}>{d}</th>
                       ))}

                       {/* Summary */}
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
                             
                             {/* Attendance Cells */}
                             {days.map(d => {
                                const status = attendance[student.id]?.[d] || '';
                                return (
                                   <td 
                                     key={d} 
                                     onClick={() => handleCellClick(student.id, d)}
                                     className={`p-1 border-r border-gray-100 text-center cursor-pointer select-none transition-colors ${getStatusColor(status)}`}
                                   >
                                      {status}
                                   </td>
                                );
                             })}

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
    </div>
  );
};

export default TeacherAttendance;
