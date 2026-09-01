
import React, { useState, useEffect } from 'react';
import { User, ClassRoom, ScopeMaterial, TeachingJournal, SD_SUBJECTS_PHASE_A, SD_SUBJECTS_PHASE_BC, MATH_SUBJECT_OPTIONS, AbsentStudent, TeachingSchedule, Student } from '../types';
import { getClasses, getScopeMaterials, getTeachingJournals, addTeachingJournal, updateTeachingJournal, deleteTeachingJournal, bulkDeleteTeachingJournals, getStudents, getTeachingSchedules, getLocalDate, isSubjectMatching, getAbsentAttendanceRecords } from '../services/database';
import { Plus, Save, Trash2, Filter, Printer, FileSpreadsheet, NotebookPen, CalendarDays, ChevronLeft, ChevronRight, UserMinus, Pencil, Copy, Search, X, Sparkles, Check, CheckSquare, Square, RefreshCcw, ClipboardList, Zap, AlertCircle, CheckCircle } from './Icons';
import Skeleton from './Skeleton';
import * as XLSX from 'xlsx';
import { GeminiActivityAssistantModal } from './GeminiActivityAssistantModal';

const ABSENT_STATUS_MAP: Record<string, string> = { S: 'Sakit', I: 'Ijin', A: 'Alfa' };

interface TeacherJournalProps {
  user: User;
}

const TeacherJournal: React.FC<TeacherJournalProps> = ({ user }) => {
  // 1. Form & Data States (Declare these first)
  const [formData, setFormData] = useState({
    classId: '',
    materialId: '',
    learningObjective: '',
    date: getLocalDate(),
    meetingNo: '',
    activities: '',
    reflection: '',
    followUp: '',
    examAgenda: ''
  });
  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    if (user.subject === 'Matematika') return MATH_SUBJECT_OPTIONS[0];
    return user.subject || '';
  });
  const [formSubject, setFormSubject] = useState<string>(() => {
    if (user.subject === 'Matematika') return MATH_SUBJECT_OPTIONS[0];
    return user.subject || '';
  });
  
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allMaterials, setAllMaterials] = useState<ScopeMaterial[]>([]);
  const [materialMap, setMaterialMap] = useState<Record<string, ScopeMaterial>>({});
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([]);
  const [selectedAbsentStudentId, setSelectedAbsentStudentId] = useState('');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);

  // States for Siswa Tidak Hadir (Two Methods: Manual & Auto from Attendance)
  const [absentInputMode, setAbsentInputMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [attendanceAbsentList, setAttendanceAbsentList] = useState<{ studentId: string; name: string; status: 'S' | 'I' | 'A'; selected: boolean }[]>([]);
  const [isLoadingAttendanceAbsents, setIsLoadingAttendanceAbsents] = useState(false);
  const [attendanceAbsentChecked, setAttendanceAbsentChecked] = useState(false);

  // 2. Filter & UI States
  const [filterClassId, setFilterClassId] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printMode, setPrintMode] = useState<'BULANAN' | 'SEMESTER'>('BULANAN');
  const [printSemester, setPrintSemester] = useState<'Ganjil' | 'Genap' | '1 Tahun'>('Ganjil');
  const [printClassStudents, setPrintClassStudents] = useState<Student[]>([]);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [copySearch, setCopySearch] = useState<string>('');
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);

  const [validationData, setValidationData] = useState({
    placeName: localStorage.getItem('journal_place_name') || '',
    principalName: localStorage.getItem('journal_principal_name') || '',
    principalNip: localStorage.getItem('journal_principal_nip') || '',
    teacherName: localStorage.getItem('journal_teacher_name') || user.fullName,
    teacherNip: localStorage.getItem('journal_teacher_nip') || user.nip || ''
  });

  const getDayName = (dateStr: string) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date(dateStr).getDay()];
  };

  // 3. Effects

  // Fetch Students for Absentee List
  useEffect(() => {
    if (formData.classId) {
      getStudents(formData.classId).then(setClassStudents);
    } else {
      setClassStudents([]);
      setAbsentStudents([]);
    }
  }, [formData.classId]);

  // Fetch absent students from attendance records (Alfa, Sakit, Ijin)
  const handleFetchAbsentFromAttendance = async (targetClassId?: string, targetDate?: string) => {
    const cId = targetClassId || formData.classId;
    const dt = targetDate || formData.date;
    if (!cId || !dt) {
      return;
    }
    setIsLoadingAttendanceAbsents(true);
    setAttendanceAbsentChecked(true);
    try {
      const records = await getAbsentAttendanceRecords(cId, dt);
      
      let students = classStudents;
      if (students.length === 0 || students[0]?.classId !== cId) {
        students = await getStudents(cId);
        setClassStudents(students);
      }
      const studentMap = new Map(students.map(s => [s.id, s.name]));

      const seen = new Set<string>();
      const absents: { studentId: string; name: string; status: 'S' | 'I' | 'A'; selected: boolean }[] = [];
      
      for (const r of records) {
        if (!seen.has(r.studentId)) {
          seen.add(r.studentId);
          const name = studentMap.get(r.studentId) || 'Siswa';
          absents.push({
            studentId: r.studentId,
            name,
            status: (r.status === 'S' || r.status === 'I' || r.status === 'A') ? r.status : 'A',
            selected: true
          });
        }
      }

      setAttendanceAbsentList(absents);
    } catch (err) {
      console.error('Error fetching absent records from attendance', err);
    } finally {
      setIsLoadingAttendanceAbsents(false);
    }
  };

  // Trigger auto-fetch when in AUTO mode or when classId / date changes
  useEffect(() => {
    if (absentInputMode === 'AUTO' && formData.classId && formData.date) {
      handleFetchAbsentFromAttendance(formData.classId, formData.date);
    } else {
      setAttendanceAbsentChecked(false);
    }
  }, [absentInputMode, formData.classId, formData.date]);

  const handleToggleAutoAbsentSelect = (studentId: string) => {
    setAttendanceAbsentList(prev => prev.map(item => item.studentId === studentId ? { ...item, selected: !item.selected } : item));
  };

  const handleToggleSelectAllAutoAbsents = () => {
    const allSelected = attendanceAbsentList.length > 0 && attendanceAbsentList.every(item => item.selected);
    setAttendanceAbsentList(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleChangeAutoAbsentStatus = (studentId: string, newStatus: 'S' | 'I' | 'A') => {
    setAttendanceAbsentList(prev => prev.map(item => item.studentId === studentId ? { ...item, status: newStatus } : item));
  };

  const handleApplyAutoAbsents = () => {
    const selectedItems = attendanceAbsentList.filter(item => item.selected);
    if (selectedItems.length === 0) {
      alert('Silakan pilih minimal 1 siswa tidak hadir untuk dimasukkan ke jurnal.');
      return;
    }

    setAbsentStudents(prev => {
      const map = new Map(prev.map(item => [item.studentId, item]));
      selectedItems.forEach(item => {
        map.set(item.studentId, {
          studentId: item.studentId,
          name: item.name,
          status: item.status
        });
      });
      return Array.from(map.values());
    });
  };

  // Fetch Students for Class Filter (For Print/Export Semester Recap)
  useEffect(() => {
    if (filterClassId) {
      getStudents(filterClassId).then(setPrintClassStudents);
    } else {
      setPrintClassStudents([]);
    }
  }, [filterClassId]);

  // Fetch Schedules for Jam Ke (Range)
  useEffect(() => {
    const fetchSchedules = async () => {
      if (user.id && user.schoolNpsn) {
        const allSchedules = await getTeachingSchedules(user.id, user.schoolNpsn);
        setSchedules(allSchedules);
      }
    };
    fetchSchedules();
  }, [user.id, user.schoolNpsn]);

  // Auto-populate Jam Ke (Range) based on Class, Date, and Subject
  useEffect(() => {
    const autoPopulateMeetingNo = async () => {
      if (formData.classId && formData.date && formSubject) {
        const dayName = getDayName(formData.date);
        const cls = classes.find(c => c.id === formData.classId);
        
        if (!cls) return;

        // Fetch schedules for this specific class and day to be more accurate
        // We use all schedules fetched in the other useEffect
        let matchingSchedules = schedules.filter(s => 
          s.className === cls.name &&
          s.day === dayName &&
          s.subject === formSubject
        );

        if (matchingSchedules.length > 0) {
          // Sort by meetingNo to get the range correctly
          matchingSchedules.sort((a, b) => (a.meetingNo || 0) - (b.meetingNo || 0));
          
          const first = matchingSchedules[0];
          const last = matchingSchedules[matchingSchedules.length - 1];
          
          let range = "";
          if (first.meetingNo === last.meetingNo && !first.meetingNoEnd) {
            range = `${first.meetingNo}`;
          } else {
            const start = first.meetingNo;
            const end = last.meetingNoEnd || last.meetingNo;
            range = start === end ? `${start}` : `${start}-${end}`;
          }
          
          setFormData(prev => ({ ...prev, meetingNo: range }));
        }
      }
    };
    
    autoPopulateMeetingNo();
  }, [formData.classId, formData.date, formSubject, schedules, classes]);
  
  // Initialize Subject based on Teacher Type
  useEffect(() => {
    // We default selectedSubject filter to 'ALL' for maximum visibility of saved journals
    setSelectedSubject('ALL');
    
    if (user.isMultiSubject && user.subjects && user.subjects.length > 0) {
      setFormSubject(user.subjects[0]);
    } else if (user.teacherType === 'CLASS') {
      const subjects = (user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A;
      if (!formSubject || !subjects.includes(formSubject)) {
         setFormSubject(subjects[0]);
      }
    } else if (user.subject === 'Matematika' || user.secondarySubject) {
      if (!formSubject || formSubject === 'Matematika') {
         setFormSubject(user.subject === 'Matematika' ? MATH_SUBJECT_OPTIONS[0] : (user.subject || ''));
      }
    } else {
      setFormSubject(user.subject || '');
    }
  }, [user, user.teacherType, user.phase, user.isMultiSubject, user.subjects, user.secondarySubject]);

  // Persist validation data
  useEffect(() => {
    localStorage.setItem('journal_place_name', validationData.placeName);
    localStorage.setItem('journal_principal_name', validationData.principalName);
    localStorage.setItem('journal_principal_nip', validationData.principalNip);
    localStorage.setItem('journal_teacher_name', validationData.teacherName);
    localStorage.setItem('journal_teacher_nip', validationData.teacherNip);
  }, [validationData]);

  const handleValidationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationData({ ...validationData, [e.target.name]: e.target.value });
  };

  // Constants
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  // Dynamic Year List (Realtime)
  const currentRealYear = new Date().getFullYear();
  const yearsList = [currentRealYear - 1, currentRealYear, currentRealYear + 1];

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cls = await getClasses(user.id, user.schoolNpsn);
      setClasses(cls);
      if (cls.length > 0) {
        // Default form class to first available, BUT FILTER defaults to All ('')
        setFormData(prev => {
          const classExists = cls.some(c => c.id === prev.classId);
          if (prev.classId && classExists) {
            return prev;
          }
          return { ...prev, classId: cls[0].id };
        });
      }
      
      // Fetch ALL Materials for Lookup Map (for Print/Export)
      const matMap: Record<string, ScopeMaterial> = {};
      const matPromises = cls.map(async (c) => {
         // PASS 'ALL' to get all materials of this teacher for lookup map
         const ganjil = await getScopeMaterials(c.id, 'Ganjil', user.id, 'ALL');
         const genap = await getScopeMaterials(c.id, 'Genap', user.id, 'ALL');
         return [...ganjil, ...genap];
      });
      const allMatsArrays = await Promise.all(matPromises);
      allMatsArrays.flat().forEach(m => {
         matMap[m.id] = m;
      });
      setMaterialMap(matMap);

      await fetchJournals();
      setLoading(false);
    };
    init();

    // Listen to sync events to refresh data
    const handleSyncStatus = (e: any) => {
        if (e.detail === 'success') {
            fetchJournals();
        }
    };
    window.addEventListener('sync-status', handleSyncStatus);
    
    return () => {
        window.removeEventListener('sync-status', handleSyncStatus);
    };
  }, [user]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterClassId, filterMonth, filterYear, selectedSubject]);

  // Fetch Materials when Form Class Changes (For Dropdown)
  useEffect(() => {
    if (formData.classId && user.id) {
      const fetchMats = async () => {
        // PASS user.id here too
        const matGanjil = await getScopeMaterials(formData.classId, 'Ganjil', user.id, formSubject);
        const matGenap = await getScopeMaterials(formData.classId, 'Genap', user.id, formSubject);
        const combined = [...matGanjil, ...matGenap];
        
        // Deduplicate materials by code and content to prevent duplicate options in dropdown
        const unique: ScopeMaterial[] = [];
        const seen = new Set<string>();
        for (const m of combined) {
          const key = `${(m.code || '').trim().toLowerCase()}|||${(m.content || '').trim().toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(m);
          }
        }
        setAllMaterials(unique);

        // If formData.materialId is set but doesn't exist directly in new target class materials, try to auto-map by code/content
        setFormData(prev => {
          if (!prev.materialId) return prev;
          const exists = unique.some(m => m.id === prev.materialId);
          if (!exists) {
            const srcMat = materialMap[prev.materialId];
            if (srcMat) {
              const matched = unique.find(m => 
                (m.code && srcMat.code && m.code.trim().toLowerCase() === srcMat.code.trim().toLowerCase()) ||
                (m.content && srcMat.content && m.content.trim().toLowerCase() === srcMat.content.trim().toLowerCase())
              );
              if (matched) {
                return { ...prev, materialId: matched.id };
              }
            }
            return { ...prev, materialId: '' };
          }
          return prev;
        });
      };
      fetchMats();
    } else {
      setAllMaterials([]);
    }
  }, [formData.classId, formSubject, user.id]);

  const fetchJournals = async () => {
    const data = await getTeachingJournals(user.id, 'ALL');
    setJournals(data);
  };

  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'classId') {
        setAbsentStudents([]);
        // Don't reset materialId immediately if copying is active, let useEffect auto-map
      }
      return updated;
    });
  };

  const handleCopyJournal = (journal: TeachingJournal) => {
    setEditingJournalId(null); // Create a NEW journal entry

    const srcClass = classes.find(c => c.id === journal.classId);
    const srcClassName = srcClass ? srcClass.name : 'Kelas Lain';

    if (journal.subject) {
      setFormSubject(journal.subject);
    }

    // Attempt to match material in target class if source material exists
    const srcMat = materialMap[journal.materialId];
    let matchedMaterialId = journal.materialId || '';

    if (srcMat && allMaterials.length > 0) {
      const matched = allMaterials.find(m => 
        (m.code && srcMat.code && m.code.trim().toLowerCase() === srcMat.code.trim().toLowerCase()) ||
        (m.content && srcMat.content && m.content.trim().toLowerCase() === srcMat.content.trim().toLowerCase())
      );
      if (matched) {
        matchedMaterialId = matched.id;
      }
    }

    setFormData({
      classId: formData.classId || classes[0]?.id || '',
      materialId: matchedMaterialId,
      learningObjective: journal.learningObjective || '',
      date: getLocalDate(), // default to today for the copied journal
      meetingNo: journal.meetingNo || '',
      activities: journal.activities || '',
      reflection: journal.reflection || '',
      followUp: journal.followUp || '',
      examAgenda: journal.examAgenda || ''
    });

    // Reset absent students since the new class session has different students
    setAbsentStudents([]);

    setCopyNotice(`📋 Isi jurnal disalin dari ${srcClassName} (${journal.subject || ''}). Silakan tentukan Kelas Tujuan, Jam Ke, Tanggal, & Presensi Siswa.`);

    // Scroll to form smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (journal: TeachingJournal) => {
    setEditingJournalId(journal.id);
    setCopyNotice(null);
    setFormData({
      classId: journal.classId,
      materialId: journal.materialId || '',
      learningObjective: journal.learningObjective || '',
      date: journal.date,
      meetingNo: journal.meetingNo || '',
      activities: journal.activities || '',
      reflection: journal.reflection || '',
      followUp: journal.followUp || '',
      examAgenda: journal.examAgenda || ''
    });
    if (journal.subject) {
      setFormSubject(journal.subject);
    }
    const absents = journal.absentStudents ? JSON.parse(journal.absentStudents) : [];
    setAbsentStudents(absents);
    
    // Scroll to top/form section smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingJournalId(null);
    setCopyNotice(null);
    setFormData({
      classId: classes[0]?.id || '',
      materialId: '',
      learningObjective: '',
      date: getLocalDate(),
      meetingNo: '',
      activities: '',
      reflection: '',
      followUp: '',
      examAgenda: ''
    });
    setAbsentStudents([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isExam = !!formData.examAgenda;

    if (!formData.classId || (!isExam && !formData.materialId) || !formData.date || !formData.activities) {
      alert("Mohon lengkapi field wajib (Kelas, LM, Tanggal, Kegiatan).");
      return;
    }

    if (!isExam && user.subject === 'Matematika' && !formSubject) {
        alert('Mohon pilih mata pelajaran spesifik sebelum menyimpan jurnal.');
        return;
    }

    setIsSaving(true);
    
    if (editingJournalId) {
      const updatedJournal = await updateTeachingJournal(editingJournalId, {
        ...formData,
        subject: formSubject,
        absentStudents: JSON.stringify(absentStudents)
      });
      if (updatedJournal) {
        setJournals(journals.map(j => j.id === editingJournalId ? updatedJournal : j));
        setEditingJournalId(null);
        // Reset form to defaults
        setFormData({
          classId: classes[0]?.id || '',
          materialId: '',
          learningObjective: '',
          date: getLocalDate(),
          meetingNo: '',
          activities: '',
          reflection: '',
          followUp: '',
          examAgenda: ''
        });
        setAbsentStudents([]);
        alert('Jurnal berhasil diperbarui!');
      } else {
        alert('Gagal memperbarui jurnal.');
      }
    } else {
      const newJournal = await addTeachingJournal({
        ...formData,
        userId: user.id,
        subject: formSubject,
        absentStudents: JSON.stringify(absentStudents)
      });

      if (newJournal) {
        setJournals([newJournal, ...journals]);
        setCopyNotice(null);
        // Reset form partials (keep class/date/meeting flow)
        setFormData(prev => ({
          ...prev,
          materialId: '',
          learningObjective: '',
          activities: '',
          reflection: '',
          followUp: '',
          examAgenda: ''
        }));
        setAbsentStudents([]);
        alert('Jurnal berhasil disimpan!');
      } else {
        alert('Gagal menyimpan jurnal.');
      }
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus jurnal ini?')) {
      await deleteTeachingJournal(id);
      setJournals(journals.filter(j => j.id !== id));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredJournals.map(j => j.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Hapus ${selectedIds.size} jurnal terpilih?`)) {
      await bulkDeleteTeachingJournals(Array.from(selectedIds));
      setJournals(journals.filter(j => !selectedIds.has(j.id)));
      setSelectedIds(new Set());
    }
  };

  // --- FILTER & PAGINATION LOGIC ---
  const filteredJournals = journals.filter(j => {
    // Robust, timezone-safe date parsing of "YYYY-MM-DD"
    let journalYear = 0;
    let journalMonth = 0;
    
    if (j.date && j.date.includes('-')) {
        const parts = j.date.split('-');
        if (parts.length >= 2) {
            journalYear = parseInt(parts[0], 10);
            journalMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
        }
    } else {
        const d = new Date(j.date);
        journalYear = d.getFullYear();
        journalMonth = d.getMonth();
    }

    const matchClass = filterClassId ? j.classId === filterClassId : true;
    const matchMonth = journalMonth === filterMonth;
    const matchYear = journalYear === filterYear;
    
    // NEW: Subject Filter Logic (Unified and robust)
    const matchSubject = isSubjectMatching(selectedSubject, j.subject || '');

    return matchClass && matchMonth && matchYear && matchSubject;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredJournals.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);

  // --- EXPORT & PRINT LOGIC ---

  const getExportData = () => {
    return filteredJournals.map((j, idx) => {
      const cls = classes.find(c => c.id === j.classId);
      const mat = materialMap[j.materialId];
      // FIX: Resolve Material ID to Text (Code + Content)
      const materialText = j.examAgenda ? `[AGENDA: ${j.examAgenda}]` : (mat ? `[${mat.code}] ${mat.content}` : j.materialId);

      const absents: AbsentStudent[] = j.absentStudents ? JSON.parse(j.absentStudents) : [];
      const absentText = absents.map(a => `${a.name} (${ABSENT_STATUS_MAP[a.status] || a.status})`).join(', ') || '-';

      return {
        no: idx + 1,
        className: cls?.name || '-',
        date: new Date(j.date).toLocaleDateString('id-ID'),
        meeting: j.examAgenda ? '-' : j.meetingNo,
        lm: materialText, 
        tp: j.examAgenda ? '-' : j.learningObjective,
        activity: j.activities,
        absent: absentText,
        reflection: j.reflection || '-',
        followUp: j.followUp || '-'
      };
    });
  };

  // Helper to fetch consolidated 1-semester data and student attendance totals
  const getSemesterData = async () => {
    if (!filterClassId) {
      alert("Mohon pilih Kelas terlebih dahulu pada filter/pengaturan cetak untuk rekap 1 semester.");
      return null;
    }

    const selectedClass = classes.find(c => c.id === filterClassId);
    const className = selectedClass ? selectedClass.name : 'Kelas';

    // 1. Filter journals by class, subject, year, and semester
    const semJournals = journals.filter(j => {
      if (j.classId !== filterClassId) return false;
      if (!isSubjectMatching(selectedSubject, j.subject || '')) return false;

      let journalYear = 0;
      let journalMonth = 0;
      if (j.date && j.date.includes('-')) {
        const parts = j.date.split('-');
        journalYear = parseInt(parts[0], 10);
        journalMonth = parseInt(parts[1], 10) - 1;
      } else {
        const d = new Date(j.date);
        journalYear = d.getFullYear();
        journalMonth = d.getMonth();
      }

      if (journalYear !== filterYear) return false;

      if (printSemester === 'Ganjil') {
        return journalMonth >= 6 && journalMonth <= 11;
      } else if (printSemester === 'Genap') {
        return journalMonth >= 0 && journalMonth <= 5;
      }
      return true; // 1 Tahun Penuh
    });

    semJournals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Fetch students for class
    let students = printClassStudents;
    if (students.length === 0 || (students[0] && students[0].classId !== filterClassId)) {
      students = await getStudents(filterClassId);
      setPrintClassStudents(students);
    }

    // 3. Aggregate Attendance totals per student
    const studentRecap: Record<string, { id: string; nis: string; name: string; gender: string; sakit: number; izin: number; alfa: number; total: number }> = {};

    students.forEach(s => {
      studentRecap[s.id] = {
        id: s.id,
        nis: s.nis || '-',
        name: s.name,
        gender: s.gender || '-',
        sakit: 0,
        izin: 0,
        alfa: 0,
        total: 0
      };
    });

    semJournals.forEach(j => {
      if (j.absentStudents) {
        try {
          const absents: AbsentStudent[] = JSON.parse(j.absentStudents);
          absents.forEach(a => {
            let rec = studentRecap[a.studentId];
            if (!rec) {
              const found = students.find(st => st.name.toLowerCase() === a.name.toLowerCase());
              if (found) rec = studentRecap[found.id];
            }
            if (rec) {
              if (a.status === 'S') rec.sakit += 1;
              else if (a.status === 'I') rec.izin += 1;
              else if (a.status === 'A') rec.alfa += 1;
              rec.total = rec.sakit + rec.izin + rec.alfa;
            }
          });
        } catch (err) {
          console.error("Error parsing absentStudents JSON", err);
        }
      }
    });

    const studentRecapList = Object.values(studentRecap).sort((a, b) => a.name.localeCompare(b.name));

    return {
      className,
      semJournals,
      studentRecapList
    };
  };

  const exportSemesterToExcel = async () => {
    const semData = await getSemesterData();
    if (!semData) return;

    const { className, semJournals, studentRecapList } = semData;
    const subjectName = selectedSubject === 'ALL' ? 'Semua Mata Pelajaran' : selectedSubject;

    // Sheet 1: Jurnal Mengajar Semester
    const journalHeaders = ['No', 'Kelas', 'Tanggal', 'Jam Ke', 'Lingkup Materi', 'Tujuan Pembelajaran', 'Kegiatan Pembelajaran', 'Siswa Tidak Hadir', 'Refleksi', 'Tindak Lanjut'];
    const journalRows = semJournals.map((j, idx) => {
      const cls = classes.find(c => c.id === j.classId);
      const mat = materialMap[j.materialId];
      const materialText = j.examAgenda ? `[AGENDA: ${j.examAgenda}]` : (mat ? `[${mat.code}] ${mat.content}` : j.materialId);
      const absents: AbsentStudent[] = j.absentStudents ? JSON.parse(j.absentStudents) : [];
      const absentText = absents.map(a => `${a.name} (${ABSENT_STATUS_MAP[a.status] || a.status})`).join(', ') || '-';

      return [
        idx + 1,
        cls?.name || className,
        new Date(j.date).toLocaleDateString('id-ID'),
        j.examAgenda ? '-' : j.meetingNo,
        materialText,
        j.examAgenda ? '-' : j.learningObjective,
        j.activities,
        absentText,
        j.reflection || '-',
        j.followUp || '-'
      ];
    });

    const wsJournal = XLSX.utils.aoa_to_sheet([
      [`REKAPITULASI JURNAL MENGAJAR SEMESTER ${printSemester.toUpperCase()}`],
      [`Kelas: ${className} | Mapel: ${subjectName} | Tahun: ${filterYear}`],
      [`Guru: ${user.fullName}`],
      [],
      journalHeaders,
      ...journalRows
    ]);

    // Sheet 2: Rekap Presensi Siswa
    const attendanceHeaders = ['No', 'NIS', 'Nama Siswa', 'L/P', 'Sakit (S)', 'Izin (I)', 'Alfa (A)', 'Total Tidak Hadir'];
    const attendanceRows = studentRecapList.map((s, idx) => [
      idx + 1,
      s.nis,
      s.name,
      s.gender,
      s.sakit,
      s.izin,
      s.alfa,
      s.total
    ]);

    const wsAttendance = XLSX.utils.aoa_to_sheet([
      [`REKAPITULASI PRESENSI SISWA 1 SEMESTER (${printSemester.toUpperCase()})`],
      [`Kelas: ${className} | Mapel: ${subjectName} | Tahun: ${filterYear}`],
      [],
      attendanceHeaders,
      ...attendanceRows
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsJournal, "Jurnal Semester");
    XLSX.utils.book_append_sheet(wb, wsAttendance, "Rekap Presensi Siswa");

    XLSX.writeFile(wb, `Rekap_Jurnal_Semester_${printSemester}_${className}_${filterYear}.xlsx`);
  };

  const exportToExcel = async () => {
    if (printMode === 'SEMESTER') {
      await exportSemesterToExcel();
      return;
    }

    const data = getExportData();
    const headers = ['No', 'Kelas', 'Tanggal', 'Jam Ke', 'Lingkup Materi', 'Tujuan Pembelajaran', 'Kegiatan', 'Ketidakhadiran', 'Refleksi', 'Tindak Lanjut'];
    const rows = data.map(d => Object.values(d));
    
    const ws = XLSX.utils.aoa_to_sheet([
      [`JURNAL MENGAJAR GURU - ${monthNames[filterMonth]} ${filterYear}`],
      [`Guru: ${user.fullName}`],
      [],
      headers,
      ...rows
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurnal Mengajar");
    XLSX.writeFile(wb, `Jurnal_Mengajar_${monthNames[filterMonth]}_${filterYear}.xlsx`);
  };

  const printSemesterToWindow = async () => {
    const semData = await getSemesterData();
    if (!semData) return;

    const { className, semJournals, studentRecapList } = semData;
    const printWindow = window.open('', '', 'height=700,width=1000');
    if (!printWindow) return;

    const subjectName = selectedSubject === 'ALL' ? 'Semua Mata Pelajaran' : selectedSubject;

    const journalRowsHtml = semJournals.map((j, idx) => {
      const cls = classes.find(c => c.id === j.classId);
      const mat = materialMap[j.materialId];
      const materialText = j.examAgenda ? `[AGENDA: ${j.examAgenda}]` : (mat ? `[${mat.code}] ${mat.content}` : j.materialId);
      const absents: AbsentStudent[] = j.absentStudents ? JSON.parse(j.absentStudents) : [];
      const absentText = absents.map(a => `${a.name} (${ABSENT_STATUS_MAP[a.status] || a.status})`).join(', ') || '-';

      return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td class="text-center font-bold">${cls?.name || className}</td>
          <td class="text-center">${new Date(j.date).toLocaleDateString('id-ID')}</td>
          <td class="text-center">${j.examAgenda ? '-' : j.meetingNo}</td>
          <td>${materialText}</td>
          <td>${j.examAgenda ? '-' : j.learningObjective}</td>
          <td>${j.activities}</td>
          <td>${absentText}</td>
          <td>${j.reflection || '-'}</td>
          <td>${j.followUp || '-'}</td>
        </tr>
      `;
    }).join('');

    const attendanceRowsHtml = studentRecapList.map((s, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="text-center">${s.nis}</td>
        <td><strong>${s.name}</strong></td>
        <td class="text-center">${s.gender}</td>
        <td class="text-center ${s.sakit > 0 ? 'highlight-sakit' : ''}">${s.sakit || '-'}</td>
        <td class="text-center ${s.izin > 0 ? 'highlight-izin' : ''}">${s.izin || '-'}</td>
        <td class="text-center ${s.alfa > 0 ? 'highlight-alfa' : ''}">${s.alfa || '-'}</td>
        <td class="text-center font-bold">${s.total || 0}</td>
      </tr>
    `).join('');

    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    printWindow.document.write(`
      <html>
        <head>
          <title>Rekap Jurnal & Presensi Semester ${printSemester} - ${className}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #111; margin: 15px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h2 { margin: 0 0 5px 0; font-size: 16px; text-transform: uppercase; }
            .header h4 { margin: 3px 0; font-size: 12px; font-weight: normal; }
            .section-title { font-size: 13px; font-weight: bold; margin-top: 25px; margin-bottom: 8px; background: #eef2ff; padding: 6px 10px; border-left: 4px solid #2563eb; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #333; padding: 6px; vertical-align: top; }
            th { background-color: #f1f5f9; text-align: center; font-weight: bold; font-size: 11px; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .highlight-sakit { background-color: #fef9c3; font-weight: bold; }
            .highlight-izin { background-color: #e0f2fe; font-weight: bold; }
            .highlight-alfa { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
            .signature-container { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .signature-box { width: 320px; text-align: center; }
            @page { size: landscape; margin: 1cm; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>LAPORAN REKAPITULASI JURNAL MENGAJAR & PRESENSI SISWA</h2>
            <h4>SEMESTER ${printSemester.toUpperCase()} - TAHUN AJARAN ${filterYear}</h4>
            <h4>Kelas: <strong>${className}</strong> | Mata Pelajaran: <strong>${subjectName}</strong> | Guru: <strong>${user.fullName}</strong></h4>
          </div>

          <div class="section-title">A. REKAPITULASI JURNAL KEGIATAN PEMBELAJARAN (${semJournals.length} Pertemuan)</div>
          <table>
            <thead>
              <tr>
                <th width="30">No</th>
                <th width="75">Kelas</th>
                <th width="80">Tanggal</th>
                <th width="45">Jam Ke</th>
                <th width="140">Lingkup Materi</th>
                <th width="150">Tujuan Pembelajaran</th>
                <th>Kegiatan Pembelajaran</th>
                <th width="120">Ketidakhadiran</th>
                <th width="90">Refleksi</th>
                <th width="90">Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              ${semJournals.length === 0 ? '<tr><td colspan="10" class="text-center" style="padding: 15px; color: #666;">Tidak ada catatan jurnal mengajar pada semester ini.</td></tr>' : journalRowsHtml}
            </tbody>
          </table>

          <div class="section-title">B. REKAPITULASI KETIDAKHADIRAN PRESENSI SISWA 1 SEMESTER</div>
          <table>
            <thead>
              <tr>
                <th width="35">No</th>
                <th width="90">NIS</th>
                <th>Nama Siswa</th>
                <th width="40">L/P</th>
                <th width="70">Sakit (S)</th>
                <th width="70">Izin (I)</th>
                <th width="70">Alfa (A)</th>
                <th width="110">Total Tidak Hadir</th>
              </tr>
            </thead>
            <tbody>
              ${studentRecapList.length === 0 ? '<tr><td colspan="8" class="text-center" style="padding: 15px; color: #666;">Data siswa kelas ini belum tersedia.</td></tr>' : attendanceRowsHtml}
            </tbody>
          </table>

          <div class="signature-container">
            <div class="signature-box">
              <p>Mengetahui,</p>
              <p>Kepala Sekolah ${user.schoolName || '[Nama Sekolah]'}</p>
              <br><br><br><br>
              <p style="white-space: nowrap;"><strong>${validationData.principalName || '................................'}</strong></p>
              <p>NIP. ${validationData.principalNip || '................................'}</p>
            </div>
            <div class="signature-box">
              <p>${validationData.placeName || '................'}, ${formattedDate}</p>
              <p>Guru Mata Pelajaran</p>
              <br><br><br><br>
              <p style="white-space: nowrap;"><strong>${validationData.teacherName || user.fullName}</strong></p>
              <p>NIP. ${validationData.teacherNip || user.nip || '................................'}</p>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrint = async () => {
    if (printMode === 'SEMESTER') {
      await printSemesterToWindow();
      return;
    }

    const data = getExportData();
    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;

    const selectedClass = classes.find(c => c.id === filterClassId);
    const classTitle = selectedClass ? selectedClass.name : 'Semua Kelas';

    const rows = data.map(d => `
      <tr>
        <td class="text-center">${d.no}</td>
        <td class="text-center font-bold">${d.className}</td>
        <td class="text-center">${d.date}</td>
        <td class="text-center">${d.meeting}</td>
        <td>${d.lm}</td>
        <td>${d.tp}</td>
        <td>${d.activity}</td>
        <td>${d.absent}</td>
        <td>${d.reflection}</td>
        <td>${d.followUp}</td>
      </tr>
    `).join('');

    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    printWindow.document.write(`
      <html>
        <head>
          <title>Jurnal Mengajar - ${monthNames[filterMonth]} ${filterYear}</title>
          <style>
            body { font-family: sans-serif; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #333; padding: 5px; vertical-align: top; }
            th { background-color: #f0f0f0; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            h2, h4 { text-align: center; margin: 0; padding: 2px; }
            .header { margin-bottom: 20px; }
            .signature-container { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .signature-box { width: 300px; text-align: center; }
            @page { size: landscape; margin: 1cm; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>JURNAL KEGIATAN PEMBELAJARAN (JURNAL MENGAJAR)</h2>
            <h4>Kelas: <strong>${classTitle}</strong> | Mata Pelajaran: <strong>${selectedSubject === 'ALL' ? 'Semua Mata Pelajaran' : selectedSubject}</strong></h4>
            <h4>Periode: ${monthNames[filterMonth]} ${filterYear}</h4>
            <h4>Guru: <strong>${user.fullName}</strong></h4>
          </div>
          <table>
            <thead>
              <tr>
                <th width="30">No</th>
                <th width="75">Kelas</th>
                <th width="80">Tanggal</th>
                <th width="45">Jam Ke</th>
                <th width="140">Lingkup Materi</th>
                <th width="150">Tujuan Pembelajaran</th>
                <th>Kegiatan Pembelajaran</th>
                <th width="120">Ketidakhadiran</th>
                <th width="85">Refleksi</th>
                <th width="85">Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? '<tr><td colspan="10" class="text-center" style="padding: 15px; color: #666;">Tidak ada catatan jurnal mengajar pada periode ini.</td></tr>' : rows}
            </tbody>
          </table>

          <div class="signature-container">
            <div class="signature-box">
              <p>Mengetahui,</p>
              <p>Kepala Sekolah ${user.schoolName || '[Nama Sekolah]'}</p>
              <br><br><br><br>
              <p style="white-space: nowrap;"><strong>${validationData.principalName || '................................'}</strong></p>
              <p>NIP. ${validationData.principalNip || '................................'}</p>
            </div>
            <div class="signature-box">
              <p>${validationData.placeName || '................'}, ${formattedDate}</p>
              <p>Guru Mata Pelajaran</p>
              <br><br><br><br>
              <p style="white-space: nowrap;"><strong>${validationData.teacherName || user.fullName}</strong></p>
              <p>NIP. ${validationData.teacherNip || user.nip || '................................'}</p>
            </div>
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
    <div className="space-y-8 pb-20">
      
      {/* --- SUBJECT SELECTOR REMOVED FROM TOP --- */}

      {/* --- FORM SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
         <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <NotebookPen className="text-blue-600" />
               {editingJournalId ? 'Edit Jurnal' : 'Tambah Jurnal Baru'}
            </h2>
            <button
               type="button"
               onClick={() => setShowCopyModal(true)}
               className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition flex items-center gap-2 shadow-sm"
               title="Salin isi jurnal dari kelas atau pertemuan lain"
            >
               <Copy size={16} /> Salin dari Jurnal Lain
            </button>
         </div>

         {copyNotice && (
            <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-2 text-amber-800 text-xs font-medium animate-in fade-in">
               <div className="flex items-center gap-2">
                  <Copy size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{copyNotice}</span>
               </div>
               <button 
                  type="button" 
                  onClick={() => setCopyNotice(null)} 
                  className="text-amber-600 hover:text-amber-900 font-bold text-sm px-1"
               >
                  ✕
               </button>
            </div>
         )}
         
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Baris 1: Kelas, Mapel, Agenda Ujian */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Kelas *</label>
                  <select 
                     name="classId"
                     value={formData.classId}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                     required
                  >
                     <option value="">Pilih Kelas</option>
                     {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>

               {/* Subject Selector in Form */}
               {(user.teacherType === 'CLASS' || user.subject === 'Matematika' || user.isMultiSubject || user.secondarySubject) && (
                   <div>
                       <label className="block text-sm font-semibold text-blue-700 mb-1">Mata Pelajaran *</label>
                       <select
                           value={formSubject}
                           onChange={(e) => setFormSubject(e.target.value)}
                           className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                           required={!formData.examAgenda}
                           disabled={!!formData.examAgenda}
                       >
                           {user.isMultiSubject ? (
                               (user.subjects || []).map(s => (
                                   <option key={s} value={s}>{s}</option>
                               ))
                           ) : user.teacherType === 'CLASS' ? (
                               ((user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A).map(s => (
                                   <option key={s} value={s}>{s}</option>
                               ))
                           ) : (
                               <>
                                   {user.subject === 'Matematika' ? (
                                       MATH_SUBJECT_OPTIONS.map(m => (
                                           <option key={m} value={m}>{m}</option>
                                       ))
                                   ) : (
                                       <option value={user.subject}>{user.subject}</option>
                                   )}
                                   {user.secondarySubject && (
                                       <option value={user.secondarySubject}>{user.secondarySubject}</option>
                                   )}
                               </>
                           )}
                       </select>
                   </div>
               )}

               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Agenda Ujian (Opsional)</label>
                  <select 
                     name="examAgenda"
                     value={formData.examAgenda}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  >
                     <option value="">Bukan Ujian</option>
                     <option value="Ujian Praktik">Ujian Praktik</option>
                     <option value="Ujian Tulis">Ujian Tulis</option>
                  </select>
               </div>
            </div>

            {/* Baris 2: LM, TP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Lingkup Materi *</label>
                  <select 
                     name="materialId"
                     value={formData.materialId}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                     required={!formData.examAgenda}
                     disabled={!formData.classId || !!formData.examAgenda}
                  >
                     <option value="">{formData.classId ? 'Pilih Materi' : 'Pilih Kelas Dulu'}</option>
                     {allMaterials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.content}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Tujuan Pembelajaran *</label>
                  <input 
                     type="text"
                     name="learningObjective"
                     value={formData.learningObjective}
                     onChange={handleInputChange}
                     placeholder="Contoh: Memahami konsep..."
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                     required={!formData.examAgenda}
                     disabled={!!formData.examAgenda}
                  />
               </div>
            </div>

            {/* Baris 2: Tanggal, Pertemuan Ke */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Tanggal *</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                       type="date"
                       name="date"
                       value={formData.date}
                       onChange={handleInputChange}
                       className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                       required
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Jam Ke (Range) *</label>
                  <input 
                     type="text"
                     name="meetingNo"
                     value={formData.meetingNo}
                     onChange={handleInputChange}
                     placeholder="Contoh: 1-2 atau 3"
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                     required={!formData.examAgenda}
                     disabled={!!formData.examAgenda}
                  />
               </div>
            </div>

            {/* Baris 3: Kegiatan */}
            <div>
               <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-blue-700">Kegiatan Pembelajaran *</label>
                  <button
                    type="button"
                    onClick={() => setIsGeminiModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all"
                  >
                    <Sparkles size={14} className="text-yellow-300" />
                    <span>Bantuan Gemini AI</span>
                  </button>
               </div>
               <textarea 
                  name="activities"
                  rows={3}
                  value={formData.activities}
                  onChange={handleInputChange}
                  placeholder="Uraikan kegiatan pembelajaran yang dilakukan (Pendahuluan, Inti, Penutup)..."
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none leading-relaxed"
                  required
               />
               <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                  <span>Klik <strong>Bantuan Gemini AI</strong> untuk merancang skenario kegiatan dengan opsi Cepat atau Kustom.</span>
                  {formData.learningObjective && !formData.activities && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          activities: `1. Pendahuluan: Berdoa, presensi, apersepsi & pertanyaan pemantik.\n2. Kegiatan Inti: Eksplorasi materi (${formData.learningObjective}), diskusi interaktif, dan penugasan kolaboratif.\n3. Penutup: Refleksi bersama siswa dan asesmen formatif singkat.`
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                    >
                      + Isi Template Cepat
                    </button>
                  )}
               </div>
            </div>

             {/* Baris 4: Refleksi */}
            <div>
               <label className="block text-sm font-semibold text-blue-700 mb-1">Refleksi</label>
               <textarea 
                  name="reflection"
                  rows={2}
                  value={formData.reflection}
                  onChange={handleInputChange}
                  placeholder={formData.examAgenda ? "Tidak aktif saat agenda ujian" : "Refleksi dari kegiatan pembelajaran (opsional)..."}
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none disabled:opacity-50 disabled:bg-gray-200"
                  disabled={!!formData.examAgenda}
               />
            </div>

             {/* Baris 5: Tindak Lanjut */}
             <div>
               <label className="block text-sm font-semibold text-blue-700 mb-1">Tindak Lanjut</label>
               <textarea 
                  name="followUp"
                  rows={2}
                  value={formData.followUp}
                  onChange={handleInputChange}
                  placeholder={formData.examAgenda ? "Tidak aktif saat agenda ujian" : "Tindak lanjut dari refleksi (opsional)..."}
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none disabled:opacity-50 disabled:bg-gray-200"
                  disabled={!!formData.examAgenda}
               />
            </div>

            {/* Section: Siswa Tidak Hadir */}
            <div className="border-t border-gray-100 pt-6">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                     <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <UserMinus className="text-red-500" />
                        Siswa Tidak Hadir
                     </h3>
                     <p className="text-xs text-gray-500 mt-0.5">
                        Pilih metode pengisian siswa yang berhalangan hadir (Sakit, Ijin, Alfa).
                     </p>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="inline-flex p-1 bg-gray-100 rounded-lg border border-gray-200 self-start sm:self-auto">
                     <button
                        type="button"
                        onClick={() => setAbsentInputMode('MANUAL')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                           absentInputMode === 'MANUAL'
                              ? 'bg-white text-blue-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                        }`}
                     >
                        <Pencil size={14} />
                        Cara 1: Manual (Pilih Siswa)
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setAbsentInputMode('AUTO');
                           if (formData.classId && formData.date) {
                              handleFetchAbsentFromAttendance(formData.classId, formData.date);
                           }
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                           absentInputMode === 'AUTO'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                        }`}
                     >
                        <ClipboardList size={14} />
                        Cara 2: Otomatis dari Daftar Hadir
                     </button>
                  </div>
               </div>

               {/* PILIHAN 1: MANUAL (CARA LAMA) */}
               {absentInputMode === 'MANUAL' && (
                  <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 mb-4">
                     <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1">
                           <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Pilih Nama Siswa dari Kelas Ini:
                           </label>
                           <select 
                              value={selectedAbsentStudentId}
                              onChange={(e) => setSelectedAbsentStudentId(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                              disabled={!formData.classId}
                           >
                              <option value="">-- Pilih Nama Siswa --</option>
                              {classStudents
                                 .filter(s => !absentStudents.find(as => as.studentId === s.id))
                                 .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                              }
                           </select>
                        </div>
                        <div className="flex items-end gap-2">
                           <button 
                              type="button"
                              onClick={() => {
                                 if (!selectedAbsentStudentId) return;
                                 const student = classStudents.find(s => s.id === selectedAbsentStudentId);
                                 if (student) {
                                    setAbsentStudents([...absentStudents, { studentId: student.id, name: student.name, status: 'A' }]);
                                    setSelectedAbsentStudentId('');
                                 }
                              }}
                              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!selectedAbsentStudentId}
                           >
                              <Plus size={16} />
                              Tambah Siswa
                           </button>
                           
                           <button
                              type="button"
                              onClick={() => {
                                 setAbsentInputMode('AUTO');
                                 if (formData.classId && formData.date) {
                                    handleFetchAbsentFromAttendance(formData.classId, formData.date);
                                 }
                              }}
                              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-medium transition flex items-center gap-1.5 text-sm"
                              title="Tarik data siswa yang tidak hadir dari daftar presensi tanggal ini"
                           >
                              <Zap size={16} className="text-indigo-600" />
                              <span className="hidden sm:inline">Tarik dari Presensi</span>
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {/* PILIHAN 2: OTOMATIS DARI DAFTAR HADIR */}
               {absentInputMode === 'AUTO' && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-4">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-100">
                        <div>
                           <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center p-1 bg-indigo-100 text-indigo-700 rounded-md">
                                 <ClipboardList size={16} />
                              </span>
                              <h4 className="text-sm font-bold text-gray-900">
                                 Data Ketidakhadiran dari Daftar Hadir
                              </h4>
                           </div>
                           <p className="text-xs text-gray-600 mt-0.5">
                              Memindai status <b>Alfa (A)</b>, <b>Sakit (S)</b>, dan <b>Ijin (I)</b> pada tanggal <b>{formData.date || '-'}</b>
                           </p>
                        </div>

                        <button
                           type="button"
                           onClick={() => handleFetchAbsentFromAttendance(formData.classId, formData.date)}
                           disabled={isLoadingAttendanceAbsents || !formData.classId}
                           className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                        >
                           <RefreshCcw size={14} className={isLoadingAttendanceAbsents ? 'animate-spin' : ''} />
                           Muat Ulang Presensi
                        </button>
                     </div>

                     <div className="mt-3">
                        {isLoadingAttendanceAbsents ? (
                           <div className="py-6 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-2">
                              <RefreshCcw size={20} className="animate-spin text-indigo-600" />
                              <span>Memuat data ketidakhadiran dari daftar hadir...</span>
                           </div>
                        ) : attendanceAbsentList.length > 0 ? (
                           <div>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                 <span className="text-xs font-semibold text-indigo-900 bg-indigo-100/70 px-2.5 py-1 rounded-full w-fit">
                                    Ditemukan {attendanceAbsentList.length} siswa tidak hadir pada tanggal ini
                                 </span>
                                 <div className="flex items-center gap-2">
                                    <button
                                       type="button"
                                       onClick={handleToggleSelectAllAutoAbsents}
                                       className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                                    >
                                       {attendanceAbsentList.every(a => a.selected) ? 'Batalkan Semua' : 'Pilih Semua'}
                                    </button>
                                    <button
                                       type="button"
                                       onClick={handleApplyAutoAbsents}
                                       className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                    >
                                       <Check size={14} />
                                       Masukkan Siswa Terpilih ke Jurnal ({attendanceAbsentList.filter(a => a.selected).length})
                                    </button>
                                 </div>
                              </div>

                              <div className="overflow-hidden border border-indigo-100 rounded-lg bg-white">
                                 <table className="w-full text-xs text-left">
                                    <thead className="bg-indigo-50/60 text-indigo-950 uppercase font-semibold border-b border-indigo-100">
                                       <tr>
                                          <th className="px-3 py-2 w-10 text-center">
                                             <input
                                                type="checkbox"
                                                checked={attendanceAbsentList.length > 0 && attendanceAbsentList.every(a => a.selected)}
                                                onChange={handleToggleSelectAllAutoAbsents}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                             />
                                          </th>
                                          <th className="px-3 py-2 w-12 text-center">No</th>
                                          <th className="px-3 py-2">Nama Siswa</th>
                                          <th className="px-3 py-2 w-44">Status di Presensi</th>
                                          <th className="px-3 py-2 w-28 text-center">Aksi Cepat</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                       {attendanceAbsentList.map((item, idx) => {
                                          const isAlreadyInJournal = absentStudents.some(as => as.studentId === item.studentId);
                                          return (
                                             <tr key={item.studentId} className={`hover:bg-indigo-50/30 transition ${item.selected ? 'bg-indigo-50/20' : ''}`}>
                                                <td className="px-3 py-2 text-center">
                                                   <input
                                                      type="checkbox"
                                                      checked={item.selected}
                                                      onChange={() => handleToggleAutoAbsentSelect(item.studentId)}
                                                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                   />
                                                </td>
                                                <td className="px-3 py-2 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                <td className="px-3 py-2 font-medium text-gray-900">
                                                   <div className="flex items-center gap-1.5">
                                                      <span>{item.name}</span>
                                                      {isAlreadyInJournal && (
                                                         <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                                                            Sudah di Jurnal
                                                         </span>
                                                      )}
                                                   </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                   <select
                                                      value={item.status}
                                                      onChange={(e) => handleChangeAutoAbsentStatus(item.studentId, e.target.value as 'S' | 'I' | 'A')}
                                                      className="border border-gray-300 rounded p-1 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                                   >
                                                      <option value="S">🟡 Sakit (S)</option>
                                                      <option value="I">🔵 Ijin (I)</option>
                                                      <option value="A">🔴 Alfa (A)</option>
                                                   </select>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                   <button
                                                      type="button"
                                                      onClick={() => {
                                                         setAbsentStudents(prev => {
                                                            const filtered = prev.filter(as => as.studentId !== item.studentId);
                                                            return [...filtered, { studentId: item.studentId, name: item.name, status: item.status }];
                                                         });
                                                      }}
                                                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold transition"
                                                   >
                                                      {isAlreadyInJournal ? 'Perbarui' : '+ Masukkan'}
                                                   </button>
                                                </td>
                                             </tr>
                                          );
                                       })}
                                    </tbody>
                                 </table>
                              </div>
                           </div>
                        ) : (
                           <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                              <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                 <CheckCircle size={20} className="text-emerald-500" />
                              </div>
                              <p className="text-xs font-semibold text-gray-800">
                                 Tidak Ada Siswa Tercatat Sakit, Izin, atau Alfa
                              </p>
                              <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto">
                                 Semua siswa pada tanggal <b>{formData.date || '-'}</b> tercatat Hadir di daftar hadir, atau data presensi belum diinput.
                              </p>
                              <div className="mt-3 flex justify-center gap-2">
                                 <button
                                    type="button"
                                    onClick={() => setAbsentInputMode('MANUAL')}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
                                 >
                                    Beralih ke Input Manual
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => handleFetchAbsentFromAttendance(formData.classId, formData.date)}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition flex items-center gap-1"
                                 >
                                    <RefreshCcw size={12} />
                                    Cek Ulang
                                 </button>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {/* TABEL FINAL: SISWA TIDAK HADIR PADA JURNAL */}
               <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Daftar Siswa Tidak Hadir pada Jurnal Ini</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                           absentStudents.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                           {absentStudents.length} Siswa
                        </span>
                     </span>

                     {absentStudents.length > 0 && (
                        <button
                           type="button"
                           onClick={() => setAbsentStudents([])}
                           className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline flex items-center gap-1"
                        >
                           <Trash2 size={12} />
                           Hapus Semua
                        </button>
                     )}
                  </div>

                  {absentStudents.length > 0 ? (
                     <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-gray-50 text-gray-700 uppercase text-xs border-b border-gray-200">
                              <tr>
                                 <th className="px-4 py-2.5 w-16 text-center">No</th>
                                 <th className="px-4 py-2.5">Nama Siswa</th>
                                 <th className="px-4 py-2.5 w-44">Keterangan</th>
                                 <th className="px-4 py-2.5 w-16 text-center">Aksi</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-200 bg-white">
                              {absentStudents.map((s, idx) => (
                                 <tr key={s.studentId} className="hover:bg-gray-50/80 transition">
                                    <td className="px-4 py-2.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                                    <td className="px-4 py-2.5">
                                       <select 
                                          value={s.status}
                                          onChange={(e) => {
                                             const newStatus = e.target.value as 'S' | 'I' | 'A';
                                             setAbsentStudents(absentStudents.map(as => as.studentId === s.studentId ? { ...as, status: newStatus } : as));
                                          }}
                                          className="w-full border border-gray-300 rounded-md p-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                       >
                                          <option value="S">🟡 Sakit (S)</option>
                                          <option value="I">🔵 Ijin (I)</option>
                                          <option value="A">🔴 Alfa (A)</option>
                                       </select>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                       <button 
                                          type="button"
                                          onClick={() => setAbsentStudents(absentStudents.filter(as => as.studentId !== s.studentId))}
                                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                                          title="Hapus dari daftar"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  ) : (
                     <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center text-xs text-gray-500">
                        Belum ada siswa tidak hadir yang dimasukkan ke jurnal. Semua siswa dianggap hadir.
                     </div>
                  )}
               </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
               {editingJournalId && (
                  <button 
                     type="button"
                     onClick={handleCancelEdit}
                     className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-6 rounded-lg transition"
                  >
                     Batal
                  </button>
               )}
               <button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition flex items-center gap-2"
               >
                  <Save size={18} />
                  {isSaving ? 'Menyimpan...' : (editingJournalId ? 'Simpan Perubahan' : 'Simpan Jurnal')}
               </button>
            </div>
         </form>
      </div>

      {/* --- FILTER SECTION (Moved Below Form) --- */}
      {/* Filter removed for Class Teachers as requested */}

      {/* --- LIST & FILTER SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
         {/* Filter Header */}
         <div className="p-6 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-6 bg-gray-50 rounded-t-xl">
             <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                 {/* Subject Filter (For Multi-Subject) */}
                 {(user.isMultiSubject || user.teacherType === 'CLASS' || user.subject === 'Matematika' || user.secondarySubject) && (
                    <div className="relative">
                       <select 
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="w-full sm:w-48 pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm font-medium"
                       >
                          <option value="ALL">Semua Mapel</option>
                          {user.isMultiSubject ? (
                             (user.subjects || []).map(s => <option key={s} value={s}>{s}</option>)
                          ) : user.teacherType === 'CLASS' ? (
                             ((user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A).map(s => (
                                <option key={s} value={s}>{s}</option>
                             ))
                          ) : (
                             <>
                                {user.subject === 'Matematika' ? (
                                   MATH_SUBJECT_OPTIONS.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                   ))
                                ) : (
                                   <option value={user.subject}>{user.subject}</option>
                                )}
                                {user.secondarySubject && (
                                   <option value={user.secondarySubject}>{user.secondarySubject}</option>
                                )}
                             </>
                          )}
                       </select>
                       <Filter size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                    </div>
                 )}

                 {/* Class Filter */}
                 <div className="relative">
                    <select 
                       value={filterClassId}
                       onChange={(e) => setFilterClassId(e.target.value)}
                       className="w-full sm:w-48 pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm font-medium"
                    >
                       <option value="">Semua Kelas</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Filter size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                 </div>

                 {/* Month Filter */}
                 <select 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    className="w-full sm:w-40 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                 >
                    {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                 </select>

                 {/* Year Filter */}
                 <select 
                    value={filterYear}
                    onChange={(e) => setFilterYear(parseInt(e.target.value))}
                    className="w-full sm:w-28 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                 >
                    {yearsList.map(y => (
                       <option key={y} value={y}>{y}</option>
                    ))}
                 </select>
             </div>

             <div className="flex flex-wrap gap-2">
                 {selectedIds.size > 0 && (
                   <button 
                     onClick={handleBulkDelete}
                     className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2.5 rounded-lg text-sm font-medium transition mr-auto xl:mr-0"
                   >
                     <Trash2 size={16} /> Hapus ({selectedIds.size})
                   </button>
                 )}
                  <button 
                     onClick={() => setShowPrintSettings(!showPrintSettings)}
                     className={`flex items-center gap-2 border px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm ${showPrintSettings ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                     <Printer size={16} /> Print / PDF
                  </button>
                  <button 
                     onClick={exportToExcel}
                     className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
                  >
                     <FileSpreadsheet size={16} /> Unduh Excel
                  </button>
              </div>
          </div>

          {/* Print Settings Panel */}
          {showPrintSettings && (
             <div className="p-6 bg-blue-50 border-b border-blue-100 animate-in slide-in-from-top duration-200">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      <Printer size={16} /> Pengaturan Cetak & Validasi
                   </h3>
                   <button 
                      onClick={handlePrint}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2"
                   >
                      <Printer size={16} /> Cetak Sekarang
                   </button>
                </div>

                {/* Print Mode Selector */}
                <div className="mb-6 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                   <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Pilih Mode / Jenis Laporan</label>
                   <div className="flex flex-wrap gap-3">
                      <button
                         type="button"
                         onClick={() => setPrintMode('BULANAN')}
                         className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${printMode === 'BULANAN' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                         📄 Jurnal Bulanan
                      </button>
                      <button
                         type="button"
                         onClick={() => setPrintMode('SEMESTER')}
                         className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${printMode === 'SEMESTER' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                         📊 Rekap Jurnal 1 Semester (+ Presensi Siswa)
                      </button>
                   </div>

                   {printMode === 'SEMESTER' && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Semester</label>
                            <select
                               value={printSemester}
                               onChange={(e) => setPrintSemester(e.target.value as any)}
                               className="w-full text-xs border border-gray-300 rounded-md p-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                               <option value="Ganjil">Semester Ganjil (Juli - Desember)</option>
                               <option value="Genap">Semester Genap (Januari - Juni)</option>
                               <option value="1 Tahun">1 Tahun Penuh</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Kelas *</label>
                            <select
                               value={filterClassId}
                               onChange={(e) => setFilterClassId(e.target.value)}
                               className="w-full text-xs border border-gray-300 rounded-md p-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                               <option value="">-- Pilih Kelas --</option>
                               {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                         </div>
                         <div className="md:col-span-2 text-[11px] text-blue-700 bg-blue-50/70 p-2.5 rounded border border-blue-100">
                            ℹ️ <strong>Catatan Rekap Semester:</strong> Laporan ini mencakup gabungan seluruh jurnal mengajar selama 1 semester serta akumulasi ketidakhadiran siswa (Sakit, Izin, Alfa) per siswa untuk membantu pertimbangan penilaian.
                         </div>
                      </div>
                   )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">Kepala Sekolah</p>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">Nama Kepala Sekolah</label>
                         <input 
                            type="text"
                            name="principalName"
                            value={validationData.principalName}
                            onChange={handleValidationChange}
                            placeholder="Nama Lengkap & Gelar"
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">NIP Kepala Sekolah</label>
                         <input 
                            type="text"
                            name="principalNip"
                            value={validationData.principalNip}
                            onChange={handleValidationChange}
                            placeholder="NIP"
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">Guru Mata Pelajaran</p>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">Nama Guru</label>
                         <input 
                            type="text"
                            name="teacherName"
                            value={validationData.teacherName}
                            onChange={handleValidationChange}
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">NIP Guru</label>
                         <input 
                            type="text"
                            name="teacherNip"
                            value={validationData.teacherNip}
                            onChange={handleValidationChange}
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">Lokasi & Tanggal</p>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">Nama Tempat (Kota/Kecamatan)</label>
                         <input 
                            type="text"
                            name="placeName"
                            value={validationData.placeName}
                            onChange={handleValidationChange}
                            placeholder="Contoh: Jakarta"
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div className="p-3 bg-white rounded border border-blue-100">
                         <p className="text-[10px] text-gray-400 mb-1">Tanggal Cetak Otomatis:</p>
                         <p className="text-sm font-medium text-gray-700">
                            {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          )}

         {/* List Items */}
         <div className="overflow-x-auto">
            {loading ? (
               <div className="space-y-4 p-6">
                  {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 animate-pulse">
                          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                          <div className="flex-1 space-y-3">
                              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                              <div className="h-20 bg-gray-200 rounded w-full"></div>
                          </div>
                      </div>
                  ))}
               </div>
            ) : filteredJournals.length === 0 ? (
               <div className="p-16 text-center text-gray-400">
                  <NotebookPen size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Tidak ada jurnal pada periode ini.</p>
               </div>
            ) : (
               <>
                 {/* Desktop Table View */}
                 <div className="hidden md:block">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-white text-gray-600 font-semibold border-b border-gray-200">
                        <tr>
                           <th className="p-4 w-10">
                              <input 
                                 type="checkbox" 
                                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                 onChange={handleSelectAll}
                                 checked={filteredJournals.length > 0 && selectedIds.size === filteredJournals.length}
                              />
                           </th>
                           <th className="p-4 w-32">Tanggal</th>
                           <th className="p-4 w-36">Mata Pelajaran</th>
                           <th className="p-4 w-20 text-center">Jam Ke</th>
                           <th className="p-4 w-48">Kelas / Materi</th>
                           <th className="p-4 min-w-[300px]">Kegiatan Pembelajaran</th>
                           <th className="p-4 w-20 text-center">Aksi</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {currentItems.map(journal => {
                           const cls = classes.find(c => c.id === journal.classId);
                           const mat = materialMap[journal.materialId];
                           return (
                              <tr key={journal.id} className="hover:bg-gray-50 transition group">
                                 <td className="p-4 align-top">
                                    <input 
                                       type="checkbox" 
                                       className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                       checked={selectedIds.has(journal.id)}
                                       onChange={() => handleToggleSelect(journal.id)}
                                    />
                                 </td>
                                 <td className="p-4 align-top">
                                    <div className="font-medium text-gray-900">
                                       {new Date(journal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                 </td>
                                 <td className="p-4 align-top">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                       {journal.subject || '-'}
                                    </span>
                                 </td>
                                 <td className="p-4 align-top text-center">
                                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${journal.examAgenda ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                                       {journal.examAgenda ? '-' : journal.meetingNo}
                                    </span>
                                 </td>
                                 <td className="p-4 align-top">
                                    <div className="font-bold text-gray-800 mb-1">{cls?.name || 'Unknown Class'}</div>
                                    <div className={`text-xs px-2 py-1 rounded inline-block ${journal.examAgenda ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-gray-100 text-gray-500'}`} title={mat ? mat.content : 'ID: ' + journal.materialId}>
                                       {journal.examAgenda ? `AGENDA: ${journal.examAgenda}` : (mat ? mat.code : journal.materialId.substring(0,8))}
                                    </div>
                                 </td>
                                 <td className="p-4 align-top">
                                    {!journal.examAgenda && (
                                       <div className="mb-2">
                                          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Tujuan:</span>
                                          <p className="text-gray-900 font-medium">{journal.learningObjective}</p>
                                       </div>
                                    )}
                                    <div className="mb-2">
                                       <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Kegiatan:</span>
                                       <p className="text-gray-600 whitespace-pre-line text-xs">{journal.activities}</p>
                                    </div>
                                    {journal.absentStudents && (
                                       <div className="mt-2 bg-red-50 p-2 rounded border border-red-100">
                                          <span className="text-[10px] font-bold text-red-700 uppercase">Siswa Tidak Hadir</span>
                                          <p className="text-[10px] text-red-800">
                                             {JSON.parse(journal.absentStudents).map((as: any) => `${as.name} (${ABSENT_STATUS_MAP[as.status] || as.status})`).join(', ')}
                                          </p>
                                       </div>
                                    )}
                                    {(journal.reflection || journal.followUp) && (
                                       <div className="grid grid-cols-2 gap-4 mt-2">
                                          {journal.reflection && (
                                             <div className="bg-yellow-50 p-2 rounded border border-yellow-100">
                                                <span className="text-[10px] font-bold text-yellow-700 uppercase">Refleksi</span>
                                                <p className="text-[10px] text-yellow-800 italic">{journal.reflection}</p>
                                             </div>
                                          )}
                                          {journal.followUp && (
                                             <div className="bg-purple-50 p-2 rounded border border-purple-100">
                                                <span className="text-[10px] font-bold text-purple-700 uppercase">Tindak Lanjut</span>
                                                <p className="text-[10px] text-purple-800 italic">{journal.followUp}</p>
                                             </div>
                                          )}
                                       </div>
                                    )}
                                 </td>
                                 <td className="p-4 align-top text-center">
                                    <div className="flex items-center justify-center gap-1">
                                       <button 
                                          onClick={() => handleCopyJournal(journal)}
                                          className="text-gray-300 hover:text-blue-600 p-2 transition rounded-full hover:bg-blue-50"
                                          title="Salin Jurnal ke Kelas Lain"
                                       >
                                          <Copy size={18} />
                                       </button>
                                       <button 
                                          onClick={() => handleEdit(journal)}
                                          className="text-gray-300 hover:text-blue-600 p-2 transition rounded-full hover:bg-blue-50"
                                          title="Edit Jurnal"
                                       >
                                          <Pencil size={18} />
                                       </button>
                                       <button 
                                          onClick={() => handleDelete(journal.id)}
                                          className="text-gray-300 hover:text-red-600 p-2 transition rounded-full hover:bg-red-50"
                                          title="Hapus Jurnal"
                                       >
                                          <Trash2 size={18} />
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                   </table>
                 </div>

                 {/* Mobile Card View */}
                 <div className="md:hidden space-y-4 p-4">
                    {currentItems.map(journal => {
                        const cls = classes.find(c => c.id === journal.classId);
                        const mat = materialMap[journal.materialId];
                        return (
                            <div key={journal.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3 relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${journal.examAgenda ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>
                                            {journal.examAgenda ? journal.examAgenda : `Jam #${journal.meetingNo}`}
                                        </span>
                                        <h3 className="font-bold text-gray-800 mt-2">{cls?.name || 'Unknown Class'}</h3>
                                        <p className="text-xs text-gray-500">{new Date(journal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        <div className="mt-1.5">
                                           <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                              {journal.subject || '-'}
                                           </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                       <button 
                                          onClick={() => handleCopyJournal(journal)}
                                          className="text-gray-400 hover:text-blue-600 p-1"
                                          title="Salin Jurnal ke Kelas Lain"
                                       >
                                          <Copy size={18} />
                                       </button>
                                       <button 
                                          onClick={() => handleEdit(journal)}
                                          className="text-gray-400 hover:text-blue-600 p-1"
                                          title="Edit Jurnal"
                                       >
                                          <Pencil size={18} />
                                       </button>
                                       <button 
                                          onClick={() => handleDelete(journal.id)}
                                          className="text-gray-400 hover:text-red-600 p-1"
                                          title="Hapus Jurnal"
                                       >
                                          <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                
                                {!journal.examAgenda && (
                                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="font-semibold text-xs text-gray-500 uppercase mb-1">Materi</p>
                                        <p className="text-xs">{mat ? `${mat.code} - ${mat.content}` : journal.materialId}</p>
                                    </div>
                                )}

                                <div>
                                    <p className="font-semibold text-xs text-gray-500 uppercase mb-1">Kegiatan</p>
                                    <p className="text-sm text-gray-600 line-clamp-3">{journal.activities}</p>
                                </div>
                                {journal.absentStudents && (
                                    <div className="mt-2 bg-red-50 p-2 rounded border border-red-100">
                                        <p className="font-semibold text-[10px] text-red-700 uppercase mb-1">Tidak Hadir</p>
                                        <p className="text-[10px] text-red-800">
                                            {JSON.parse(journal.absentStudents).map((as: any) => `${as.name} (${ABSENT_STATUS_MAP[as.status] || as.status})`).join(', ')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                 </div>

                 {/* Pagination Controls */}
                 {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 p-4 bg-gray-50">
                       <div className="text-sm text-gray-500">
                          Halaman {currentPage} dari {totalPages}
                       </div>
                       <div className="flex gap-2">
                          <button 
                             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                             disabled={currentPage === 1}
                             className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600"
                          >
                             <ChevronLeft size={18} />
                          </button>
                          
                          {/* Simple Page Numbers */}
                          {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                             // Logic to show a window of pages
                             let p = i + 1;
                             if (totalPages > 5 && currentPage > 3) p = currentPage - 2 + i;
                             if (p > totalPages) return null;
                             
                             return (
                                <button 
                                   key={p}
                                   onClick={() => setCurrentPage(p)}
                                   className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                                      currentPage === p 
                                      ? 'bg-blue-600 text-white shadow-sm' 
                                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                   }`}
                                >
                                   {p}
                                </button>
                             )
                          })}

                          <button 
                             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                             disabled={currentPage === totalPages}
                             className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600"
                          >
                             <ChevronRight size={18} />
                          </button>
                       </div>
                    </div>
                 )}
               </>
            )}
         </div>
      </div>

      {/* Modal Copy Jurnal Dari Kelas Lain */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white rounded-t-xl">
              <div className="flex items-center gap-2 font-bold text-base">
                <Copy size={20} />
                <span>Salin Jurnal dari Kelas / Pertemuan Lain</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="text-white/80 hover:text-white hover:bg-blue-700 p-1.5 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={copySearch}
                  onChange={(e) => setCopySearch(e.target.value)}
                  placeholder="Cari materi, tujuan, kegiatan, atau nama kelas..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              {copySearch && (
                <button 
                  type="button"
                  onClick={() => setCopySearch('')} 
                  className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {journals.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-xs">
                  Belum ada catatan jurnal mengajar sebelumnya.
                </div>
              ) : (
                journals
                  .filter(j => {
                    if (!copySearch) return true;
                    const query = copySearch.toLowerCase();
                    const cls = classes.find(c => c.id === j.classId);
                    const mat = materialMap[j.materialId];
                    const clsName = cls ? cls.name.toLowerCase() : '';
                    const matText = mat ? mat.content.toLowerCase() : '';
                    const subj = (j.subject || '').toLowerCase();
                    const obj = (j.learningObjective || '').toLowerCase();
                    const act = (j.activities || '').toLowerCase();
                    return clsName.includes(query) || matText.includes(query) || subj.includes(query) || obj.includes(query) || act.includes(query);
                  })
                  .slice(0, 30)
                  .map(j => {
                    const cls = classes.find(c => c.id === j.classId);
                    const mat = materialMap[j.materialId];
                    return (
                      <div key={j.id} className="p-3.5 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/30 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded">
                              {cls?.name || 'Kelas'}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-semibold rounded">
                              {j.subject || '-'}
                            </span>
                            <span className="text-gray-400 text-[11px]">
                              {new Date(j.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {mat && (
                            <p className="text-xs font-semibold text-gray-800">
                              [{mat.code}] {mat.content}
                            </p>
                          )}
                          {j.learningObjective && (
                            <p className="text-xs text-gray-600 line-clamp-1">
                              <strong>Tujuan:</strong> {j.learningObjective}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 line-clamp-2 italic">
                            "{j.activities}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyJournal(j);
                            setShowCopyModal(false);
                          }}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shrink-0 flex items-center gap-1.5 shadow-sm self-end md:self-center"
                        >
                          <Copy size={14} />
                          Salin Jurnal Ini
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="p-3 border-t border-gray-100 bg-gray-50 text-right rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Activity Assistant Modal */}
      <GeminiActivityAssistantModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        subjectName={formSubject || user.subject || ''}
        className={classes.find(c => c.id === formData.classId)?.name || ''}
        materialTopic={
          formData.examAgenda 
            ? `Agenda Ujian: ${formData.examAgenda}`
            : (formData.materialId && materialMap[formData.materialId] 
                ? `[${materialMap[formData.materialId].code}] ${materialMap[formData.materialId].content}`
                : (formData.learningObjective || formData.materialId || ''))
        }
        onApplyText={(text) => {
          setFormData(prev => ({ ...prev, activities: text }));
          setIsGeminiModalOpen(false);
        }}
      />
    </div>
  );
};

export default TeacherJournal;
