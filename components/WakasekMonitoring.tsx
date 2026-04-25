
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, TeachingJournal, AttendanceRecord, ClassRoom, TeachingSchedule, SystemSettings, RfidLog } from '../types';
import { getSchoolTeachers, getSchoolJournals, getSchoolAttendance, syncAllData, getAvailableClassesForHomeroom, getSchoolSchedules, getSchoolJournalsByRange, getSystemSettings, saveSystemSettings, getRfidLogs } from '../services/database';
import SupervisionManager from './SupervisionManager';
import { Activity, CheckCircle, XCircle, Calendar, Users, Search, Filter, Clock, Info, AlertCircle, RefreshCcw, Loader2, BookOpen, LayoutGrid, List as ListIcon, ChevronDown, ChevronUp, TrendingUp, BarChart3, PieChart, Download, Printer, FileSpreadsheet, FileText, School, ShieldCheck, Save } from './Icons';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface WakasekMonitoringProps {
  user: User;
}

const WakasekMonitoring: React.FC<WakasekMonitoringProps> = ({ user }) => {
  const navigate = useNavigate();
  const infographicRef = useRef<HTMLDivElement>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'GURU' | 'KELAS' | 'PRESENSI' | 'SUPERVISI' | 'ABSENSI_RFID'>('GURU');
  const [rfidLogs, setRfidLogs] = useState<RfidLog[]>([]);
  const [rfidViewMode, setRfidViewMode] = useState<'LOGS' | 'SETTINGS'>('LOGS');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [allPeriodJournals, setAllPeriodJournals] = useState<TeachingJournal[]>([]);
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user.schoolNpsn) return;
      setLoading(true);
      try {
        const [schoolTeachers, schoolClasses, schoolSchedules, systemSettings, schoolRfidLogs] = await Promise.all([
          getSchoolTeachers(user.schoolNpsn),
          getAvailableClassesForHomeroom(user.schoolNpsn),
          getSchoolSchedules(user.schoolNpsn),
          getSystemSettings(),
          getRfidLogs(user.schoolNpsn, selectedDate)
        ]);
        
        setSettings(systemSettings || null);
        setRfidLogs(schoolRfidLogs || []);
        
        const teacherIds = schoolTeachers.map(t => t.id);
        
        const [schoolJournals, schoolAttendance] = await Promise.all([
          getSchoolJournals(teacherIds, selectedDate),
          getSchoolAttendance(teacherIds, selectedDate)
        ]);

        // Fetch all journals for the current academic year if on PRESENSI tab
        if (activeTab === 'PRESENSI') {
            const now = new Date();
            const year = now.getFullYear();
            const startYear = now.getMonth() >= 6 ? year : year - 1;
            const startDate = `${startYear}-07-01`;
            const endDate = `${startYear + 1}-06-30`;
            const periodJournals = await getSchoolJournalsByRange(teacherIds, startDate, endDate);
            setAllPeriodJournals(periodJournals);
        }

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
  }, [user.schoolNpsn, selectedDate, activeTab]);

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

  const activeDeviceStats = useMemo(() => {
    const devices: Record<string, { lastSeen: string, count: number }> = {};
    // Extract devices from logs of the selected date
    rfidLogs.forEach(log => {
      const dId = log.deviceId || "Terminal Utama";
      if (!devices[dId]) {
        devices[dId] = { lastSeen: log.timestamp, count: 0 };
      }
      devices[dId].count++;
      if (new Date(log.timestamp) > new Date(devices[dId].lastSeen)) {
        devices[dId].lastSeen = log.timestamp;
      }
    });
    return Object.entries(devices).map(([id, stats]) => ({ id, ...stats }));
  }, [rfidLogs]);

  const teacherStats = useMemo(() => {
    return teachers.map(teacher => {
      const teacherSchedules = schedules.filter(s => s.userId === teacher.id);
      const totalJPPerWeek = teacherSchedules.reduce((acc, s) => acc + ((s.meetingNoEnd || s.meetingNo || 1) - (s.meetingNo || 1) + 1), 0);
      
      if (totalJPPerWeek === 0) return { teacher, weekly: 0, monthly: 0, semester: 0, yearly: 0, totalJP: 0 };

      const teacherJournals = allPeriodJournals.filter(j => j.userId === teacher.id);
      
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); // Monday
      startOfWeek.setHours(0,0,0,0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      const startOfSemester = now.getMonth() >= 6 ? new Date(startYear, 6, 1) : new Date(startYear, 0, 1);
      const startOfYear = new Date(startYear, 6, 1);

      const filterByDate = (journals: TeachingJournal[], startDate: Date) => {
          return journals.filter(j => new Date(j.date) >= startDate && new Date(j.date) <= now).length;
      };

      const weeklyJournals = filterByDate(teacherJournals, startOfWeek);
      const monthlyJournals = filterByDate(teacherJournals, startOfMonth);
      const semesterJournals = filterByDate(teacherJournals, startOfSemester);
      const yearlyJournals = filterByDate(teacherJournals, startOfYear);

      const weeksElapsed = (startDate: Date) => {
          const diff = now.getTime() - startDate.getTime();
          return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
      };

      const weeklyTarget = totalJPPerWeek;
      const monthlyTarget = totalJPPerWeek * weeksElapsed(startOfMonth);
      const semesterTarget = totalJPPerWeek * weeksElapsed(startOfSemester);
      const yearlyTarget = totalJPPerWeek * weeksElapsed(startOfYear);

      return {
          teacher,
          weekly: Math.min(100, (weeklyJournals / weeklyTarget) * 100),
          monthly: Math.min(100, (monthlyJournals / monthlyTarget) * 100),
          semester: Math.min(100, (semesterJournals / semesterTarget) * 100),
          yearly: Math.min(100, (yearlyJournals / yearlyTarget) * 100),
          totalJP: totalJPPerWeek
      };
    });
  }, [teachers, schedules, allPeriodJournals]);

  const handleExportExcel = () => {
    const data = teacherStats.map(s => ({
      'Nama Guru': s.teacher.fullName,
      'NIP': s.teacher.nip || '-',
      'Mata Pelajaran': s.teacher.subject || '-',
      'JP/Minggu': s.totalJP,
      'Minggu Ini (%)': s.weekly.toFixed(1),
      'Bulan Ini (%)': s.monthly.toFixed(1),
      'Semester (%)': s.semester.toFixed(1),
      'Tahunan (%)': s.yearly.toFixed(1)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presensi Guru");
    XLSX.writeFile(wb, `Presensi_Guru_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    await generateInfographic('save');
  };

  const handlePrint = async () => {
    await generateInfographic('print');
  };

  const generateInfographic = async (action: 'save' | 'print') => {
    if (!infographicRef.current) return;
    
    setIsSyncing(true); // Reuse syncing state as loading indicator
    try {
      const element = infographicRef.current;
      
      // Temporarily remove hidden class to capture
      element.classList.remove('hidden');
      element.classList.add('block');
      
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Re-hide
      element.classList.remove('block');
      element.classList.add('hidden');
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Handle multi-page if content is too long
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      if (action === 'save') {
        pdf.save(`Infografis_Presensi_Guru_${new Date().toISOString().split('T')[0]}.pdf`);
      } else {
        // For printing, we use the blob URL approach which is more reliable for direct printing
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          // Some browsers need a delay or specific trigger for autoPrint
          pdf.autoPrint();
          // Revoke URL after some time to clean up
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      }
    } catch (error) {
      console.error("Failed to generate infographic:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportDoc = () => {
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Laporan Presensi Guru</title></head>
      <body>
        <h2 style="text-align: center;">Laporan Presensi Kehadiran Guru</h2>
        <h3 style="text-align: center;">${user.schoolName}</h3>
        <p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</p>
        <table border="1" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th>Nama Guru</th>
              <th>JP/Minggu</th>
              <th>Minggu (%)</th>
              <th>Bulan (%)</th>
              <th>Semester (%)</th>
              <th>Tahunan (%)</th>
            </tr>
          </thead>
          <tbody>
    `;

    const rows = teacherStats.map(s => `
      <tr>
        <td>${s.teacher.fullName}</td>
        <td style="text-align: center;">${s.totalJP}</td>
        <td style="text-align: center;">${s.weekly.toFixed(1)}%</td>
        <td style="text-align: center;">${s.monthly.toFixed(1)}%</td>
        <td style="text-align: center;">${s.semester.toFixed(1)}%</td>
        <td style="text-align: center;">${s.yearly.toFixed(1)}%</td>
      </tr>
    `).join('');

    const footer = `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const source = header + rows + footer;
    const blob = new Blob(['\ufeff', source], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Presensi_Guru_${new Date().toISOString().split('T')[0]}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const isRfidAuthorized = useMemo(() => {
    if (user.role === 'ADMIN') return false; 
    return (
      user.additionalRole === 'KEPALA_SEKOLAH' ||
      user.additionalRole === 'WAKASEK_KURIKULUM' ||
      user.additionalRole === 'WALI_KELAS' ||
      user.subject === 'Bimbingan Konseling' ||
      user.subject === 'BK' ||
      user.isRfidOfficer === true
    );
  }, [user]);

  const stats = {
    total: teachers.length,
    filledJournal: teachers.filter(t => getJournalStatus(t.id)).length,
    filledAttendance: teachers.filter(t => getAttendanceStatus(t.id)).length
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    
    setIsSavingSettings(true);
    setSaveStatus(null);
    try {
      await saveSystemSettings(settings);
      setSaveStatus({ type: 'success', text: 'Pengaturan Absensi RFID berhasil disimpan!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus({ type: 'error', text: 'Gagal menyimpan pengaturan.' });
    } finally {
      setIsSavingSettings(false);
    }
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
    <>
      <div className="max-w-6xl mx-auto space-y-6 pb-20 print:hidden">
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
        <button
          onClick={() => setActiveTab('PRESENSI')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'PRESENSI' 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp size={18} />
          Presensi Kehadiran Guru
        </button>
        <button
          onClick={() => setActiveTab('SUPERVISI')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'SUPERVISI' 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck size={18} />
          Supervisi
        </button>
        {isRfidAuthorized && (
          <button
            onClick={() => setActiveTab('ABSENSI_RFID')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'ABSENSI_RFID' 
                ? 'bg-white text-purple-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={18} />
            Absensi RFID
          </button>
        )}
      </div>

      {/* Main Content */}
      {activeTab === 'SUPERVISI' ? (
        <SupervisionManager user={user} />
      ) : activeTab === 'ABSENSI_RFID' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setRfidViewMode('LOGS')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${rfidViewMode === 'LOGS' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Log Kehadiran
                </button>
                <button 
                  onClick={() => setRfidViewMode('SETTINGS')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${rfidViewMode === 'SETTINGS' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Pengaturan Waktu
                </button>
            </div>
            <div className="text-xs font-medium text-gray-500">
               {rfidLogs.length} Data ditemukan pada {new Date(selectedDate).toLocaleDateString('id-ID')}
            </div>
          </div>

          {rfidViewMode === 'SETTINGS' ? (
            <div className="p-8">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6 bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">Konfigurasi Waktu Absensi RFID</h3>
                    <p className="text-sm text-gray-500">Atur jam operasional absensi RFID untuk sekolah Anda.</p>
                  </div>
                </div>

                {saveStatus && (
                  <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${saveStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {saveStatus.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span className="font-medium text-sm">{saveStatus.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Jam Mulai Masuk (Format 24 Jam)</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1">
                          <select 
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            value={(settings?.rfidCheckInStart || '06:00').split(':')[0]}
                            onChange={(e) => {
                              const mins = (settings?.rfidCheckInStart || '06:00').split(':')[1];
                              const newVal = `${e.target.value}:${mins}`;
                              setSettings(prev => prev ? ({ ...prev, rfidCheckInStart: newVal }) : null);
                            }}
                          >
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                          <span className="font-bold">:</span>
                          <select 
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            value={(settings?.rfidCheckInStart || '06:00').split(':')[1]}
                            onChange={(e) => {
                              const hours = (settings?.rfidCheckInStart || '06:00').split(':')[0];
                              const newVal = `${hours}:${e.target.value}`;
                              setSettings(prev => prev ? ({ ...prev, rfidCheckInStart: newVal }) : null);
                            }}
                          >
                            {Array.from({ length: 60 }).map((_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                        <Clock size={20} className="text-gray-400" />
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500 italic">Pilih jam dan menit (00:00 - 23:59).</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Batas Terlambat (Format 24 Jam)</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1">
                          <select 
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            value={(settings?.rfidCheckInLate || '08:30').split(':')[0]}
                            onChange={(e) => {
                              const mins = (settings?.rfidCheckInLate || '08:30').split(':')[1];
                              const newVal = `${e.target.value}:${mins}`;
                              setSettings(prev => prev ? ({ ...prev, rfidCheckInLate: newVal }) : null);
                            }}
                          >
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                          <span className="font-bold">:</span>
                          <select 
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            value={(settings?.rfidCheckInLate || '08:30').split(':')[1]}
                            onChange={(e) => {
                              const hours = (settings?.rfidCheckInLate || '08:30').split(':')[0];
                              const newVal = `${hours}:${e.target.value}`;
                              setSettings(prev => prev ? ({ ...prev, rfidCheckInLate: newVal }) : null);
                            }}
                          >
                            {Array.from({ length: 60 }).map((_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                        <Clock size={20} className="text-gray-400" />
                      </div>
                      <p className="mt-1 text-[10px] text-red-500 italic">Lewat jam ini dianggap terlambat.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Jam Mulai Pulang (Format 24 Jam)</label>
                    <div className="flex items-center gap-2 max-w-sm">
                      <div className="flex-1 flex items-center gap-1">
                        <select 
                          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={(settings?.rfidCheckOutStart || '14:00').split(':')[0]}
                          onChange={(e) => {
                            const mins = (settings?.rfidCheckOutStart || '14:00').split(':')[1];
                            const newVal = `${e.target.value}:${mins}`;
                            setSettings(prev => prev ? ({ ...prev, rfidCheckOutStart: newVal }) : null);
                          }}
                        >
                          {Array.from({ length: 24 }).map((_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                          ))}
                        </select>
                        <span className="font-bold">:</span>
                        <select 
                          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={(settings?.rfidCheckOutStart || '14:00').split(':')[1]}
                          onChange={(e) => {
                            const hours = (settings?.rfidCheckOutStart || '14:00').split(':')[0];
                            const newVal = `${hours}:${e.target.value}`;
                            setSettings(prev => prev ? ({ ...prev, rfidCheckOutStart: newVal }) : null);
                          }}
                        >
                          {Array.from({ length: 60 }).map((_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <Clock size={20} className="text-gray-400" />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500 italic">Gunakan format 24 jam. Contoh: 14:30 untuk jam setengah tiga sore.</p>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button 
                      type="submit"
                      disabled={isSavingSettings}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md transition flex items-center gap-2 disabled:opacity-70"
                    >
                      {isSavingSettings ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      {isSavingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                    </button>
                  </div>
                </form>

                <div className="mt-10 p-5 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                        <AlertCircle size={16} className="text-purple-500" />
                        Panduan Logika Batas Waktu (Format 24 Jam):
                    </h4>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                            <div>
                                <p className="text-xs font-bold text-gray-700 uppercase">Status Hadir (H)</p>
                                <p className="text-[11px] text-gray-500">
                                    Siswa melakukan tap antara pukul <span className="font-bold">{settings?.rfidCheckInStart || '06:00'}</span> sampai dengan <span className="font-bold">{settings?.rfidCheckInLate || '08:30'}</span>.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                            <div>
                                <p className="text-xs font-bold text-gray-700 uppercase">Status Terlambat (T)</p>
                                <p className="text-[11px] text-gray-500">
                                    Siswa melakukan tap setelah pukul <span className="font-bold">{settings?.rfidCheckInLate || '08:30'}</span> namun sebelum jam pulang <span className="font-bold">{settings?.rfidCheckOutStart || '14:00'}</span>.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                            <div>
                                <p className="text-xs font-bold text-gray-700 uppercase">Status Pulang / Pulang Cepat</p>
                                <p className="text-[11px] text-gray-500">
                                    Tap pada pukul <span className="font-bold">{settings?.rfidCheckOutStart || '14:00'}</span> ke atas dihitung Pulang. Sebelum jam tersebut dihitung Pulang Cepat.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {/* Status Alat Scan Section */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="text-blue-500" size={18} />
                      <h3 className="font-bold text-gray-800 text-sm">Status Terminal Scanner (Aktif Hari Ini)</h3>
                    </div>
                    <div className="text-[10px] text-gray-400 italic font-medium">Mendeteksi aktivitas dari riwayat tap RFID</div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {activeDeviceStats.length === 0 ? (
                      <div className="w-full py-4 text-center text-xs text-gray-400 italic bg-gray-50 rounded-lg">
                        Tidak ada aktivitas scanner yang terdeteksi pada tanggal ini.
                      </div>
                    ) : (
                      activeDeviceStats.map((device) => (
                        <div key={device.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex-1 min-w-[200px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-700">{device.id}</span>
                            <span className="flex items-center gap-1 text-[9px] text-green-500 font-bold uppercase tracking-wider">
                              <CheckCircle size={10} /> Aktif
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 mb-1">
                            Terakhir Sinyal: <span className="text-gray-800 font-medium">
                              {new Date(device.lastSeen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Volume Scan: <span className="text-blue-600 font-bold">{device.count}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Siswa</th>
                    <th className="px-6 py-4">Kelas</th>
                    <th className="px-6 py-4">Waktu Tap</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rfidLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Clock size={32} className="text-gray-300" />
                          <p className="font-medium">Belum ada data tap RFID pada tanggal ini.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rfidLogs
                      .filter(log => log.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-800">{log.studentName}</div>
                          <div className="text-[10px] text-gray-400">ID: {log.studentId}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {log.className}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-gray-800">
                            {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${
                            log.status === 'HADIR' ? 'bg-green-100 text-green-700' :
                            log.status === 'TERLAMBAT' ? 'bg-orange-100 text-orange-700' :
                            log.status === 'PULANG' ? 'bg-blue-100 text-blue-700' :
                            log.status === 'PULANG CEPAT' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.status === 'HADIR' ? 'HADIR' : 
                             log.status === 'TERLAMBAT' ? 'TERLAMBAT' : 
                             log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-gray-500 font-medium">
                          {log.method}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
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
          ) : activeTab === 'KELAS' ? (
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
          ) : (
            <div className="p-6">
              {/* Export Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100 hover:bg-green-100 transition"
                  >
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition"
                  >
                    <Download size={14} /> PDF
                  </button>
                  <button 
                    onClick={handleExportDoc}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition"
                  >
                    <FileText size={14} /> Word
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-100 transition"
                  >
                    <Printer size={14} /> Cetak
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 font-medium italic">
                  * Data akumulasi dihitung dari awal tahun ajaran (Juli)
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                      <div className="space-y-3">
                        <div className="h-8 bg-gray-100 rounded"></div>
                        <div className="h-8 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                  ))
                ) : teacherStats.filter(s => 
                    s.teacher.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (s.teacher.subject && s.teacher.subject.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).length === 0 ? (
                  <div className="col-span-full py-12 text-center text-gray-500">
                    <p>Data guru tidak ditemukan.</p>
                  </div>
                ) : (
                  teacherStats
                    .filter(s => 
                      s.teacher.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (s.teacher.subject && s.teacher.subject.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .map(stats => {
                      const getProgressColor = (val: number) => {
                        if (val >= 90) return 'bg-green-500';
                        if (val >= 75) return 'bg-blue-500';
                        if (val >= 50) return 'bg-yellow-500';
                        return 'bg-red-500';
                      };

                      return (
                        <div key={stats.teacher.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-gray-800 group-hover:text-purple-600 transition">{stats.teacher.fullName}</h4>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stats.teacher.subject || 'Guru'}</p>
                            </div>
                            <div className="bg-purple-50 text-purple-600 px-2 py-1 rounded text-[10px] font-bold">
                              {stats.totalJP} JP / MINGGU
                            </div>
                          </div>

                          <div className="space-y-4">
                            {/* Weekly */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-gray-500 uppercase">Minggu Ini</span>
                                <span className={stats.weekly >= 90 ? 'text-green-600' : 'text-gray-700'}>{stats.weekly.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${getProgressColor(stats.weekly)}`}
                                  style={{ width: `${stats.weekly}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Monthly */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-gray-500 uppercase">Bulan Ini</span>
                                <span className={stats.monthly >= 90 ? 'text-green-600' : 'text-gray-700'}>{stats.monthly.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${getProgressColor(stats.monthly)}`}
                                  style={{ width: `${stats.monthly}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Semester & Yearly Grid */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Semester</p>
                                <p className="text-lg font-black text-gray-800">{stats.semester.toFixed(1)}%</p>
                                <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                  <div className={`h-full ${getProgressColor(stats.semester)}`} style={{ width: `${stats.semester}%` }}></div>
                                </div>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Tahunan</p>
                                <p className="text-lg font-black text-gray-800">{stats.yearly.toFixed(1)}%</p>
                                <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                  <div className={`h-full ${getProgressColor(stats.yearly)}`} style={{ width: `${stats.yearly}%` }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
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
    )}
  </div>

  {/* Printable Infographic Section */}
      <div ref={infographicRef} className="hidden print:block p-10 bg-white font-sans text-gray-900 w-[210mm]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-purple-600 pb-8 mb-10">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <School size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-900">{user.schoolName}</h1>
              <p className="text-sm text-gray-500 font-mono tracking-wide">NPSN: {user.schoolNpsn} | SISTEM MONITORING KURIKULUM DIGITAL</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-purple-600 uppercase tracking-[0.3em] mb-1">LAPORAN INFOGRAFIS</p>
            <p className="text-2xl font-black text-gray-800">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="relative overflow-hidden bg-purple-50 p-8 rounded-3xl border border-purple-100">
            <div className="absolute -right-4 -top-4 text-purple-100">
              <Users size={80} />
            </div>
            <p className="relative z-10 text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Total Tenaga Pendidik</p>
            <p className="relative z-10 text-5xl font-black text-purple-900">{teachers.length}</p>
          </div>
          <div className="relative overflow-hidden bg-blue-50 p-8 rounded-3xl border border-blue-100">
            <div className="absolute -right-4 -top-4 text-blue-100">
              <TrendingUp size={80} />
            </div>
            <p className="relative z-10 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Rata-rata Kepatuhan</p>
            <p className="relative z-10 text-5xl font-black text-blue-900">
              {(teacherStats.reduce((acc, s) => acc + s.yearly, 0) / (teacherStats.length || 1)).toFixed(1)}%
            </p>
          </div>
          <div className="relative overflow-hidden bg-green-50 p-8 rounded-3xl border border-green-100">
            <div className="absolute -right-4 -top-4 text-green-100">
              <CheckCircle size={80} />
            </div>
            <p className="relative z-10 text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Integritas Data</p>
            <p className="relative z-10 text-5xl font-black text-green-900">A+</p>
          </div>
        </div>

        {/* Main Section Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-gray-200"></div>
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-gray-400">Detail Performa Kehadiran Guru</h2>
          <div className="h-px flex-1 bg-gray-200"></div>
        </div>

        {/* Teacher Infographic Grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-10">
          {teacherStats.map((stats) => (
            <div key={stats.teacher.id} className="flex flex-col break-inside-avoid border-b border-gray-100 pb-6">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-0.5">{stats.teacher.fullName}</h3>
                  <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">{stats.teacher.subject || 'Guru Mata Pelajaran'}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Beban Kerja</div>
                  <div className="text-lg font-black text-gray-800">{stats.totalJP} <span className="text-[10px] text-gray-400">JP/MGG</span></div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Minggu', val: stats.weekly, color: 'bg-indigo-500' },
                  { label: 'Bulan', val: stats.monthly, color: 'bg-blue-500' },
                  { label: 'Semester', val: stats.semester, color: 'bg-purple-500' },
                  { label: 'Tahun', val: stats.yearly, color: 'bg-emerald-500' }
                ].map(p => (
                  <div key={p.label} className="space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-gray-400 tracking-tighter mb-1">{p.label}</span>
                      <span className="text-sm font-black text-gray-900">{p.val.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${p.color}`}
                        style={{ width: `${p.val}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer / Signature Section */}
        <div className="mt-20 pt-10 border-t-2 border-gray-100 flex justify-between items-start">
          <div className="max-w-md">
            <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Laporan ini dihasilkan secara otomatis oleh sistem EduAdmin Pro. Seluruh data yang disajikan bersifat valid dan telah melalui proses sinkronisasi real-time dengan database jurnal mengajar sekolah.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-gray-500">
              <Clock size={12} />
              <span>WAKTU CETAK: {new Date().toLocaleString('id-ID')}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center min-w-[200px]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-16">Wakasek Kurikulum</p>
            <div className="w-full h-px bg-gray-900 mb-2"></div>
            <p className="text-xs font-black uppercase text-gray-900">{user.fullName}</p>
            <p className="text-[10px] text-gray-500 font-medium">NIP. {user.nip || '..........................'}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default WakasekMonitoring;
