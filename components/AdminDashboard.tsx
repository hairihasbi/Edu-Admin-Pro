
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, GraduationCap, TrendingUp, ClipboardList, Layout, CalendarDays, 
  Activity, ShieldAlert, Clock, Server, ChevronRight, CheckCircle, Database, 
  WifiOff, AlertTriangle, RefreshCcw, Megaphone, DatabaseBackup, Settings, Globe
} from './Icons';
import { getDashboardStats, getPendingTeachers, getSystemLogs, addSystemLog } from '../services/database';
import { checkConnection } from '../services/tursoService'; 
import { User, DashboardStatsData, LogEntry } from '../types';

interface AdminDashboardProps {
  onPublishAnnouncement?: (title: string, content: string) => void;
  user?: User; 
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Database Stats State
  const [stats, setStats] = useState<DashboardStatsData>({
    totalClasses: 0,
    totalStudents: 0,
    filledJournals: 0,
    attendanceRate: 0,
    genderDistribution: [],
    weeklyAttendance: []
  });

  // New Admin Features State (Real-time Data)
  const [pendingCount, setPendingCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [dbStatus, setDbStatus] = useState<'Turso Cloud' | 'Mode Lokal' | 'Sync Error' | 'Checking...'>('Checking...');

  const refreshRealtimeData = async () => {
    if (!user) return;
    
    try {
      // 1. Parallel Fetch for Local/Hybrid Data
      let [pendingData, logsData] = await Promise.all([
        getPendingTeachers(),
        getSystemLogs()
      ]);

      setPendingCount(pendingData.length);
      
      // AUTO-LOGGING IF EMPTY: Ensure user sees "Activity" works immediately
      // This solves the issue of "empty dashboard" for new users
      if (logsData.length === 0) {
          await addSystemLog('INFO', 'System', 'SYSTEM', 'Dashboard Init', 'Dashboard initialized. Monitoring active.');
          // Re-fetch to show the new log immediately
          logsData = await getSystemLogs();
      }

      const sortedLogs = logsData
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
      setRecentLogs(sortedLogs);
      
      // 2. Fetch Aggregated Stats (Logic Split: Online vs Offline)
      if (navigator.onLine) {
          try {
              // Try fetching REAL server-side stats
              const response = await fetch('/api/admin/stats', { 
                headers: {
                  'Authorization': `Bearer ${user.id}`
                },
                credentials: 'include' 
              });
              
              const contentType = response.headers.get("content-type");
              if (response.ok && contentType && contentType.indexOf("application/json") !== -1) {
                  const serverStats = await response.json();
                  const localStats = await getDashboardStats(user); 
                  
                  setStats({
                      ...localStats,
                      totalClasses: serverStats.totalClasses,
                      totalStudents: serverStats.totalStudents,
                      filledJournals: serverStats.filledJournals,
                      attendanceRate: serverStats.attendanceRate,
                      genderDistribution: serverStats.genderDistribution || localStats.genderDistribution
                  });
                  setDbStatus('Turso Cloud');
              } else {
                  // Fallback without throwing loud error
                  const localStats = await getDashboardStats(user);
                  setStats(localStats);
                  if (response.status === 404) setDbStatus('Mode Lokal');
                  else setDbStatus('Sync Error');
              }
          } catch (e: any) {
              console.warn("Server stats fetch failed (using local):", e.message);
              const localStats = await getDashboardStats(user);
              setStats(localStats);
              
              if (e.message.includes('API Missing') || e.message.includes('Unexpected token')) {
                  setDbStatus('Mode Lokal');
              } else {
                  setDbStatus('Sync Error');
              }
          }
      } else {
          // Fallback to local Dexie if offline
          const localStats = await getDashboardStats(user);
          setStats(localStats);
          setDbStatus('Mode Lokal');
      }

    } catch (error) {
      console.error("Error fetching dashboard data", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshRealtimeData();
      setIsLoading(false);
    };
    init();

    // Listen to sync events
    const handleSync = (e: any) => {
        refreshRealtimeData();
        if (e.detail === 'error') setDbStatus('Sync Error');
        else if (e.detail === 'success') setDbStatus('Turso Cloud');
    };
    
    // Periodically check connection
    const intervalId = setInterval(async () => {
        if (navigator.onLine) {
            const isConnected = await checkConnection();
            if (isConnected) {
                setDbStatus('Turso Cloud');
            } else {
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
    }, 30000);
    
    window.addEventListener('sync-status', handleSync); 
    window.addEventListener('online', () => refreshRealtimeData());
    window.addEventListener('offline', () => setDbStatus('Mode Lokal'));

    return () => {
        clearInterval(intervalId);
        window.removeEventListener('sync-status', handleSync);
        window.removeEventListener('online', () => refreshRealtimeData());
        window.removeEventListener('offline', () => setDbStatus('Mode Lokal'));
    };
  }, [user]);

  // Helper to get Gender Percentage
  const getGenderPercent = (type: 'Laki-laki' | 'Perempuan') => {
      const data = stats.genderDistribution.find(x => x.name === type);
      const count = data ? data.value : 0;
      return stats.totalStudents > 0 ? Math.round((count / stats.totalStudents) * 100) : 0;
  };

  const getGenderCount = (type: 'Laki-laki' | 'Perempuan') => {
      const data = stats.genderDistribution.find(x => x.name === type);
      return data ? data.value : 0;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Statistik Utama Admin (Agregat Sekolah Realtime) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {isLoading ? (
          // Skeleton for Stats
          Array.from({length: 4}).map((_, i) => (
             <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                   <div className="h-4 bg-gray-200 rounded w-20"></div>
                   <div className="h-6 bg-gray-200 rounded w-10"></div>
                   <div className="h-3 bg-gray-200 rounded w-16"></div>
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
                <span className="text-xs text-gray-400">Rombel Aktif (Global)</span>
              </div>
            </div>

            {/* Total Murid */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-pink-100 rounded-full text-pink-600">
                <GraduationCap size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Murid</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.totalStudents}</h3>
                <span className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp size={12} className="mr-1" /> Terdaftar DB
                </span>
              </div>
            </div>

            {/* Jurnal Terisi */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                <ClipboardList size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Jurnal Terisi</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.filledJournals}</h3>
                <span className="text-xs text-gray-400">Total Entri Guru</span>
              </div>
            </div>

            {/* Kehadiran */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                <CalendarDays size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Kehadiran</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.attendanceRate}%</h3>
                <span className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp size={12} className="mr-1" /> Rata-rata
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* QUICK ACTIONS & DEMOGRAPHICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Actions Panel */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity size={18} className="text-blue-600" /> Aksi Cepat (Quick Actions)
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/teachers" className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition group">
                 <div className="bg-white p-2 rounded-full mb-2 shadow-sm group-hover:scale-110 transition">
                    <Users size={20} className="text-blue-600" />
                 </div>
                 <span className="text-xs font-bold text-blue-800">Kelola Guru</span>
              </Link>
              <Link to="/announcements" className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition group">
                 <div className="bg-white p-2 rounded-full mb-2 shadow-sm group-hover:scale-110 transition">
                    <Megaphone size={20} className="text-purple-600" />
                 </div>
                 <span className="text-xs font-bold text-purple-800">Pengumuman</span>
              </Link>
              <Link to="/backup" className="flex flex-col items-center justify-center p-4 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition group">
                 <div className="bg-white p-2 rounded-full mb-2 shadow-sm group-hover:scale-110 transition">
                    <DatabaseBackup size={20} className="text-indigo-600" />
                 </div>
                 <span className="text-xs font-bold text-indigo-800">Backup Data</span>
              </Link>
              <Link to="/site-settings" className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition group">
                 <div className="bg-white p-2 rounded-full mb-2 shadow-sm group-hover:scale-110 transition">
                    <Globe size={20} className="text-orange-600" />
                 </div>
                 <span className="text-xs font-bold text-orange-800">Identitas Situs</span>
              </Link>
           </div>
        </div>

        {/* Demographic Stats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <GraduationCap size={18} className="text-pink-600" /> Demografi Siswa
           </h3>
           <div className="space-y-6">
              {/* Male */}
              <div>
                 <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">Laki-laki</span>
                    <span className="font-bold text-gray-800">{getGenderCount('Laki-laki')} Siswa</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{width: `${getGenderPercent('Laki-laki')}%`}}></div>
                 </div>
                 <div className="text-right text-xs text-blue-500 mt-1 font-medium">{getGenderPercent('Laki-laki')}%</div>
              </div>

              {/* Female */}
              <div>
                 <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">Perempuan</span>
                    <span className="font-bold text-gray-800">{getGenderCount('Perempuan')} Siswa</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-pink-500 h-2.5 rounded-full" style={{width: `${getGenderPercent('Perempuan')}%`}}></div>
                 </div>
                 <div className="text-right text-xs text-pink-500 mt-1 font-medium">{getGenderPercent('Perempuan')}%</div>
              </div>
           </div>
        </div>

      </div>

      {/* SYSTEM MONITORING & HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: System Status & Pending Approvals */}
          <div className="space-y-6">
              {/* Card 1: Pendaftaran Guru Baru */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 group-hover:opacity-70 transition"></div>
                  
                  <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                          <div className={`p-3 rounded-lg ${pendingCount > 0 ? 'bg-orange-100 text-orange-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                              <ShieldAlert size={24} />
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              pendingCount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                          }`}>
                              {pendingCount > 0 ? 'Perlu Tindakan' : 'Aman'}
                          </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Pendaftaran Guru Baru</h3>
                      <p className="text-sm text-gray-500 mb-4">
                          {pendingCount > 0 
                              ? `Terdapat ${pendingCount} guru baru yang menunggu verifikasi akun.` 
                              : 'Tidak ada permintaan pendaftaran guru baru saat ini.'}
                      </p>
                      
                      <Link 
                          to="/teachers" 
                          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                          Kelola Pendaftaran <ChevronRight size={16} />
                      </Link>
                  </div>
              </div>

              {/* Card 2: Status Sistem */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
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
                          <p className="text-xs text-gray-500">
                              {dbStatus === 'Turso Cloud' ? 'Terhubung ke Cloud (Realtime)' : 
                               dbStatus === 'Mode Lokal' ? 'Offline / Local Storage Only' : 
                               dbStatus === 'Checking...' ? 'Memeriksa koneksi...' :
                               'Gagal terhubung ke Cloud'}
                          </p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
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
          </div>

          {/* Right: Recent Activity Log (Real-time) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <Activity size={18} className="text-blue-600" /> Aktivitas Terkini
                  </h3>
                  <div className="flex items-center gap-2">
                      <button onClick={refreshRealtimeData} className="text-gray-400 hover:text-blue-600 p-1 rounded transition" title="Refresh Log">
                          <RefreshCcw size={14} />
                      </button>
                      <Link to="/system-logs" className="text-xs text-blue-600 font-medium hover:underline">
                          Lihat Lengkap
                      </Link>
                  </div>
              </div>
              <div className="p-4 flex-1 overflow-y-auto min-h-[250px]">
                  {recentLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                          <Activity size={32} className="mb-2 opacity-20" />
                          <p>Belum ada aktivitas tercatat.</p>
                          <button onClick={refreshRealtimeData} className="mt-2 text-xs text-blue-500 underline">Refresh Manual</button>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {recentLogs.map((log) => (
                              <div key={log.id} className="flex gap-3 items-start group">
                                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                      log.level === 'ERROR' ? 'bg-red-500' : 
                                      log.level === 'WARNING' ? 'bg-yellow-500' : 
                                      (log.action || '').includes('Delete') ? 'bg-red-400' :
                                      (log.action || '').includes('Update') ? 'bg-blue-500' : 'bg-green-500'
                                  }`}></div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start">
                                          <p className="text-sm text-gray-800 font-semibold truncate pr-2">
                                              {log.action}
                                          </p>
                                          <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded">
                                              <Clock size={10} />
                                              {new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                          </span>
                                      </div>
                                      <p className="text-xs text-gray-500 truncate mt-0.5">
                                          <span className="font-medium text-gray-700">{log.actor}</span>: {log.details}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
