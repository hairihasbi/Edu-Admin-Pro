
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, School, User, IdCard, CalendarDays, Layout, Users, ClipboardList, TrendingUp, Plus, Trash2, X, Settings, Heart, Coffee, Megaphone, AlertCircle, Info, Zap, DatabaseBackup, AlertTriangle, Database, WifiOff, RefreshCcw, Cloud, ArrowRight } from './Icons';
import { User as UserType, TeachingSchedule, DashboardStatsData, Notification } from '../types';
import { getDashboardStats, getTeachingSchedules, addTeachingSchedule, deleteTeachingSchedule, getActiveAnnouncements, getSyncStats } from '../services/database';
import { checkConnection } from '../services/tursoService';

interface TeacherDashboardProps {
  user: UserType;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  // Identity State
  const [academicPeriod, setAcademicPeriod] = useState({ year: '', semester: '' });
  const [currentDateFormatted, setCurrentDateFormatted] = useState('');
  const [currentDayName, setCurrentDayName] = useState('');

  // Stats State
  const [stats, setStats] = useState<DashboardStatsData>({
    totalClasses: 0,
    totalStudents: 0,
    filledJournals: 0,
    attendanceRate: 0,
    genderDistribution: [],
    weeklyAttendance: []
  });

  // Schedule State
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    day: 'Senin',
    timeStart: '07:30',
    timeEnd: '09:00',
    className: '',
    subject: user.subject || ''
  });

  // Database Status State
  const [dbStatus, setDbStatus] = useState<'Turso Cloud' | 'Mode Lokal' | 'Sync Error' | 'Checking...'>('Checking...');
  const [pendingCount, setPendingCount] = useState(0);

  // Donation Popup State
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Announcement Banner State
  const [announcement, setAnnouncement] = useState<Notification | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // FETCH DATA FUNCTION
  const fetchData = async () => {
    // Only show loading on initial load or if explicitly needed
    if (isLoading) setIsLoading(true);
    try {
        const statsData = await getDashboardStats(user);
        setStats(statsData);
        
        const scheduleData = await getTeachingSchedules(user.id);
        setSchedules(scheduleData);
        
        // Initial Sync Check
        const syncData = await getSyncStats(user);
        setPendingCount(syncData.totalUnsynced);
    } catch (error) {
        console.error("Dashboard Fetch Error:", error);
        setStats({
          totalClasses: 0, totalStudents: 0, filledJournals: 0, 
          attendanceRate: 0, genderDistribution: [], weeklyAttendance: []
        });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Calculate Academic Period & Date
    const now = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', dateOptions);
    setCurrentDateFormatted(dateStr);
    const dayName = now.toLocaleDateString('id-ID', { weekday: 'long' });
    setCurrentDayName(dayName);

    const month = now.getMonth(); 
    const year = now.getFullYear();
    let sem = '';
    let acadYear = '';

    if (month >= 6) { 
      sem = 'Ganjil';
      acadYear = `${year}/${year + 1}`;
    } else { 
      sem = 'Genap';
      acadYear = `${year - 1}/${year}`;
    }

    setAcademicPeriod({ year: acadYear, semester: sem });
    
    // 2. Fetch Stats & Schedules (Safe Mode)
    fetchData();

    // 3. Check Donation Popup Preference
    const hidePopup = localStorage.getItem('eduadmin_hide_donation_popup');
    if (!hidePopup) {
      const timer = setTimeout(() => setShowDonationModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // DB Connection & Sync Check Logic
  useEffect(() => {
    const handleSyncStatus = (e: any) => {
        if (e.detail === 'error') setDbStatus('Sync Error');
        else if (e.detail === 'success') {
            setDbStatus('Turso Cloud');
            // CRITICAL FIX: Reload dashboard stats when data arrives from server
            fetchData();
        }
    };

    const handleUnsavedChanges = (e: any) => {
        getSyncStats(user).then(d => setPendingCount(d.totalUnsynced));
    };
    
    const checkDb = async () => {
        if (navigator.onLine) {
            const isConnected = await checkConnection();
            if (isConnected) setDbStatus('Turso Cloud');
            else {
                 try {
                    const res = await fetch('/api/turso', { method: 'POST', body: JSON.stringify({action: 'check'}) });
                    if (res.status === 404) setDbStatus('Mode Lokal');
                    else setDbStatus('Sync Error');
                } catch {
                    setDbStatus('Mode Lokal'); 
                }
            }
        } else {
            setDbStatus('Mode Lokal');
        }
        // Always check pending stats - PASS USER
        getSyncStats(user).then(d => setPendingCount(d.totalUnsynced)).catch(() => {});
    };

    checkDb();
    const intervalId = setInterval(checkDb, 30000);
    
    window.addEventListener('sync-status', handleSyncStatus); 
    window.addEventListener('unsaved-changes', handleUnsavedChanges);
    window.addEventListener('online', checkDb);
    window.addEventListener('offline', () => setDbStatus('Mode Lokal'));

    return () => {
        clearInterval(intervalId);
        window.removeEventListener('sync-status', handleSyncStatus);
        window.removeEventListener('unsaved-changes', handleUnsavedChanges);
        window.removeEventListener('online', checkDb);
        window.removeEventListener('offline', () => setDbStatus('Mode Lokal'));
    };
  }, [user]); 

  // --- LIVE ANNOUNCEMENT LOGIC (CHANGED) ---
  // Runs independently of donation modal, polls every 30s
  useEffect(() => {
    // Initial check
    checkAnnouncements();

    // Polling interval for "Live" feel
    const intervalId = setInterval(checkAnnouncements, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  const checkAnnouncements = async () => {
      // Prevent fetching if modal is already open to avoid overwriting current view
      // We check the state inside the async flow logic below, but React state inside setInterval closure
      // might be stale. Ideally we trust the effect dependencies or use functional updates, 
      // but for simple polling, re-fetching is okay.
      
      const activeAnnouncements = await getActiveAnnouncements();
      
      if (activeAnnouncements.length > 0) {
          // Take the most recent one
          const latest = activeAnnouncements[0];
          const storageKey = `announcement_view_count_${latest.id}`;
          
          // Get current view count (Default 0)
          const currentCount = parseInt(localStorage.getItem(storageKey) || '0');
          const MAX_VIEWS = 2;

          // Logic: Show if view count < 2
          // We also check if we are NOT currently showing it (to prevent interval re-triggering animation)
          if (currentCount < MAX_VIEWS) {
              setAnnouncement(prev => {
                  // Only update state if it's a new announcement or different from current
                  if (prev?.id !== latest.id) {
                      // Increment view count immediately upon deciding to show
                      localStorage.setItem(storageKey, (currentCount + 1).toString());
                      setShowAnnouncementModal(true);
                      return latest;
                  }
                  return prev; // No change if already showing same ID
              });
              
              // If state was null (first load), ensure modal opens
              if (!showAnnouncementModal) {
                   setShowAnnouncementModal(true);
                   // Ensure we increment if we force open, handling the closure staleness slightly
                   const updatedCount = parseInt(localStorage.getItem(storageKey) || '0');
                   if (updatedCount === currentCount) {
                        localStorage.setItem(storageKey, (currentCount + 1).toString());
                   }
              }
          }
      }
  };

  const closeAnnouncementModal = () => {
      setShowAnnouncementModal(false);
      // We don't clear announcement state immediately to allow fade out animation if implemented
      setTimeout(() => setAnnouncement(null), 300);
  };

  // Update schedule subject when user profile changes
  useEffect(() => {
    setNewSchedule(prev => ({ ...prev, subject: user.subject || '' }));
  }, [user.subject]);

  // Schedule Logic
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.className || !newSchedule.subject) return;

    const added = await addTeachingSchedule({
      userId: user.id,
      day: newSchedule.day,
      timeStart: newSchedule.timeStart,
      timeEnd: newSchedule.timeEnd,
      className: newSchedule.className,
      subject: newSchedule.subject
    });

    if (added) {
      setSchedules(prev => [...prev, added].sort((a, b) => a.day.localeCompare(b.day) || a.timeStart.localeCompare(b.timeStart)));
      setNewSchedule({
        day: 'Senin',
        timeStart: '07:30',
        timeEnd: '09:00',
        className: '',
        subject: user.subject || ''
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm("Hapus jadwal ini?")) {
      await deleteTeachingSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    }
  };

  // Donation Modal Logic
  const closeDonationModal = () => {
    if (dontShowAgain) {
      localStorage.setItem('eduadmin_hide_donation_popup', 'true');
    }
    setShowDonationModal(false);
  };

  const navigateToDonation = () => {
    if (dontShowAgain) {
      localStorage.setItem('eduadmin_hide_donation_popup', 'true');
    }
    setShowDonationModal(false);
    navigate('/donation');
  };

  const getScheduleStatus = (start: string, end: string) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (currentMinutes < startTotal) return 'Akan Datang';
    if (currentMinutes >= startTotal && currentMinutes <= endTotal) return 'Sedang Berlangsung';
    return 'Selesai';
  };

  const todaySchedules = schedules.filter(s => s.day === currentDayName);

  // Helper for Announcement Styles
  const getAnnouncementStyles = (type: string) => {
      switch(type) {
          case 'maintenance': return {
              bg: 'bg-gradient-to-br from-yellow-400 to-orange-500',
              icon: <AlertCircle className="w-16 h-16 text-white opacity-90" />,
              btn: 'bg-white text-orange-600 hover:bg-orange-50'
          };
          case 'update': return {
              bg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
              icon: <Zap className="w-16 h-16 text-white opacity-90" />,
              btn: 'bg-white text-purple-600 hover:bg-purple-50'
          };
          case 'alert': return {
              bg: 'bg-gradient-to-br from-red-500 to-rose-600',
              icon: <AlertCircle className="w-16 h-16 text-white opacity-90" />,
              btn: 'bg-white text-red-600 hover:bg-red-50'
          };
          default: return {
              bg: 'bg-gradient-to-br from-teal-400 to-emerald-600',
              icon: <Info className="w-16 h-16 text-white opacity-90" />,
              btn: 'bg-white text-teal-600 hover:bg-teal-50'
          };
      }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* --- DATA WIPE WARNING BANNER --- */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm flex items-start gap-4">
         <div className="bg-yellow-100 p-2 rounded-full text-yellow-600 shrink-0">
            <AlertTriangle size={20} />
         </div>
         <div className="flex-1">
            <h3 className="text-sm font-bold text-yellow-800">Penting: Pembersihan Data Tahunan</h3>
            <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
               Data sistem akan <strong>dihapus total oleh Admin</strong> pada akhir tahun pembelajaran untuk persiapan tahun ajaran baru. 
               Mohon para Guru melakukan <strong>Backup Data Semester</strong> (Nilai, Jurnal, Absensi) secara berkala agar data tidak hilang.
            </p>
            <Link to="/profile" className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-yellow-800 hover:text-yellow-900 underline">
               <DatabaseBackup size={12} /> Ke Menu Backup (via Profil)
            </Link>
         </div>
      </div>

      {/* Kartu Identitas Guru */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <IdCard size={20} className="text-blue-100" />
            Identitas Guru & Sekolah
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
             // Identity Skeleton
             <>
               <div className="space-y-2 animate-pulse"><div className="h-3 bg-gray-200 rounded w-24"></div><div className="h-6 bg-gray-200 rounded w-3/4"></div></div>
               <div className="space-y-2 animate-pulse"><div className="h-3 bg-gray-200 rounded w-24"></div><div className="h-6 bg-gray-200 rounded w-3/4"></div></div>
               <div className="space-y-2 animate-pulse"><div className="h-3 bg-gray-200 rounded w-24"></div><div className="h-6 bg-gray-200 rounded w-3/4"></div></div>
               <div className="space-y-2 animate-pulse"><div className="h-3 bg-gray-200 rounded w-24"></div><div className="h-6 bg-gray-200 rounded w-3/4"></div></div>
               <div className="col-span-1 md:col-span-2 lg:col-span-2 h-16 bg-gray-100 rounded animate-pulse"></div>
             </>
          ) : (
             <>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                    <School size={12} /> Nama Sekolah
                  </label>
                  <p className="text-gray-800 font-semibold text-lg">{user.schoolName || 'Belum diatur (Edit di Profil)'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                    <User size={12} /> Nama Guru
                  </label>
                  <p className="text-gray-800 font-semibold text-lg">{user.fullName}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                    <IdCard size={12} /> NIP / NUPTK
                  </label>
                  <p className="text-gray-800 font-medium">{user.nip || 'Belum diatur'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                    <BookOpen size={12} /> Mata Pelajaran
                  </label>
                  <p className="text-gray-800 font-medium">{user.subject || 'Belum diatur'}</p>
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
                        <CalendarDays size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Tahun Ajaran Aktif</p>
                        <p className="text-gray-900 font-bold text-lg leading-tight">
                          {academicPeriod.year || '...'} <span className="mx-2 text-gray-300">|</span> Semester {academicPeriod.semester || '...'}
                        </p>
                      </div>
                  </div>
                  <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-blue-600 shadow-sm border border-blue-100">
                    Update Otomatis
                  </div>
                </div>
             </>
          )}
        </div>
      </div>

      {/* Statistik Ringkas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Skeleton for Stats
          Array.from({length: 4}).map((_, i) => (
             <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                   <div className="h-4 bg-gray-200 rounded w-20"></div>
                   <div className="h-6 bg-gray-200 rounded w-10"></div>
                </div>
             </div>
          ))
        ) : (
          <>
            {/* Total Kelas */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                <Layout size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Kelas</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.totalClasses}</h3>
              </div>
            </div>

            {/* Total Murid */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-pink-100 rounded-full text-pink-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Siswa</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.totalStudents}</h3>
              </div>
            </div>

            {/* Jurnal Terisi */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-teal-100 rounded-full text-teal-600">
                <ClipboardList size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Jurnal Terisi</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.filledJournals}</h3>
              </div>
            </div>

            {/* Kehadiran */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Kehadiran</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.attendanceRate}%</h3>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status Database Card (REAL TIME) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${
                  dbStatus === 'Turso Cloud' ? 'bg-green-100 text-green-600' : 
                  dbStatus === 'Mode Lokal' ? 'bg-gray-100 text-gray-600' : 
                  dbStatus === 'Checking...' ? 'bg-blue-100 text-blue-600' :
                  'bg-red-100 text-red-600'
              }`}>
                  {dbStatus === 'Turso Cloud' ? <Database size={24} /> : 
                   dbStatus === 'Mode Lokal' ? <WifiOff size={24} /> : 
                   dbStatus === 'Checking...' ? <RefreshCcw size={24} className="animate-spin"/> :
                   <AlertTriangle size={24} />}
              </div>
              <div>
                  <h4 className="font-bold text-gray-800">Status Database</h4>
                  <div className="flex flex-col">
                      <p className="text-xs text-gray-500">
                          {dbStatus === 'Turso Cloud' ? 'Terhubung ke Cloud (Realtime)' : 
                           dbStatus === 'Mode Lokal' ? 'Offline / Local Storage Only' : 
                           dbStatus === 'Checking...' ? 'Memeriksa koneksi...' :
                           'Gagal terhubung ke Cloud'}
                      </p>
                      {/* PENDING DATA INDICATOR */}
                      {pendingCount > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-orange-600 animate-pulse">
                              <Cloud size={12} />
                              {pendingCount} Data Belum Diupload
                          </div>
                      )}
                  </div>
              </div>
          </div>
          
          <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                  <Link 
                    to="/sync" 
                    className="flex items-center gap-1 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition shadow-sm"
                  >
                    Sync Sekarang <ArrowRight size={12} />
                  </Link>
              )}
              <div className={`w-3 h-3 rounded-full ${
                  dbStatus === 'Turso Cloud' ? 'bg-green-500' : 
                  dbStatus === 'Mode Lokal' ? 'bg-gray-400' : 
                  dbStatus === 'Checking...' ? 'bg-blue-500 animate-pulse' :
                  'bg-red-500'
              }`}></div>
              <span className={`text-sm font-bold ${
                  dbStatus === 'Turso Cloud' ? 'text-green-700' : 
                  dbStatus === 'Mode Lokal' ? 'text-gray-500' : 
                  dbStatus === 'Checking...' ? 'text-blue-600' :
                  'text-red-600'
              }`}>
                  {dbStatus}
              </span>
          </div>
      </div>

      {/* Donation Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-40 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-2">
             <div className="bg-white p-2 rounded-lg shadow-sm text-pink-500">
                <Heart size={20} fill="currentColor" />
             </div>
             <h3 className="font-bold text-indigo-900 text-lg">Aplikasi Ini 100% Gratis!</h3>
          </div>
          <p className="text-indigo-700 text-sm leading-relaxed">
             EduAdmin Pro dibuat dengan semangat untuk memajukan pendidikan Indonesia. 
             Jika aplikasi ini membantu pekerjaan Anda, mari berikan dukungan sukarela untuk biaya server dan pengembangan fitur baru agar aplikasi ini bisa terus digunakan oleh ribuan guru lainnya.
          </p>
        </div>

        <Link 
          to="/donation" 
          className="relative z-10 whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition transform hover:scale-105 flex items-center gap-2"
        >
           <Coffee size={20} />
           Beri Dukungan
        </Link>
      </div>

      {/* Jadwal Mengajar Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          {/* ... existing code ... */}
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Jadwal Mengajar Hari Ini</h3>
              <p className="text-sm text-gray-500">Tahun Ajaran {academicPeriod.year}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium hidden sm:block">
                 {currentDateFormatted}
              </div>
              <button 
                onClick={() => setIsScheduleModalOpen(true)}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition"
              >
                <Settings size={14} /> Atur Jadwal
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
            {isLoading ? (
               <div className="p-8 text-center">Memuat jadwal...</div>
            ) : todaySchedules.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>Tidak ada jadwal mengajar pada hari {currentDayName}.</p>
                <button onClick={() => setIsScheduleModalOpen(true)} className="text-blue-600 text-sm mt-2 hover:underline">
                  + Tambah Jadwal
                </button>
              </div>
            ) : (
              todaySchedules.map((item) => {
                const status = getScheduleStatus(item.timeStart, item.timeEnd);
                return (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{item.className}</h4>
                        <p className="text-sm text-gray-500">{item.subject}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{item.timeStart} - {item.timeEnd}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        status === 'Selesai' ? 'bg-gray-100 text-gray-600' :
                        status === 'Sedang Berlangsung' ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
      </div>

      {/* Schedule Management Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-800">Manajemen Jadwal Mengajar</h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddSchedule} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Hari</label>
                  <select 
                    value={newSchedule.day}
                    onChange={(e) => setNewSchedule({...newSchedule, day: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                   <label className="block text-xs font-semibold text-gray-500 mb-1">Mulai</label>
                   <input type="time" value={newSchedule.timeStart} onChange={e => setNewSchedule({...newSchedule, timeStart: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm" required />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-gray-500 mb-1">Selesai</label>
                   <input type="time" value={newSchedule.timeEnd} onChange={e => setNewSchedule({...newSchedule, timeEnd: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm" required />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-gray-500 mb-1">Kelas</label>
                   <input type="text" placeholder="X-A" value={newSchedule.className} onChange={e => setNewSchedule({...newSchedule, className: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm" required />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1">
                    <Plus size={16} /> Tambah
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                 {DAYS.map(day => {
                    const daySchedules = schedules.filter(s => s.day === day);
                    if (daySchedules.length === 0) return null;
                    return (
                       <div key={day}>
                          <h4 className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">{day}</h4>
                          <div className="space-y-2">
                             {daySchedules.map(sch => (
                                <div key={sch.id} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                                   <div>
                                      <p className="font-semibold text-gray-800">{sch.className} <span className="text-gray-400 font-normal">| {sch.subject}</span></p>
                                      <p className="text-xs text-gray-500">{sch.timeStart} - {sch.timeEnd}</p>
                                   </div>
                                   <button onClick={() => handleDeleteSchedule(sch.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50">
                                      <Trash2 size={16} />
                                   </button>
                                </div>
                             ))}
                          </div>
                       </div>
                    )
                 })}
                 {schedules.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Belum ada jadwal tersimpan.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DONATION POPUP MODAL */}
      {showDonationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-300">
             
             {/* Header with Gradient */}
             <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-6 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 pattern-dots"></div>
                <Heart className="w-12 h-12 mx-auto mb-3 animate-pulse text-white drop-shadow-md" fill="currentColor" />
                <h3 className="text-2xl font-bold mb-1">Dukungan Anda Berarti!</h3>
                <p className="text-pink-100 text-sm">Mari bantu pendidikan Indonesia lebih maju.</p>
             </div>

             <div className="p-6">
                <p className="text-gray-600 text-center mb-6 leading-relaxed">
                   Halo Guru Hebat! Aplikasi EduAdmin Pro ini 100% gratis. 
                   Namun, kami membutuhkan dukungan sukarela untuk biaya server dan pengembangan fitur AI agar tetap berjalan lancar.
                </p>

                <div className="space-y-3">
                   <button 
                      onClick={navigateToDonation}
                      className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
                   >
                      <Coffee size={20} />
                      Beri Dukungan Sukarela
                   </button>
                   
                   <button 
                      onClick={closeDonationModal}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 rounded-xl transition"
                   >
                      Nanti Saja
                   </button>
                </div>

                <div className="mt-6 flex justify-center">
                   <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 border-gray-300"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                      />
                      Jangan tampilkan lagi
                   </label>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT BANNER MODAL */}
      {showAnnouncementModal && announcement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-in zoom-in-95 duration-300 border border-gray-100">
                  
                  {/* Dynamic Header */}
                  <div className={`p-8 text-center relative overflow-hidden ${getAnnouncementStyles(announcement.type).bg}`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
                      <div className="absolute bottom-0 left-0 w-20 h-20 bg-white opacity-10 rounded-full blur-xl"></div>
                      
                      <div className="relative z-10 flex flex-col items-center">
                          <div className="mb-4">
                              {getAnnouncementStyles(announcement.type).icon}
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-2">{announcement.title}</h3>
                          <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                              System Announcement
                          </div>
                      </div>
                  </div>

                  <div className="p-8">
                      <div className="prose prose-sm max-w-none text-gray-600 mb-8 whitespace-pre-wrap leading-relaxed text-center">
                          {announcement.message}
                      </div>

                      <button 
                          onClick={closeAnnouncementModal}
                          className={`w-full py-3.5 rounded-xl font-bold shadow-sm transition transform hover:scale-[1.02] ${getAnnouncementStyles(announcement.type).btn}`}
                      >
                          Mengerti, Tutup Pesan
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default TeacherDashboard;
