import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import { User, UserRole, Notification } from "./types";
import HomePage from "./components/HomePage";
import AdminDashboard from "./components/AdminDashboard";
import AdminTeachers from "./components/AdminTeachers";
import AdminSettings from "./components/AdminSettings";
import AdminSiteSettings from "./components/AdminSiteSettings"; // Import New Component
import AdminSystemLogs from "./components/AdminSystemLogs";
import AdminStudents from "./components/AdminStudents";
import AdminAnnouncements from "./components/AdminAnnouncements";
import TeacherDashboard from "./components/TeacherDashboard";
import TeacherProfile from "./components/TeacherProfile";
import TeacherHomeroom from "./components/TeacherHomeroom";
import TeacherClasses from "./components/TeacherClasses";
import TeacherAttendance from "./components/TeacherAttendance";
import TeacherScopeMaterial from "./components/TeacherScopeMaterial";
import TeacherSummative from "./components/TeacherSummative";
import TeacherJournal from "./components/TeacherJournal";
import TeacherGuidance from "./components/TeacherGuidance";
import TeacherRPPGenerator from "./components/TeacherRPPGenerator";
import BackupRestore from "./components/BackupRestore";
import TeacherDonation from "./components/TeacherDonation";
import TeacherGenQuiz from "./components/TeacherGenQuiz";
import HelpCenter from "./components/HelpCenter";
import BroadcastPage from "./components/BroadcastPage";
import SyncPage from "./components/SyncPage"; // Import SyncPage
import DailyPicket from "./components/DailyPicket"; // Import DailyPicket
import { GuruWaliManager } from "./components/GuruWaliManager";
import { GuruWaliMentoring } from "./components/GuruWaliMentoring";
import { Student360View } from "./components/Student360View";
import WakasekMonitoring from "./components/WakasekMonitoring"; // Import WakasekMonitoring
import WakasekAcademicManagement from "./components/WakasekAcademicManagement"; // Import WakasekAcademicManagement
import SupervisionAssessment from "./components/SupervisionAssessment";
import SupervisionResults from "./components/SupervisionResults";
import WakasekScheduleManager from "./components/WakasekScheduleManager"; // Import WakasekScheduleManager
import DonationHistory from "./components/DonationHistory"; // Import DonationHistory
import NotificationPanel from "./components/NotificationPanel";
import LearningStyleManager from "./components/LearningStyleManager";
import StudentAssessment from "./components/StudentAssessment";
import CbtManager from "./components/CbtManager";
import CbtEditor from "./components/CbtEditor";
import CbtResults from "./components/CbtResults";
import CbtExamEnvironment from "./components/CbtExamEnvironment";
import StudentDashboard from "./components/StudentDashboard";
import RfidTerminal from "./components/RfidTerminal";
import RfidOfficerManager from "./components/RfidOfficerManager";
import RfidSecurityManager from "./components/RfidSecurityManager";
import AttendanceMonitoring from "./components/AttendanceMonitoring";
import ProposalPage from "./components/ProposalPage";
import ExtracurricularManager from "./components/ExtracurricularManager";
import CocurricularJournalManager from "./components/CocurricularJournalManager";
import Breadcrumbs from "./components/Breadcrumbs";
import OnboardingTour from "./components/OnboardingTour";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import {
  initDatabase,
  loginUser,
  registerUser,
  getNotifications,
  createNotification,
  markNotificationAsRead,
  clearNotifications,
  getSystemSettings,
  syncAllData,
  checkSchoolNameByNpsn,
  updateUserProfile,
  getUserProfile,
  verifyStudentByNis,
  cleanupOldPhotos,
} from "./services/database";
import { db } from "./services/db";
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
  ChevronDown,
  Search,
  DatabaseBackup,
  Heart,
  FileQuestion,
  Play,
  UserPlus,
  Settings,
  Activity,
  LifeBuoy,
  ShieldAlert,
  UserCheck,
  DownloadCloud,
  RefreshCcw,
  Shield,
  Wifi,
  WifiOff,
  Smartphone,
  Send,
  ClipboardCheck,
  BrainCircuit,
  Megaphone,
  Database,
  Globe,
  Cloud,
  CheckCircle,
  ArrowLeftRight,
  School,
  IdCard,
  CreditCard, // Import CreditCard
  Calendar, // Import Calendar
  Sun,
  Moon,
  Clock,
  FileText,
  Trophy,
  Layers,
} from "./components/Icons";

// Konstanta Timeout: 15 Menit
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 jam inaktif
const REFRESH_PROFILE_INTERVAL = 30000; // 30 detik refresh profile

const AppContent: React.FC = () => {
  // ... existing state ...
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // Login State
  const [loginMode, setLoginMode] = useState<"STAFF" | "STUDENT">("STAFF");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [studentNpsn, setStudentNpsn] = useState("");
  const [studentNis, setStudentNis] = useState("");
  const [loginError, setLoginError] = useState("");

  // Register State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regNpsn, setRegNpsn] = useState(""); // NEW NPSN State
  const [regSchoolName, setRegSchoolName] = useState(""); // NEW School Name State
  const [regTeacherType, setRegTeacherType] = useState<
    "MAPEL" | "BK" | "CLASS" | "TENDIK"
  >("MAPEL");
  const [regPhase, setRegPhase] = useState<"A" | "B" | "C">("A"); // NEW Phase State
  const [regMessage, setRegMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // NPSN Check State
  const [isCheckingNpsn, setIsCheckingNpsn] = useState(false);
  const [isSchoolFound, setIsSchoolFound] = useState(false);

  // Reset Password State
  // Removed as we use dedicated routes now
  // const [isResetMode, setIsResetMode] = useState(false);
  // const [resetUsername, setResetUsername] = useState('');
  // const [newPassword, setNewPassword] = useState('');
  // const [resetMessage, setResetMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("eduadmin_sidebar_groups");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const hasSeenTour = localStorage.getItem("hasSeenTour");
    if (!hasSeenTour) {
      return {
        admin_users: true,
        admin_comm: true,
        admin_config: true,
        admin_system: true,
        admin_account: true,
        kepsek_supervisi: true,
        kepsek_rfid: true,
        kepsek_ekskul: true,
        kepsek_system: true,
        guru_kbm: true,
        guru_ai: true,
        guru_classes: true,
        guru_presence: true,
        guru_manajerial: true,
        guru_utilitas: true,
        tendik_services: true,
        tendik_system: true,
      };
    }
    return {
      admin_users: true,
      kepsek_supervisi: true,
      guru_kbm: true,
      guru_classes: true,
      tendik_services: true,
    };
  });
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "error" | "success"
  >("idle");
  const [hasUnsaved, setHasUnsaved] = useState(false); // NEW STATE for unsaved changes
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWA, setIsPWA] = useState(false);

  // App Config State (Logo/Title)
  const [appConfig, setAppConfig] = useState({
    name: "EduAdmin Pro",
    logoUrl: "",
  });

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Session Timer Ref
  const sessionTimerRef = useRef<any>(null);

  // Track last user activity for automatic sync idle check
  const lastActivityRef = useRef<number>(Date.now());

  // Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // --- LOGOUT HANDLER ---
  const handleLogout = useCallback(() => {
    localStorage.removeItem("eduadmin_user");
    setCurrentUser(null);
    setIsSidebarOpen(false);
    setIsNotifPanelOpen(false);
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    navigate("/login");
  }, [navigate]);

  // --- INITIALIZATION & SYSTEM SETTINGS ---
  useEffect(() => {
    let isMounted = true;

    // Refresh user profile from DB to catch role/status changes (like isSupervisor)
    const refreshUserProfile = async () => {
      if (currentUser && isMounted) {
        try {
          const updatedUser = await getUserProfile(currentUser.id);
          if (
            updatedUser &&
            isMounted &&
            JSON.stringify(updatedUser) !== JSON.stringify(currentUser)
          ) {
            setCurrentUser(updatedUser);
            localStorage.setItem("eduadmin_user", JSON.stringify(updatedUser));
          }
        } catch (e) {
          // Non-critical background refresh failure
        }
      }
    };

    // const profileInterval = setInterval(refreshUserProfile, REFRESH_PROFILE_INTERVAL);

    // Check PWA Mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
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
        await cleanupOldPhotos(); // Cleans up RFID photos from previous days to save space

        // Load System Settings and Apply
        const settings = await getSystemSettings();
        if (settings) {
          // Apply Title
          if (settings.appName) {
            document.title = settings.appName;
            if (isMounted)
              setAppConfig((prev) => ({ ...prev, name: settings.appName! }));
          }
          if (settings.logoUrl && isMounted) {
            setAppConfig((prev) => ({ ...prev, logoUrl: settings.logoUrl! }));
          }
          // Apply Favicon
          if (settings.faviconUrl) {
            let link = document.querySelector(
              "link[rel~='icon']",
            ) as HTMLLinkElement;
            if (!link) {
              link = document.createElement("link");
              link.rel = "icon";
              document.getElementsByTagName("head")[0].appendChild(link);
            }
            link.href = settings.faviconUrl;
          }
          // Apply Meta Description (SEO)
          if (settings.appDescription) {
            let meta = document.querySelector("meta[name='description']");
            if (!meta) {
              meta = document.createElement("meta");
              meta.setAttribute("name", "description");
              document.getElementsByTagName("head")[0].appendChild(meta);
            }
            meta.setAttribute("content", settings.appDescription);
          }
        }

        const savedUser = localStorage.getItem("eduadmin_user");
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (isMounted) {
              setCurrentUser(parsedUser);
              refreshNotifications(parsedUser.role);
              // FORCE SYNC ON LOAD (Critical fix for multi-browser support)
              syncAllData(true).catch((e) =>
                console.warn("Initial sync failed", e),
              );
            }
          } catch (e) {
            localStorage.removeItem("eduadmin_user");
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

    // NEW Listener for Unsaved Changes
    const handleUnsavedStatus = (e: any) => {
      setHasUnsaved(e.detail);
    };

    // NEW Listener for Auth Errors (401 from API)
    const handleAuthError = () => {
      // Prevent alert if user already logged out (manual logout race condition)
      if (!localStorage.getItem("eduadmin_user")) return;

      console.warn("Session expired or invalid (401). Manual logout may be required.");
      // Auto-logout disabled per user request to allow staying logged in during reload/transient errors
      // handleLogout();
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("unsaved-changes", handleUnsavedStatus);
    window.addEventListener("auth-error", handleAuthError); // Register Auth Listener
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      isMounted = false;
      // clearInterval(profileInterval);

      window.removeEventListener("unsaved-changes", handleUnsavedStatus);
      window.removeEventListener("auth-error", handleAuthError);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, [handleLogout]); // Add handleLogout to dependencies

  // --- SYNC STATUS LISTENER (Refreshes User Data) ---
  useEffect(() => {
    const handleSyncStatus = async (e: any) => {
      setSyncStatus(e.detail);

      if (e.detail === "success" && currentUser) {
        refreshNotifications(currentUser.role);

        // CRITICAL: Refresh user data from DB to get latest quota/profile updates
        try {
          const freshUser = await db.users.get(currentUser.id);
          if (freshUser) {
            // Only update if critical fields changed to avoid loops
            if (
              freshUser.rppUsageCount !== currentUser.rppUsageCount ||
              freshUser.rppLastReset !== currentUser.rppLastReset ||
              freshUser.role !== currentUser.role ||
              freshUser.isSupervisor !== currentUser.isSupervisor ||
              freshUser.additionalRole !== currentUser.additionalRole ||
              freshUser.status !== currentUser.status
            ) {
              console.log("[App] Sync updated user data:", freshUser);
              if (freshUser.status !== "ACTIVE" && freshUser.role !== "ADMIN") {
                alert("Akun Anda telah dinonaktifkan oleh Admin. Anda akan dialihkan ke halaman login.");
                handleLogout();
                return;
              }
              setCurrentUser(freshUser);
              localStorage.setItem("eduadmin_user", JSON.stringify(freshUser));
            }
          }
        } catch (err) {
          console.error("Failed to refresh user after sync:", err);
        }
      }
    };

    window.addEventListener("sync-status", handleSyncStatus);
    return () => window.removeEventListener("sync-status", handleSyncStatus);
  }, [currentUser, handleLogout]);

  // --- USER ACTIVITY TRACKER FOR IDLE DETECTOR ---
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, []);

  // --- AUTOMATIC SYNC HEARTBEAT ---
  // Runs every 40 seconds to ensure data flows between Guru <-> Admin
  useEffect(() => {
    if (!currentUser) return;

    let resumeTimeout: NodeJS.Timeout | null = null;

    const handleResume = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && navigator.onLine) {
        // Beri waktu 2 detik agar koneksi I/O jaringan siap setelah tab aktif kembali
        if (resumeTimeout) clearTimeout(resumeTimeout);
        resumeTimeout = setTimeout(() => {
          syncAllData(false).catch(() => {});
          refreshNotifications(currentUser.role);
        }, 2000);
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("online", handleResume);

    const syncInterval = setInterval(() => {
      // Cegah sync saat tab diminimalkan atau sistem tidur (menghindari net::ERR_NETWORK_IO_SUSPENDED)
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      if (navigator.onLine) {
        // 1. Cek apakah pengguna sedang aktif menginput/fokus pada form
        const activeEl = document.activeElement;
        if (activeEl) {
          const tagName = activeEl.tagName.toUpperCase();
          const isInputting = 
            tagName === "INPUT" || 
            tagName === "TEXTAREA" || 
            tagName === "SELECT" || 
            activeEl.hasAttribute("contenteditable") || 
            activeEl.closest("form") !== null;
            
          if (isInputting) {
            console.log("Auto-Sync ditunda karena pengguna sedang mengisi formulir.");
            return;
          }
        }

        // 2. Cek apakah ada aktivitas user dalam 30 detik terakhir (tidak idle)
        const idleDuration = Date.now() - lastActivityRef.current;
        if (idleDuration < 30000) {
          console.log(`Auto-Sync ditunda karena pengguna sedang aktif/bekerja (Idle: ${Math.round(idleDuration / 1000)}s).`);
          return;
        }

        console.log("Auto-Sync Triggered");
        syncAllData(false).catch(() => {}); // Silent sync
        refreshNotifications(currentUser.role);
      }
    }, 40000); // 40 Seconds Interval

    return () => {
      clearInterval(syncInterval);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // SISWA TIDAK ADA TIMEOUT (Request User)
    if (currentUser.role === "SISWA") {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      return;
    }

    const resetSessionTimer = () => {
      // JANGAN LOGOUT jika sedang di halaman Ujian CBT
      const isCbtPage =
        window.location.hash.includes("/cbt/exam/") ||
        window.location.pathname.includes("/cbt/exam/");
      if (isCbtPage) {
        if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
        return;
      }

      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => {
        alert(
          "Sesi Anda telah berakhir karena tidak ada aktivitas selama 15 menit. Silakan login kembali.",
        );
        handleLogout();
      }, SESSION_TIMEOUT_MS);
    };
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    const onUserActivity = () => {
      resetSessionTimer();
    };
    events.forEach((event) => {
      window.addEventListener(event, onUserActivity);
    });
    resetSessionTimer();
    return () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, onUserActivity);
      });
    };
  }, [currentUser, handleLogout]);

  // ... existing Handlers (Notif, Install, Auth) ...
  const refreshNotifications = async (role: UserRole) => {
    const data = await getNotifications(role);
    setNotifications(data);
  };

  const addNotificationHandler = async (
    title: string,
    message: string,
    type: Notification["type"] = "info",
    targetRole: Notification["targetRole"] = "ALL",
  ) => {
    await createNotification(title, message, type, targetRole);
    if (currentUser) refreshNotifications(currentUser.role);
  };

  const markAsReadHandler = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
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
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the install prompt");
        } else {
          console.log("User dismissed the install prompt");
        }
        setDeferredPrompt(null);
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const user = await loginUser(loginUsername, loginPassword);
      if (user) {
        localStorage.setItem("eduadmin_user", JSON.stringify(user));
        setCurrentUser(user);
        setLoginUsername("");
        setLoginPassword("");
        refreshNotifications(user.role);
        // FORCE SYNC ON LOGIN (Critical fix for multi-browser support)
        syncAllData(true).catch((e) =>
          console.warn("Sync after login failed", e),
        );
        navigate("/dashboard");
      } else {
        setLoginError("Username atau password salah.");
      }
    } catch (err) {
      if (err instanceof Error) setLoginError(err.message);
      else setLoginError("Terjadi kesalahan koneksi.");
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!studentNpsn || !studentNis) {
      setLoginError("NPSN dan NIS wajib diisi.");
      return;
    }

    try {
      const user = await verifyStudentByNis(studentNpsn, studentNis);
      if (user) {
        localStorage.setItem("eduadmin_user", JSON.stringify(user));
        setCurrentUser(user);
        setStudentNpsn("");
        setStudentNis("");
        refreshNotifications(user.role);
        navigate("/dashboard");
      } else {
        setLoginError(
          "Data siswa tidak ditemukan. Pastikan NPSN dan NIS benar (Siswa harus sudah didaftarkan oleh guru).",
        );
      }
    } catch (err) {
      if (err instanceof Error) setLoginError(err.message);
      else setLoginError("Gagal memverifikasi data siswa.");
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
      setRegMessage({ type: "error", text: "Password minimal 6 karakter." });
      return;
    }
    if (!regNpsn) {
      setRegMessage({ type: "error", text: "NPSN Sekolah Wajib Diisi." });
      return;
    }
    if (!regSchoolName) {
      setRegMessage({ type: "error", text: "Nama Sekolah Wajib Diisi." });
      return;
    }

    // Tentukan Subject Awal berdasarkan Pilihan Jenis Guru
    let initialSubject = "";
    if (regTeacherType === "BK") initialSubject = "Bimbingan Konseling";
    if (regTeacherType === "CLASS") initialSubject = "GURU KELAS";
    if (regTeacherType === "TENDIK") initialSubject = "TENAGA KEPENDIDIKAN";

    const result = await registerUser(
      regFullName,
      regUsername,
      regPassword,
      regEmail,
      regPhone,
      regNpsn,
      regSchoolName,
      initialSubject,
      regTeacherType === "CLASS" ? "CLASS" : "SUBJECT",
      regTeacherType === "CLASS" ? regPhase : undefined,
      regTeacherType === "TENDIK" ? "TENDIK" : "GURU",
    );

    if (result.success) {
      setRegMessage({ type: "success", text: result.message });
      setTimeout(() => {
        setIsRegisterMode(false);
        setRegMessage(null);
        setRegFullName("");
        setRegUsername("");
        setRegPassword("");
        setRegEmail("");
        setRegPhone("");
        setRegNpsn("");
        setRegSchoolName("");
        setIsSchoolFound(false);
        setRegTeacherType("MAPEL");
        setRegPhase("A");
      }, 3000);
    } else {
      setRegMessage({ type: "error", text: result.message });
    }
  };

  // handleResetPassword removed

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("eduadmin_user", JSON.stringify(updatedUser));
  };

  // NEW: Handle Quota Update (Local Only to avoid race condition with Server)
  const handleQuotaUpdate = async (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("eduadmin_user", JSON.stringify(updatedUser));
    // Update IndexedDB but DO NOT call pushToTurso (api/gemini.ts handles server increment)
    await db.users.put(updatedUser);
  };

  const NavLink = ({
    to,
    icon: Icon,
    label,
    badge,
    isChild = false,
  }: {
    to: string;
    icon: any;
    label: string;
    badge?: string;
    isChild?: boolean;
  }) => {
    const isActive =
      location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        onClick={() => setIsSidebarOpen(false)}
        className={`w-full flex items-center justify-between px-3 ${
          isChild ? "py-2 text-[13px]" : "py-2.5 text-sm"
        } rounded-lg transition-all duration-150 group ${
          isActive
            ? "bg-blue-600 text-white font-medium shadow-xs shadow-blue-500/20 dark:bg-blue-600 dark:text-white"
            : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            size={isChild ? 16 : 18}
            className={`shrink-0 ${
              isActive
                ? "text-white"
                : "text-gray-400 group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-200"
            }`}
          />
          <span className="truncate">{label}</span>
        </div>
        {badge && (
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ml-1 ${
              isActive
                ? "bg-white/20 text-white"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
            }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem("eduadmin_sidebar_groups", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleAllGroups = (expand: boolean, groupIds: string[]) => {
    const next: Record<string, boolean> = {};
    groupIds.forEach((id) => {
      next[id] = expand;
    });
    setOpenGroups(next);
    try {
      localStorage.setItem("eduadmin_sidebar_groups", JSON.stringify(next));
    } catch (e) {}
  };

  interface SidebarNavItem {
    to: string;
    icon: any;
    label: string;
    badge?: string;
  }

  interface SidebarNavGroup {
    id: string;
    title: string;
    icon: any;
    badge?: string;
    items: SidebarNavItem[];
  }

  const getSidebarGroups = (user: User | null): SidebarNavGroup[] => {
    if (!user) return [];

    if (user.role === UserRole.ADMIN) {
      return [
        {
          id: "admin_users",
          title: "Data & Pengguna",
          icon: Users,
          items: [
            { to: "/teachers", icon: Users, label: "Manajemen Guru" },
            { to: "/students", icon: GraduationCap, label: "Data Siswa" },
          ],
        },
        {
          id: "admin_comm",
          title: "Komunikasi & Informasi",
          icon: Megaphone,
          items: [
            { to: "/announcements", icon: Megaphone, label: "Live Announcements" },
            { to: "/broadcast", icon: Send, label: "Broadcast WhatsApp" },
          ],
        },
        {
          id: "admin_config",
          title: "Pengaturan & Konfigurasi",
          icon: Settings,
          items: [
            { to: "/site-settings", icon: Globe, label: "Pengaturan Situs" },
            { to: "/settings", icon: Settings, label: "Konfigurasi Sistem" },
            { to: "/donations", icon: CreditCard, label: "Riwayat Donasi" },
            { to: "/proposal", icon: FileText, label: "Proposal & Fitur" },
          ],
        },
        {
          id: "admin_system",
          title: "Database & Pemeliharaan",
          icon: DatabaseBackup,
          items: [
            { to: "/sync", icon: ArrowLeftRight, label: "Sinkronisasi Data" },
            { to: "/backup", icon: DatabaseBackup, label: "Backup & Restore" },
            { to: "/system-logs", icon: Activity, label: "System Logs" },
          ],
        },
        {
          id: "admin_account",
          title: "Bantuan & Akun",
          icon: LifeBuoy,
          items: [
            { to: "/help-center", icon: LifeBuoy, label: "Pusat Bantuan" },
            { to: "/profile", icon: UserIcon, label: "Profil Saya" },
          ],
        },
      ];
    }

    if (user.role === UserRole.GURU) {
      if (user.additionalRole === "KEPALA_SEKOLAH") {
        const groups: SidebarNavGroup[] = [
          {
            id: "kepsek_supervisi",
            title: "Supervisi Akademik",
            icon: ClipboardCheck,
            items: [
              { to: "/supervision-assessment", icon: ClipboardCheck, label: "Instrumen Supervisi" },
              { to: "/supervision-results", icon: ClipboardCheck, label: "Hasil Supervisi" },
            ],
          },
          {
            id: "kepsek_rfid",
            title: "Presensi & Terminal RFID",
            icon: IdCard,
            items: [
              { to: "/monitoring-kurikulum", icon: Activity, label: "Monitoring RFID & KBM" },
              { to: "/attendance-monitoring", icon: Clock, label: "Monitoring Absensi RFID" },
              { to: "/absensi-rfid", icon: IdCard, label: "Terminal RFID" },
              { to: "/rfid-officers", icon: UserCheck, label: "Petugas RFID" },
            ],
          },
        ];

        if (
          user.isExtracurricularAdvisor &&
          user.extracurriculars &&
          user.extracurriculars.length > 0
        ) {
          groups.push({
            id: "kepsek_ekskul",
            title: "Ekstrakurikuler",
            icon: Trophy,
            items: [{ to: "/extracurricular", icon: Trophy, label: "Pembina Ekskul" }],
          });
        }

        groups.push({
          id: "kepsek_system",
          title: "Sistem, Bantuan & Akun",
          icon: Settings,
          items: [
            { to: "/sync", icon: ArrowLeftRight, label: "Sinkronisasi Data" },
            { to: "/backup", icon: DatabaseBackup, label: "Backup & Restore" },
            { to: "/help-center", icon: LifeBuoy, label: "Pusat Bantuan" },
            { to: "/profile", icon: UserIcon, label: "Profil & Akun" },
            { to: "/donation", icon: Heart, label: "Dukungan Aplikasi" },
          ],
        });

        return groups;
      }

      // Regular Guru / Wakasek / Wali Kelas / BK
      const groups: SidebarNavGroup[] = [
        {
          id: "guru_kbm",
          title: "KBM & Penilaian",
          icon: BookOpen,
          items: [
            { to: "/attendance", icon: CalendarCheck, label: "Daftar Hadir" },
            { to: "/journal", icon: NotebookPen, label: "Jurnal Mengajar" },
            { to: "/scope-material", icon: List, label: "Lingkup Materi" },
            { to: "/summative", icon: Calculator, label: "Asesmen Sumatif" },
            { to: "/cbt", icon: FileQuestion, label: "CBT (Ujian Online)" },
            { to: "/cocurricular-journal", icon: Layers, label: "Jurnal Kokurikuler" },
          ],
        },
        {
          id: "guru_ai",
          title: "Asisten AI Guru",
          icon: BrainCircuit,
          badge: "AI",
          items: [
            { to: "/rpp-generator", icon: BrainCircuit, label: "AI RPP Generator" },
            { to: "/gen-quiz", icon: FileQuestion, label: "AI Generator Soal" },
          ],
        },
        {
          id: "guru_classes",
          title: "Kelas & Bimbingan",
          icon: Users,
          items: [
            { to: "/classes", icon: BookOpen, label: "Manajemen Kelas" },
            ...(user.homeroomClassId
              ? [
                  { to: "/homeroom", icon: Users, label: "Wali Kelas" },
                  { to: "/learning-style", icon: Activity, label: "Gaya Belajar" },
                ]
              : []),
            { to: "/guru-wali-mentoring", icon: UserCheck, label: "Bimbingan Guru Wali" },
            ...(user.subject === "Bimbingan Konseling"
              ? [{ to: "/guidance", icon: ShieldAlert, label: "Bimbingan Konseling" }]
              : []),
          ],
        },
        {
          id: "guru_presence",
          title: "Presensi & Piket",
          icon: CalendarCheck,
          items: [
            { to: "/picket", icon: CalendarCheck, label: "Piket Harian" },
            { to: "/absensi-rfid", icon: IdCard, label: "Terminal RFID" },
            ...(user.additionalRole === "WAKASEK_KURIKULUM" ||
            user.additionalRole === "WALI_KELAS" ||
            user.homeroomClassId ||
            user.isRfidOfficer ||
            user.subject === "Bimbingan Konseling"
              ? [
                  {
                    to: "/attendance-monitoring",
                    icon: Clock,
                    label: "Monitoring Absensi RFID",
                  },
                ]
              : []),
            ...(user.isRfidOfficer
              ? [
                  {
                    to: "/rfid-security",
                    icon: Shield,
                    label: "Manajemen & Keamanan RFID",
                  },
                ]
              : []),
          ],
        },
      ];

      // Manajerial & Kurikulum
      const manajerialItems: SidebarNavItem[] = [];
      if (user.additionalRole === "WAKASEK_KURIKULUM") {
        manajerialItems.push(
          { to: "/monitoring-kurikulum", icon: Activity, label: "Monitoring RFID & KBM" },
          { to: "/academic-management", icon: GraduationCap, label: "Kenaikan & Kelulusan" },
          { to: "/manage-schedules", icon: Calendar, label: "Manajemen Jadwal" },
          { to: "/guru-wali-manager", icon: Users, label: "Manajemen Guru Wali" }
        );
      }
      if (user.isSupervisor || user.additionalRole === "WAKASEK_KURIKULUM") {
        manajerialItems.push({
          to: "/supervision-assessment",
          icon: ClipboardCheck,
          label: "Instrumen Supervisi",
        });
      }
      manajerialItems.push({
        to: "/supervision-results",
        icon: ClipboardCheck,
        label: "Hasil Supervisi",
      });
      if (
        user.isExtracurricularAdvisor &&
        user.extracurriculars &&
        user.extracurriculars.length > 0
      ) {
        manajerialItems.push({
          to: "/extracurricular",
          icon: Trophy,
          label: "Pembina Ekskul",
        });
      }

      if (manajerialItems.length > 0) {
        groups.push({
          id: "guru_manajerial",
          title: "Manajerial & Kurikulum",
          icon: ClipboardCheck,
          items: manajerialItems,
        });
      }

      groups.push({
        id: "guru_utilitas",
        title: "Utilitas & Akun",
        icon: Settings,
        items: [
          { to: "/broadcast", icon: Send, label: "Broadcast WhatsApp" },
          { to: "/sync", icon: ArrowLeftRight, label: "Sinkronisasi Data" },
          { to: "/backup", icon: DatabaseBackup, label: "Backup & Restore" },
          { to: "/help-center", icon: LifeBuoy, label: "Pusat Bantuan" },
          { to: "/profile", icon: UserIcon, label: "Profil & Akun" },
          { to: "/donation", icon: Heart, label: "Dukungan Aplikasi" },
        ],
      });

      return groups;
    }

    if (user.role === UserRole.TENDIK) {
      return [
        {
          id: "tendik_services",
          title: "Layanan & Piket",
          icon: CalendarCheck,
          items: [
            { to: "/picket", icon: CalendarCheck, label: "Piket Harian" },
            { to: "/absensi-rfid", icon: IdCard, label: "Terminal RFID" },
          ],
        },
        {
          id: "tendik_system",
          title: "Utilitas & Akun",
          icon: Settings,
          items: [
            { to: "/sync", icon: ArrowLeftRight, label: "Sinkronisasi Data" },
            { to: "/backup", icon: DatabaseBackup, label: "Backup & Restore" },
            { to: "/help-center", icon: LifeBuoy, label: "Pusat Bantuan" },
            { to: "/profile", icon: UserIcon, label: "Profil & Akun" },
            { to: "/donation", icon: Heart, label: "Dukungan Aplikasi" },
          ],
        },
      ];
    }

    if (user.role === UserRole.SISWA) {
      return [
        {
          id: "siswa_account",
          title: "Akun Siswa",
          icon: UserIcon,
          items: [{ to: "/profile", icon: UserIcon, label: "Profil Saya" }],
        },
      ];
    }

    return [];
  };

  // Automatically expand group containing active route whenever route changes
  useEffect(() => {
    if (!currentUser) return;
    const path = location.pathname;
    const groups = getSidebarGroups(currentUser);
    const activeGroup = groups.find((g) =>
      g.items.some(
        (item) => path === item.to || path.startsWith(item.to + "/")
      )
    );
    if (activeGroup) {
      setOpenGroups((prev) => {
        if (prev[activeGroup.id]) return prev;
        const next = { ...prev, [activeGroup.id]: true };
        try {
          localStorage.setItem("eduadmin_sidebar_groups", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  }, [location.pathname, currentUser]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("dashboard")) return "Dashboard";
    if (path.includes("teachers")) return "Manajemen Guru";
    if (path.includes("students")) return "Manajemen Siswa";
    if (path.includes("classes")) return "Manajemen Kelas";
    if (path.includes("attendance")) return "Daftar Hadir";
    if (path.includes("scope-material")) return "Lingkup Materi";
    if (path.includes("journal")) return "Jurnal Mengajar";
    if (path.includes("summative")) return "Asesmen Sumatif";
    if (path.includes("profile")) return "Profil & Akun";
    if (path.includes("site-settings")) return "Pengaturan Situs"; // NEW TITLE
    if (path.includes("settings")) return "Konfigurasi Sistem";
    if (path.includes("system-logs")) return "System Logs";
    if (path.includes("announcements")) return "Live Announcements";
    if (path.includes("backup")) return "Backup & Restore";
    if (path.includes("cbt/exam")) return "Ujian Online Sedang Berlangsung";
    if (path.includes("cbt")) return "CBT - Computer Based Test";
    if (path.includes("donation")) return "Dukungan Aplikasi";
    if (path.includes("gen-quiz")) return "AI Generator Soal";
    if (path.includes("rpp-generator")) return "AI RPP Generator";
    if (path.includes("help-center")) return "Pusat Bantuan";
    if (path.includes("guidance")) return "Bimbingan Konseling";
    if (path.includes("broadcast")) return "Broadcast WhatsApp";
    if (path.includes("sync")) return "Sinkronisasi Data"; // NEW
    if (path.includes("supervision-assessment")) return "Penilaian Supervisi";
    if (path.includes("supervision-results")) return "Hasil Supervisi";
    if (path.includes("monitoring-kurikulum")) return "Monitoring Kurikulum"; // NEW
    if (path.includes("guru-wali-manager")) return "Manajemen Guru Wali";
    if (path.includes("guru-wali-mentoring")) return "Bimbingan Guru Wali";
    if (path.includes("student-360")) return "Profil 360 Siswa";
    if (path.includes("learning-style")) return "Asesmen Gaya Belajar";
    return appConfig.name || "EduAdmin";
  };

  // --- CONNECTION STATUS HELPER ---
  const getConnectionStatus = () => {
    if (!isOnline) {
      return {
        label: "Mode Lokal (Offline)",
        color: "bg-gray-100 text-gray-600 border border-gray-200",
        icon: <WifiOff size={14} className="text-gray-500" />,
      };
    }
    if (syncStatus === "error") {
      return {
        label: "Sync Gagal",
        color: "bg-red-50 text-red-600 border border-red-200",
        icon: <WifiOff size={14} className="text-red-500" />,
      };
    }
    if (syncStatus === "syncing") {
      return {
        label: "Sinkronisasi...",
        color: "bg-blue-50 text-blue-600 border border-blue-200",
        icon: <RefreshCcw size={14} className="animate-spin text-blue-500" />,
      };
    }
    // NEW: Unsaved changes check when online
    if (hasUnsaved) {
      return {
        label: "Belum Tersimpan",
        color:
          "bg-orange-50 text-orange-700 border border-orange-200 animate-pulse",
        icon: <Cloud size={14} className="text-orange-500" />,
      };
    }
    return {
      label: "Data Aman (Cloud)",
      color: "bg-green-50 text-green-700 border border-green-200",
      icon: <CheckCircle size={14} className="text-green-600" />,
    };
  };

  const connStatus = getConnectionStatus();

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 flex-col gap-3">
        <RefreshCcw className="animate-spin text-blue-500" size={32} />
        <span>Memuat Aplikasi...</span>
      </div>
    );

  if (!currentUser) {
    // ... public routes return ...
    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/asesmen/:classId" element={<StudentAssessment />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/login"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
              <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-8 text-center relative">
                  <Link
                    to="/"
                    className="absolute top-4 left-4 text-blue-100 hover:text-white transition"
                  >
                    <ChevronLeft size={24} />
                  </Link>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {appConfig.name}
                  </h1>
                  <p className="text-blue-100">
                    Sistem Administrasi Sekolah Terpadu
                  </p>
                </div>

                <div className="p-8">
                  {/* Login Mode Switcher */}
                  {!isRegisterMode && (
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                      <button
                        onClick={() => {
                          setLoginMode("STAFF");
                          setLoginError("");
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${loginMode === "STAFF" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <Users size={18} />
                        Guru / Staf
                      </button>
                      <button
                        onClick={() => {
                          setLoginMode("STUDENT");
                          setLoginError("");
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${loginMode === "STUDENT" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <GraduationCap size={18} />
                        Siswa (Ujian)
                      </button>
                    </div>
                  )}

                  {isRegisterMode ? (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                        Daftar Guru Baru
                      </h2>
                      {regMessage && (
                        <div
                          className={`p-3 rounded-lg text-sm mb-4 ${regMessage.type === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                        >
                          {regMessage.text}
                        </div>
                      )}

                      {/* Pilihan Jenis Guru */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jenis Pendaftar
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label
                            className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === "MAPEL" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-gray-300 hover:bg-gray-50"}`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={regTeacherType === "MAPEL"}
                              onChange={() => setRegTeacherType("MAPEL")}
                            />
                            <BookOpen
                              size={18}
                              className={
                                regTeacherType === "MAPEL"
                                  ? "text-blue-600"
                                  : "text-gray-400"
                              }
                            />
                            <span
                              className={`text-xs font-medium text-center ${regTeacherType === "MAPEL" ? "text-blue-700" : "text-gray-600"}`}
                            >
                              Guru Mapel
                            </span>
                          </label>
                          <label
                            className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === "CLASS" ? "border-green-500 bg-green-50 ring-1 ring-green-500" : "border-gray-300 hover:bg-gray-50"}`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={regTeacherType === "CLASS"}
                              onChange={() => setRegTeacherType("CLASS")}
                            />
                            <Users
                              size={18}
                              className={
                                regTeacherType === "CLASS"
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }
                            />
                            <span
                              className={`text-xs font-medium text-center ${regTeacherType === "CLASS" ? "text-green-700" : "text-gray-600"}`}
                            >
                              Guru Kelas (SD)
                            </span>
                          </label>
                          <label
                            className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === "BK" ? "border-purple-500 bg-purple-50 ring-1 ring-purple-500" : "border-gray-300 hover:bg-gray-50"}`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={regTeacherType === "BK"}
                              onChange={() => setRegTeacherType("BK")}
                            />
                            <ShieldAlert
                              size={18}
                              className={
                                regTeacherType === "BK"
                                  ? "text-purple-600"
                                  : "text-gray-400"
                              }
                            />
                            <span
                              className={`text-xs font-medium text-center ${regTeacherType === "BK" ? "text-purple-700" : "text-gray-600"}`}
                            >
                              Guru BK
                            </span>
                          </label>
                          <label
                            className={`flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition ${regTeacherType === "TENDIK" ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-gray-300 hover:bg-gray-50"}`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={regTeacherType === "TENDIK"}
                              onChange={() => setRegTeacherType("TENDIK")}
                            />
                            <Settings
                              size={18}
                              className={
                                regTeacherType === "TENDIK"
                                  ? "text-orange-600"
                                  : "text-gray-400"
                              }
                            />
                            <span
                              className={`text-xs font-medium text-center ${regTeacherType === "TENDIK" ? "text-orange-700" : "text-gray-600"}`}
                            >
                              Tenaga Kependidikan
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Pilihan Fase (Khusus Guru Kelas) */}
                      {regTeacherType === "CLASS" && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                          <label className="block text-sm font-medium text-green-800 mb-2">
                            Pilih Fase / Kelas
                          </label>
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
                            *Menentukan mata pelajaran yang akan muncul (IPAS
                            hanya di Fase B & C).
                          </p>
                        </div>
                      )}

                      {/* Input NPSN & School Name Logic */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sekolah
                        </label>
                        <div className="space-y-2">
                          <div className="relative">
                            <School
                              className="absolute left-3 top-2.5 text-gray-400"
                              size={18}
                            />
                            <input
                              type="text"
                              required
                              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                              placeholder="NPSN (8 Digit)"
                              value={regNpsn}
                              onChange={(e) => setRegNpsn(e.target.value)}
                              onBlur={handleNpsnBlur}
                              maxLength={8}
                            />
                            {isCheckingNpsn && (
                              <div className="absolute right-3 top-2.5">
                                <RefreshCcw
                                  className="animate-spin text-blue-500"
                                  size={16}
                                />
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            required
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${isSchoolFound ? "bg-gray-100 text-gray-600" : "bg-white"}`}
                            placeholder="Nama Sekolah"
                            value={regSchoolName}
                            onChange={(e) => setRegSchoolName(e.target.value)}
                            readOnly={isSchoolFound}
                          />
                          {isSchoolFound && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle size={12} /> Data sekolah ditemukan.
                            </p>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Nama Lengkap"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                      />

                      <input
                        type="email"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                      />
                      <input
                        type="tel"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="No. WhatsApp (Aktif)"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                      />
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Username"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                      />
                      <input
                        type="password"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />

                      <button
                        type="submit"
                        className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700"
                      >
                        Daftar Sekarang
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRegisterMode(false)}
                        className="text-sm text-gray-600 hover:text-blue-600 w-full text-center mt-2"
                      >
                        Sudah punya akun? Login
                      </button>
                    </form>
                  ) : loginMode === "STUDENT" ? (
                    <form onSubmit={handleStudentLogin} className="space-y-6">
                      <div className="text-center mb-4">
                        <h2 className="text-2xl font-semibold text-gray-800">
                          Akses Ujian Siswa
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                          Masukkan NPSN Sekolah dan NIS Anda untuk memulai.
                        </p>
                      </div>

                      {loginError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                          {loginError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="relative">
                          <School
                            className="absolute left-3 top-3 text-gray-400"
                            size={20}
                          />
                          <input
                            type="text"
                            required
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                            placeholder="NPSN Sekolah (8 Digit)"
                            value={studentNpsn}
                            onChange={(e) => setStudentNpsn(e.target.value)}
                            maxLength={8}
                          />
                        </div>
                        <div className="relative">
                          <IdCard
                            className="absolute left-3 top-3 text-gray-400"
                            size={20}
                          />
                          <input
                            type="text"
                            required
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                            placeholder="Nomor Induk Siswa (NIS/NISN)"
                            value={studentNis}
                            onChange={(e) => setStudentNis(e.target.value)}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                      >
                        <Play size={18} fill="currentColor" />
                        Masuk Ke Ruang Ujian
                      </button>

                      <div className="text-center text-xs text-gray-400">
                        <p>
                          *Hanya tersedia jika guru Anda sudah mendaftarkan data
                          siswa di aplikasi.
                        </p>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-6">
                      <h2 className="text-2xl font-semibold text-gray-800">
                        Masuk Akun
                      </h2>
                      {loginError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                          {loginError}
                        </div>
                      )}
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                        placeholder="Username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                      />
                      <input
                        type="password"
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                        placeholder="Password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                      <div className="flex justify-between text-sm">
                        <button
                          type="button"
                          onClick={() => setIsRegisterMode(true)}
                          className="text-blue-600"
                        >
                          Daftar Guru
                        </button>
                        <Link to="/forgot-password" className="text-gray-500">
                          Lupa Password?
                        </Link>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg"
                      >
                        Masuk
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const sidebarGroups = getSidebarGroups(currentUser);
  const allGroupIds = sidebarGroups.map((g) => g.id);
  const areAllOpen =
    sidebarGroups.length > 0 && sidebarGroups.every((g) => openGroups[g.id]);

  const displayedGroups = sidebarSearch.trim()
    ? sidebarGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((item) =>
            item.label.toLowerCase().includes(sidebarSearch.toLowerCase())
          ),
        }))
        .filter((g) => g.items.length > 0)
    : sidebarGroups;

  return (
    <div className="min-h-screen bg-gray-50 flex dark:bg-gray-900 dark:text-gray-100">
      <OnboardingTour user={currentUser} />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} dark:bg-gray-800 dark:border-r dark:border-gray-700`}
      >
        <div className="h-full flex flex-col">
          <div className="h-20 flex items-center justify-center border-b border-gray-100 px-4 dark:border-gray-700">
            {appConfig.logoUrl ? (
              <img
                src={appConfig.logoUrl}
                alt="Logo"
                className="max-h-12 max-w-full object-contain"
              />
            ) : (
              <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2 dark:text-blue-400">
                <GraduationCap /> EduAdmin
              </h1>
            )}
          </div>

          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {/* Top-Level Quick Link */}
            <NavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />

            {/* Quick Search for Menus */}
            {sidebarGroups.length > 1 && (
              <div className="relative pt-1 pb-1">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                />
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Cari menu..."
                  className="w-full pl-8 pr-7 py-1.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-xs rounded-lg border border-transparent focus:border-blue-400 focus:bg-white dark:focus:bg-gray-700 outline-none transition"
                />
                {sidebarSearch && (
                  <button
                    type="button"
                    onClick={() => setSidebarSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs p-0.5"
                    title="Hapus pencarian"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Header with Expand / Collapse All Toggle */}
            {sidebarGroups.length > 0 && !sidebarSearch && (
              <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <span>Kelompok Menu</span>
                <button
                  type="button"
                  onClick={() => toggleAllGroups(!areAllOpen, allGroupIds)}
                  className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold lowercase tracking-normal text-[11px] transition-colors"
                >
                  {areAllOpen ? "tutup semua" : "buka semua"}
                </button>
              </div>
            )}

            {/* Grouped Accordion Navigation */}
            <div className="space-y-1.5 pt-1">
              {displayedGroups.length === 0 ? (
                <div className="text-center py-6 px-3 text-xs text-gray-400 dark:text-gray-500">
                  Tidak ada menu "{sidebarSearch}"
                </div>
              ) : (
                displayedGroups.map((group) => {
                  const isOpen = sidebarSearch
                    ? true
                    : Boolean(openGroups[group.id]);
                  const isGroupActive = group.items.some(
                    (item) =>
                      location.pathname === item.to ||
                      location.pathname.startsWith(item.to + "/")
                  );

                  return (
                    <div key={group.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 select-none ${
                          isGroupActive
                            ? "bg-blue-50/80 text-blue-700 border border-blue-200/70 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60 shadow-xs"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`p-1 rounded-md ${
                              isGroupActive
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/80 dark:text-blue-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            <group.icon size={14} />
                          </div>
                          <span className="truncate">{group.title}</span>
                          {group.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              {group.badge}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              isGroupActive
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {group.items.length}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 text-gray-400 ${
                              isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="pl-2 ml-3.5 border-l-2 border-blue-100 dark:border-gray-700 space-y-1 my-1">
                          {group.items.map((item) => (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              icon={item.icon}
                              label={item.label}
                              badge={item.badge}
                              isChild
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-100 space-y-2">
            {/* Mobile Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition mb-2 lg:hidden dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span>{isDarkMode ? "Mode Terang" : "Mode Gelap"}</span>
            </button>

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition mb-2"
              >
                <DownloadCloud size={18} />
                <span>Install Aplikasi</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
            >
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col dark:bg-gray-900">
        {/* ... Header ... */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 z-30 dark:bg-gray-800 dark:border-b dark:border-gray-700">
          <div className="flex items-center gap-4 overflow-hidden">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[180px] sm:max-w-none">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* PWA Badge (NEW) */}
            {isPWA && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm bg-purple-50 text-purple-700 border border-purple-200"
                title="Aplikasi Terinstall (PWA)"
              >
                <DownloadCloud size={14} className="text-purple-600" />
                <span>APP / PWA</span>
              </div>
            )}

            {/* Database Connection Status Label (Enhanced with Unsaved Indicator) */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${connStatus.color}`}
              title={
                hasUnsaved
                  ? "Ada data lokal belum tersimpan ke server"
                  : "Status Database"
              }
            >
              {connStatus.icon}
              <span>{connStatus.label}</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-full transition"
              title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notification */}
            <div className="relative">
              <button
                onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition relative"
              >
                <Bell size={20} />
                {notifications.filter((n) => !n.isRead).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                )}
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
                <p className="text-sm font-semibold text-gray-800">
                  {currentUser.fullName}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.role === UserRole.ADMIN
                    ? "Administrator"
                    : "Guru"}
                </p>
              </div>
              <img
                src={currentUser.avatar}
                alt="Avatar"
                className="w-9 h-9 rounded-full border border-gray-200"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="px-6 py-2 border-b border-gray-100 bg-white">
          <Breadcrumbs />
        </div>
        <div
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6"
          onClick={() => {
            setIsNotifPanelOpen(false);
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }}
        >
          <Routes>
            {currentUser.role === UserRole.ADMIN ? (
              <>
                <Route
                  path="/dashboard"
                  element={
                    <AdminDashboard
                      onPublishAnnouncement={addNotificationHandler}
                      user={currentUser}
                    />
                  }
                />
                <Route path="/teachers" element={<AdminTeachers />} />
                <Route path="/students" element={<AdminStudents />} />
                <Route path="/announcements" element={<AdminAnnouncements />} />
                <Route path="/donations" element={<DonationHistory />} />{" "}
                {/* NEW ROUTE */}
                <Route
                  path="/broadcast"
                  element={<BroadcastPage user={currentUser} />}
                />
                <Route
                  path="/backup"
                  element={<BackupRestore user={currentUser} />}
                />
                <Route path="/sync" element={<SyncPage user={currentUser} />} />{" "}
                {/* NEW ROUTE */}
                <Route
                  path="/attendance-monitoring"
                  element={<AttendanceMonitoring user={currentUser} />}
                />
                <Route
                  path="/proposal"
                  element={<ProposalPage />}
                />
                <Route
                  path="/extracurricular"
                  element={<ExtracurricularManager user={currentUser} />}
                />
                <Route path="/site-settings" element={<AdminSiteSettings />} />
                <Route path="/settings" element={<AdminSettings />} />
                <Route path="/system-logs" element={<AdminSystemLogs />} />
                <Route
                  path="/help-center"
                  element={<HelpCenter user={currentUser} />}
                />
                <Route
                  path="/profile"
                  element={
                    <TeacherProfile
                      user={currentUser}
                      onUpdateUser={handleProfileUpdate}
                    />
                  }
                />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </>
            ) : currentUser.role === UserRole.TENDIK ? (
              <>
                <Route
                  path="/dashboard"
                  element={<TeacherDashboard user={currentUser} />}
                />
                <Route
                  path="/picket"
                  element={<DailyPicket currentUser={currentUser} />}
                />
                <Route
                  path="/absensi-rfid"
                  element={<RfidTerminal user={currentUser} />}
                />
                <Route
                  path="/backup"
                  element={<BackupRestore user={currentUser} />}
                />
                <Route path="/sync" element={<SyncPage user={currentUser} />} />
                <Route
                  path="/help-center"
                  element={<HelpCenter user={currentUser} />}
                />
                <Route
                  path="/profile"
                  element={
                    <TeacherProfile
                      user={currentUser}
                      onUpdateUser={handleProfileUpdate}
                    />
                  }
                />
                <Route
                  path="/donation"
                  element={<TeacherDonation user={currentUser} />}
                />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </>
            ) : currentUser.role === UserRole.SISWA ? (
              <>
                <Route
                  path="/dashboard"
                  element={<StudentDashboard user={currentUser} />}
                />
                <Route
                  path="/cbt/exam/:examId"
                  element={<CbtExamEnvironment user={currentUser} />}
                />
                <Route
                  path="/profile"
                  element={
                    <TeacherProfile
                      user={currentUser}
                      onUpdateUser={handleProfileUpdate}
                    />
                  }
                />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </>
            ) : (
              <>
                <Route
                  path="/dashboard"
                  element={<TeacherDashboard user={currentUser} />}
                />
                <Route
                  path="/homeroom"
                  element={<TeacherHomeroom user={currentUser} />}
                />
                <Route
                  path="/learning-style"
                  element={<LearningStyleManager user={currentUser} />}
                />
                <Route
                  path="/classes"
                  element={<TeacherClasses user={currentUser} />}
                />
                <Route
                  path="/picket"
                  element={<DailyPicket currentUser={currentUser} />}
                />
                <Route
                  path="/absensi-rfid"
                  element={<RfidTerminal user={currentUser} />}
                />
                {(currentUser.additionalRole === "KEPALA_SEKOLAH" ||
                  currentUser.isRfidOfficer) && (
                  <Route
                    path="/rfid-security"
                    element={<RfidSecurityManager user={currentUser} />}
                  />
                )}
                {(currentUser.additionalRole === "KEPALA_SEKOLAH" ||
                  currentUser.additionalRole === "WAKASEK_KURIKULUM" ||
                  currentUser.homeroomClassId ||
                  currentUser.subject === "Bimbingan Konseling") && (
                  <Route
                    path="/attendance-monitoring"
                    element={<AttendanceMonitoring user={currentUser} />}
                  />
                )}
                {currentUser.additionalRole === "KEPALA_SEKOLAH" && (
                  <Route
                    path="/rfid-officers"
                    element={<RfidOfficerManager user={currentUser} />}
                  />
                )}
                {currentUser.subject === "Bimbingan Konseling" && (
                  <Route
                    path="/guidance"
                    element={<TeacherGuidance user={currentUser} />}
                  />
                )}
                <Route
                  path="/attendance"
                  element={<TeacherAttendance user={currentUser} />}
                />
                <Route
                  path="/cbt"
                  element={<CbtManager user={currentUser} />}
                />
                <Route
                  path="/cbt/editor/:examId"
                  element={<CbtEditor user={currentUser} />}
                />
                <Route
                  path="/cbt/results/:examId"
                  element={<CbtResults user={currentUser} />}
                />
                <Route
                  path="/supervision-results"
                  element={<SupervisionResults user={currentUser} />}
                />
                <Route
                  path="/scope-material"
                  element={<TeacherScopeMaterial user={currentUser} />}
                />
                <Route
                  path="/journal"
                  element={<TeacherJournal user={currentUser} />}
                />
                <Route
                  path="/cocurricular-journal"
                  element={<CocurricularJournalManager user={currentUser} />}
                />
                <Route
                  path="/extracurricular"
                  element={<ExtracurricularManager user={currentUser} />}
                />
                <Route
                  path="/summative"
                  element={<TeacherSummative user={currentUser} />}
                />
                {(currentUser.isSupervisor ||
                  currentUser.additionalRole === "KEPALA_SEKOLAH" ||
                  currentUser.additionalRole === "WAKASEK_KURIKULUM") && (
                  <Route
                    path="/supervision-assessment"
                    element={<SupervisionAssessment user={currentUser} />}
                  />
                )}
                {(currentUser.additionalRole === "KEPALA_SEKOLAH" || 
                  currentUser.additionalRole === "WAKASEK_KURIKULUM") && (
                  <Route
                    path="/monitoring-kurikulum"
                    element={<WakasekMonitoring user={currentUser} />}
                  />
                )}
                {currentUser.additionalRole === "WAKASEK_KURIKULUM" && (
                  <Route
                    path="/academic-management"
                    element={<WakasekAcademicManagement user={currentUser} />}
                  />
                )}
                {currentUser.additionalRole === "WAKASEK_KURIKULUM" && (
                  <Route
                    path="/manage-schedules"
                    element={<WakasekScheduleManager user={currentUser} />}
                  />
                )}
                {currentUser.additionalRole === "WAKASEK_KURIKULUM" && (
                   <Route
                     path="/guru-wali-manager"
                     element={<GuruWaliManager user={currentUser} />}
                   />
                )}
                <Route
                  path="/guru-wali-mentoring"
                  element={<GuruWaliMentoring user={currentUser} />}
                />
                <Route
                  path="/student-360/:studentId"
                  element={<Student360View studentId="" currentUserId={currentUser.id} currentUserRole={currentUser.role} />}
                />
                <Route path="/gen-quiz" element={<TeacherGenQuiz />} />
                <Route
                  path="/rpp-generator"
                  element={
                    <TeacherRPPGenerator
                      user={currentUser}
                      onUpdateUser={handleQuotaUpdate}
                    />
                  }
                />
                <Route
                  path="/broadcast"
                  element={<BroadcastPage user={currentUser} />}
                />
                <Route
                  path="/backup"
                  element={<BackupRestore user={currentUser} />}
                />
                <Route path="/sync" element={<SyncPage user={currentUser} />} />{" "}
                {/* NEW ROUTE */}
                <Route
                  path="/cbt/exam/:examId"
                  element={<CbtExamEnvironment user={currentUser} />}
                />
                <Route
                  path="/help-center"
                  element={<HelpCenter user={currentUser} />}
                />
                <Route
                  path="/profile"
                  element={
                    <TeacherProfile
                      user={currentUser}
                      onUpdateUser={handleProfileUpdate}
                    />
                  }
                />
                <Route
                  path="/donation"
                  element={<TeacherDonation user={currentUser} />}
                />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </>
            )}
          </Routes>
        </div>
        {/* Bottom Navigation for Mobile */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:bg-gray-800 dark:border-gray-700">
          <Link
            to="/dashboard"
            className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === "/dashboard" ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] mt-1 font-medium">Home</span>
          </Link>

          {currentUser.role === UserRole.GURU &&
          currentUser.additionalRole !== "KEPALA_SEKOLAH" ? (
            <>
              <Link
                to="/classes"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/classes") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <BookOpen size={20} />
                <span className="text-[10px] mt-1 font-medium">Kelas</span>
              </Link>
              <Link
                to="/journal"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/journal") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <NotebookPen size={20} />
                <span className="text-[10px] mt-1 font-medium">Jurnal</span>
              </Link>
            </>
          ) : currentUser.role === UserRole.GURU &&
            currentUser.additionalRole === "KEPALA_SEKOLAH" ? (
            <>
              <Link
                to="/attendance-monitoring"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/attendance-monitoring") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <Clock size={20} />
                <span className="text-[10px] mt-1 font-medium">Monitoring</span>
              </Link>
              <Link
                to="/supervision-assessment"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/supervision-assessment") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <ClipboardCheck size={20} />
                <span className="text-[10px] mt-1 font-medium">Supervisi</span>
              </Link>
              <Link
                to="/supervision-results"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/supervision-results") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <ClipboardCheck size={20} />
                <span className="text-[10px] mt-1 font-medium">Hasil</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/teachers"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/teachers") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <Users size={20} />
                <span className="text-[10px] mt-1 font-medium">Guru</span>
              </Link>
              <Link
                to="/students"
                className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.includes("/students") ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                <GraduationCap size={20} />
                <span className="text-[10px] mt-1 font-medium">Siswa</span>
              </Link>
            </>
          )}

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full text-gray-500 dark:text-gray-400"
          >
            <Menu size={20} />
            <span className="text-[10px] mt-1 font-medium">Menu</span>
          </button>
        </div>
      </main>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[55] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
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
