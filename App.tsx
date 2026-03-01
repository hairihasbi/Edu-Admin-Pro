
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { User, UserRole, Notification } from './types';
import HomePage from './components/HomePage'; 
import AdminDashboard from './components/AdminDashboard';
import AdminTeachers from './components/AdminTeachers';
import AdminSettings from './components/AdminSettings';
import AdminSiteSettings from './components/AdminSiteSettings'; // Import New Component
import AdminSystemLogs from './components/AdminSystemLogs';
import AdminStudents from './components/AdminStudents'; 
import AdminAnnouncements from './components/AdminAnnouncements';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherProfile from './components/TeacherProfile';
import TeacherHomeroom from './components/TeacherHomeroom';
import TeacherClasses from './components/TeacherClasses';
import TeacherAttendance from './components/TeacherAttendance';
import TeacherScopeMaterial from './components/TeacherScopeMaterial';
import TeacherSummative from './components/TeacherSummative';
import TeacherJournal from './components/TeacherJournal';
import TeacherGuidance from './components/TeacherGuidance'; 
import TeacherRPPGenerator from './components/TeacherRPPGenerator'; 
import BackupRestore from './components/BackupRestore'; 
import TeacherDonation from './components/TeacherDonation'; 
import TeacherGenQuiz from './components/TeacherGenQuiz'; 
import HelpCenter from './components/HelpCenter'; 
import BroadcastPage from './components/BroadcastPage';
import SyncPage from './components/SyncPage'; // Import SyncPage
import DailyPicket from './components/DailyPicket'; // Import DailyPicket
import DonationHistory from './components/DonationHistory'; // Import DonationHistory
import NotificationPanel from './components/NotificationPanel';
import Breadcrumbs from './components/Breadcrumbs';
import { initDatabase, loginUser, resetPassword, registerUser, getNotifications, createNotification, markNotificationAsRead, clearNotifications, getSystemSettings, syncAllData, checkSchoolNameByNpsn } from './services/database';
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  Lock, 
  User as UserIcon, 
  GraduationCap, 
  Bell, 
  BookOpen, 
  CalendarCheck, 
  List, 
  Calculator, 
  NotebookPen, 
  ChevronLeft, 
  DatabaseBackup, 
  Heart, 
  FileQuestion,
  UserPlus,
  Settings,
  Activity,
  LifeBuoy,
  ShieldAlert,
  UserCheck,
  DownloadCloud,
  RefreshCcw,
  Wifi,
  WifiOff,
  Smartphone,
  Send,
  BrainCircuit,
  Megaphone,
  Database,
  Globe,
  Cloud, 
  CheckCircle,
  ArrowLeftRight,
  School,
  CreditCard // Import CreditCard
} from './components/Icons';

// Konstanta Timeout: 15 Menit
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

const AppContent: React.FC = () => {
  // ... existing state ...
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Register State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNpsn, setRegNpsn] = useState(''); // NEW NPSN State
  const [regSchoolName, setRegSchoolName] = useState(''); // NEW School Name State
  const [regTeacherType, setRegTeacherType] = useState<'MAPEL' | 'BK' | 'CLASS'>('MAPEL');
  const [regPhase, setRegPhase] = useState<'A' | 'B' | 'C'>('A'); // NEW Phase State
  const [regMessage, setRegMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // NPSN Check State
  const [isCheckingNpsn, setIsCheckingNpsn] = useState(false);
  const [isSchoolFound, setIsSchoolFound] = useState(false);

  // Reset Password State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [hasUnsaved, setHasUnsaved] = useState(false); // NEW STATE for unsaved changes
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWA, setIsPWA] = useState(false);
  
  // App Config State (Logo/Title)
  const [appConfig, setAppConfig] = useState({
      name: 'EduAdmin Pro',
      logoUrl: ''
  });
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Session Timer Ref
  const sessionTimerRef = useRef<any>(null);

  // Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // --- LOGOUT HANDLER ---
  const handleLogout = useCallback(() => {
    localStorage.removeItem('eduadmin_user');
    setCurrentUser(null);
    setIsSidebarOpen(false);
    setIsNotifPanelOpen(false);
    if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
    }
    navigate('/login');
  }, [navigate]);

  // --- INITIALIZATION & SYSTEM SETTINGS ---
  useEffect(() => {
    let isMounted = true;

    // Check PWA Mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
        setIsPWA(true);
    }

    const init = async () => {
      const timeoutId = setTimeout(() => {
        if (isMounted && isLoading) {
          console.warn("Initialization timed out, forcing app load.");
          setIsLoading(false);
        }
      }, 15000); // INCREASED TO 15 SECONDS

      try {
        await initDatabase();
        
        // Load System Settings and Apply
        const settings = await getSystemSettings();
        if (settings) {
            // Apply Title
            if (settings.appName) {
                document.title = settings.appName;
                if(isMounted) setAppConfig(prev => ({ ...prev, name: settings.appName! }));
            }
            if (settings.logoUrl && isMounted) {
                setAppConfig(prev => ({ ...prev, logoUrl: settings.logoUrl! }));
            }
            // Apply Favicon
            if (settings.faviconUrl) {
                let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = settings.faviconUrl;
            }
            // Apply Meta Description (SEO)
            if (settings.appDescription) {
                let meta = document.querySelector("meta[name='description']");
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('name', 'description');
                    document.getElementsByTagName('head')[0].appendChild(meta);
                }
                meta.setAttribute('content', settings.appDescription);
            }
        }

        const savedUser = localStorage.getItem('eduadmin_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if(isMounted) {
                setCurrentUser(parsedUser);
                refreshNotifications(parsedUser.role);
                // FORCE SYNC ON LOAD (Critical fix for multi-browser support)
                syncAllData(true).catch(e => console.warn("Initial sync failed", e));
            }
          } catch (e) {
            localStorage.removeItem('eduadmin_user');
          }
        }
      } catch (error) {
        console.error("Critical Initialization Error:", error);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    const handleSyncStatus = (e: any) => {
        setSyncStatus(e.detail);
        if (e.detail === 'success' && currentUser) {
            refreshNotifications(currentUser.role);
        }
    };
    
    // NEW Listener for Unsaved Changes
    const handleUnsavedStatus = (e: any) => {
        setHasUnsaved(e.detail);
    };

    // NEW Listener for Auth Errors (401 from API)
    const handleAuthError = () => {
        // Prevent alert if user already logged out (manual logout race condition)
        if (!localStorage.getItem('eduadmin_user')) return;

        console.warn("Session expired or invalid (401). Triggering auto-logout.");
        alert("Sesi Anda telah berakhir atau akun tidak ditemukan di server. Silakan login kembali.");
        handleLogout();
    };
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('sync-status', handleSyncStatus);
    window.addEventListener('unsaved-changes', handleUnsavedStatus);
    window.addEventListener('auth-error', handleAuthError); // Register Auth Listener
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      isMounted = false;
      window.removeEventListener('sync-status', handleSyncStatus);
      window.removeEventListener('unsaved-changes', handleUnsavedStatus);
      window.removeEventListener('auth-error', handleAuthError);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [handleLogout]); // Add handleLogout to dependencies

  // --- AUTOMATIC SYNC HEARTBEAT ---
  // Runs every 15 seconds to ensure data flows between Guru <-> Admin
  useEffect(() => {
      if (!currentUser) return;
      
      const syncInterval = setInterval(() => {
          if (navigator.onLine) {
              console.log("Auto-Sync Triggered");
              syncAllData(false).catch(() => {}); // Silent sync
              refreshNotifications(currentUser.role);
          }
      }, 15000); // 15 Seconds Interval

      return () => clearInterval(syncInterval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const resetSessionTimer = () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => {
        alert("Sesi Anda telah berakhir karena tidak ada aktivitas selama 15 menit. Silakan login kembali.");
        handleLogout();
      }, SESSION_TIMEOUT_MS);
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const onUserActivity = () => {
        resetSessionTimer();
    };
    events.forEach(event => {
        window.addEventListener(event, onUserActivity);
    });
    resetSessionTimer();
    return () => {
        if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
        events.forEach(event => {
            window.removeEventListener(event, onUserActivity);
        });
    };
  }, [currentUser, handleLogout]);

  // ... existing Handlers (Notif, Install, Auth) ...
  const refreshNotifications = async (role: UserRole) => {
      const data = await getNotifications(role);
      setNotifications(data);
  };

  const addNotificationHandler = async (title: string, message: string, type: Notification['type'] = 'info', targetRole: Notification['targetRole'] = 'ALL') => {
    await createNotification(title, message, type, targetRole);
    if (currentUser) refreshNotifications(currentUser.role);
  };

  const markAsReadHandler = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const clearAllNotificationsHandler = async () => {
    if (currentUser) {
        await clearNotifications(currentUser.role);
        setNotifications([]);
    }
  };

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const user = await loginUser(loginUsername, loginPassword);
      if (user) {
        localStorage.setItem('eduadmin_user', JSON.stringify(user));
        setCurrentUser(user);
        setLoginUsername('');
        setLoginPassword('');
        refreshNotifications(user.role);
        // FORCE SYNC ON LOGIN (Critical fix for multi-browser support)
        syncAllData(true).catch(e => console.warn("Sync after login failed", e));
        navigate('/dashboard');
      } else {
        setLoginError('Username atau password salah.');
      }
    } catch (err) {
        if(err instanceof Error) setLoginError(err.message);
        else setLoginError('Terjadi kesalahan koneksi.');
    }
  };

  const handleNpsnBlur = async () => {
      if (regNpsn.length < 8) return;
      setIsCheckingNpsn(true);
      const result = await checkSchoolNameByNpsn(regNpsn);
      if (result.found && result.schoolName) {
          setRegSchoolName(result.schoolName);
          setIsSchoolFound(true);
      } else {
          setIsSchoolFound(false);
          // Keep existing input if any, or allow manual
      }
      setIsCheckingNpsn(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegMessage(null);
    if (regPassword.length < 6) {
        setRegMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
        return;
    }
    if (!regNpsn) {
        setRegMessage({ type: 'error', text: 'NPSN Sekolah Wajib Diisi.' });
        return;
    }
    if (!regSchoolName) {
        setRegMessage({ type: 'error', text: 'Nama Sekolah Wajib Diisi.' });
        return;
    }
    
    // Tentukan Subject Awal berdasarkan Pilihan Jenis Guru
    let initialSubject = '';
    if (regTeacherType === 'BK') initialSubject = 'Bimbingan Konseling';
    if (regTeacherType === 'CLASS') initialSubject = 'GURU KELAS';

    const result = await registerUser(
        regFullName, regUsername, regPassword, regEmail, regPhone, regNpsn, regSchoolName, 
        initialSubject, 
        regTeacherType === 'CLASS' ? 'CLASS' : 'SUBJECT', 
        regTeacherType === 'CLASS' ? regPhase : undefined
    );
    
    if (result.success) {
        setRegMessage({ type: 'success', text: result.message });
        setTimeout(() => { 
            setIsRegisterMode(false); 
            setRegMessage(null); 
            setRegFullName(''); 
            setRegUsername(''); 
            setRegPassword(''); 
            setRegEmail(''); 
            setRegPhone(''); 
            setRegNpsn('');
            setRegSchoolName('');
            setIsSchoolFound(false);
            setRegTeacherType('MAPEL');
            setRegPhase('A');
        }, 3000);
    } else {
        setRegMessage({ type: 'error', text: result.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await resetPassword(resetUsername, newPassword);
    if (success) {
      setResetMessage({ type: 'success', text: 'Password berhasil diubah! Silakan login.' });
      setTimeout(() => { setIsResetMode(false); setResetMessage(null); setResetUsername(''); setNewPassword(''); }, 2000);
    } else {
      setResetMessage({ type: 'error', text: 'Username tidak ditemukan atau gagal mengubah password.' });
    }
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('eduadmin_user', JSON.stringify(updatedUser));
  };

  const NavLink = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
    return (
      <Link 
        to={to}
        onClick={() => setIsSidebarOpen(false)}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
          isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Icon size={20} />
        <span>{label}</span>
      </Link>
    );
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Dashboard';
    if (path.includes('teachers')) return 'Manajemen Guru';
    if (path.includes('students')) return 'Manajemen Siswa';
    if (path.includes('classes')) return 'Manajemen Kelas';
    if (path.includes('attendance')) return 'Daftar Hadir';
    if (path.includes('scope-material')) return 'Lingkup Materi';
    if (path.includes('journal')) return 'Jurnal Mengajar';
    if (path.includes('summative')) return 'Asesmen Sumatif';
    if (path.includes('profile')) return 'Profil & Akun';
    if (path.includes('site-settings')) return 'Pengaturan Situs'; // NEW TITLE
    if (path.includes('settings')) return 'Konfigurasi Sistem';
    if (path.includes('system-logs')) return 'System Logs';
    if (path.includes('announcements')) return 'Live Announcements';
    if (path.includes('backup')) return 'Backup & Restore';
    if (path.includes('donation')) return 'Dukungan Aplikasi';
    if (path.includes('gen-quiz')) return 'AI Generator Soal';
    if (path.includes('rpp-generator')) return 'AI RPP Generator'; 
    if (path.includes('help-center')) return 'Pusat Bantuan';
    if (path.includes('guidance')) return 'Bimbingan Konseling';
    if (path.includes('broadcast')) return 'Broadcast WhatsApp';
    if (path.includes('sync')) return 'Sinkronisasi Data'; // NEW
    return appConfig.name || 'EduAdmin';
  };

  // --- CONNECTION STATUS HELPER ---
  const getConnectionStatus = () => {
    if (!isOnline) {
      return { 
        label: 'Mode Lokal (Offline)', 
        color: 'bg-gray-100 text-gray-600 border border-gray-200', 
        icon: <WifiOff size={14} className="text-gray-500" /> 
      };
    }
    if (syncStatus === 'error') {
      return { 
        label: 'Sync Gagal', 
        color: 'bg-red-50 text-red-600 border border-red-200', 
        icon: <WifiOff size={14} className="text-red-500" /> 
      };
    }
    if (syncStatus === 'syncing') {
      return { 
        label: 'Sinkronisasi...', 
        color: 'bg-blue-50 text-blue-600 border border-blue-200', 
        icon: <RefreshCcw size={14} className="animate-spin text-blue-500" /> 
      };
    }
    // NEW: Unsaved changes check when online
    if (hasUnsaved) {
       return {
        label: 'Belum Tersimpan', 
        color: 'bg-orange-50 text-orange-700 border border-orange-200 animate-pulse', 
        icon: <Cloud size={14} className="text-orange-500" /> 
       };
    }
    return { 
      label: 'Data Aman (Cloud)', 
      color: 'bg-green-50 text-green-700 border border-green-200', 
      icon: <CheckCircle size={14} className="text-green-600" /> 
    };
  };

  const connStatus = getConnectionStatus();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 flex-col gap-3"><RefreshCcw className="animate-spin text-blue-500" size={32}/><span>Memuat Aplikasi...</span></div>;

  if (!currentUser) {
    // ... public routes return ...
    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={
          <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-8 text-center relative">
                   <Link to="/" className="absolute top-4 left-4 text-blue-100 hover:text-white transition">
                      <ChevronLeft size={24} />
                   </Link>
                   <h1 className="text-3xl font-bold text-white mb-2">{appConfig.name}</h1>
                   <p className="text-blue-100">Sistem Administrasi Sekolah Terpadu</p>
                </div>
                
                <div className="p-8">
                  {/* ... Login/Register Forms ... */}
                  {isRegisterMode ? (
                     <form onSubmit={handleRegister} className="space-y-4">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Daftar Guru Baru</h2>
                        {regMessage && <div className={`p-3 rounded-lg text-sm mb-4 ${regMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{regMessage.text}</div>}
                        
                        {/* Pilihan Jenis Guru */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Guru</label>
                            <div className="grid grid-cols-3 gap-3">
                                <label className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === 'MAPEL' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-300 hover:bg-gray-50'}`}>
                                    <input type="radio" className="hidden" checked={regTeacherType === 'MAPEL'} onChange={() => setRegTeacherType('MAPEL')} />
                                    <BookOpen size={18} className={regTeacherType === 'MAPEL' ? 'text-blue-600' : 'text-gray-400'} />
                                    <span className={`text-xs font-medium text-center ${regTeacherType === 'MAPEL' ? 'text-blue-700' : 'text-gray-600'}`}>Guru Mapel</span>
                                </label>
                                <label className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === 'CLASS' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-300 hover:bg-gray-50'}`}>
                                    <input type="radio" className="hidden" checked={regTeacherType === 'CLASS'} onChange={() => setRegTeacherType('CLASS')} />
                                    <Users size={18} className={regTeacherType === 'CLASS' ? 'text-green-600' : 'text-gray-400'} />
                                    <span className={`text-xs font-medium text-center ${regTeacherType === 'CLASS' ? 'text-green-700' : 'text-gray-600'}`}>Guru Kelas (SD)</span>
                                </label>
                                <label className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === 'BK' ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-300 hover:bg-gray-50'}`}>
                                    <input type="radio" className="hidden" checked={regTeacherType === 'BK'} onChange={() => setRegTeacherType('BK')} />
                                    <ShieldAlert size={18} className={regTeacherType === 'BK' ? 'text-purple-600' : 'text-gray-400'} />
                                    <span className={`text-xs font-medium text-center ${regTeacherType === 'BK' ? 'text-purple-700' : 'text-gray-600'}`}>Guru BK</span>
                                </label>
                            </div>
                        </div>

                        {/* Pilihan Fase (Khusus Guru Kelas) */}
                        {regTeacherType === 'CLASS' && (
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                <label className="block text-sm font-medium text-green-800 mb-2">Pilih Fase / Kelas</label>
                                <select 
                                    className="w-full p-2 border border-green-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    value={regPhase}
                                    onChange={(e) => setRegPhase(e.target.value as any)}
                                >
                                    <option value="A">Fase A (Kelas 1 - 2)</option>
                                    <option value="B">Fase B (Kelas 3 - 4)</option>
                                    <option value="C">Fase C (Kelas 5 - 6)</option>
                                </select>
                                <p className="text-xs text-green-600 mt-1">
                                    *Menentukan mata pelajaran yang akan muncul (IPAS hanya di Fase B & C).
                                </p>
                            </div>
                        )}

                        {/* Input NPSN & School Name Logic */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sekolah</label>
                            <div className="space-y-2">
                                <div className="relative">
                                    <School className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        required 
                                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        placeholder="NPSN (8 Digit)" 
                                        value={regNpsn} 
                                        onChange={e => setRegNpsn(e.target.value)}
                                        onBlur={handleNpsnBlur}
                                        maxLength={8}
                                    />
                                    {isCheckingNpsn && (
                                        <div className="absolute right-3 top-2.5">
                                            <RefreshCcw className="animate-spin text-blue-500" size={16} />
                                        </div>
                                    )}
                                </div>
                                <input 
                                    type="text" 
                                    required 
                                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${isSchoolFound ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
                                    placeholder="Nama Sekolah" 
                                    value={regSchoolName} 
                                    onChange={e => setRegSchoolName(e.target.value)}
                                    readOnly={isSchoolFound}
                                />
                                {isSchoolFound && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12}/> Data sekolah ditemukan.</p>}
                            </div>
                        </div>

                        <input type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Nama Lengkap" value={regFullName} onChange={e => setRegFullName(e.target.value)} />
                        
                        <input type="email" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        <input type="tel" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="No. WhatsApp (Aktif)" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                        <input type="text" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Username" value={regUsername} onChange={e => setRegUsername(e.target.value)} />
                        <input type="password" required className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                        
                        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700">Daftar Sekarang</button>
                        <button type="button" onClick={() => setIsRegisterMode(false)} className="text-sm text-gray-600 hover:text-blue-600 w-full text-center mt-2">Sudah punya akun? Login</button>
                     </form>
                  ) : !isResetMode ? (
                    <form onSubmit={handleLogin} className="space-y-6">
                      <h2 className="text-2xl font-semibold text-gray-800">Masuk Akun</h2>
                      {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{loginError}</div>}
                      <input type="text" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                      <input type="password" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                      <div className="flex justify-between text-sm"><button type="button" onClick={() => setIsRegisterMode(true)} className="text-blue-600">Daftar Guru</button><button type="button" onClick={() => setIsResetMode(true)} className="text-gray-500">Lupa Password?</button></div>
                      <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg">Masuk</button>
                    </form>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-6">
                      <h2 className="text-2xl font-semibold text-gray-800">Reset Password</h2>
                      {resetMessage && <div className={`p-3 rounded-lg text-sm ${resetMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{resetMessage.text}</div>}
                      <input type="text" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Username" value={resetUsername} onChange={e => setResetUsername(e.target.value)} />
                      <input type="password" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="Password Baru" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <div className="flex gap-2"><button type="button" onClick={() => setIsResetMode(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">Batal</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Simpan</button></div>
                    </form>
                  )}
                </div>
             </div>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="h-20 flex items-center justify-center border-b border-gray-100 px-4">
            {appConfig.logoUrl ? (
                <img src={appConfig.logoUrl} alt="Logo" className="max-h-12 max-w-full object-contain" />
            ) : (
                <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                    <GraduationCap /> EduAdmin
                </h1>
            )}
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <NavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            
            {currentUser.role === UserRole.ADMIN && (
              <>
                <NavLink to="/teachers" icon={Users} label="Manajemen Guru" />
                <NavLink to="/students" icon={GraduationCap} label="Data Siswa" />
                <NavLink to="/announcements" icon={Megaphone} label="Live Announcements" /> 
                <NavLink to="/broadcast" icon={Send} label="Broadcast WhatsApp" />
                <NavLink to="/backup" icon={DatabaseBackup} label="Backup & Restore" />
                <NavLink to="/donations" icon={CreditCard} label="Riwayat Donasi" /> {/* NEW LINK */}
                <NavLink to="/sync" icon={ArrowLeftRight} label="Sinkronisasi Data" /> {/* NEW LINK */}
                <NavLink to="/site-settings" icon={Globe} label="Pengaturan Situs" /> 
                <NavLink to="/settings" icon={Settings} label="Konfigurasi Sistem" />
                <NavLink to="/system-logs" icon={Activity} label="System Logs" />
                <NavLink to="/help-center" icon={LifeBuoy} label="Pusat Bantuan" />
                <NavLink to="/profile" icon={UserIcon} label="Profil Saya" />
              </>
            )}

            {currentUser.role === UserRole.GURU && (
              <>
                <NavLink to="/classes" icon={BookOpen} label="Manajemen Kelas" />
                {currentUser.homeroomClassId && (
                   <NavLink to="/homeroom" icon={Users} label="Wali Kelas" />
                )}
                <NavLink to="/picket" icon={CalendarCheck} label="Piket Harian" /> {/* NEW LINK */}
                {currentUser.subject === 'Bimbingan Konseling' && (
                   <NavLink to="/guidance" icon={ShieldAlert} label="Bimbingan Konseling" />
                )}
                <NavLink to="/attendance" icon={CalendarCheck} label="Daftar Hadir" />
                <NavLink to="/scope-material" icon={List} label="Lingkup Materi" />
                <NavLink to="/journal" icon={NotebookPen} label="Jurnal Mengajar" />
                <NavLink to="/summative" icon={Calculator} label="Asesmen Sumatif" />
                <NavLink to="/rpp-generator" icon={BrainCircuit} label="AI RPP Generator" /> 
                <NavLink to="/gen-quiz" icon={FileQuestion} label="AI Generator Soal" />
                <NavLink to="/broadcast" icon={Send} label="Broadcast WhatsApp" />
                <NavLink to="/sync" icon={ArrowLeftRight} label="Sinkronisasi Data" /> {/* NEW LINK */}
                <NavLink to="/backup" icon={DatabaseBackup} label="Backup & Restore" />
                <NavLink to="/help-center" icon={LifeBuoy} label="Pusat Bantuan" />
                <NavLink to="/profile" icon={UserIcon} label="Profil & Akun" />
                <NavLink to="/donation" icon={Heart} label="Dukungan Aplikasi" />
              </>
            )}
          </nav>
          
          <div className="p-4 border-t border-gray-100 space-y-2">
            {deferredPrompt && (
              <button onClick={handleInstallClick} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition mb-2">
                <DownloadCloud size={18} /><span>Install Aplikasi</span>
              </button>
            )}
            <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
              <LogOut size={18} /><span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* ... Header ... */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 z-30">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden text-gray-500 hover:text-gray-700"><Menu size={24} /></button>
              <h2 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h2>
           </div>

           <div className="flex items-center gap-4">
              {/* PWA Badge (NEW) */}
              {isPWA && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm bg-purple-50 text-purple-700 border border-purple-200" title="Aplikasi Terinstall (PWA)">
                      <DownloadCloud size={14} className="text-purple-600" />
                      <span>APP / PWA</span>
                  </div>
              )}

              {/* Database Connection Status Label (Enhanced with Unsaved Indicator) */}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${connStatus.color}`} title={hasUnsaved ? "Ada data lokal belum tersimpan ke server" : "Status Database"}>
                 {connStatus.icon}
                 <span>{connStatus.label}</span>
              </div>

              {/* Notification */}
              <div className="relative">
                <button onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition relative">
                   <Bell size={20} />
                   {notifications.filter(n => !n.isRead).length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                </button>
                <NotificationPanel 
                    notifications={notifications} 
                    isOpen={isNotifPanelOpen} 
                    onClose={() => setIsNotifPanelOpen(false)} 
                    onMarkAsRead={markAsReadHandler} 
                    onClearAll={clearAllNotificationsHandler} 
                />
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                 <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-gray-800">{currentUser.fullName}</p>
                    <p className="text-xs text-gray-500">{currentUser.role === UserRole.ADMIN ? 'Administrator' : 'Guru'}</p>
                 </div>
                 <img src={currentUser.avatar} alt="Avatar" className="w-9 h-9 rounded-full border border-gray-200" />
              </div>
           </div>
        </header>

        {/* Page Content */}
        <div className="px-6 py-2 border-b border-gray-100 bg-white">
            <Breadcrumbs />
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6" onClick={() => { setIsNotifPanelOpen(false); if(window.innerWidth < 1024) setIsSidebarOpen(false); }}>
           <Routes>
              {currentUser.role === UserRole.ADMIN ? (
                 <>
                   <Route path="/dashboard" element={<AdminDashboard onPublishAnnouncement={addNotificationHandler} user={currentUser} />} />
                   <Route path="/teachers" element={<AdminTeachers />} />
                   <Route path="/students" element={<AdminStudents />} />
                   <Route path="/announcements" element={<AdminAnnouncements />} />
                   <Route path="/donations" element={<DonationHistory />} /> {/* NEW ROUTE */}
                   <Route path="/broadcast" element={<BroadcastPage user={currentUser} />} />
                   <Route path="/backup" element={<BackupRestore user={currentUser} />} />
                   <Route path="/sync" element={<SyncPage user={currentUser} />} /> {/* NEW ROUTE */}
                   <Route path="/site-settings" element={<AdminSiteSettings />} /> 
                   <Route path="/settings" element={<AdminSettings />} />
                   <Route path="/system-logs" element={<AdminSystemLogs />} />
                   <Route path="/help-center" element={<HelpCenter user={currentUser} />} />
                   <Route path="/profile" element={<TeacherProfile user={currentUser} onUpdateUser={handleProfileUpdate} />} />
                   <Route path="*" element={<Navigate to="/dashboard" replace />} />
                 </>
              ) : (
                 <>
                   <Route path="/dashboard" element={<TeacherDashboard user={currentUser} />} />
                   <Route path="/homeroom" element={<TeacherHomeroom user={currentUser} />} />
                   <Route path="/classes" element={<TeacherClasses user={currentUser} />} />
                   <Route path="/picket" element={<DailyPicket currentUser={currentUser} />} /> {/* NEW ROUTE */}
                   {currentUser.subject === 'Bimbingan Konseling' && <Route path="/guidance" element={<TeacherGuidance user={currentUser} />} />}
                   <Route path="/attendance" element={<TeacherAttendance user={currentUser} />} />
                   <Route path="/scope-material" element={<TeacherScopeMaterial user={currentUser} />} />
                   <Route path="/journal" element={<TeacherJournal user={currentUser} />} />
                   <Route path="/summative" element={<TeacherSummative user={currentUser} />} />
                   <Route path="/gen-quiz" element={<TeacherGenQuiz />} />
                   <Route path="/rpp-generator" element={<TeacherRPPGenerator user={currentUser} />} />
                   <Route path="/broadcast" element={<BroadcastPage user={currentUser} />} />
                   <Route path="/backup" element={<BackupRestore user={currentUser} />} /> 
                   <Route path="/sync" element={<SyncPage user={currentUser} />} /> {/* NEW ROUTE */}
                   <Route path="/help-center" element={<HelpCenter user={currentUser} />} />
                   <Route path="/profile" element={<TeacherProfile user={currentUser} onUpdateUser={handleProfileUpdate} />} />
                   <Route path="/donation" element={<TeacherDonation user={currentUser} />} />
                   <Route path="*" element={<Navigate to="/dashboard" replace />} />
                 </>
              )}
           </Routes>
        </div>
        {/* Bottom Navigation for Mobile */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <Link to="/dashboard" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/dashboard' ? 'text-blue-600' : 'text-gray-500'}`}>
            <LayoutDashboard size={20} />
            <span className="text-[10px] mt-1 font-medium">Home</span>
          </Link>
          
          {currentUser.role === UserRole.GURU ? (
             <>
               <Link to="/classes" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes('/classes') ? 'text-blue-600' : 'text-gray-500'}`}>
                 <BookOpen size={20} />
                 <span className="text-[10px] mt-1 font-medium">Kelas</span>
               </Link>
               <Link to="/journal" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes('/journal') ? 'text-blue-600' : 'text-gray-500'}`}>
                 <NotebookPen size={20} />
                 <span className="text-[10px] mt-1 font-medium">Jurnal</span>
               </Link>
             </>
          ) : (
             <>
               <Link to="/teachers" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes('/teachers') ? 'text-blue-600' : 'text-gray-500'}`}>
                 <Users size={20} />
                 <span className="text-[10px] mt-1 font-medium">Guru</span>
               </Link>
               <Link to="/students" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes('/students') ? 'text-blue-600' : 'text-gray-500'}`}>
                 <GraduationCap size={20} />
                 <span className="text-[10px] mt-1 font-medium">Siswa</span>
               </Link>
             </>
          )}

          <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center justify-center w-full h-full text-gray-500">
            <Menu size={20} />
            <span className="text-[10px] mt-1 font-medium">Menu</span>
          </button>
        </div>
      </main>

      {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
