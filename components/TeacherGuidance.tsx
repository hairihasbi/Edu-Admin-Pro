
import React, { useState, useEffect } from 'react';
import { User, Student, ClassRoom, StudentViolation, StudentAchievement, CounselingSession, StudentPointReduction, HomeVisit, ParentCall } from '../types';
import { 
  getClasses, getStudents, 
  getStudentViolations, addStudentViolation, deleteStudentViolation,
  getStudentAchievements, addStudentAchievement, deleteStudentAchievement,
  getCounselingSessions, addCounselingSession, deleteCounselingSession,
  getStudentPointReductions, addStudentPointReduction, deleteStudentPointReduction,
  getHomeVisits, saveHomeVisit, deleteHomeVisit,
  getParentCalls, saveParentCall, deleteParentCall
} from '../services/database';
import { 
  ShieldAlert, Trophy, MessageSquareHeart, Search, Plus, Trash2, 
  CalendarDays, FileWarning, User as UserIcon, AlertTriangle, Printer, FileSpreadsheet, FileText,
  Heart, RefreshCcw, Home, Smartphone, Shield, PieChart, Activity, BarChart3, Clock, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp
} from './Icons';
import { db } from '../services/db';
import * as XLSX from 'xlsx';

interface TeacherGuidanceProps {
  user: User;
}

const TeacherGuidance: React.FC<TeacherGuidanceProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'violations' | 'reductions' | 'achievements' | 'counseling' | 'homeVisits' | 'parentCalls' | 'priority' | 'print' | 'dashboard'>('dashboard');
  
  // New State for Priority Monitor & Dashboard
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [flaggedStudents, setFlaggedStudents] = useState<any[]>([]);
  const [isLoadingPriority, setIsLoadingPriority] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'POINTS' | 'ABSENCE' | 'TARDY'>('ALL');
  const [prioritySearch, setPrioritySearch] = useState('');
  const [expandedAttendanceIds, setExpandedAttendanceIds] = useState<Record<string, boolean>>({});

  const toggleExpandAttendance = (studentId: string) => {
    setExpandedAttendanceIds(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const dayName = days[d.getDay()];
      const dateNum = String(d.getDate()).padStart(2, '0');
      const monthName = months[d.getMonth()];
      const year = d.getFullYear();
      return `${dayName}, ${dateNum} ${monthName} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const m = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${months[m] || parts[1]}`;
    }
    return dateStr;
  };
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allSchoolClasses, setAllSchoolClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]); // For Dropdown (Filtered)
  const [studentMap, setStudentMap] = useState<Record<string, {name: string, className: string, classId: string}>>({}); // For Display (All Owned Students)
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  // Feature Data
  const [violations, setViolations] = useState<StudentViolation[]>([]);
  const [reductions, setReductions] = useState<StudentPointReduction[]>([]);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [homeVisits, setHomeVisits] = useState<HomeVisit[]>([]);
  const [parentCalls, setParentCalls] = useState<ParentCall[]>([]);

  // Forms
  const [violationForm, setViolationForm] = useState({ name: '', points: 5, description: '', date: new Date().toISOString().split('T')[0] });
  const [reductionForm, setReductionForm] = useState({ activityName: '', pointsRemoved: 5, description: '', date: new Date().toISOString().split('T')[0] });
  const [achievementForm, setAchievementForm] = useState({ title: '', level: 'Sekolah', description: '', date: new Date().toISOString().split('T')[0] });
  const [counselingForm, setCounselingForm] = useState({ issue: '', notes: '', followUp: '', date: new Date().toISOString().split('T')[0] });
  const [homeVisitForm, setHomeVisitForm] = useState({ address: '', reason: '', result: '', followUp: '', notes: '', date: new Date().toISOString().split('T')[0] });
  const [parentCallForm, setParentCallForm] = useState({ parentName: '', parentPhone: '', problem: '', solution: '', followUp: '', notes: '', date: new Date().toISOString().split('T')[0] });

  // Init
  useEffect(() => {
    const init = async () => {
      // 1. Load Classes SPECIFIC to this User (Guru BK yang bersangkutan)
      const cls = await getClasses(user.id, user.schoolNpsn); 
      setClasses(cls);
      
      // Load all school classes for Home Visit & Parent Call
      const allCls = await getClasses('', user.schoolNpsn); // Passing empty string for userId to get all school classes
      setAllSchoolClasses(allCls);

      if (cls.length > 0) {
        setSelectedClassId(prev => {
          const classExists = cls.some(c => c.id === prev);
          if (prev && classExists) return prev;
          return cls[0].id;
        });
      }

      // 2. Load Students ONLY from these classes to populate the display map
      const map: Record<string, {name: string, className: string, classId: string}> = {};
      
      // Fetch students for each class in the school to be safe for display
      const studentPromises = allCls.map(c => getStudents(c.id));
      const studentsPerClass = await Promise.all(studentPromises);

      studentsPerClass.flat().forEach(s => {
        const className = allCls.find(c => c.id === s.classId)?.name || 'Unknown';
        map[s.id] = { name: s.name, className: className, classId: s.classId };
      });
      
      setStudentMap(map);
      loadPriorityData();
    };
    init();
  }, [user.id]);

  // Load Students when Class Changes (For Dropdown Input)
  useEffect(() => {
    if (selectedClassId) {
      const loadStudents = async () => {
        const sts = await getStudents(selectedClassId);
        setStudents(sts);
        setSelectedStudentId(prev => {
          if (prev && sts.some(s => s.id === prev)) return prev;
          return '';
        });
      };
      loadStudents();
    }
  }, [selectedClassId]);

  // Load Feature Data based on Tab
  useEffect(() => {
    loadFeatureData();
  }, [activeTab]); 

  const loadPriorityData = async () => {
    setIsLoadingPriority(true);
    try {
      // 1. Determine classes and target students in this school
      const schoolClasses = await getClasses('', user.schoolNpsn);
      const schoolClassIds = new Set(schoolClasses.map(c => c.id));

      const allDbStudents = await db.students.toArray();
      let targetStudents = allDbStudents.filter(s => {
        if (s.schoolNpsn && user.schoolNpsn && s.schoolNpsn === user.schoolNpsn) return true;
        if (s.classId && schoolClassIds.has(s.classId)) return true;
        if (!user.schoolNpsn || s.schoolNpsn === 'DEFAULT') return true;
        return false;
      });

      if (targetStudents.length === 0) {
        targetStudents = allDbStudents;
      }
      const studentIdsSet = new Set(targetStudents.map(s => s.id));

      // 2. Fetch all relevant tables in parallel
      const [
        allAttendanceRecords,
        allRfidLogs,
        allViolations,
        allReductions,
        allSessions,
        allHomeVisits,
        allParentCalls
      ] = await Promise.all([
        db.attendanceRecords.toArray(),
        db.rfidLogs.toArray(),
        getStudentViolations(),
        getStudentPointReductions(),
        getCounselingSessions(),
        getHomeVisits(user.schoolNpsn || 'DEFAULT'),
        getParentCalls(user.schoolNpsn || 'DEFAULT')
      ]);

      setViolations(allViolations);
      setReductions(allReductions);
      setSessions(allSessions);
      setHomeVisits(allHomeVisits);
      setParentCalls(allParentCalls);

      // Filter attendance records to relevant students or classes (no arbitrary 30-day cut-off or dropping empty schoolNpsn)
      const schoolAttendance = allAttendanceRecords.filter(r => 
        !r.deleted && 
        (studentIdsSet.has(r.studentId) || (r.classId && schoolClassIds.has(r.classId)))
      );

      // Filter RFID logs
      const schoolRfidLogs = allRfidLogs.filter(l => 
        !l.deleted && 
        (studentIdsSet.has(l.studentId) || (l.classId && schoolClassIds.has(l.classId)) || (!user.schoolNpsn || l.schoolNpsn === user.schoolNpsn))
      );

      const prioritized: any[] = [];

      targetStudents.forEach((student: any) => {
        const studentAtt = schoolAttendance.filter((a: any) => a.studentId === student.id);
        const studentRfid = schoolRfidLogs.filter((l: any) => l.studentId === student.id);
        const sViolations = allViolations.filter((v: any) => v.studentId === student.id);
        const sReductions = allReductions.filter((r: any) => r.studentId === student.id);

        // --- TARDINESS PROCESSING ---
        const tardyByDate: Record<string, { date: string; time: string; source: string; notes?: string }> = {};

        // A. From manual attendance records
        studentAtt.forEach((a: any) => {
          const s = (a.status || '').toUpperCase().trim();
          const isLate = s === 'T' || s === 'TERLAMBAT' || s === 'TELAT' || s === 'LATE' || (a.notes && a.notes.toLowerCase().includes('terlambat'));
          if (isLate && a.date) {
            tardyByDate[a.date] = {
              date: a.date,
              time: a.notes || 'Terlambat Masuk',
              source: 'Presensi Guru / Mapel',
              notes: a.notes
            };
          }
        });

        // B. From RFID Logs
        studentRfid.forEach((l: any) => {
          const date = l.timestamp ? l.timestamp.split('T')[0] : '';
          const time = l.timestamp ? l.timestamp.split('T')[1]?.substring(0, 5) : '';
          const isLate = l.status === 'TERLAMBAT' || (time && time > '07:30');
          if (isLate && date) {
            if (!tardyByDate[date]) {
              tardyByDate[date] = {
                date,
                time: time ? `Pukul ${time} WIB` : 'Terlambat',
                source: 'Tap Gate RFID / Elektronik',
                notes: l.method ? `Metode: ${l.method}` : ''
              };
            } else {
              tardyByDate[date].time = time ? `Pukul ${time} WIB` : tardyByDate[date].time;
              tardyByDate[date].source = `${tardyByDate[date].source} & RFID`;
            }
          }
        });

        // C. From Disciplinary Violations
        sViolations.forEach((v: any) => {
          const isLateViolation = v.violationName?.toLowerCase().includes('terlambat') || v.violationName?.toLowerCase().includes('telat');
          if (isLateViolation && v.date && !tardyByDate[v.date]) {
            tardyByDate[v.date] = {
              date: v.date,
              time: `${v.points} Pts Pelanggaran`,
              source: 'Buku Pelanggaran Guru Piket',
              notes: v.violationName
            };
          }
        });

        const tardyDetailsList = Object.values(tardyByDate).sort((a, b) => b.date.localeCompare(a.date));
        const totalTardies = tardyDetailsList.length;

        // --- ABSENCE (ALFA) & ATTENDANCE SUMMARY PROCESSING ---
        const statusByDate: Record<string, { statuses: string[]; notes?: string; source?: string }> = {};
        let hadirCount = 0;
        let sakitCount = 0;
        let izinCount = 0;

        studentAtt.forEach((a: any) => {
          if (!a.date) return;
          if (!statusByDate[a.date]) {
            statusByDate[a.date] = { statuses: [], notes: a.notes, source: 'Presensi Guru' };
          }
          statusByDate[a.date].statuses.push((a.status || '').toUpperCase().trim());
          if (a.notes) statusByDate[a.date].notes = a.notes;
        });

        studentRfid.forEach((l: any) => {
          const date = l.timestamp ? l.timestamp.split('T')[0] : '';
          if (date && (l.status === 'HADIR' || l.status === 'TERLAMBAT' || l.status === 'PULANG')) {
            if (!statusByDate[date]) {
              statusByDate[date] = { statuses: [], notes: l.method, source: 'Tap Gate RFID' };
            }
            statusByDate[date].statuses.push('H');
          }
        });

        // Classify each date
        const alfaDateList: { date: string; notes?: string; source: string }[] = [];
        Object.entries(statusByDate).forEach(([date, data]) => {
          const { statuses, notes, source } = data;
          const hasHadir = statuses.some(s => s === 'H' || s === 'HADIR' || s === 'PRESENT');
          const hasSakit = statuses.some(s => s === 'S' || s === 'SAKIT');
          const hasIzin = statuses.some(s => s === 'I' || s === 'IZIN' || s === 'IJIN');
          const hasAlfa = statuses.some(s => s === 'A' || s === 'ALFA' || s === 'ALPA' || s === 'ALPHA' || s === 'TK' || s === 'BOLOS' || s === 'ABSENT');

          if (hasHadir) {
            hadirCount++;
          } else if (hasSakit) {
            sakitCount++;
          } else if (hasIzin) {
            izinCount++;
          } else if (hasAlfa) {
            alfaDateList.push({ date, notes, source: source || 'Presensi Guru' });
          }
        });

        // Check truant violations
        sViolations.forEach((v: any) => {
          const isTruant = v.violationName?.toLowerCase().includes('bolos') || 
                           v.violationName?.toLowerCase().includes('alfa') || 
                           v.violationName?.toLowerCase().includes('alpa') || 
                           v.violationName?.toLowerCase().includes('tanpa keterangan');
          if (isTruant && v.date && !alfaDateList.some(item => item.date === v.date)) {
            alfaDateList.push({ date: v.date, notes: v.violationName, source: 'Buku Pelanggaran' });
          }
        });

        // Sort alfa dates chronologically
        alfaDateList.sort((a, b) => a.date.localeCompare(b.date));
        const uniqueAlfaDateStrings = alfaDateList.map(a => a.date);

        // Consecutive streak calculation
        let currentStreak = 0;
        let maxStreak = 0;
        let currentStreakDates: string[] = [];
        let maxStreakDates: string[] = [];

        for (let i = 0; i < uniqueAlfaDateStrings.length; i++) {
          if (i === 0) {
            currentStreak = 1;
            currentStreakDates = [uniqueAlfaDateStrings[0]];
          } else {
            const prevDate = new Date(uniqueAlfaDateStrings[i - 1]);
            const currDate = new Date(uniqueAlfaDateStrings[i]);
            const diffDays = Math.round(Math.abs(currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
            const prevDayOfWeek = prevDate.getDay(); // 5 = Friday

            // Consecutive if 1 day apart or weekend span (Friday to Monday: 3 days apart)
            const isConsecutive = diffDays === 1 || (diffDays <= 3 && (prevDayOfWeek === 5 || prevDayOfWeek === 6));

            if (isConsecutive) {
              currentStreak++;
              currentStreakDates.push(uniqueAlfaDateStrings[i]);
            } else {
              currentStreak = 1;
              currentStreakDates = [uniqueAlfaDateStrings[i]];
            }
          }
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            maxStreakDates = [...currentStreakDates];
          }
        }

        // --- DISCIPLINE POINTS PROCESSING ---
        const totalVPoints = sViolations.reduce((acc: number, v: any) => acc + (v.points || 0), 0);
        const totalRPoints = sReductions.reduce((acc: number, r: any) => acc + (r.pointsRemoved || 0), 0);
        const netPoints = Math.max(0, totalVPoints - totalRPoints);

        const hasConsecutiveAbsence = maxStreak >= 3;
        const hasAccumulatedAbsence = uniqueAlfaDateStrings.length >= 3;
        const hasAbsenceIssue = hasConsecutiveAbsence || hasAccumulatedAbsence;
        const hasTardyIssue = totalTardies >= 3;
        const hasPointIssue = netPoints > 20;

        if (hasAbsenceIssue || hasTardyIssue || hasPointIssue) {
          const reasons: string[] = [];

          if (hasPointIssue) {
            if (netPoints > 100) {
              reasons.push(`Poin Kritis: ${netPoints} Poin (Prioritas SP-3 / Sidang DO)`);
            } else if (netPoints > 50) {
              reasons.push(`Poin Tinggi: ${netPoints} Poin (Prioritas SP-2 / Panggilan Ortu)`);
            } else {
              reasons.push(`Poin Disiplin: ${netPoints} Poin (Prioritas SP-1)`);
            }
          }

          if (hasConsecutiveAbsence) {
            reasons.push(`Absen ${maxStreak} Hari Berturut-turut (${maxStreakDates.map(formatShortDate).join(', ')})`);
          } else if (hasAccumulatedAbsence) {
            reasons.push(`Akumulasi ${uniqueAlfaDateStrings.length} Hari Alfa`);
          }

          if (hasTardyIssue) {
            reasons.push(`Terlambat ${totalTardies} Kali (${tardyDetailsList.slice(0, 3).map(t => formatShortDate(t.date)).join(', ')}${totalTardies > 3 ? '...' : ''})`);
          }

          let spLevel: 'SP-3' | 'SP-2' | 'SP-1' | 'NORMAL' = 'NORMAL';
          let spTitle = 'Prioritas SP-1';
          if (netPoints > 100) {
            spLevel = 'SP-3';
            spTitle = 'SP-3 / Sidang DO';
          } else if (netPoints > 50) {
            spLevel = 'SP-2';
            spTitle = 'SP-2 / Panggilan Ortu';
          } else if (netPoints > 20) {
            spLevel = 'SP-1';
            spTitle = 'Prioritas SP-1';
          }

          prioritized.push({
            student,
            tardies: totalTardies,
            tardyDetails: tardyDetailsList,
            maxConsecutive: maxStreak,
            maxConsecutiveDates: maxStreakDates,
            totalAlfa: uniqueAlfaDateStrings.length,
            alfaDetails: alfaDateList,
            alfaDates: uniqueAlfaDateStrings,
            hadirCount,
            sakitCount,
            izinCount,
            netPoints,
            totalVPoints,
            totalRPoints,
            spLevel,
            spTitle,
            reasons,
            hasAbsenceIssue,
            hasConsecutiveAbsence,
            hasAccumulatedAbsence,
            hasTardyIssue,
            hasPointIssue,
            violationsCount: sViolations.length,
            sessionsCount: allSessions.filter((s: any) => s.studentId === student.id).length,
            parentCallsCount: allParentCalls.filter((pc: any) => pc.studentId === student.id).length,
            homeVisitsCount: allHomeVisits.filter((hv: any) => hv.studentId === student.id).length
          });
        }
      });

      // Priority sort order: SP-3, SP-2, SP-1, then net points, then chronic absences
      prioritized.sort((a, b) => {
        const score = (item: any) => {
          let s = 0;
          if (item.netPoints > 100) s += 1000;
          else if (item.netPoints > 50) s += 500;
          else if (item.netPoints > 20) s += 250;
          s += item.netPoints * 2;
          if (item.hasConsecutiveAbsence) s += 200 + (item.maxConsecutive * 20);
          else if (item.hasAbsenceIssue) s += 120 + (item.totalAlfa * 10);
          if (item.hasTardyIssue) s += 80 + (item.tardies * 5);
          return s;
        };
        return score(b) - score(a);
      });

      setFlaggedStudents(prioritized);
    } catch (error) {
      console.error("Priority Load Error:", error);
    } finally {
      setIsLoadingPriority(false);
    }
  };

  const getSiswaDashboardData = () => {
    const studentIds = Object.keys(studentMap);
    
    return studentIds.map(sid => {
      const info = studentMap[sid];
      const sViolations = violations.filter(v => v.studentId === sid);
      const sReductions = reductions.filter(r => r.studentId === sid);
      const sSessions = sessions.filter(s => s.studentId === sid);
      const sHomeVisits = homeVisits.filter(hv => hv.studentId === sid);
      const sParentCalls = parentCalls.filter(pc => pc.studentId === sid);
      
      const totalVPoints = sViolations.reduce((acc, v) => acc + v.points, 0);
      const totalRPoints = sReductions.reduce((acc, r) => acc + r.pointsRemoved, 0);
      const netPoints = Math.max(0, totalVPoints - totalRPoints);
      
      let riskLevel: 'AMAN' | 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS' = 'AMAN';
      let riskColor = 'bg-green-50 text-green-700 border-green-100';
      let recommendation = 'Aman / Tidak ada tindakan';
      
      if (netPoints > 100) {
        riskLevel = 'KRITIS';
        riskColor = 'bg-red-200 text-red-900 border-red-300 font-extrabold animate-pulse';
        recommendation = 'Sidang Akademik / Skorsing / Drop Out';
      } else if (netPoints > 50) {
        riskLevel = 'TINGGI';
        riskColor = 'bg-red-50 text-red-700 border-red-100';
        recommendation = 'Panggilan Orang Tua & SP-2';
      } else if (netPoints > 20) {
        riskLevel = 'SEDANG';
        riskColor = 'bg-yellow-50 text-yellow-800 border-yellow-100';
        recommendation = 'Konseling BK Intensif & SP-1';
      } else if (netPoints > 0) {
        riskLevel = 'RENDAH';
        riskColor = 'bg-blue-50 text-blue-700 border-blue-100';
        recommendation = 'Teguran Wali Kelas & Pembinaan';
      }
      
      return {
        id: sid,
        name: info?.name || 'Unknown',
        className: info?.className || 'Unknown',
        totalVPoints,
        totalRPoints,
        netPoints,
        riskLevel,
        riskColor,
        recommendation,
        violations: sViolations,
        reductions: sReductions,
        sessions: sSessions,
        homeVisits: sHomeVisits,
        parentCalls: sParentCalls
      };
    });
  };

  const getFilteredPriorityStudents = () => {
    return flaggedStudents.filter((item) => {
      // Filter by class if selected in sidebar
      if (selectedClassId && item.student.classId !== selectedClassId) return false;

      // Filter by category
      if (priorityFilter === 'POINTS' && !item.hasPointIssue) return false;
      if (priorityFilter === 'ABSENCE' && !item.hasAbsenceIssue) return false;
      if (priorityFilter === 'TARDY' && !item.hasTardyIssue) return false;

      // Filter by search query
      if (prioritySearch.trim()) {
        const q = prioritySearch.toLowerCase();
        const stInfo = getStudentDisplay(item.student.id);
        const nameMatch = item.student.name?.toLowerCase().includes(q);
        const nisMatch = item.student.nis?.toLowerCase().includes(q);
        const classMatch = (stInfo?.className || item.student.classId || '').toLowerCase().includes(q);
        if (!nameMatch && !nisMatch && !classMatch) return false;
      }

      return true;
    });
  };

  const loadFeatureData = async () => {
    // Keep priority attendance data populated across all tabs
    loadPriorityData();

    if (activeTab === 'priority') {
       // Loaded above
    } else if (activeTab === 'print' || activeTab === 'dashboard') {
       const [v, r, a, s, hv, pc] = await Promise.all([
          getStudentViolations(),
          getStudentPointReductions(),
          getStudentAchievements(),
          getCounselingSessions(),
          getHomeVisits(user.schoolNpsn || 'DEFAULT'),
          getParentCalls(user.schoolNpsn || 'DEFAULT')
       ]);
       setViolations(v);
       setReductions(r);
       setAchievements(a);
       setSessions(s);
       setHomeVisits(hv);
       setParentCalls(pc);
    } else if (activeTab === 'violations') {
      const data = await getStudentViolations();
      setViolations(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else if (activeTab === 'reductions') {
      const data = await getStudentPointReductions();
      setReductions(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else if (activeTab === 'achievements') {
      const data = await getStudentAchievements();
      setAchievements(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else if (activeTab === 'homeVisits') {
      const data = await getHomeVisits(user.schoolNpsn || 'DEFAULT');
      setHomeVisits(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else if (activeTab === 'parentCalls') {
      const data = await getParentCalls(user.schoolNpsn || 'DEFAULT');
      setParentCalls(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else {
      const data = await getCounselingSessions();
      setSessions(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  };

  const getStudentDisplay = (id: string) => {
    const info = studentMap[id];
    if (info) return { name: info.name, className: info.className };
    return null; 
  };

  // --- HANDLERS ---

  const handleAddViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addStudentViolation({
      studentId: selectedStudentId,
      date: violationForm.date,
      violationName: violationForm.name,
      points: Number(violationForm.points),
      description: violationForm.description,
      reportedBy: user.fullName ? `Guru BK (${user.fullName})` : 'Guru BK'
    });
    setViolationForm({ name: '', points: 5, description: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Pelanggaran dicatat.');
  };

  const handleAddReduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addStudentPointReduction({
      studentId: selectedStudentId,
      date: reductionForm.date,
      activityName: reductionForm.activityName,
      pointsRemoved: Number(reductionForm.pointsRemoved),
      description: reductionForm.description
    });
    setReductionForm({ activityName: '', pointsRemoved: 5, description: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Pengurangan poin dicatat.');
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addStudentAchievement({
      studentId: selectedStudentId,
      date: achievementForm.date,
      title: achievementForm.title,
      level: achievementForm.level as any,
      description: achievementForm.description
    });
    setAchievementForm({ title: '', level: 'Sekolah', description: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Prestasi dicatat.');
  };

  const handleAddCounseling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addCounselingSession({
      studentId: selectedStudentId,
      date: counselingForm.date,
      issue: counselingForm.issue,
      notes: counselingForm.notes,
      followUp: counselingForm.followUp,
      status: 'OPEN'
    });
    setCounselingForm({ issue: '', notes: '', followUp: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Sesi konseling dicatat.');
  };

  const handleAddHomeVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedClassId) return;
    await saveHomeVisit({
      studentId: selectedStudentId,
      classId: selectedClassId,
      schoolNpsn: user.schoolNpsn || 'DEFAULT',
      date: homeVisitForm.date,
      address: homeVisitForm.address,
      reason: homeVisitForm.reason,
      result: homeVisitForm.result,
      followUp: homeVisitForm.followUp,
      notes: homeVisitForm.notes,
      userId: user.id
    });
    setHomeVisitForm({ address: '', reason: '', result: '', followUp: '', notes: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Kunjungan rumah dicatat.');
  };

  const handleAddParentCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedClassId) return;
    await saveParentCall({
      studentId: selectedStudentId,
      classId: selectedClassId,
      schoolNpsn: user.schoolNpsn || 'DEFAULT',
      date: parentCallForm.date,
      parentName: parentCallForm.parentName,
      parentPhone: parentCallForm.parentPhone,
      problem: parentCallForm.problem,
      solution: parentCallForm.solution,
      followUp: parentCallForm.followUp,
      notes: parentCallForm.notes,
      userId: user.id
    });
    setParentCallForm({ parentName: '', parentPhone: '', problem: '', solution: '', followUp: '', notes: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Panggilan orang tua dicatat.');
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Hapus data ini?")) return;
    
    if (activeTab === 'violations') await deleteStudentViolation(id);
    else if (activeTab === 'reductions') await deleteStudentPointReduction(id);
    else if (activeTab === 'achievements') await deleteStudentAchievement(id);
    else if (activeTab === 'homeVisits') await deleteHomeVisit(id);
    else if (activeTab === 'parentCalls') await deleteParentCall(id);
    else await deleteCounselingSession(id);
    
    loadFeatureData();
  };

  // --- EXPORT HANDLERS ---

  const getStudentDataForReport = () => {
    if (!selectedStudentId) return null;
    const info = getStudentDisplay(selectedStudentId);
    if (!info) return null;
    
    const vList = violations.filter(v => v.studentId === selectedStudentId);
    const rList = reductions.filter(r => r.studentId === selectedStudentId);
    
    const totalV = vList.reduce((acc, v) => acc + v.points, 0);
    const totalR = rList.reduce((acc, r) => acc + r.pointsRemoved, 0);
    const netPoints = Math.max(0, totalV - totalR);

    return {
      info,
      violations: vList,
      reductions: rList,
      achievements: achievements.filter(a => a.studentId === selectedStudentId),
      sessions: sessions.filter(s => s.studentId === selectedStudentId),
      homeVisits: homeVisits.filter(hv => hv.studentId === selectedStudentId),
      parentCalls: parentCalls.filter(pc => pc.studentId === selectedStudentId),
      summary: { totalV, totalR, netPoints }
    };
  };

  const generateHTMLReport = (data: any) => {
    const violationRows = data.violations.length > 0 
      ? data.violations.map((v: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${v.date}</td>
          <td><strong>${v.violationName}</strong></td>
          <td><span style="font-weight:600; color:#3730a3;">${v.reportedBy || 'Guru BK / Wali Kelas'}</span></td>
          <td>${v.description || '-'}</td>
          <td style="text-align:center; font-weight:bold; color:#dc2626;">+${v.points}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center; font-style: italic;">Tidak ada data pelanggaran</td></tr>';

    const reductionRows = data.reductions.length > 0 
      ? data.reductions.map((r: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${r.date}</td>
          <td>${r.activityName}</td>
          <td>${r.description || '-'}</td>
          <td style="text-align:center">-${r.pointsRemoved}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada data pemulihan poin</td></tr>';

    const achievementRows = data.achievements.length > 0
      ? data.achievements.map((a: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${a.date}</td>
          <td>${a.title}</td>
          <td>${a.level}</td>
          <td>${a.description || '-'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada data prestasi</td></tr>';

    const sessionRows = data.sessions.length > 0
      ? data.sessions.map((s: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${s.date}</td>
          <td>${s.issue}</td>
          <td>${s.notes}</td>
          <td>${s.followUp || '-'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada catatan konseling</td></tr>';

    const homeVisitRows = data.homeVisits.length > 0
      ? data.homeVisits.map((hv: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${hv.date}</td>
          <td>${hv.address}</td>
          <td>${hv.reason}</td>
          <td>${hv.result}</td>
          <td>${hv.followUp}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center; font-style: italic;">Tidak ada data home visit</td></tr>';

    const parentCallRows = data.parentCalls.length > 0
      ? data.parentCalls.map((pc: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${pc.date}</td>
          <td>${pc.parentName} (${pc.parentPhone})</td>
          <td>${pc.problem}</td>
          <td>${pc.solution}</td>
          <td>${pc.followUp}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center; font-style: italic;">Tidak ada data panggilan orang tua</td></tr>';

    return `
      <html>
        <head>
          <title>Laporan BK - ${data.info.name}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 12pt; }
            h2, h3 { text-align: center; margin: 5px 0; }
            .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .student-info { margin-bottom: 20px; }
            .student-info table { width: auto; border: none; }
            .student-info td { border: none; padding: 2px 10px 2px 0; font-weight: bold; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 14pt; font-weight: bold; background-color: #f0f0f0; padding: 5px; border: 1px solid #000; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: top; }
            th { background-color: #e0e0e0; text-align: center; font-weight: bold; }
            .summary-box { border: 2px solid #333; padding: 10px; width: 300px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>LAPORAN REKAM JEJAK SISWA</h2>
            <h3>BIMBINGAN KONSELING & KEDISIPLINAN</h3>
          </div>

          <div class="student-info">
            <table>
              <tr><td>Nama Siswa</td><td>: ${data.info.name}</td></tr>
              <tr><td>Kelas</td><td>: ${data.info.className}</td></tr>
              <tr><td>Tanggal Cetak</td><td>: ${new Date().toLocaleDateString('id-ID')}</td></tr>
            </table>
          </div>

          <div class="summary-box">
             <strong>Ringkasan Poin Kedisiplinan:</strong><br/>
             Total Poin Pelanggaran: ${data.summary.totalV}<br/>
             Total Poin Dikurangi: ${data.summary.totalR}<br/>
             -----------------------------------<br/>
             <strong>SISA POIN AKTIF: ${data.summary.netPoints}</strong>
          </div>

          <div class="section">
            <div class="section-title">A. PELANGGARAN & KEDISIPLINAN</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="23%">Jenis Pelanggaran</th>
                  <th width="20%">Diinput Oleh</th>
                  <th width="32%">Keterangan</th>
                  <th width="8%">Poin</th>
                </tr>
              </thead>
              <tbody>${violationRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">B. PEMULIHAN POIN (PENGURANGAN)</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="25%">Aktivitas</th>
                  <th width="45%">Keterangan</th>
                  <th width="10%">Poin (-)</th>
                </tr>
              </thead>
              <tbody>${reductionRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">C. PRESTASI NON-AKADEMIK</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="25%">Nama Prestasi</th>
                  <th width="15%">Tingkat</th>
                  <th width="40%">Keterangan</th>
                </tr>
              </thead>
              <tbody>${achievementRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">D. CATATAN KONSELING</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="20%">Permasalahan</th>
                  <th width="30%">Catatan / Proses</th>
                  <th width="30%">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>${sessionRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">E. DAFTAR HOME VISIT</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="18%">Alamat</th>
                  <th width="20%">Alasan</th>
                  <th width="25%">Hasil</th>
                  <th width="20%">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>${homeVisitRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">F. PANGGILAN ORANG TUA</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="12%">Tanggal</th>
                  <th width="18%">Orang Tua</th>
                  <th width="20%">Masalah</th>
                  <th width="25%">Solusi</th>
                  <th width="20%">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>${parentCallRows}</tbody>
            </table>
          </div>

          <div style="margin-top: 40px; float: right; text-align: center; width: 250px;">
             <p>Banjarbaru, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
             <p>Guru Bimbingan Konseling,</p>
             <br/><br/><br/>
             <p style="font-weight: bold; text-decoration: underline;">${user.fullName}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const data = getStudentDataForReport();
    if (!data) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;

    printWindow.document.write(generateHTMLReport(data));
    printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
    printWindow.document.close();
  };

  const handleDocExport = () => {
    const data = getStudentDataForReport();
    if (!data) return;

    const htmlContent = generateHTMLReport(data);
    
    // Create a Blob with Word-compatible HTML
    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });
    
    // Trigger Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_BK_${data.info.name.replace(/\s+/g, '_')}.doc`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelExport = () => {
    const data = getStudentDataForReport();
    if (!data) return;

    // Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Pelanggaran
    const vRows = data.violations.map((v, i) => ({
      No: i + 1,
      Tanggal: v.date,
      Pelanggaran: v.violationName,
      Poin: v.points,
      Keterangan: v.description || '-',
      Pelapor: v.reportedBy
    }));
    const ws1 = XLSX.utils.json_to_sheet(vRows.length ? vRows : [{Info: "Tidak ada data pelanggaran"}]);
    XLSX.utils.book_append_sheet(wb, ws1, "Pelanggaran");

    // Sheet 2: Pengurangan
    const rRows = data.reductions.map((r, i) => ({
      No: i + 1,
      Tanggal: r.date,
      Aktivitas: r.activityName,
      PoinDikurangi: r.pointsRemoved,
      Keterangan: r.description || '-'
    }));
    const ws2 = XLSX.utils.json_to_sheet(rRows.length ? rRows : [{Info: "Tidak ada data pengurangan"}]);
    XLSX.utils.book_append_sheet(wb, ws2, "Pemulihan Poin");

    // Sheet 3: Prestasi
    const aRows = data.achievements.map((a, i) => ({
      No: i + 1,
      Tanggal: a.date,
      Prestasi: a.title,
      Tingkat: a.level,
      Deskripsi: a.description || '-'
    }));
    const ws3 = XLSX.utils.json_to_sheet(aRows.length ? aRows : [{Info: "Tidak ada data prestasi"}]);
    XLSX.utils.book_append_sheet(wb, ws3, "Prestasi");

    // Sheet 4: Konseling
    const sRows = data.sessions.map((s, i) => ({
      No: i + 1,
      Tanggal: s.date,
      Masalah: s.issue,
      Catatan: s.notes,
      TindakLanjut: s.followUp || '-',
      Status: s.status
    }));
    const ws4 = XLSX.utils.json_to_sheet(sRows.length ? sRows : [{Info: "Tidak ada data konseling"}]);
    XLSX.utils.book_append_sheet(wb, ws4, "Konseling");

    // Sheet 5: Home Visit
    const hvRows = data.homeVisits.map((hv, i) => ({
      No: i + 1,
      Tanggal: hv.date,
      Alamat: hv.address,
      Alasan: hv.reason,
      Hasil: hv.result,
      TindakLanjut: hv.followUp,
      Keterangan: hv.notes || '-'
    }));
    const ws5 = XLSX.utils.json_to_sheet(hvRows.length ? hvRows : [{Info: "Tidak ada data home visit"}]);
    XLSX.utils.book_append_sheet(wb, ws5, "Home Visit");

    // Sheet 6: Panggilan Ortu
    const pcRows = data.parentCalls.map((pc, i) => ({
      No: i + 1,
      Tanggal: pc.date,
      OrangTua: pc.parentName,
      NoHP: pc.parentPhone,
      Masalah: pc.problem,
      Solusi: pc.solution,
      TindakLanjut: pc.followUp,
      Keterangan: pc.notes || '-'
    }));
    const ws6 = XLSX.utils.json_to_sheet(pcRows.length ? pcRows : [{Info: "Tidak ada data panggilan ortu"}]);
    XLSX.utils.book_append_sheet(wb, ws6, "Panggilan Ortu");

    XLSX.writeFile(wb, `Laporan_BK_${data.info.name.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
           <ShieldAlert className="text-purple-600" /> Bimbingan Konseling & Kedisiplinan
        </h2>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <PieChart size={16} /> Dashboard BK
          </button>
          <button
            onClick={() => setActiveTab('violations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'violations' ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileWarning size={16} /> Pelanggaran
          </button>
          <button
            onClick={() => setActiveTab('reductions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'reductions' ? 'bg-green-50 text-green-600 ring-1 ring-green-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <RefreshCcw size={16} /> Pemulihan Poin
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'achievements' ? 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Trophy size={16} /> Prestasi
          </button>
          <button
            onClick={() => setActiveTab('counseling')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'counseling' ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquareHeart size={16} /> Konseling
          </button>
          <button
            onClick={() => setActiveTab('homeVisits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'homeVisits' ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Home size={16} /> Home Visit
          </button>
          <button
            onClick={() => setActiveTab('parentCalls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'parentCalls' ? 'bg-pink-50 text-pink-600 ring-1 ring-pink-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Smartphone size={16} /> Panggilan Ortu
          </button>
          <button
            onClick={() => setActiveTab('priority')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'priority' ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle size={16} /> Monitor Prioritas
            {flaggedStudents.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-red-600 text-white shadow-xs">
                {flaggedStudents.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'print' ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Printer size={16} /> Cetak
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* INPUT FORM / SELECTOR (Left Column) */}
        <div className="lg:col-span-1">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-6">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">
                 {activeTab === 'violations' ? 'Input Pelanggaran' : 
                  activeTab === 'reductions' ? 'Input Pengurangan Poin' :
                  activeTab === 'achievements' ? 'Input Prestasi' : 
                  activeTab === 'counseling' ? 'Log Konseling' : 
                  activeTab === 'homeVisits' ? 'Input Home Visit' :
                  activeTab === 'parentCalls' ? 'Input Panggilan Ortu' :
                  activeTab === 'priority' ? 'Analisis Otomatis' :
                  activeTab === 'dashboard' ? 'Navigasi & Analisis' :
                  'Filter Data Laporan'}
              </h3>
              
              {/* Student Selector */}
              <div className="mb-4 space-y-3">
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Pilih Kelas</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                      value={selectedClassId}
                      onChange={(e) => {
                         setSelectedClassId(e.target.value);
                         setSelectedStudentId('');
                      }}
                    >
                       <option value="">-- Semua Kelas --</option>
                       {(activeTab === 'homeVisits' || activeTab === 'parentCalls' ? allSchoolClasses : classes).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 {activeTab !== 'dashboard' && activeTab !== 'priority' && (
                    <div>
                       <label className="block text-xs font-semibold text-gray-500 mb-1">Pilih Siswa</label>
                       <select 
                         className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                         value={selectedStudentId}
                         onChange={(e) => setSelectedStudentId(e.target.value)}
                         disabled={classes.length === 0}
                       >
                          <option value="">-- Pilih Siswa --</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                 )}
              </div>

              {/* Dynamic Forms - Hidden on Print Tab */}
              {activeTab === 'dashboard' && (
                 <div className="space-y-4">
                    <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-800 leading-relaxed border border-purple-100">
                       <p className="font-bold flex items-center gap-1 mb-1">
                          <ShieldAlert size={14} /> Sinkronisasi Real-Time
                       </p>
                       Data kedisiplinan wali kelas dan guru BK terintegrasi secara langsung. Gunakan filter di bawah untuk melakukan analisis taktis.
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-gray-500 mb-1">Pencarian Siswa Cepat</label>
                       <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Ketik nama siswa..." 
                            className="w-full border border-gray-300 rounded-lg p-2 pl-8 text-xs focus:ring-2 focus:ring-purple-500"
                            value={dashboardSearch}
                            onChange={(e) => setDashboardSearch(e.target.value)}
                          />
                          <div className="absolute left-2.5 top-3.5 text-gray-400">
                             <Search size={12} />
                          </div>
                       </div>
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-gray-500 mb-1">Filter Tingkat Risiko</label>
                       <select
                         className="w-full border border-gray-300 rounded-lg p-2 text-xs text-gray-700"
                         value={riskFilter}
                         onChange={(e) => setRiskFilter(e.target.value)}
                       >
                          <option value="ALL">Semua Risiko</option>
                          <option value="KRITIS">Kritis (&gt; 100 Poin)</option>
                          <option value="TINGGI">Tinggi (51 - 100 Poin)</option>
                          <option value="SEDANG">Sedang (21 - 50 Poin)</option>
                          <option value="RENDAH">Rendah (1 - 20 Poin)</option>
                       </select>
                    </div>
                 </div>
              )}

              {activeTab === 'priority' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-red-50 via-amber-50 to-orange-50 rounded-xl border border-red-200/80 text-sm">
                    <p className="text-red-800 font-bold mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle size={15} className="text-red-600" /> Kriteria Deteksi Otomatis BK
                    </p>
                    <p className="text-gray-600 text-xs leading-relaxed">
                      Sistem memindai rekam presensi harian (alfa & terlambat) serta siswa dengan akumulasi &gt; 20 poin (Prioritas SP-1 ke atas).
                    </p>
                    <div className="mt-3 pt-3 border-t border-red-200/60 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-purple-900">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold">Poin &gt; 20 / Prioritas SP-1+</span>
                          <p className="text-[10px] text-gray-500">Poin sanksi aktif SP-1, SP-2, SP-3</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-red-900">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold">3+ Hari Absen Berturut-turut</span>
                          <p className="text-[10px] text-gray-500">Pola ketidakhadiran alfa/bolos</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-orange-900">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold">5+ Kali Terlambat / Bulan</span>
                          <p className="text-[10px] text-gray-500">Keterlambatan berulang presensi</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Cari Siswa Terdeteksi</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Ketik nama atau NIS..." 
                        className="w-full border border-gray-300 rounded-lg p-2 pl-8 text-xs focus:ring-2 focus:ring-red-500 text-gray-800"
                        value={prioritySearch}
                        onChange={(e) => setPrioritySearch(e.target.value)}
                      />
                      <div className="absolute left-2.5 top-2.5 text-gray-400">
                        <Search size={14} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Filter Kategori Deteksi</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs text-gray-700 font-medium"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as any)}
                    >
                      <option value="ALL">Semua Kriteria Prioritas ({flaggedStudents.length})</option>
                      <option value="POINTS">Poin &gt; 20 / SP-1+ ({flaggedStudents.filter(f => f.hasPointIssue).length})</option>
                      <option value="ABSENCE">Absen 3+ Hari Berturut-turut ({flaggedStudents.filter(f => f.hasAbsenceIssue).length})</option>
                      <option value="TARDY">Terlambat 5+ Kali ({flaggedStudents.filter(f => f.hasTardyIssue).length})</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={loadPriorityData}
                    disabled={isLoadingPriority}
                    className="w-full py-2 px-3 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCcw size={13} className={isLoadingPriority ? "animate-spin" : ""} />
                    {isLoadingPriority ? 'Memindai Ulang...' : 'Pindai Ulang Sistem'}
                  </button>
                </div>
              )}

              {activeTab === 'violations' && (
                 <form onSubmit={handleAddViolation} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={violationForm.date} onChange={e => setViolationForm({...violationForm, date: e.target.value})} />
                    <input type="text" placeholder="Jenis Pelanggaran (mis: Terlambat)" required className="w-full border rounded-lg p-2 text-sm" value={violationForm.name} onChange={e => setViolationForm({...violationForm, name: e.target.value})} />
                    <input type="number" placeholder="Poin Sanksi" required className="w-full border rounded-lg p-2 text-sm" value={violationForm.points} onChange={e => setViolationForm({...violationForm, points: parseInt(e.target.value)})} />
                    <textarea placeholder="Keterangan / Kronologi" className="w-full border rounded-lg p-2 text-sm h-20" value={violationForm.description} onChange={e => setViolationForm({...violationForm, description: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50">Simpan Pelanggaran</button>
                 </form>
              )}

              {activeTab === 'reductions' && (
                 <form onSubmit={handleAddReduction} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={reductionForm.date} onChange={e => setReductionForm({...reductionForm, date: e.target.value})} />
                    <input type="text" placeholder="Aktivitas (mis: Membersihkan Mushola)" required className="w-full border rounded-lg p-2 text-sm" value={reductionForm.activityName} onChange={e => setReductionForm({...reductionForm, activityName: e.target.value})} />
                    <input type="number" placeholder="Poin Dikurangi (mis: 10)" required className="w-full border rounded-lg p-2 text-sm" value={reductionForm.pointsRemoved} onChange={e => setReductionForm({...reductionForm, pointsRemoved: parseInt(e.target.value)})} />
                    <textarea placeholder="Keterangan tambahan" className="w-full border rounded-lg p-2 text-sm h-20" value={reductionForm.description} onChange={e => setReductionForm({...reductionForm, description: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50">Simpan Pengurangan</button>
                 </form>
              )}

              {activeTab === 'achievements' && (
                 <form onSubmit={handleAddAchievement} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={achievementForm.date} onChange={e => setAchievementForm({...achievementForm, date: e.target.value})} />
                    <input type="text" placeholder="Nama Prestasi / Lomba" required className="w-full border rounded-lg p-2 text-sm" value={achievementForm.title} onChange={e => setAchievementForm({...achievementForm, title: e.target.value})} />
                    <select className="w-full border rounded-lg p-2 text-sm" value={achievementForm.level} onChange={e => setAchievementForm({...achievementForm, level: e.target.value})}>
                       <option value="Sekolah">Tingkat Sekolah</option>
                       <option value="Kecamatan">Tingkat Kecamatan</option>
                       <option value="Kabupaten">Tingkat Kabupaten</option>
                       <option value="Provinsi">Tingkat Provinsi</option>
                       <option value="Nasional">Tingkat Nasional</option>
                    </select>
                    <textarea placeholder="Deskripsi (Juara 1, dll)" className="w-full border rounded-lg p-2 text-sm h-20" value={achievementForm.description} onChange={e => setAchievementForm({...achievementForm, description: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-yellow-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-yellow-600 disabled:opacity-50">Simpan Prestasi</button>
                 </form>
              )}

              {activeTab === 'counseling' && (
                 <form onSubmit={handleAddCounseling} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={counselingForm.date} onChange={e => setCounselingForm({...counselingForm, date: e.target.value})} />
                    <input type="text" placeholder="Permasalahan Utama" required className="w-full border rounded-lg p-2 text-sm" value={counselingForm.issue} onChange={e => setCounselingForm({...counselingForm, issue: e.target.value})} />
                    <textarea placeholder="Catatan Proses Konseling" required className="w-full border rounded-lg p-2 text-sm h-24" value={counselingForm.notes} onChange={e => setCounselingForm({...counselingForm, notes: e.target.value})} />
                    <textarea placeholder="Rencana Tindak Lanjut" className="w-full border rounded-lg p-2 text-sm h-16" value={counselingForm.followUp} onChange={e => setCounselingForm({...counselingForm, followUp: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">Simpan Log Konseling</button>
                 </form>
              )}

              {activeTab === 'homeVisits' && (
                 <form onSubmit={handleAddHomeVisit} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={homeVisitForm.date} onChange={e => setHomeVisitForm({...homeVisitForm, date: e.target.value})} />
                    <input type="text" placeholder="Alamat Tujuan" required className="w-full border rounded-lg p-2 text-sm" value={homeVisitForm.address} onChange={e => setHomeVisitForm({...homeVisitForm, address: e.target.value})} />
                    <textarea placeholder="Alasan Kunjungan" required className="w-full border rounded-lg p-2 text-sm h-16" value={homeVisitForm.reason} onChange={e => setHomeVisitForm({...homeVisitForm, reason: e.target.value})} />
                    <textarea placeholder="Hasil Kunjungan" required className="w-full border rounded-lg p-2 text-sm h-20" value={homeVisitForm.result} onChange={e => setHomeVisitForm({...homeVisitForm, result: e.target.value})} />
                    <textarea placeholder="Rencana Tindak Lanjut" required className="w-full border rounded-lg p-2 text-sm h-16" value={homeVisitForm.followUp} onChange={e => setHomeVisitForm({...homeVisitForm, followUp: e.target.value})} />
                    <textarea placeholder="Keterangan" className="w-full border rounded-lg p-2 text-sm h-16" value={homeVisitForm.notes} onChange={e => setHomeVisitForm({...homeVisitForm, notes: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-orange-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50">Simpan Home Visit</button>
                 </form>
              )}

              {activeTab === 'parentCalls' && (
                 <form onSubmit={handleAddParentCall} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={parentCallForm.date} onChange={e => setParentCallForm({...parentCallForm, date: e.target.value})} />
                    <input type="text" placeholder="Nama Orang Tua/Wali" required className="w-full border rounded-lg p-2 text-sm" value={parentCallForm.parentName} onChange={e => setParentCallForm({...parentCallForm, parentName: e.target.value})} />
                    <input type="text" placeholder="No HP Orang Tua/Wali" required className="w-full border rounded-lg p-2 text-sm" value={parentCallForm.parentPhone} onChange={e => setParentCallForm({...parentCallForm, parentPhone: e.target.value})} />
                    <textarea placeholder="Masalah Siswa" required className="w-full border rounded-lg p-2 text-sm h-16" value={parentCallForm.problem} onChange={e => setParentCallForm({...parentCallForm, problem: e.target.value})} />
                    <textarea placeholder="Solusi" required className="w-full border rounded-lg p-2 text-sm h-16" value={parentCallForm.solution} onChange={e => setParentCallForm({...parentCallForm, solution: e.target.value})} />
                    <textarea placeholder="Rencana Tindak Lanjut" required className="w-full border rounded-lg p-2 text-sm h-16" value={parentCallForm.followUp} onChange={e => setParentCallForm({...parentCallForm, followUp: e.target.value})} />
                    <textarea placeholder="Keterangan" className="w-full border rounded-lg p-2 text-sm h-16" value={parentCallForm.notes} onChange={e => setParentCallForm({...parentCallForm, notes: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-pink-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-pink-700 disabled:opacity-50">Simpan Panggilan Ortu</button>
                 </form>
              )}

              {activeTab === 'print' && (
                 <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-800">
                       Silakan pilih kelas dan nama siswa terlebih dahulu untuk menampilkan data rekam jejak lengkap.
                    </div>
                    <button 
                       onClick={handlePrint}
                       disabled={!selectedStudentId}
                       className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <Printer size={18} /> Unduh / Cetak PDF
                    </button>
                    <button 
                       onClick={handleDocExport}
                       disabled={!selectedStudentId}
                       className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <FileText size={18} /> Unduh Docx (.doc)
                    </button>
                    <button 
                       onClick={handleExcelExport}
                       disabled={!selectedStudentId}
                       className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <FileSpreadsheet size={18} /> Unduh Excel (.xlsx)
                    </button>
                 </div>
              )}
           </div>
        </div>

        {/* LIST DATA / PREVIEW (Right Column) */}
        <div className="lg:col-span-2">
           {activeTab === 'dashboard' ? (() => {
              const allSiswaData = getSiswaDashboardData();
              const selectedClassName = allSchoolClasses.find(c => c.id === selectedClassId)?.name;
              
              // Filter based on search & class & risk
              const filteredDashboardData = allSiswaData.filter(item => {
                 const matchesClass = selectedClassId ? (item.className === selectedClassName) : true;
                 const matchesSearch = dashboardSearch 
                    ? (item.name.toLowerCase().includes(dashboardSearch.toLowerCase()) || item.id.includes(dashboardSearch))
                    : true;
                 const matchesRisk = riskFilter === 'ALL' ? true : item.riskLevel === riskFilter;
                 return matchesClass && matchesSearch && matchesRisk;
              });

              // Stats Calculations
              const totalViolationsCount = violations.length;
              const totalReductionsCount = reductions.length;
              const totalViolationsPoints = violations.reduce((acc, v) => acc + v.points, 0);
              const totalReductionsPoints = reductions.reduce((acc, r) => acc + r.pointsRemoved, 0);
              const highRiskSiswaCount = allSiswaData.filter(s => s.netPoints > 50).length;
              const recoveryRate = totalViolationsPoints > 0 ? Math.round((totalReductionsPoints / totalViolationsPoints) * 100) : 0;

              // Recent Activity Logs (Violations & Reductions merged and sorted)
              const recentActivityLogs = [
                 ...violations.map(v => ({
                    id: v.id,
                    studentId: v.studentId,
                    date: v.date,
                    type: 'VIOLATION' as const,
                    title: v.violationName,
                    points: v.points,
                    desc: v.description,
                    by: v.reportedBy || 'Guru BK'
                 })),
                 ...reductions.map(r => ({
                    id: r.id,
                    studentId: r.studentId,
                    date: r.date,
                    type: 'REDUCTION' as const,
                    title: r.activityName,
                    points: -r.pointsRemoved,
                    desc: r.description,
                    by: 'Wali Kelas / BK'
                 }))
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

              // Top Violations Category aggregation
              const categoriesCount: Record<string, number> = {};
              violations.forEach(v => {
                 const cat = v.violationName || 'Lainnya';
                 categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
              });
              const topCategories = Object.entries(categoriesCount)
                 .map(([name, count]) => ({ name, count }))
                 .sort((a, b) => b.count - a.count)
                 .slice(0, 5);

              return (
                 <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 text-left">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center border-b pb-4">
                       <div>
                          <h3 className="font-bold text-gray-800 text-lg">Dashboard Pemantauan & Kolaborasi</h3>
                          <p className="text-xs text-gray-500">Rekapitulasi kedisiplinan siswa real-time tersinkronisasi</p>
                       </div>
                       <span className="text-[10px] bg-purple-50 text-purple-600 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">Live Sync</span>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="bg-gradient-to-br from-red-50 to-red-100/30 p-4 rounded-xl border border-red-100 relative overflow-hidden">
                          <div className="absolute right-2 top-2 bg-red-100/50 p-1.5 rounded-lg text-red-600">
                             <FileWarning size={14} />
                          </div>
                          <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Total Sanksi</span>
                          <div className="text-xl font-black text-red-900 mt-1">{totalViolationsPoints} <span className="text-xs font-semibold">pts</span></div>
                          <div className="text-[9px] text-red-500 font-medium mt-1">{totalViolationsCount} kejadian terekam</div>
                       </div>

                       <div className="bg-gradient-to-br from-green-50 to-green-100/30 p-4 rounded-xl border border-green-100 relative overflow-hidden">
                          <div className="absolute right-2 top-2 bg-green-100/50 p-1.5 rounded-lg text-green-600">
                             <RefreshCcw size={14} />
                          </div>
                          <span className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Pemulihan</span>
                          <div className="text-xl font-black text-green-900 mt-1">{totalReductionsPoints} <span className="text-xs font-semibold">pts</span></div>
                          <div className="text-[9px] text-green-600 font-medium mt-1">{totalReductionsCount} kegiatan mandiri</div>
                       </div>

                       <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/30 p-4 rounded-xl border border-yellow-100 relative overflow-hidden">
                          <div className="absolute right-2 top-2 bg-yellow-100/50 p-1.5 rounded-lg text-yellow-600">
                             <ShieldAlert size={14} />
                          </div>
                          <span className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider">Risiko Tinggi</span>
                          <div className="text-xl font-black text-yellow-900 mt-1">{highRiskSiswaCount} <span className="text-xs font-semibold">anak</span></div>
                          <div className="text-[9px] text-yellow-600 font-medium mt-1">Akumulasi &gt; 50 poin</div>
                       </div>

                       <div className="bg-gradient-to-br from-purple-50 to-purple-100/30 p-4 rounded-xl border border-purple-100 relative overflow-hidden">
                          <div className="absolute right-2 top-2 bg-purple-100/50 p-1.5 rounded-lg text-purple-600">
                             <Activity size={14} />
                          </div>
                          <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Rasio Pemulihan</span>
                          <div className="text-xl font-black text-purple-900 mt-1">{recoveryRate}%</div>
                          <div className="text-[9px] text-purple-600 font-medium mt-1">Kedisiplinan membaik</div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                       
                       {/* Left Stats Section: Active Point Rankings (Deteksi Threshold) */}
                       <div className="xl:col-span-2 space-y-4">
                          <div className="flex justify-between items-center">
                             <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                <AlertCircle size={16} className="text-purple-600" /> Deteksi Sanksi & Ambang Batas (Threshold)
                             </h4>
                             {selectedClassId && (
                                <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded">
                                   Kelas: {selectedClassName}
                                </span>
                             )}
                          </div>

                          <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                             <div className="max-h-[300px] overflow-y-auto">
                                {filteredDashboardData.filter(x => x.netPoints > 0).length === 0 ? (
                                   <div className="p-12 text-center text-gray-400">
                                      <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
                                      <p className="text-xs font-bold text-gray-700">Tidak ada siswa dengan poin pelanggaran aktif.</p>
                                   </div>
                                ) : (
                                   <table className="w-full text-xs text-left">
                                      <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100 sticky top-0">
                                         <tr>
                                            <th className="p-3">Siswa</th>
                                            <th className="p-3 text-center">Net Poin</th>
                                            <th className="p-3">Risiko</th>
                                            <th className="p-3">Rekomendasi / Tindakan</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                         {filteredDashboardData.filter(x => x.netPoints > 0).map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition">
                                               <td className="p-3 font-bold text-gray-800">
                                                  <div>{item.name}</div>
                                                  <div className="text-[9px] text-gray-400 font-mono">NIS: {item.id} • Kelas {item.className}</div>
                                               </td>
                                               <td className="p-3 text-center">
                                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                                     item.netPoints > 100 
                                                     ? 'bg-red-200 text-red-900' 
                                                     : item.netPoints > 50 
                                                     ? 'bg-red-100 text-red-700' 
                                                     : item.netPoints > 20 
                                                     ? 'bg-yellow-100 text-yellow-800' 
                                                     : 'bg-blue-50 text-blue-700'
                                                  }`}>
                                                     {item.netPoints} pts
                                                  </span>
                                               </td>
                                               <td className="p-3">
                                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.riskColor}`}>
                                                     {item.riskLevel}
                                                  </span>
                                               </td>
                                               <td className="p-3">
                                                  <div className="flex items-center justify-between gap-2">
                                                     <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[150px]" title={item.recommendation}>
                                                        {item.recommendation}
                                                     </span>
                                                     <button
                                                        onClick={() => {
                                                           setSelectedStudentId(item.id);
                                                           setActiveTab('print');
                                                        }}
                                                        className="bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white p-1 rounded transition"
                                                        title="Buka Folder Rekam Jejak"
                                                     >
                                                        <Search size={12} />
                                                     </button>
                                                  </div>
                                               </td>
                                            </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                )}
                             </div>
                          </div>
                       </div>

                       {/* Right Column: Mini Statistics & Category breakdown */}
                       <div className="space-y-4">
                          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                             <BarChart3 size={16} className="text-purple-600" /> Kategori Terbanyak
                          </h4>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                             {topCategories.length === 0 ? (
                                <p className="text-xs text-gray-400 italic text-center py-6">Belum ada data statistik sanksi.</p>
                             ) : (
                                topCategories.map((cat, idx) => {
                                   const maxCount = Math.max(...topCategories.map(c => c.count));
                                   const percentage = maxCount > 0 ? Math.round((cat.count / maxCount) * 100) : 0;
                                   return (
                                      <div key={cat.name} className="space-y-1">
                                         <div className="flex justify-between text-xs font-semibold text-gray-700">
                                            <span className="truncate max-w-[130px]" title={cat.name}>{cat.name}</span>
                                            <span className="text-purple-600">{cat.count} sanksi</span>
                                         </div>
                                         <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                               className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                                               style={{ width: `${percentage}%` }}
                                            />
                                         </div>
                                      </div>
                                   );
                                })
                             )}
                          </div>

                          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                             <h5 className="font-extrabold text-purple-800 text-xs flex items-center gap-1.5 mb-1.5">
                                <ShieldAlert size={12} /> Aturan Poin & Tindakan
                             </h5>
                             <ul className="text-[10px] text-purple-700 space-y-1 pl-3.5 list-disc font-semibold">
                                <li><strong>1 - 20 Pts:</strong> Teguran & Pembinaan Wali Kelas</li>
                                <li><strong>21 - 50 Pts:</strong> Konseling BK SP-1</li>
                                <li><strong>51 - 100 Pts:</strong> Panggilan Ortu SP-2</li>
                                <li><strong>&gt; 100 Pts:</strong> Sidang Skorsing / DO</li>
                             </ul>
                          </div>
                       </div>
                    </div>

                    {/* Real-time Collaboration Feed: Recent Activity Logs */}
                    <div className="space-y-4 pt-2">
                       <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                          <Clock size={16} className="text-purple-600" /> Kolaborasi Harian Terakhir (Saling Terintegrasi)
                       </h4>
                       <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
                          <div className="max-h-[250px] overflow-y-auto">
                             {recentActivityLogs.length === 0 ? (
                                <p className="p-8 text-center text-gray-400 text-xs">Belum ada aktivitas terekam hari ini.</p>
                             ) : (
                                recentActivityLogs.map((log) => {
                                   const stInfo = getStudentDisplay(log.studentId);
                                   return (
                                      <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-gray-50/50 transition text-xs">
                                         <div className="flex gap-3 items-start text-left">
                                            <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                                               log.type === 'VIOLATION' 
                                               ? 'bg-red-50 text-red-600' 
                                               : 'bg-green-50 text-green-600'
                                            }`}>
                                               {log.type === 'VIOLATION' ? <FileWarning size={14} /> : <RefreshCcw size={14} />}
                                            </div>
                                            <div>
                                               <div className="font-bold text-gray-800">
                                                  {stInfo?.name || 'Siswa'} <span className="text-gray-400 font-medium">({stInfo?.className})</span>
                                               </div>
                                               <div className="text-gray-700 mt-0.5 flex items-center gap-1.5">
                                                  <span className="font-semibold">{log.title}</span>
                                                  <span className={`px-1 rounded font-mono text-[9px] font-bold ${
                                                     log.type === 'VIOLATION' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                  }`}>
                                                     {log.points > 0 ? `+${log.points}` : log.points} pts
                                                  </span>
                                               </div>
                                               {log.desc && <p className="text-[11px] text-gray-500 mt-1 italic leading-relaxed">"{log.desc}"</p>}
                                               <div className="text-[9px] text-gray-400 mt-1 flex items-center gap-2 font-semibold">
                                                  <span>Dicatat oleh: <strong className="text-purple-600">{log.by}</strong></span>
                                                  <span>•</span>
                                                  <span>{log.date}</span>
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                   );
                                })
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
              );
           })() : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                 <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">
                       {activeTab === 'print' ? 'Preview Laporan Siswa' : `Riwayat Data (${activeTab})`}
                    </h3>
                    {selectedStudentId && getStudentDisplay(selectedStudentId) && <span className="text-xs bg-white px-2 py-1 rounded border text-blue-600 font-medium">Filter: {getStudentDisplay(selectedStudentId)?.name}</span>}
                 </div>
                 
                 <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  
                  {/* MONITOR PRIORITAS TAB */}
                  {activeTab === 'priority' && (() => {
                    const filteredPriorityStudents = getFilteredPriorityStudents();

                    return (
                    <div className="p-4 space-y-4">
                      {isLoadingPriority ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                          <RefreshCcw size={36} className="animate-spin mb-4 text-red-500 opacity-70" />
                          <p className="font-semibold text-gray-700 text-sm">Menganalisis data presensi & akumulasi poin kedisiplinan...</p>
                          <p className="text-xs text-gray-400 mt-1">Memindai data presensi harian, buku pelanggaran siswa, dan ambang batas SP-1 (&gt; 20 poin)</p>
                        </div>
                      ) : flaggedStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-emerald-600 bg-emerald-50/50 rounded-2xl border border-emerald-100 m-2">
                          <ShieldAlert size={52} className="mb-3 text-emerald-500 opacity-60" />
                          <p className="font-bold text-base text-gray-800 text-center">Tidak ada siswa yang memerlukan tindakan prioritas saat ini.</p>
                          <p className="text-xs text-emerald-700 mt-1 font-medium text-center max-w-md">
                            Seluruh siswa dalam zona aman: tidak terdeteksi 3+ hari absen berturut-turut, 5+ kali terlambat sebulan, maupun siswa dengan akumulasi poin &gt; 20 (SP-1).
                          </p>
                          <span className="mt-3 px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] rounded-full uppercase tracking-wider font-extrabold">
                            Safe Zone
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Header Summary & Filter Chips */}
                          <div className="bg-gradient-to-r from-red-50/70 via-orange-50/50 to-purple-50/70 p-3.5 rounded-xl border border-red-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2 bg-red-600 text-white rounded-lg shadow-xs">
                                <AlertTriangle size={18} />
                              </span>
                              <div>
                                <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                                  Siswa Perlu Perhatian Khusus
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                    {filteredPriorityStudents.length} {filteredPriorityStudents.length !== flaggedStudents.length ? `dari ${flaggedStudents.length}` : 'Siswa'}
                                  </span>
                                </h4>
                                <p className="text-[11px] text-gray-500">
                                  Prioritas berdasarkan ketidakhadiran alfa, keterlambatan, dan akumulasi poin sanksi (&gt; 20 poin / SP-1 ke atas)
                                </p>
                              </div>
                            </div>

                            {/* Filter Chips */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPriorityFilter('ALL')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                  priorityFilter === 'ALL'
                                    ? 'bg-gray-900 text-white shadow-xs'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                Semua ({flaggedStudents.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setPriorityFilter('POINTS')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                  priorityFilter === 'POINTS'
                                    ? 'bg-purple-700 text-white shadow-xs'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                Poin &gt; 20 / SP-1+ ({flaggedStudents.filter(f => f.hasPointIssue).length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setPriorityFilter('ABSENCE')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                  priorityFilter === 'ABSENCE'
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                Absen 3+ Hari ({flaggedStudents.filter(f => f.hasAbsenceIssue).length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setPriorityFilter('TARDY')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                  priorityFilter === 'TARDY'
                                    ? 'bg-orange-600 text-white shadow-xs'
                                    : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                Terlambat ({flaggedStudents.filter(f => f.hasTardyIssue).length})
                              </button>
                            </div>
                          </div>

                          {/* Student Cards */}
                          {filteredPriorityStudents.length === 0 ? (
                            <div className="p-8 text-center bg-white rounded-xl border border-gray-100 text-gray-400">
                              <p className="text-sm font-medium">Tidak ada siswa yang sesuai kriteria filter saat ini.</p>
                              <button
                                type="button"
                                onClick={() => { setPriorityFilter('ALL'); setPrioritySearch(''); }}
                                className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                              >
                                Reset Filter & Pencarian
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3.5">
                              {filteredPriorityStudents.map((item) => {
                                const { 
                                  student, 
                                  tardies, 
                                  tardyDetails, 
                                  maxConsecutive, 
                                  maxConsecutiveDates, 
                                  totalAlfa, 
                                  alfaDetails, 
                                  hadirCount, 
                                  sakitCount, 
                                  izinCount, 
                                  netPoints, 
                                  totalVPoints, 
                                  totalRPoints, 
                                  spLevel, 
                                  spTitle, 
                                  reasons, 
                                  hasPointIssue, 
                                  hasAbsenceIssue, 
                                  hasTardyIssue, 
                                  violationsCount, 
                                  sessionsCount, 
                                  parentCallsCount, 
                                  homeVisitsCount 
                                } = item;
                                const stInfo = getStudentDisplay(student.id);

                                return (
                                  <div 
                                    key={student.id} 
                                    className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group ${
                                      spLevel === 'SP-3' 
                                        ? 'border-red-300 bg-red-50/20 ring-1 ring-red-200' 
                                        : spLevel === 'SP-2' 
                                        ? 'border-orange-200 bg-orange-50/15' 
                                        : hasPointIssue 
                                        ? 'border-purple-200 bg-purple-50/15' 
                                        : 'border-red-100'
                                    }`}
                                  >
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                      <div className="flex gap-3.5 items-start flex-1 min-w-0">
                                        <div className="relative shrink-0">
                                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base ring-2 ${
                                            spLevel === 'SP-3' 
                                              ? 'bg-red-100 text-red-700 ring-red-300' 
                                              : spLevel === 'SP-2' 
                                              ? 'bg-orange-100 text-orange-700 ring-orange-300' 
                                              : hasPointIssue 
                                              ? 'bg-purple-100 text-purple-700 ring-purple-300' 
                                              : 'bg-red-50 text-red-600 ring-red-100'
                                          }`}>
                                            {student.name.charAt(0)}
                                          </div>
                                          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                                            spLevel === 'SP-3' 
                                              ? 'bg-red-600 animate-ping' 
                                              : spLevel === 'SP-2' 
                                              ? 'bg-orange-500' 
                                              : hasPointIssue 
                                              ? 'bg-purple-600' 
                                              : 'bg-red-500'
                                          }`}>
                                            <AlertTriangle size={8} className="text-white" />
                                          </div>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h5 className="font-extrabold text-gray-900 group-hover:text-red-600 transition-colors text-sm truncate">
                                              {student.name}
                                            </h5>

                                            {/* Status Badge SP */}
                                            {spLevel === 'SP-3' && (
                                              <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded-md text-[10px] font-black uppercase tracking-tight flex items-center gap-1">
                                                <AlertTriangle size={10} className="text-red-600" /> SP-3 / Sidang DO ({netPoints} Pts)
                                              </span>
                                            )}
                                            {spLevel === 'SP-2' && (
                                              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded-md text-[10px] font-black uppercase tracking-tight flex items-center gap-1">
                                                <AlertTriangle size={10} className="text-orange-600" /> SP-2 / Panggilan Ortu ({netPoints} Pts)
                                              </span>
                                            )}
                                            {spLevel === 'SP-1' && (
                                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded-md text-[10px] font-black uppercase tracking-tight flex items-center gap-1">
                                                <AlertCircle size={10} className="text-purple-600" /> Prioritas SP-1 ({netPoints} Pts)
                                              </span>
                                            )}
                                            {netPoints <= 20 && netPoints > 0 && (
                                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-semibold">
                                                {netPoints} Pts Net
                                              </span>
                                            )}
                                          </div>

                                          <p className="text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                                            <Shield size={12} className="text-gray-400" />
                                            <span>Kelas: <strong className="text-gray-700">{stInfo?.className || student.classId}</strong></span>
                                            {student.nis && (
                                              <>
                                                <span>•</span>
                                                <span>NIS: <strong className="text-gray-700">{student.nis}</strong></span>
                                              </>
                                            )}
                                          </p>

                                          {/* Reasons Badges */}
                                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {reasons.map((reason: string, i: number) => {
                                              const isPointReason = reason.includes('Poin') || reason.includes('SP-');
                                              const isAbsenceReason = reason.includes('Absen') || reason.includes('Alfa');
                                              const isTardyReason = reason.includes('Terlambat');

                                              return (
                                                <span 
                                                  key={i} 
                                                  className={`px-2.5 py-1 text-[10px] rounded-lg font-bold border flex items-center gap-1 ${
                                                    isPointReason
                                                      ? spLevel === 'SP-3'
                                                        ? 'bg-red-100 text-red-800 border-red-200 font-extrabold'
                                                        : spLevel === 'SP-2'
                                                        ? 'bg-orange-100 text-orange-800 border-orange-200 font-extrabold'
                                                        : 'bg-purple-50 text-purple-800 border-purple-200'
                                                      : isAbsenceReason
                                                      ? 'bg-red-50 text-red-700 border-red-200'
                                                      : 'bg-orange-50 text-orange-700 border-orange-200'
                                                  }`}
                                                >
                                                  {isPointReason && <ShieldAlert size={11} className="shrink-0" />}
                                                  {isAbsenceReason && <CalendarDays size={11} className="shrink-0" />}
                                                  {isTardyReason && <AlertCircle size={11} className="shrink-0" />}
                                                  {reason}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Quick Action Buttons */}
                                      <div className="flex flex-row md:flex-col gap-1.5 w-full md:w-auto shrink-0">
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setSelectedClassId(student.classId);
                                            setSelectedStudentId(student.id);
                                            setActiveTab('parentCalls');
                                          }}
                                          className={`flex-1 text-[11px] px-3.5 py-1.5 rounded-lg font-bold transition-all shadow-xs flex items-center justify-center gap-1 ${
                                            spLevel === 'SP-2' || spLevel === 'SP-3'
                                              ? 'bg-red-600 text-white hover:bg-red-700 hover:scale-105'
                                              : 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white'
                                          }`}
                                          title="Buat Surat Panggilan Orang Tua Siswa"
                                        >
                                          <Smartphone size={12} /> Panggilan Ortu
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setSelectedClassId(student.classId);
                                            setSelectedStudentId(student.id);
                                            setActiveTab('counseling');
                                          }}
                                          className={`flex-1 text-[11px] px-3.5 py-1.5 rounded-lg font-bold transition-all shadow-xs flex items-center justify-center gap-1 ${
                                            spLevel === 'SP-1'
                                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
                                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700'
                                          }`}
                                          title="Catat / Jadwalkan Sesi Konseling Siswa"
                                        >
                                          <MessageSquareHeart size={12} /> Jadwalkan Konseling
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expandable Attendance Breakdown & Log */}
                                    <div className="mt-3">
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandAttendance(student.id)}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition border ${
                                          hasAbsenceIssue || hasTardyIssue
                                            ? 'bg-amber-50/70 border-amber-200 text-amber-950 hover:bg-amber-100/70'
                                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <CalendarDays size={14} className={hasAbsenceIssue ? "text-red-600 shrink-0" : "text-amber-600 shrink-0"} />
                                          <span>
                                            <strong>Rincian & Log Presensi:</strong>{' '}
                                            <span className={totalAlfa > 0 ? "text-red-700 font-bold" : "text-gray-600"}>
                                              {totalAlfa || 0} Hari Alfa
                                            </span>
                                            {maxConsecutive >= 3 && (
                                              <span className="text-red-600 font-black ml-1">({maxConsecutive}x berturut-turut)</span>
                                            )}
                                            {' • '}
                                            <span className={tardies > 0 ? "text-orange-700 font-bold" : "text-gray-600"}>
                                              {tardies || 0}x Terlambat
                                            </span>
                                            {' • '}
                                            <span className="text-gray-500 font-normal">
                                              (Hadir: {hadirCount || 0}, Sakit: {sakitCount || 0}, Izin: {izinCount || 0})
                                            </span>
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 shrink-0">
                                          <span>{expandedAttendanceIds[student.id] ? 'Tutup Rincian' : 'Buka Log Tanggal'}</span>
                                          {expandedAttendanceIds[student.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                      </button>

                                      {/* Expanded Attendance Details Box */}
                                      {expandedAttendanceIds[student.id] && (
                                        <div className="mt-2 p-3.5 bg-gray-50/90 border border-gray-200 rounded-xl space-y-3 text-xs animate-in fade-in duration-200">
                                          {/* Alfa Log */}
                                          <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                              <span className="font-bold text-red-800 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-red-600" />
                                                Riwayat Tanggal Absen / Alfa ({totalAlfa || 0} Hari)
                                              </span>
                                              {maxConsecutive >= 3 && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-extrabold">
                                                  {maxConsecutive} Hari Berturut-turut
                                                </span>
                                              )}
                                            </div>
                                            {alfaDetails && alfaDetails.length > 0 ? (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {alfaDetails.map((alfa: any, idx: number) => {
                                                  const isConsecutiveDate = maxConsecutiveDates && maxConsecutiveDates.includes(alfa.date);
                                                  return (
                                                    <div 
                                                      key={idx} 
                                                      className={`p-2 rounded-lg border text-[11px] flex flex-col justify-between ${
                                                        isConsecutiveDate 
                                                          ? 'bg-red-100/70 border-red-300 text-red-900 font-bold shadow-xs' 
                                                          : 'bg-white border-red-100 text-gray-800'
                                                      }`}
                                                    >
                                                      <div className="flex items-center justify-between">
                                                        <span className="font-semibold">{formatIndonesianDate(alfa.date)}</span>
                                                        {isConsecutiveDate && (
                                                          <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-black">
                                                            BERUNTUN
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                                                        <span>{alfa.source}</span>
                                                        {alfa.notes && <span className="italic truncate max-w-[120px]">{alfa.notes}</span>}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <p className="text-gray-400 italic text-[11px]">Tidak ada catatan tanggal alfa / tanpa keterangan.</p>
                                            )}
                                          </div>

                                          {/* Tardiness Log */}
                                          <div className="pt-2.5 border-t border-gray-200">
                                            <span className="font-bold text-orange-800 flex items-center gap-1.5 mb-1.5">
                                              <span className="w-2 h-2 rounded-full bg-orange-500" />
                                              Riwayat Tanggal Keterlambatan ({tardies || 0} Kali)
                                            </span>
                                            {tardyDetails && tardyDetails.length > 0 ? (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {tardyDetails.map((tardy: any, idx: number) => (
                                                  <div key={idx} className="p-2 bg-white border border-orange-200 rounded-lg text-[11px]">
                                                    <div className="flex items-center justify-between font-bold text-orange-950">
                                                      <span>{formatIndonesianDate(tardy.date)}</span>
                                                      <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                                                        {tardy.time || 'Terlambat'}
                                                      </span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                                                      <span>{tardy.source}</span>
                                                      {tardy.notes && <span className="italic truncate max-w-[120px]">{tardy.notes}</span>}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-gray-400 italic text-[11px]">Tidak ada catatan keterlambatan.</p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Bottom Indicators & Link to Digital Folder */}
                                    <div className="mt-3.5 pt-3 border-t border-dashed border-gray-100 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                                        <span className="flex items-center gap-1 font-medium">
                                          <div className={`w-1.5 h-1.5 rounded-full ${netPoints > 20 ? 'bg-purple-600' : 'bg-gray-400'}`} />
                                          Poin Bersih: <strong className={netPoints > 20 ? 'text-purple-800' : 'text-gray-700'}>{netPoints} Pts</strong>
                                          <span className="text-[10px] text-gray-400">({totalVPoints} Plg, -{totalRPoints} Pml)</span>
                                        </span>
                                        <span className="flex items-center gap-1 font-medium">
                                          <div className={`w-1.5 h-1.5 rounded-full ${hasAbsenceIssue ? 'bg-red-600' : 'bg-gray-400'}`} />
                                          Alfa: <strong className={hasAbsenceIssue ? 'text-red-700' : 'text-gray-700'}>{totalAlfa || 0} hari</strong>
                                          {maxConsecutive >= 3 && <span className="text-[10px] text-red-600 font-bold">({maxConsecutive}x beruntun)</span>}
                                        </span>
                                        <span className="flex items-center gap-1 font-medium">
                                          <div className={`w-1.5 h-1.5 rounded-full ${hasTardyIssue ? 'bg-orange-500' : 'bg-gray-400'}`} />
                                          Terlambat: <strong className={hasTardyIssue ? 'text-orange-700' : 'text-gray-700'}>{tardies || 0}x</strong>
                                        </span>
                                        <span className="flex items-center gap-1 font-medium">
                                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                          Konseling BK: <strong className="text-gray-700">{sessionsCount} sesi</strong>
                                        </span>
                                        {parentCallsCount > 0 && (
                                          <span className="flex items-center gap-1 font-medium">
                                            <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
                                            Panggilan: <strong className="text-gray-700">{parentCallsCount}x</strong>
                                          </span>
                                        )}
                                        {homeVisitsCount > 0 && (
                                          <span className="flex items-center gap-1 font-medium">
                                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                                            Home Visit: <strong className="text-gray-700">{homeVisitsCount}x</strong>
                                          </span>
                                        )}
                                      </div>

                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setSelectedClassId(student.classId);
                                          setSelectedStudentId(student.id);
                                          setActiveTab('print');
                                        }}
                                        className="text-[11px] text-indigo-600 font-extrabold flex items-center gap-1 hover:text-indigo-800 hover:underline transition-colors ml-auto"
                                        title="Buka Folder Rekam Jejak Digital & Cetak Dokumen"
                                      >
                                        <Search size={12} strokeWidth={2.5} /> Buka Folder Digital & Cetak
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })()}
                 
                 {/* PRINT PREVIEW TAB */}
                 {activeTab === 'print' && (
                    selectedStudentId && getStudentDisplay(selectedStudentId) ? (
                       <div className="p-6 space-y-6">
                          <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                             <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl">
                                {getStudentDisplay(selectedStudentId)?.name.charAt(0)}
                             </div>
                             <div>
                                <h2 className="text-xl font-bold text-gray-800">{getStudentDisplay(selectedStudentId)?.name}</h2>
                                <p className="text-gray-500">Kelas {getStudentDisplay(selectedStudentId)?.className} • NIS: {students.find(s => s.id === selectedStudentId)?.nis || '-'}</p>
                             </div>
                          </div>

                          {/* Summary Points Calculation */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex gap-6 text-sm">
                             <div>
                                <span className="text-gray-500 block text-xs">Total Pelanggaran</span>
                                <span className="font-bold text-red-600">{violations.filter(v => v.studentId === selectedStudentId).reduce((a,b)=>a+b.points,0)} Poin</span>
                             </div>
                             <div>
                                <span className="text-gray-500 block text-xs">Total Dikurangi</span>
                                <span className="font-bold text-green-600">{reductions.filter(r => r.studentId === selectedStudentId).reduce((a,b)=>a+b.pointsRemoved,0)} Poin</span>
                             </div>
                             <div className="border-l pl-6">
                                <span className="text-gray-500 block text-xs">Sisa Poin Aktif</span>
                                <span className="font-bold text-gray-800 text-lg">
                                   {Math.max(0, violations.filter(v => v.studentId === selectedStudentId).reduce((a,b)=>a+b.points,0) - reductions.filter(r => r.studentId === selectedStudentId).reduce((a,b)=>a+b.pointsRemoved,0))}
                                </span>
                             </div>
                          </div>

                          {/* Preview Sections */}
                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-red-500 pl-2">A. Pelanggaran</h4>
                             {violations.filter(v => v.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {violations.filter(v => v.studentId === selectedStudentId).map(v => (
                                      <li key={v.id}>{v.date} - {v.violationName} ({v.points} poin)</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan pelanggaran.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-green-500 pl-2">B. Pemulihan Poin</h4>
                             {reductions.filter(r => r.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {reductions.filter(r => r.studentId === selectedStudentId).map(r => (
                                      <li key={r.id}>{r.date} - {r.activityName} (-{r.pointsRemoved} poin)</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan pemulihan poin.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-yellow-500 pl-2">C. Prestasi</h4>
                             {achievements.filter(a => a.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {achievements.filter(a => a.studentId === selectedStudentId).map(a => (
                                      <li key={a.id}>{a.date} - {a.title} ({a.level})</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan prestasi.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-blue-500 pl-2">D. Konseling</h4>
                             {sessions.filter(s => s.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {sessions.filter(s => s.studentId === selectedStudentId).map(s => (
                                      <li key={s.id}>{s.date} - {s.issue}</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan konseling.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-orange-500 pl-2">E. Home Visit</h4>
                             {homeVisits.filter(hv => hv.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {homeVisits.filter(hv => hv.studentId === selectedStudentId).map(hv => (
                                      <li key={hv.id}>{hv.date} - {hv.reason} ({hv.address})</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan home visit.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-pink-500 pl-2">F. Panggilan Ortu</h4>
                             {parentCalls.filter(pc => pc.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {parentCalls.filter(pc => pc.studentId === selectedStudentId).map(pc => (
                                      <li key={pc.id}>{pc.date} - {pc.parentName} ({pc.problem})</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan panggilan orang tua.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-amber-500 pl-2">G. Presensi & Disiplin Kehadiran</h4>
                             {(() => {
                                const stPriority = flaggedStudents.find(f => f.student.id === selectedStudentId);
                                if (!stPriority || (stPriority.totalAlfa === 0 && stPriority.tardies === 0)) {
                                   return <p className="text-sm text-gray-400 italic">Tidak ada catatan ketidakhadiran alfa atau keterlambatan berulang.</p>;
                                }
                                return (
                                   <div className="space-y-2 text-sm">
                                      <div className="flex flex-wrap gap-4 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                                         <div>
                                            <span className="text-gray-500 block">Total Alfa:</span>
                                            <strong className="text-red-700 font-bold text-sm">{stPriority.totalAlfa} Hari</strong>
                                            {stPriority.maxConsecutive >= 3 && (
                                               <span className="text-red-600 block text-[11px] font-bold">({stPriority.maxConsecutive} hari berturut-turut)</span>
                                            )}
                                         </div>
                                         <div>
                                            <span className="text-gray-500 block">Total Terlambat:</span>
                                            <strong className="text-orange-700 font-bold text-sm">{stPriority.tardies} Kali</strong>
                                         </div>
                                         <div>
                                            <span className="text-gray-500 block">Status Presensi Lain:</span>
                                            <span className="text-gray-700">{stPriority.hadirCount || 0} Hadir, {stPriority.sakitCount || 0} Sakit, {stPriority.izinCount || 0} Izin</span>
                                         </div>
                                      </div>

                                      {stPriority.alfaDetails && stPriority.alfaDetails.length > 0 && (
                                         <div>
                                            <span className="font-semibold text-gray-700 text-xs block mb-1">Rincian Tanggal Alfa / Tanpa Keterangan:</span>
                                            <ul className="list-disc pl-5 space-y-0.5 text-xs text-red-700">
                                               {stPriority.alfaDetails.map((alfa: any, idx: number) => (
                                                  <li key={idx}>
                                                     {formatIndonesianDate(alfa.date)} ({alfa.source}){alfa.notes ? ` - ${alfa.notes}` : ''}
                                                     {stPriority.maxConsecutiveDates && stPriority.maxConsecutiveDates.includes(alfa.date) ? ' [Berturut-turut]' : ''}
                                                  </li>
                                               ))}
                                            </ul>
                                         </div>
                                      )}

                                      {stPriority.tardyDetails && stPriority.tardyDetails.length > 0 && (
                                         <div>
                                            <span className="font-semibold text-gray-700 text-xs block mb-1">Rincian Tanggal Keterlambatan:</span>
                                            <ul className="list-disc pl-5 space-y-0.5 text-xs text-orange-800">
                                               {stPriority.tardyDetails.map((tardy: any, idx: number) => (
                                                  <li key={idx}>
                                                     {formatIndonesianDate(tardy.date)} - {tardy.time || 'Terlambat'} ({tardy.source}){tardy.notes ? ` - ${tardy.notes}` : ''}
                                                  </li>
                                               ))}
                                            </ul>
                                         </div>
                                      )}
                                   </div>
                                );
                             })()}
                          </div>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                          <Search size={48} className="mb-4 opacity-20" />
                          <p>Pilih siswa di menu sebelah kiri untuk melihat preview laporan.</p>
                       </div>
                    )
                 )}

                 {/* LIST VIOLATIONS */}
                 {activeTab === 'violations' && (
                    violations.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data pelanggaran di kelas Anda.</p> :
                    violations.map(v => {
                       const stInfo = getStudentDisplay(v.studentId);
                       if (!stInfo) return null; // Skip if student not in teacher's classes
                       if (selectedStudentId && v.studentId !== selectedStudentId) return null; if (selectedClassId && !selectedStudentId && studentMap[v.studentId]?.classId !== selectedClassId) return null;

                       return (
                        <div key={v.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full">{v.points} Poin</span>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium mt-1">{v.violationName}</p>
                                    <p className="text-xs text-gray-500 mt-1">{v.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-2">Pelapor: {v.reportedBy} • {v.date}</p>
                                </div>
                                <button onClick={() => handleDelete(v.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}

                 {/* LIST REDUCTIONS */}
                 {activeTab === 'reductions' && (
                    reductions.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data pengurangan poin di kelas Anda.</p> :
                    reductions.map(r => {
                       const stInfo = getStudentDisplay(r.studentId);
                       if (!stInfo) return null;
                       if (selectedStudentId && r.studentId !== selectedStudentId) return null; if (selectedClassId && !selectedStudentId && studentMap[r.studentId]?.classId !== selectedClassId) return null;

                       return (
                        <div key={r.id} className="p-4 hover:bg-gray-50 border-l-4 border-green-400">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">-{r.pointsRemoved} Poin</span>
                                    </div>
                                    <p className="text-sm text-green-700 font-bold mt-1 flex items-center gap-1"><RefreshCcw size={14}/> {r.activityName}</p>
                                    <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-2">{r.date}</p>
                                </div>
                                <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}

                 {/* LIST ACHIEVEMENTS */}
                 {activeTab === 'achievements' && (
                    achievements.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data prestasi di kelas Anda.</p> :
                    achievements.map(a => {
                       const stInfo = getStudentDisplay(a.studentId);
                       if (!stInfo) return null; // Skip if student not in teacher's classes
                       if (selectedStudentId && a.studentId !== selectedStudentId) return null; if (selectedClassId && !selectedStudentId && studentMap[a.studentId]?.classId !== selectedClassId) return null;

                       return (
                        <div key={a.id} className="p-4 hover:bg-gray-50 border-l-4 border-yellow-400">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                    </div>
                                    <p className="text-sm text-yellow-700 font-bold mt-1 flex items-center gap-1"><Trophy size={14}/> {a.title}</p>
                                    <span className="inline-block bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded mt-1">{a.level}</span>
                                    <p className="text-xs text-gray-500 mt-2">{a.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{a.date}</p>
                                </div>
                                <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}

                 {/* LIST COUNSELING */}
                 {activeTab === 'counseling' && (
                    sessions.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada sesi konseling di kelas Anda.</p> :
                    sessions.map(s => {
                       const stInfo = getStudentDisplay(s.studentId);
                       if (!stInfo) return null; // Skip if student not in teacher's classes
                       if (selectedStudentId && s.studentId !== selectedStudentId) return null; if (selectedClassId && !selectedStudentId && studentMap[s.studentId]?.classId !== selectedClassId) return null;

                       return (
                        <div key={s.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Masalah</span>
                                        <p className="text-sm text-gray-700 font-medium">{s.issue}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded mt-2 border border-gray-100">
                                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{s.notes}</p>
                                    </div>
                                    {s.followUp && (
                                        <p className="text-xs text-purple-600 mt-2 font-medium">TL: {s.followUp}</p>
                                     )}
                                     <p className="text-[10px] text-gray-400 mt-2">{s.date}</p>
                                 </div>
                                 <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                             </div>
                         </div>
                        );
                     })
                  )}

                  {/* LIST HOME VISITS */}
                  {activeTab === 'homeVisits' && (
                     homeVisits.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data kunjungan rumah.</p> :
                     homeVisits.map(hv => {
                        const stInfo = getStudentDisplay(hv.studentId);
                        if (!stInfo) return null;
                        if (selectedStudentId && hv.studentId !== selectedStudentId) return null;
                        if (selectedClassId && !selectedStudentId) {
                           const studentClassId = hv.classId || studentMap[hv.studentId]?.classId;
                           if (studentClassId !== selectedClassId) return null;
                        }

                        return (
                         <div key={hv.id} className="p-4 hover:bg-gray-50 border-l-4 border-orange-400">
                             <div className="flex justify-between items-start">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                         <div className="font-bold text-gray-800">{stInfo.name}</div>
                                     </div>
                                     <p className="text-sm text-orange-700 font-bold mt-1 flex items-center gap-1"><Home size={14}/> {hv.reason}</p>
                                     <p className="text-xs text-gray-600 mt-1"><strong>Alamat:</strong> {hv.address}</p>
                                     <p className="text-xs text-gray-500 mt-1"><strong>Hasil:</strong> {hv.result}</p>
                                     {hv.followUp && (
                                         <p className="text-xs text-purple-600 mt-1"><strong>Rencana Tindak Lanjut:</strong> {hv.followUp}</p>
                                     )}
                                     {hv.notes && <p className="text-xs text-gray-400 mt-1 italic">"{hv.notes}"</p>}
                                     <p className="text-[10px] text-gray-400 mt-2">{hv.date}</p>
                                 </div>
                                 <button onClick={() => handleDelete(hv.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                             </div>
                         </div>
                        );
                     })
                  )}

                  {/* LIST PARENT CALLS */}
                  {activeTab === 'parentCalls' && (
                     parentCalls.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data panggilan orang tua.</p> :
                     parentCalls.map(pc => {
                        const stInfo = getStudentDisplay(pc.studentId);
                        if (!stInfo) return null;
                        if (selectedStudentId && pc.studentId !== selectedStudentId) return null;
                        if (selectedClassId && !selectedStudentId) {
                           const studentClassId = pc.classId || studentMap[pc.studentId]?.classId;
                           if (studentClassId !== selectedClassId) return null;
                        }

                        return (
                         <div key={pc.id} className="p-4 hover:bg-gray-50 border-l-4 border-pink-400">
                             <div className="flex justify-between items-start">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                         <div className="font-bold text-gray-800">{stInfo.name}</div>
                                     </div>
                                     <p className="text-sm text-pink-700 font-bold mt-1 flex items-center gap-1"><Smartphone size={14}/> Panggilan Orang Tua ({pc.parentName})</p>
                                     {pc.parentPhone && <p className="text-xs text-gray-600 mt-1"><strong>No HP:</strong> {pc.parentPhone}</p>}
                                     <p className="text-xs text-gray-600 mt-1"><strong>Masalah:</strong> {pc.problem}</p>
                                     <p className="text-xs text-gray-500 mt-1"><strong>Solusi:</strong> {pc.solution}</p>
                                     {pc.followUp && (
                                         <p className="text-xs text-purple-600 mt-1"><strong>Rencana Tindak Lanjut:</strong> {pc.followUp}</p>
                                     )}
                                     {pc.notes && <p className="text-xs text-gray-400 mt-1 italic">"{pc.notes}"</p>}
                                     <p className="text-[10px] text-gray-400 mt-2">{pc.date}</p>
                                 </div>
                                 <button onClick={() => handleDelete(pc.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                             </div>
                         </div>
                        );
                     })
                  )}

              </div>
           </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TeacherGuidance;
