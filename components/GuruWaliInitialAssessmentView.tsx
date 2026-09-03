import React, { useState, useEffect, useRef } from 'react';
import { 
  Student, 
  User, 
  GuruWaliInitialAssessment, 
  GuidanceCategory 
} from '../types';
import { 
  getGuruWaliInitialAssessmentsByGuruWali, 
  saveGuruWaliInitialAssessment, 
  deleteGuruWaliInitialAssessment,
  bulkSaveGuruWaliInitialAssessments 
} from '../services/database';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Printer, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  BookOpen, 
  Award, 
  Wrench, 
  Heart, 
  Compass, 
  ChevronRight, 
  Info, 
  Sparkles,
  Layers,
  ArrowUpDown,
  Filter,
  Eye,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface GuruWaliInitialAssessmentViewProps {
  user: User;
  mentees: Student[];
  classMap: Record<string, string>;
  signatureData: {
    placeName: string;
    principalName: string;
    principalNip: string;
    teacherName: string;
    teacherNip: string;
  };
  onOpenSignatureSettings: () => void;
  onOpenMentoringForStudent?: (student: Student) => void;
  onDataChanged?: () => void;
}

const GUIDANCE_CATEGORIES: GuidanceCategory[] = [
  'Penguatan Akademik',
  'Potensi Prestasi',
  'Kedisiplinan & Karakter',
  'Mandiri & Stabil'
];

export const GuruWaliInitialAssessmentView: React.FC<GuruWaliInitialAssessmentViewProps> = ({
  user,
  mentees,
  classMap,
  signatureData,
  onOpenSignatureSettings,
  onOpenMentoringForStudent,
  onDataChanged
}) => {
  const [assessments, setAssessments] = useState<GuruWaliInitialAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | GuidanceCategory>('ALL');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'ACADEMIC' | 'SKILLS' | 'ACHIEVEMENTS' | 'CHARACTER' | 'CONCLUSION'>('ACADEMIC');
  const [formData, setFormData] = useState<Omit<GuruWaliInitialAssessment, 'id' | 'lastModified' | 'isSynced'>>({
    studentId: '',
    studentName: '',
    guruWaliId: user.id,
    guruWaliName: user.fullName,
    schoolNpsn: user.schoolNpsn || 'DEFAULT',
    date: new Date().toISOString().split('T')[0],
    status: 'Lengkap',
    academic: {
      favoriteSubjects: '',
      difficultSubjects: '',
      studyHabitSchedule: '',
      studyMethod: '',
      previousGpa: ''
    },
    skills: {
      masteredSkills: '',
      extracurriculars: '',
      skillInterests: ''
    },
    achievements: {
      academicAchievements: '',
      nonAcademicAchievements: '',
      personalGoals: ''
    },
    character: {
      prominentTraits: '',
      traitsToDevelop: '',
      positiveHabits: '',
      habitsToImprove: ''
    },
    conclusion: {
      guidanceCategory: 'Penguatan Akademik',
      summaryNotes: '',
      followUpRecommendations: ''
    }
  });

  // Detail Modal State
  const [detailAssessment, setDetailAssessment] = useState<{
    assessment: GuruWaliInitialAssessment;
    student: Student;
  } | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    loadAssessments();
  }, [user.id]);

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const data = await getGuruWaliInitialAssessmentsByGuruWali(user.id);
      setAssessments(data);
    } catch (e) {
      console.error('Failed to load initial assessments:', e);
      showToast('Gagal memuat data identifikasi awal', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Map of assessment by student ID
  const assessmentMap = React.useMemo(() => {
    const map = new Map<string, GuruWaliInitialAssessment>();
    assessments.forEach(a => map.set(a.studentId, a));
    return map;
  }, [assessments]);

  // Statistics
  const totalMentees = mentees.length;
  const completedCount = mentees.filter(m => assessmentMap.has(m.id)).length;
  const pendingCount = totalMentees - completedCount;
  const completionRate = totalMentees > 0 ? Math.round((completedCount / totalMentees) * 100) : 0;

  // Category counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<GuidanceCategory, number> = {
      'Penguatan Akademik': 0,
      'Potensi Prestasi': 0,
      'Kedisiplinan & Karakter': 0,
      'Mandiri & Stabil': 0
    };
    assessments.forEach(a => {
      if (a.conclusion?.guidanceCategory && counts[a.conclusion.guidanceCategory] !== undefined) {
        counts[a.conclusion.guidanceCategory]++;
      }
    });
    return counts;
  }, [assessments]);

  // Unique classes for filter
  const uniqueClasses = React.useMemo(() => {
    const set = new Set<string>();
    mentees.forEach(m => {
      if (m.classId) set.add(m.classId);
    });
    return Array.from(set);
  }, [mentees]);

  // Filtered mentees
  const filteredMentees = React.useMemo(() => {
    return mentees.filter(m => {
      const q = searchTerm.toLowerCase();
      const className = (classMap[m.classId] || '').toLowerCase();
      const matchesSearch = m.name.toLowerCase().includes(q) || m.nis.includes(q) || className.includes(q);

      const matchesClass = selectedClassFilter === 'ALL' || m.classId === selectedClassFilter;

      const hasAssessment = assessmentMap.has(m.id);
      let matchesStatus = true;
      if (statusFilter === 'COMPLETED') matchesStatus = hasAssessment;
      if (statusFilter === 'PENDING') matchesStatus = !hasAssessment;

      let matchesCategory = true;
      if (categoryFilter !== 'ALL') {
        const assessment = assessmentMap.get(m.id);
        matchesCategory = assessment?.conclusion?.guidanceCategory === categoryFilter;
      }

      return matchesSearch && matchesClass && matchesStatus && matchesCategory;
    });
  }, [mentees, searchTerm, selectedClassFilter, statusFilter, categoryFilter, assessmentMap, classMap]);

  // Open Form for Student
  const handleOpenForm = (student: Student) => {
    setActiveStudent(student);
    const existing = assessmentMap.get(student.id);

    if (existing) {
      setFormData({
        studentId: student.id,
        studentName: student.name,
        guruWaliId: user.id,
        guruWaliName: user.fullName,
        schoolNpsn: user.schoolNpsn || 'DEFAULT',
        date: existing.date || new Date().toISOString().split('T')[0],
        status: existing.status || 'Lengkap',
        academic: {
          favoriteSubjects: existing.academic?.favoriteSubjects || '',
          difficultSubjects: existing.academic?.difficultSubjects || '',
          studyHabitSchedule: existing.academic?.studyHabitSchedule || '',
          studyMethod: existing.academic?.studyMethod || '',
          previousGpa: existing.academic?.previousGpa || ''
        },
        skills: {
          masteredSkills: existing.skills?.masteredSkills || '',
          extracurriculars: existing.skills?.extracurriculars || '',
          skillInterests: existing.skills?.skillInterests || ''
        },
        achievements: {
          academicAchievements: existing.achievements?.academicAchievements || '',
          nonAcademicAchievements: existing.achievements?.nonAcademicAchievements || '',
          personalGoals: existing.achievements?.personalGoals || ''
        },
        character: {
          prominentTraits: existing.character?.prominentTraits || '',
          traitsToDevelop: existing.character?.traitsToDevelop || '',
          positiveHabits: existing.character?.positiveHabits || '',
          habitsToImprove: existing.character?.habitsToImprove || ''
        },
        conclusion: {
          guidanceCategory: existing.conclusion?.guidanceCategory || 'Penguatan Akademik',
          summaryNotes: existing.conclusion?.summaryNotes || '',
          followUpRecommendations: existing.conclusion?.followUpRecommendations || ''
        }
      });
    } else {
      setFormData({
        studentId: student.id,
        studentName: student.name,
        guruWaliId: user.id,
        guruWaliName: user.fullName,
        schoolNpsn: user.schoolNpsn || 'DEFAULT',
        date: new Date().toISOString().split('T')[0],
        status: 'Lengkap',
        academic: {
          favoriteSubjects: '',
          difficultSubjects: '',
          studyHabitSchedule: '',
          studyMethod: '',
          previousGpa: ''
        },
        skills: {
          masteredSkills: '',
          extracurriculars: '',
          skillInterests: ''
        },
        achievements: {
          academicAchievements: '',
          nonAcademicAchievements: '',
          personalGoals: ''
        },
        character: {
          prominentTraits: '',
          traitsToDevelop: '',
          positiveHabits: '',
          habitsToImprove: ''
        },
        conclusion: {
          guidanceCategory: 'Penguatan Akademik',
          summaryNotes: '',
          followUpRecommendations: ''
        }
      });
    }

    setActiveTab('ACADEMIC');
    setIsFormOpen(true);
  };

  // Save Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;

    try {
      const existing = assessmentMap.get(activeStudent.id);
      await saveGuruWaliInitialAssessment({
        ...(existing?.id ? { id: existing.id } : {}),
        ...formData,
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        guruWaliId: user.id,
        guruWaliName: user.fullName,
        schoolNpsn: user.schoolNpsn || 'DEFAULT'
      });

      showToast(`Identifikasi awal untuk ${activeStudent.name} berhasil disimpan!`);
      setIsFormOpen(false);
      loadAssessments();
      onDataChanged?.();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal menyimpan identifikasi awal', 'error');
    }
  };

  // Delete Assessment
  const handleDeleteAssessment = async (assessmentId: string, studentName: string) => {
    if (!window.confirm(`Yakin ingin menghapus data identifikasi awal untuk ${studentName}?`)) return;

    try {
      await deleteGuruWaliInitialAssessment(assessmentId);
      showToast(`Data identifikasi awal ${studentName} berhasil dihapus.`);
      loadAssessments();
      onDataChanged?.();
      if (detailAssessment && detailAssessment.assessment.id === assessmentId) {
        setDetailAssessment(null);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menghapus data', 'error');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (mentees.length === 0) {
      showToast('Belum ada siswa bimbingan untuk diekspor', 'info');
      return;
    }

    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Status Identifikasi',
      'Tanggal Asesmen',
      'Kategori Profil Bimbingan',
      // Akademik
      'Mapel Disukai',
      'Mapel Dirasa Sulit',
      'Jadwal Belajar di Rumah',
      'Metode / Gaya Belajar',
      'Nilai Rata-rata Semester Sebelumnya',
      // Keterampilan
      'Keterampilan Dikuasai',
      'Ekskul yang Diikuti / Diminati',
      'Minat Keterampilan Baru',
      // Prestasi
      'Prestasi Akademik Pernah Diraih',
      'Prestasi Non-Akademik',
      'Target Prestasi Pribadi',
      // Karakter
      'Karakter Menonjol',
      'Karakter Ingin Dikembangkan',
      'Kebiasaan Positif',
      'Kebiasaan Perlu Diperbaiki',
      // Kesimpulan
      'Fokus Prioritas / Catatan Kompas Guru Wali',
      'Rekomendasi Tindak Lanjut Awal'
    ];

    const rows = mentees.map((m, idx) => {
      const a = assessmentMap.get(m.id);
      const className = classMap[m.classId] || '-';
      return [
        idx + 1,
        m.nis,
        m.name,
        className,
        a ? 'Sudah Diidentifikasi' : 'Belum Diisi',
        a?.date || '-',
        a?.conclusion?.guidanceCategory || '-',
        a?.academic?.favoriteSubjects || '-',
        a?.academic?.difficultSubjects || '-',
        a?.academic?.studyHabitSchedule || '-',
        a?.academic?.studyMethod || '-',
        a?.academic?.previousGpa || '-',
        a?.skills?.masteredSkills || '-',
        a?.skills?.extracurriculars || '-',
        a?.skills?.skillInterests || '-',
        a?.achievements?.academicAchievements || '-',
        a?.achievements?.nonAcademicAchievements || '-',
        a?.achievements?.personalGoals || '-',
        a?.character?.prominentTraits || '-',
        a?.character?.traitsToDevelop || '-',
        a?.character?.positiveHabits || '-',
        a?.character?.habitsToImprove || '-',
        a?.conclusion?.summaryNotes || '-',
        a?.conclusion?.followUpRecommendations || '-'
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Identifikasi Awal");
    const cleanName = (user.fullName || 'GuruWali').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Identifikasi_Awal_Siswa_Asuh_${cleanName}.xlsx`);
    showToast('Berhasil mengekspor data identifikasi awal ke Excel!');
  };

  // Download Template Excel
  const handleDownloadTemplate = () => {
    const headers = [
      'NIS (Wajib)',
      'Nama Siswa (Acuan)',
      'Kelas',
      'Tanggal Asesmen (YYYY-MM-DD)',
      'Kategori Profil (Penguatan Akademik / Potensi Prestasi / Kedisiplinan & Karakter / Mandiri & Stabil)',
      'Mapel Disukai',
      'Mapel Dirasa Sulit',
      'Jadwal Belajar Rumah',
      'Metode Belajar',
      'Nilai Rata-rata Semester Lalu',
      'Keterampilan Dikuasai',
      'Ekskul Diikuti / Diminati',
      'Minat Keterampilan Baru',
      'Prestasi Akademik',
      'Prestasi Non-Akademik',
      'Target Prestasi Pribadi',
      'Karakter Menonjol',
      'Karakter Ingin Dikembangkan',
      'Kebiasaan Positif',
      'Kebiasaan Perlu Diperbaiki',
      'Catatan Kesimpulan Guru Wali',
      'Rekomendasi Tindak Lanjut'
    ];

    // Prefill rows with current mentees for convenience
    const rows = mentees.map(m => {
      const a = assessmentMap.get(m.id);
      return [
        m.nis,
        m.name,
        classMap[m.classId] || '',
        a?.date || new Date().toISOString().split('T')[0],
        a?.conclusion?.guidanceCategory || 'Penguatan Akademik',
        a?.academic?.favoriteSubjects || '',
        a?.academic?.difficultSubjects || '',
        a?.academic?.studyHabitSchedule || '',
        a?.academic?.studyMethod || '',
        a?.academic?.previousGpa || '',
        a?.skills?.masteredSkills || '',
        a?.skills?.extracurriculars || '',
        a?.skills?.skillInterests || '',
        a?.achievements?.academicAchievements || '',
        a?.achievements?.nonAcademicAchievements || '',
        a?.achievements?.personalGoals || '',
        a?.character?.prominentTraits || '',
        a?.character?.traitsToDevelop || '',
        a?.character?.positiveHabits || '',
        a?.character?.habitsToImprove || '',
        a?.conclusion?.summaryNotes || '',
        a?.conclusion?.followUpRecommendations || ''
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Template_Identifikasi_Awal_Siswa_Asuh.xlsx`);
    showToast('Template Excel berhasil diunduh!');
  };

  // Handle File Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          showToast('File Excel kosong atau tidak memiliki baris data', 'error');
          return;
        }

        // Map parsed rows
        const menteesByNis = new Map<string, Student>();
        mentees.forEach(m => menteesByNis.set(m.nis.trim(), m));

        const parsedRows: any[] = [];
        // Skip header row
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const rawNis = String(row[0] || '').trim();
          if (!rawNis) continue;

          const matchedStudent = menteesByNis.get(rawNis);

          parsedRows.push({
            rowNumber: i + 1,
            nis: rawNis,
            studentName: String(row[1] || matchedStudent?.name || ''),
            matchedStudent,
            date: String(row[3] || new Date().toISOString().split('T')[0]),
            guidanceCategory: String(row[4] || 'Penguatan Akademik'),
            favoriteSubjects: String(row[5] || ''),
            difficultSubjects: String(row[6] || ''),
            studyHabitSchedule: String(row[7] || ''),
            studyMethod: String(row[8] || ''),
            previousGpa: String(row[9] || ''),
            masteredSkills: String(row[10] || ''),
            extracurriculars: String(row[11] || ''),
            skillInterests: String(row[12] || ''),
            academicAchievements: String(row[13] || ''),
            nonAcademicAchievements: String(row[14] || ''),
            personalGoals: String(row[15] || ''),
            prominentTraits: String(row[16] || ''),
            traitsToDevelop: String(row[17] || ''),
            positiveHabits: String(row[18] || ''),
            habitsToImprove: String(row[19] || ''),
            summaryNotes: String(row[20] || ''),
            followUpRecommendations: String(row[21] || '')
          });
        }

        setImportPreviewRows(parsedRows);
        setIsImportModalOpen(true);
      } catch (err: any) {
        console.error(err);
        showToast('Gagal membaca file Excel. Pastikan format valid.', 'error');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Submit Import
  const handleExecuteImport = async () => {
    const validRows = importPreviewRows.filter(r => r.matchedStudent);
    if (validRows.length === 0) {
      showToast('Tidak ada siswa yang cocok dengan daftar siswa bimbingan Anda', 'error');
      return;
    }

    setIsProcessingImport(true);
    try {
      const itemsToSave: (Omit<GuruWaliInitialAssessment, 'id' | 'lastModified' | 'isSynced'> & { id?: string })[] = [];

      for (const r of validRows) {
        const student = r.matchedStudent as Student;
        const existing = assessmentMap.get(student.id);

        let category: GuidanceCategory = 'Penguatan Akademik';
        if (GUIDANCE_CATEGORIES.includes(r.guidanceCategory as any)) {
          category = r.guidanceCategory as GuidanceCategory;
        }

        itemsToSave.push({
          ...(existing?.id ? { id: existing.id } : {}),
          studentId: student.id,
          studentName: student.name,
          guruWaliId: user.id,
          guruWaliName: user.fullName,
          schoolNpsn: user.schoolNpsn || 'DEFAULT',
          date: r.date || new Date().toISOString().split('T')[0],
          status: 'Lengkap',
          academic: {
            favoriteSubjects: r.favoriteSubjects,
            difficultSubjects: r.difficultSubjects,
            studyHabitSchedule: r.studyHabitSchedule,
            studyMethod: r.studyMethod,
            previousGpa: r.previousGpa
          },
          skills: {
            masteredSkills: r.masteredSkills,
            extracurriculars: r.extracurriculars,
            skillInterests: r.skillInterests
          },
          achievements: {
            academicAchievements: r.academicAchievements,
            nonAcademicAchievements: r.nonAcademicAchievements,
            personalGoals: r.personalGoals
          },
          character: {
            prominentTraits: r.prominentTraits,
            traitsToDevelop: r.traitsToDevelop,
            positiveHabits: r.positiveHabits,
            habitsToImprove: r.habitsToImprove
          },
          conclusion: {
            guidanceCategory: category,
            summaryNotes: r.summaryNotes,
            followUpRecommendations: r.followUpRecommendations
          }
        });
      }

      await bulkSaveGuruWaliInitialAssessments(itemsToSave);
      showToast(`Berhasil mengimpor ${itemsToSave.length} data identifikasi awal siswa!`);
      setIsImportModalOpen(false);
      setImportPreviewRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadAssessments();
      onDataChanged?.();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal menyimpan hasil import', 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Print Single Student Assessment
  const handlePrintStudentAssessment = (student: Student, assessment?: GuruWaliInitialAssessment) => {
    const data = assessment || assessmentMap.get(student.id);
    if (!data) {
      showToast('Siswa ini belum memiliki data identifikasi awal untuk dicetak', 'info');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir oleh browser. Izinkan pop-up untuk mencetak.');
      return;
    }

    const className = classMap[student.classId] || 'Kelas';
    const formattedDate = format(new Date(), 'dd MMMM yyyy', { locale: id });
    const assessmentDateFormatted = data.date ? format(new Date(data.date), 'dd MMMM yyyy', { locale: id }) : formattedDate;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Identifikasi_Awal_${student.name.replace(/\s+/g, '_')}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              margin: 0;
              padding: 0;
              line-height: 1.35;
              font-size: 10.5pt;
            }
            .header-kop {
              text-align: center;
              border-bottom: 2.5px solid #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
              position: relative;
            }
            .header-kop::after {
              content: "";
              position: absolute;
              bottom: -4.5px;
              left: 0;
              right: 0;
              border-bottom: 0.8px solid #000;
            }
            .header-kop h3 {
              margin: 0;
              font-size: 11pt;
              font-weight: normal;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-kop h2 {
              margin: 3px 0;
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
            }
            .header-kop p {
              margin: 2px 0 0 0;
              font-size: 9.5pt;
              color: #333;
            }
            .report-title {
              text-align: center;
              margin: 14px 0 10px 0;
            }
            .report-title h4 {
              margin: 0;
              font-size: 12pt;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
            }
            .report-title p {
              margin: 2px 0 0 0;
              font-size: 9.5pt;
              color: #444;
            }
            .student-info-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            .student-info-table td {
              padding: 2.5px 5px;
              font-size: 10pt;
              vertical-align: top;
            }
            .student-info-table td.label {
              width: 24%;
              font-weight: bold;
            }
            .student-info-table td.colon {
              width: 2%;
            }
            .section-header {
              font-family: Arial, sans-serif;
              font-size: 9.5pt;
              font-weight: bold;
              background-color: #f1f5f9;
              padding: 4px 8px;
              margin-top: 10px;
              margin-bottom: 4px;
              border-left: 4px solid #1e3a8a;
              text-transform: uppercase;
              page-break-after: avoid;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
              page-break-inside: avoid;
            }
            table.data-table th, table.data-table td {
              border: 1px solid #444;
              padding: 4.5px 6px;
              font-size: 9.5pt;
              vertical-align: top;
            }
            table.data-table th {
              background-color: #f8fafc;
              font-family: Arial, sans-serif;
              font-size: 9pt;
              text-align: left;
              font-weight: bold;
              width: 32%;
            }
            .badge-category {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 9pt;
              font-weight: bold;
              background-color: #e0e7ff;
              color: #312e81;
              border: 1px solid #c7d2fe;
            }
            .signature-container {
              margin-top: 24px;
              width: 100%;
              page-break-inside: avoid;
            }
            .signature-table {
              width: 100%;
              border-collapse: collapse;
            }
            .signature-table td {
              width: 50%;
              text-align: center;
              vertical-align: top;
              padding: 0 10px;
              font-size: 10pt;
            }
            .signature-name {
              font-weight: bold;
              text-decoration: underline;
              white-space: nowrap;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <!-- KOP SURAT RESMI -->
          <div class="header-kop">
            <h3>PEMERINTAH PROVINSI / KEMENTERIAN PENDIDIKAN DAN KEBUDAYAAN</h3>
            <h2>${user.schoolName || 'SMA NEGERI INDONESIA'}</h2>
            <p>Instrumen Asesmen Diagnostik & Kompas Bimbingan Guru Wali</p>
          </div>

          <!-- JUDUL -->
          <div class="report-title">
            <h4>LEMBAR IDENTIFIKASI AWAL SISWA ASUH</h4>
            <p>Tahun Ajaran ${new Date().getFullYear()} / ${new Date().getFullYear() + 1}</p>
          </div>

          <!-- BIODATA SISWA -->
          <table class="student-info-table">
            <tr>
              <td class="label">Nama Lengkap Siswa</td>
              <td class="colon">:</td>
              <td><strong>${student.name}</strong></td>
              <td class="label">Kelas</td>
              <td class="colon">:</td>
              <td><strong>${className}</strong></td>
            </tr>
            <tr>
              <td class="label">Nomor Induk Siswa (NIS)</td>
              <td class="colon">:</td>
              <td>${student.nis}</td>
              <td class="label">Jenis Kelamin</td>
              <td class="colon">:</td>
              <td>${student.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}</td>
            </tr>
            <tr>
              <td class="label">Guru Wali Pembimbing</td>
              <td class="colon">:</td>
              <td><strong>${signatureData.teacherName || user.fullName}</strong></td>
              <td class="label">Tanggal Identifikasi</td>
              <td class="colon">:</td>
              <td>${assessmentDateFormatted}</td>
            </tr>
          </table>

          <!-- PILAR A: AKADEMIK -->
          <div class="section-header">Pilar 1: Pendampingan Akademik</div>
          <table class="data-table">
            <tr>
              <th>Mata Pelajaran yang Disukai</th>
              <td>${data.academic?.favoriteSubjects || '-'}</td>
            </tr>
            <tr>
              <th>Mata Pelajaran yang Dirasa Sulit</th>
              <td>${data.academic?.difficultSubjects || '-'}</td>
            </tr>
            <tr>
              <th>Kebiasaan & Jadwal Belajar di Rumah</th>
              <td>${data.academic?.studyHabitSchedule || '-'}</td>
            </tr>
            <tr>
              <th>Metode & Gaya Belajar yang Efektif</th>
              <td>${data.academic?.studyMethod || '-'}</td>
            </tr>
            <tr>
              <th>Nilai Rata-rata Semester Sebelumnya</th>
              <td>${data.academic?.previousGpa || '-'}</td>
            </tr>
          </table>

          <!-- PILAR B: KETERAMPILAN -->
          <div class="section-header">Pilar 2: Pendampingan Keterampilan</div>
          <table class="data-table">
            <tr>
              <th>Keterampilan yang Dikuasai Saat Ini</th>
              <td>${data.skills?.masteredSkills || '-'}</td>
            </tr>
            <tr>
              <th>Keterlibatan Ekstrakurikuler / Organisasi</th>
              <td>${data.skills?.extracurriculars || '-'}</td>
            </tr>
            <tr>
              <th>Minat Keterampilan Baru yang Ingin Dipelajari</th>
              <td>${data.skills?.skillInterests || '-'}</td>
            </tr>
          </table>

          <!-- PILAR C: PRESTASI -->
          <div class="section-header">Pilar 3: Pendampingan Prestasi</div>
          <table class="data-table">
            <tr>
              <th>Prestasi Akademik yang Pernah Diraih</th>
              <td>${data.achievements?.academicAchievements || '-'}</td>
            </tr>
            <tr>
              <th>Prestasi Non-Akademik (Seni/Olahraga/dsb)</th>
              <td>${data.achievements?.nonAcademicAchievements || '-'}</td>
            </tr>
            <tr>
              <th>Target / Impian Prestasi Pribadi di Sekolah</th>
              <td>${data.achievements?.personalGoals || '-'}</td>
            </tr>
          </table>

          <!-- PILAR D: KARAKTER -->
          <div class="section-header">Pilar 4: Pendampingan Karakter & Sikap</div>
          <table class="data-table">
            <tr>
              <th>Nilai Karakter yang Paling Menonjol</th>
              <td>${data.character?.prominentTraits || '-'}</td>
            </tr>
            <tr>
              <th>Karakter yang Ingin Ditingkatkan / Diperbaiki</th>
              <td>${data.character?.traitsToDevelop || '-'}</td>
            </tr>
            <tr>
              <th>Kebiasaan Positif Sehari-hari</th>
              <td>${data.character?.positiveHabits || '-'}</td>
            </tr>
            <tr>
              <th>Kebiasaan yang Perlu Diperbaiki / Tantangan Diri</th>
              <td>${data.character?.habitsToImprove || '-'}</td>
            </tr>
          </table>

          <!-- PILAR E: KESIMPULAN & KOMPAS GURU WALI -->
          <div class="section-header">Pilar 5: Kesimpulan & Fokus Pendampingan Guru Wali</div>
          <table class="data-table">
            <tr>
              <th>Kategori Profil Bimbingan</th>
              <td><span class="badge-category">${data.conclusion?.guidanceCategory || 'Penguatan Akademik'}</span></td>
            </tr>
            <tr>
              <th>Fokus Utama & Catatan Pendampingan</th>
              <td>${data.conclusion?.summaryNotes || '-'}</td>
            </tr>
            <tr>
              <th>Rekomendasi Awal Tindak Lanjut</th>
              <td>${data.conclusion?.followUpRecommendations || '-'}</td>
            </tr>
          </table>

          <!-- TANDA TANGAN -->
          <div class="signature-container">
            <table class="signature-table">
              <tr>
                <td>
                  <p>&nbsp;</p>
                  <p>Mengetahui,</p>
                  <p>Kepala Sekolah ${user.schoolName || ''}</p>
                  <br><br><br><br>
                  <p class="signature-name">${signatureData.principalName || '................................................'}</p>
                  <p>NIP. ${signatureData.principalNip || '................................................'}</p>
                </td>
                <td>
                  <p>&nbsp;</p>
                  <p>${signatureData.placeName || '....................'}, ${formattedDate}</p>
                  <p>Guru Wali Pembimbing,</p>
                  <br><br><br><br>
                  <p class="signature-name">${signatureData.teacherName || user.fullName}</p>
                  <p>NIP. ${signatureData.teacherNip || user.nip || '................................................'}</p>
                </td>
              </tr>
            </table>
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Batch Print All Mentees Summary Table
  const handlePrintBatchSummary = () => {
    if (mentees.length === 0) {
      showToast('Tidak ada data siswa untuk dicetak', 'info');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir oleh browser. Izinkan pop-up untuk mencetak.');
      return;
    }

    const formattedDate = format(new Date(), 'dd MMMM yyyy', { locale: id });

    const rowsHtml = mentees.map((m, idx) => {
      const a = assessmentMap.get(m.id);
      const className = classMap[m.classId] || '-';
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${m.name}</strong><br><span style="font-size: 8.5pt; color: #555;">NIS: ${m.nis} | Kelas: ${className}</span></td>
          <td style="font-size: 9pt;">
            ${a ? `<strong>Disukai:</strong> ${a.academic?.favoriteSubjects || '-'}<br><strong>Sulit:</strong> ${a.academic?.difficultSubjects || '-'}` : '<span style="color: #999; font-style: italic;">Belum diisi</span>'}
          </td>
          <td style="font-size: 9pt;">
            ${a ? `${a.skills?.masteredSkills || '-'}<br><span style="color: #555;">Ekskul: ${a.skills?.extracurriculars || '-'}</span>` : '<span style="color: #999; font-style: italic;">Belum diisi</span>'}
          </td>
          <td style="font-size: 9pt;">
            ${a ? `${a.achievements?.personalGoals || a.achievements?.academicAchievements || '-'}` : '<span style="color: #999; font-style: italic;">Belum diisi</span>'}
          </td>
          <td style="font-size: 9pt;">
            ${a ? `<strong>${a.conclusion?.guidanceCategory || '-'}</strong><br>${a.conclusion?.summaryNotes || '-'}` : '<span style="color: #999; font-style: italic;">Belum diisi</span>'}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Rekap_Identifikasi_Awal_Guru_Wali</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm 12mm 12mm 12mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              margin: 0;
              padding: 0;
              line-height: 1.3;
              font-size: 9.5pt;
            }
            .header-kop {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 6px;
              margin-bottom: 10px;
            }
            .header-kop h2 { margin: 2px 0; font-size: 13pt; text-transform: uppercase; }
            .header-kop p { margin: 2px 0 0 0; font-size: 9pt; }
            .report-title { text-align: center; margin: 10px 0; }
            .report-title h4 { margin: 0; font-size: 11.5pt; text-transform: uppercase; text-decoration: underline; }
            table.recap-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            table.recap-table th, table.recap-table td {
              border: 1px solid #444;
              padding: 4px 6px;
              vertical-align: top;
            }
            table.recap-table th {
              background-color: #f1f5f9;
              text-align: center;
              font-weight: bold;
              font-family: Arial, sans-serif;
              font-size: 8.5pt;
              text-transform: uppercase;
            }
            .signature-container {
              margin-top: 20px;
              width: 100%;
              page-break-inside: avoid;
            }
            .signature-table { width: 100%; border-collapse: collapse; }
            .signature-table td { width: 50%; text-align: center; font-size: 9.5pt; }
            .signature-name { font-weight: bold; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="header-kop">
            <h2>${user.schoolName || 'SMA NEGERI INDONESIA'}</h2>
            <p>Rekapitulasi Instrumen Identifikasi Awal Siswa Asuh Guru Wali</p>
          </div>
          <div class="report-title">
            <h4>REKAPITULASI IDENTIFIKASI AWAL SISWA ASUH</h4>
            <p>Guru Wali: <strong>${signatureData.teacherName || user.fullName}</strong> | Total: ${mentees.length} Siswa (${completedCount} Terisi)</p>
          </div>
          <table class="recap-table">
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 170px;">Nama Siswa & Identitas</th>
                <th>Pilar Akademik (Suka & Sulit)</th>
                <th>Pilar Keterampilan</th>
                <th>Target Prestasi</th>
                <th style="width: 180px;">Kategori & Catatan Kompas</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="signature-container">
            <table class="signature-table">
              <tr>
                <td>
                  <p>Mengetahui,</p>
                  <p>Kepala Sekolah</p>
                  <br><br><br>
                  <p class="signature-name">${signatureData.principalName || '................................................'}</p>
                  <p>NIP. ${signatureData.principalNip || '................................................'}</p>
                </td>
                <td>
                  <p>${signatureData.placeName || '....................'}, ${formattedDate}</p>
                  <p>Guru Wali Pembimbing,</p>
                  <br><br><br>
                  <p class="signature-name">${signatureData.teacherName || user.fullName}</p>
                  <p>NIP. ${signatureData.teacherNip || user.nip || '................................................'}</p>
                </td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getCategoryBadgeClass = (category?: GuidanceCategory) => {
    switch (category) {
      case 'Penguatan Akademik':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Potensi Prestasi':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Kedisiplinan & Karakter':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Mandiri & Stabil':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <Info className="w-5 h-5 text-indigo-600" />
              )}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-black/5 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Insight Summary Cards (Kartu Ringkasan Kelas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Siswa Asuh</p>
            <h3 className="text-2xl font-black text-gray-900 mt-0.5">{totalMentees}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Siswa binaan terdaftar</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sudah Diidentifikasi</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-2xl font-black text-emerald-600">{completedCount}</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {completionRate}%
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Baseline telah terdata</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Belum Diidentifikasi</p>
            <h3 className="text-2xl font-black text-amber-600 mt-0.5">{pendingCount}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Menunggu asesmen awal</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Compass className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori Dominan</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 line-clamp-1">
              {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[1] > 0
                ? Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0]
                : 'Belum Ada Data'}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Pemetaan kompas awal</p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header and Toolbar */}
        <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-gray-50/60 to-white">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Kompas Identifikasi Awal Siswa Asuh</h3>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                  4 Pilar Asesmen
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Instrumen diagnostik akademik, keterampilan, prestasi, dan karakter sebagai panduan pendampingan berkala sepanjang tahun.
              </p>
            </div>
          </div>

          {/* Action Buttons: Import, Export, Print */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Unduh format template Excel"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Unduh Template</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Import data siswa dari Excel"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Import Excel</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Export seluruh identifikasi awal ke file Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handlePrintBatchSummary}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Cetak seluruh ringkasan lembar identifikasi kelas"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>Cetak Rekap</span>
            </button>

            <button
              onClick={onOpenSignatureSettings}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
              title="Pengaturan Tanda Tangan Cetak"
            >
              <FileCheck className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, NIS, atau kelas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Class Filter */}
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none"
            >
              <option value="ALL">Semua Kelas</option>
              {uniqueClasses.map(cId => (
                <option key={cId} value={cId}>{classMap[cId] || cId}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="COMPLETED">Sudah Diidentifikasi</option>
              <option value="PENDING">Belum Diisi</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none"
            >
              <option value="ALL">Semua Kategori</option>
              {GUIDANCE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Siswa Bimbingan</th>
                <th className="py-3 px-4">Status & Kategori</th>
                <th className="py-3 px-4">Ringkasan Pilar Akademik & Minat</th>
                <th className="py-3 px-4">Tanggal Asesmen</th>
                <th className="py-3 px-4 text-center w-40">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="py-4 px-4 bg-gray-50/50"></td>
                  </tr>
                ))
              ) : mentees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-gray-400">
                    <Compass className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="font-semibold text-gray-600">Belum ada siswa bimbingan terdaftar</p>
                    <p className="text-xs text-gray-400 mt-1">Pilih siswa bimbingan Anda terlebih dahulu di tab Siswa Bimbingan.</p>
                  </td>
                </tr>
              ) : filteredMentees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-gray-400 text-xs">
                    Tidak ada siswa yang sesuai dengan filter atau pencarian.
                  </td>
                </tr>
              ) : (
                filteredMentees.map((student, idx) => {
                  const assessment = assessmentMap.get(student.id);
                  const className = classMap[student.classId] || 'Kelas';
                  const isCompleted = !!assessment;

                  return (
                    <tr key={student.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-medium">
                        {idx + 1}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            isCompleted ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>NIS: {student.nis}</span>
                              <span>•</span>
                              <span className="px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">
                                {className}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status & Category */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Sudah Diidentifikasi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Belum Diisi
                            </span>
                          )}

                          {assessment?.conclusion?.guidanceCategory && (
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryBadgeClass(assessment.conclusion.guidanceCategory)}`}>
                                {assessment.conclusion.guidanceCategory}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Summary Insights */}
                      <td className="py-3.5 px-4">
                        {assessment ? (
                          <div className="text-xs space-y-1 text-gray-600 max-w-sm">
                            {assessment.academic?.favoriteSubjects && (
                              <p className="line-clamp-1">
                                <span className="font-semibold text-gray-700">Suka:</span> {assessment.academic.favoriteSubjects}
                              </p>
                            )}
                            {assessment.academic?.difficultSubjects && (
                              <p className="line-clamp-1 text-rose-600">
                                <span className="font-semibold text-rose-700">Sulit:</span> {assessment.academic.difficultSubjects}
                              </p>
                            )}
                            {assessment.skills?.masteredSkills && (
                              <p className="line-clamp-1 text-indigo-600">
                                <span className="font-semibold text-indigo-700">Bakat:</span> {assessment.skills.masteredSkills}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Belum ada catatan awal</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {assessment?.date ? (
                          format(new Date(assessment.date), 'dd MMM yyyy', { locale: id })
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenForm(student)}
                            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                              isCompleted
                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                            }`}
                            title={isCompleted ? 'Edit Identifikasi Awal' : 'Isi Identifikasi Awal'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isCompleted ? 'Edit' : 'Isi'}</span>
                          </button>

                          {isCompleted && (
                            <>
                              <button
                                onClick={() => setDetailAssessment({ assessment, student })}
                                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200"
                                title="Lihat Rincian Lengkap"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handlePrintStudentAssessment(student, assessment)}
                                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200"
                                title="Cetak Lembar Identifikasi Awal"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteAssessment(assessment.id, student.name)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Data Asesmen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL: 4 PILAR IDENTIFIKASI AWAL */}
      {isFormOpen && activeStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Form Identifikasi Awal Siswa Asuh
                  </h3>
                  <p className="text-xs text-gray-500">
                    Siswa: <strong>{activeStudent.name}</strong> • NIS: {activeStudent.nis} • Kelas: {classMap[activeStudent.classId] || 'Kelas'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pillar Navigation Tabs */}
            <div className="px-5 pt-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-none bg-gray-50/50">
              <button
                type="button"
                onClick={() => setActiveTab('ACADEMIC')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'ACADEMIC'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>1. Akademik</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SKILLS')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'SKILLS'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>2. Keterampilan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ACHIEVEMENTS')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'ACHIEVEMENTS'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>3. Prestasi</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CHARACTER')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'CHARACTER'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>4. Karakter & Sikap</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CONCLUSION')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'CONCLUSION'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>5. Kesimpulan Kompas</span>
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: AKADEMIK */}
              {activeTab === 'ACADEMIC' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Pilar Pendampingan Akademik</p>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        Mengetahui mata pelajaran favorit, mata pelajaran yang butuh intervensi, jadwal belajar rumah, serta metode belajar siswa.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Mata Pelajaran yang Disukai
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Matematika, Bahasa Inggris, Biologi"
                        value={formData.academic.favoriteSubjects}
                        onChange={(e) => setFormData({
                          ...formData,
                          academic: { ...formData.academic, favoriteSubjects: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Mata Pelajaran yang Dirasa Sulit
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Fisika, Kimia, Ekonomi"
                        value={formData.academic.difficultSubjects}
                        onChange={(e) => setFormData({
                          ...formData,
                          academic: { ...formData.academic, difficultSubjects: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Kebiasaan & Jadwal Belajar di Rumah
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pukul 19.30 - 21.00 WIB setiap malam, belajar mandiri"
                        value={formData.academic.studyHabitSchedule}
                        onChange={(e) => setFormData({
                          ...formData,
                          academic: { ...formData.academic, studyHabitSchedule: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Metode & Gaya Belajar yang Efektif
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Visual (rangkuman warna), diskusi kelompok, praktek langsung"
                        value={formData.academic.studyMethod}
                        onChange={(e) => setFormData({
                          ...formData,
                          academic: { ...formData.academic, studyMethod: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Nilai Rata-rata Semester Sebelumnya (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 84.5 atau Rata-rata 85 di Kelas X"
                      value={formData.academic.previousGpa || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        academic: { ...formData.academic, previousGpa: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: KETERAMPILAN */}
              {activeTab === 'SKILLS' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-xl text-xs text-purple-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Pilar Pendampingan Keterampilan</p>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        Pemetaan keahlian teknis/non-teknis, partisipasi ekstrakurikuler, dan minat pengembangan kompetensi siswa.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Keterampilan yang Dikuasai Saat Ini
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Contoh: Desain Grafis (Canva/Photoshop), Pemrograman Dasar, Public Speaking, Bermain Alat Musik Gitar, Olahraga Futsal"
                      value={formData.skills.masteredSkills}
                      onChange={(e) => setFormData({
                        ...formData,
                        skills: { ...formData.skills, masteredSkills: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Keterlibatan Ekstrakurikuler / Organisasi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Pramuka, OSIS, Rohis, PMR, Klub Robotik, Paskibra"
                      value={formData.skills.extracurriculars}
                      onChange={(e) => setFormData({
                        ...formData,
                        skills: { ...formData.skills, extracurriculars: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Minat Keterampilan Baru yang Ingin Dipelajari
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Ingin memperdalam bahasa Jepang, videografi editing, debat bahasa Inggris"
                      value={formData.skills.skillInterests}
                      onChange={(e) => setFormData({
                        ...formData,
                        skills: { ...formData.skills, skillInterests: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: PRESTASI */}
              {activeTab === 'ACHIEVEMENTS' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Pilar Pendampingan Prestasi</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Dokumentasi rekam jejak capaian lomba/kompetisi masa lalu dan target capaian prestasi yang ingin dicapai siswa.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Prestasi Akademik yang Pernah Diraih
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Juara 2 OSN Matematika Tingkat Kota (2024), Peringkat 1 Kelas IX SMP"
                      value={formData.achievements.academicAchievements}
                      onChange={(e) => setFormData({
                        ...formData,
                        achievements: { ...formData.achievements, academicAchievements: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Prestasi Non-Akademik yang Pernah Diraih
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Juara 1 Turnamen Futsal Antar-Sekolah, Juara 3 Lomba Tilawah Al-Qur'an"
                      value={formData.achievements.nonAcademicAchievements}
                      onChange={(e) => setFormData({
                        ...formData,
                        achievements: { ...formData.achievements, nonAcademicAchievements: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Target / Impian Prestasi Pribadi di Sekolah
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Masuk 5 besar peringkat paralel, lolos olimpiade sains provinsi, tembus PTN jalur prestasi"
                      value={formData.achievements.personalGoals}
                      onChange={(e) => setFormData({
                        ...formData,
                        achievements: { ...formData.achievements, personalGoals: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: KARAKTER */}
              {activeTab === 'CHARACTER' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Pilar Pendampingan Karakter & Sikap</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Observasi profil kepribadian, nilai positif yang dominan, serta area kedisiplinan atau relasi sosial yang perlu pendampingan.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Nilai Karakter yang Paling Menonjol
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Sopan santun, kejujuran, rasa empati tinggi, tekun"
                        value={formData.character.prominentTraits}
                        onChange={(e) => setFormData({
                          ...formData,
                          character: { ...formData.character, prominentTraits: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Karakter yang Ingin Diperkuat / Dikembangkan
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Rasa percaya diri berbicara di depan umum, kepemimpinan"
                        value={formData.character.traitsToDevelop}
                        onChange={(e) => setFormData({
                          ...formData,
                          character: { ...formData.character, traitsToDevelop: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Kebiasaan Positif Sehari-hari
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Tepat waktu sholat/ibadah, rajin mencatat materi, suka membantu teman"
                        value={formData.character.positiveHabits}
                        onChange={(e) => setFormData({
                          ...formData,
                          character: { ...formData.character, positiveHabits: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Kebiasaan yang Perlu Diperbaiki / Tantangan
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Sering menunda tugas sekolah, begadang bermain gawai/game, mudah cemas"
                        value={formData.character.habitsToImprove}
                        onChange={(e) => setFormData({
                          ...formData,
                          character: { ...formData.character, habitsToImprove: e.target.value }
                        })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: KESIMPULAN & KOMPAS GURU WALI */}
              {activeTab === 'CONCLUSION' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
                    <Compass className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Kesimpulan & Kompas Pendampingan Guru Wali</p>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        Menetapkan profil bimbingan utama dan strategi tindak lanjut awal sebagai kompas sepanjang tahun ajaran.
                      </p>
                    </div>
                  </div>

                  {/* Kategori Profil Bimbingan */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Kategori Profil Bimbingan Siswa <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {GUIDANCE_CATEGORIES.map(cat => {
                        const isSelected = formData.conclusion.guidanceCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              conclusion: { ...formData.conclusion, guidanceCategory: cat }
                            })}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/80 font-bold text-indigo-900 shadow-2xs'
                                : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <p className="text-xs">{cat}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Kesimpulan Ringkas & Fokus Utama Pendampingan <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Tuliskan intisari profil siswa ini dan fokus prioritas pendampingan yang akan Anda berikan..."
                      value={formData.conclusion.summaryNotes}
                      onChange={(e) => setFormData({
                        ...formData,
                        conclusion: { ...formData.conclusion, summaryNotes: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Rekomendasi Awal Tindak Lanjut
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Mengagendakan bimbingan teman sebaya untuk mata pelajaran Fisika, dorong ikut seleksi OSN"
                      value={formData.conclusion.followUpRecommendations || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        conclusion: { ...formData.conclusion, followUpRecommendations: e.target.value }
                      })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Tanggal Asesmen Diagnostik
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full md:w-60 p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Lengkapi seluruh pilar untuk hasil diagnosis optimal</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-200"
                  >
                    Simpan Identifikasi Awal
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DETAIL MODAL (RINGKASAN PROFIL ASESMEN AWAL) */}
      {detailAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Rangkuman Identifikasi Awal
                  </h3>
                  <p className="text-xs text-gray-500">
                    <strong>{detailAssessment.student.name}</strong> • NIS: {detailAssessment.student.nis} • Kelas: {classMap[detailAssessment.student.classId] || 'Kelas'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintStudentAssessment(detailAssessment.student, detailAssessment.assessment)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-200 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cetak</span>
                </button>
                <button
                  onClick={() => setDetailAssessment(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Guidance Category Banner */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/70 to-purple-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Kategori Profil Bimbingan</p>
                  <h4 className="text-lg font-extrabold text-indigo-950 mt-0.5">
                    {detailAssessment.assessment.conclusion?.guidanceCategory || 'Penguatan Akademik'}
                  </h4>
                  <p className="text-xs text-indigo-800/80 mt-1">
                    {detailAssessment.assessment.conclusion?.summaryNotes || 'Belum ada catatan ringkas'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] text-gray-400 block">Tanggal Asesmen</span>
                  <span className="text-xs font-bold text-gray-700">
                    {detailAssessment.assessment.date ? format(new Date(detailAssessment.assessment.date), 'dd MMM yyyy', { locale: id }) : '-'}
                  </span>
                </div>
              </div>

              {/* 4 Pillars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pilar Akademik */}
                <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs border-b border-gray-200 pb-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Pilar Akademik</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-gray-500 font-medium">Mapel Disukai:</span>
                      <p className="font-semibold text-gray-800">{detailAssessment.assessment.academic?.favoriteSubjects || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Mapel Dirasa Sulit:</span>
                      <p className="font-semibold text-rose-600">{detailAssessment.assessment.academic?.difficultSubjects || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Kebiasaan Belajar:</span>
                      <p className="text-gray-700">{detailAssessment.assessment.academic?.studyHabitSchedule || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Metode Efektif:</span>
                      <p className="text-gray-700">{detailAssessment.assessment.academic?.studyMethod || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Pilar Keterampilan */}
                <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs border-b border-gray-200 pb-2">
                    <Wrench className="w-4 h-4 text-purple-600" />
                    <span>Pilar Keterampilan</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-gray-500 font-medium">Keterampilan Dikuasai:</span>
                      <p className="font-semibold text-gray-800">{detailAssessment.assessment.skills?.masteredSkills || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Ekskul / Organisasi:</span>
                      <p className="font-semibold text-gray-800">{detailAssessment.assessment.skills?.extracurriculars || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Minat Keterampilan Baru:</span>
                      <p className="text-gray-700">{detailAssessment.assessment.skills?.skillInterests || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Pilar Prestasi */}
                <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs border-b border-gray-200 pb-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>Pilar Prestasi</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-gray-500 font-medium">Prestasi Akademik:</span>
                      <p className="font-semibold text-gray-800">{detailAssessment.assessment.achievements?.academicAchievements || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Prestasi Non-Akademik:</span>
                      <p className="font-semibold text-gray-800">{detailAssessment.assessment.achievements?.nonAcademicAchievements || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Target Prestasi Pribadi:</span>
                      <p className="text-amber-800 font-semibold">{detailAssessment.assessment.achievements?.personalGoals || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Pilar Karakter */}
                <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs border-b border-gray-200 pb-2">
                    <Heart className="w-4 h-4 text-emerald-600" />
                    <span>Pilar Karakter & Sikap</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-gray-500 font-medium">Karakter Menonjol:</span>
                      <p className="font-semibold text-gray-800">{detailAssessment.assessment.character?.prominentTraits || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Karakter Ingin Dikembangkan:</span>
                      <p className="text-gray-700">{detailAssessment.assessment.character?.traitsToDevelop || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Kebiasaan Positif:</span>
                      <p className="text-gray-700">{detailAssessment.assessment.character?.positiveHabits || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Tantangan / Perlu Diperbaiki:</span>
                      <p className="text-rose-600">{detailAssessment.assessment.character?.habitsToImprove || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rekomendasi Tindak Lanjut */}
              {detailAssessment.assessment.conclusion?.followUpRecommendations && (
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
                    Rekomendasi Awal Tindak Lanjut:
                  </p>
                  <p className="text-xs text-indigo-950 leading-relaxed">
                    {detailAssessment.assessment.conclusion.followUpRecommendations}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <button
                onClick={() => {
                  const student = detailAssessment.student;
                  setDetailAssessment(null);
                  handleOpenForm(student);
                }}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Identifikasi</span>
              </button>

              <button
                onClick={() => setDetailAssessment(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* IMPORT PREVIEW MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Preview Import Identifikasi Awal Excel
                  </h3>
                  <p className="text-xs text-gray-500">
                    File: <strong>{importFileName}</strong> • Terdeteksi {importPreviewRows.length} baris data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800">
                  <span className="font-bold">Cocok dengan Siswa Bimbingan:</span>{' '}
                  {importPreviewRows.filter(r => r.matchedStudent).length} siswa
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
                  <span className="font-bold">Tidak Cocok / Tidak Ditemukan:</span>{' '}
                  {importPreviewRows.filter(r => !r.matchedStudent).length} baris
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">NIS</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Status Pencocokan</th>
                      <th className="py-2.5 px-3">Kategori Bimbingan</th>
                      <th className="py-2.5 px-3">Mapel Disukai</th>
                      <th className="py-2.5 px-3">Mapel Sulit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importPreviewRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className={r.matchedStudent ? 'hover:bg-gray-50' : 'bg-rose-50/30'}>
                        <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                        <td className="py-2 px-3 font-mono">{r.nis}</td>
                        <td className="py-2 px-3 font-medium">{r.studentName}</td>
                        <td className="py-2 px-3">
                          {r.matchedStudent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Cocok
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Bukan Bimbingan
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{r.guidanceCategory}</td>
                        <td className="py-2 px-3 text-gray-600">{r.favoriteSubjects || '-'}</td>
                        <td className="py-2 px-3 text-rose-600">{r.difficultSubjects || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Hanya data yang berstatus <strong>Cocok</strong> yang akan disimpan ke database.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  disabled={isProcessingImport || importPreviewRows.filter(r => r.matchedStudent).length === 0}
                  onClick={handleExecuteImport}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {isProcessingImport ? 'Menyimpan...' : 'Simpan ke Database'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
