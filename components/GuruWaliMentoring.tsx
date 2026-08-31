import React, { useState, useEffect } from 'react';
import { 
  getMenteesByGuruWali, 
  saveMentoringJournal, 
  updateMentoringJournal,
  deleteMentoringJournal,
  getMentoringJournals,
  updateMentoringActionStatus,
  saveGraduateProfileAssessment,
  getGraduateProfileAssessments,
  getClasses,
  bulkUpdateTeacherMentees,
  removeMenteeFromGuruWali
} from '../services/database';
import { db } from '../services/db';
import { Student, User, MentoringJournal, MentoringTopic, GraduateProfileAssessment, ClassRoom } from '../types';
import { 
  Users, 
  Plus, 
  History, 
  ChevronRight, 
  Calendar, 
  BookOpen, 
  User as UserIcon, 
  Briefcase, 
  MessageCircle,
  Shield,
  ShieldOff,
  CheckCircle2,
  Clock,
  TrendingUp,
  Star,
  Activity,
  UserPlus,
  UserMinus,
  Search,
  X,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  Info,
  Printer,
  Edit3,
  Trash2,
  Settings,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface GuruWaliMentoringProps {
  user: User;
}

export const GuruWaliMentoring: React.FC<GuruWaliMentoringProps> = ({ user }) => {
  const [mentees, setMentees] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [journals, setJournals] = useState<MentoringJournal[]>([]);
  const [assessments, setAssessments] = useState<GraduateProfileAssessment[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'FORM' | 'ASSESSMENT'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal Select Mentee States
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [allSchoolStudents, setAllSchoolStudents] = useState<Student[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalClassFilter, setModalClassFilter] = useState('ALL');
  const [modalStatusFilter, setModalStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'MY_MENTEES' | 'OTHER'>('ALL');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [savingMentees, setSavingMentees] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Journal Form & Edit States
  const [editingJournal, setEditingJournal] = useState<MentoringJournal | null>(null);
  const [journalDate, setJournalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [topic, setTopic] = useState<MentoringTopic>('AKADEMIK');
  const [notes, setNotes] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [actionStatus, setActionStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [isPrivate, setIsPrivate] = useState(false);
  const [savingJournal, setSavingJournal] = useState(false);
  
  // Assessment States (8 Dimensions)
  const [scores, setScores] = useState({
    imanTaqwa: 3,
    kebinekaanGlobal: 3,
    gotongRoyong: 3,
    mandiri: 3,
    nalarKritis: 3,
    kreatif: 3,
    integritas: 3,
    leadershipResilience: 3
  });

  // Print & Signature Configuration
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [signatureData, setSignatureData] = useState({
    placeName: localStorage.getItem('guru_wali_place_name') || localStorage.getItem('journal_place_name') || 'Banjarbaru',
    principalName: localStorage.getItem('guru_wali_principal_name') || localStorage.getItem('journal_principal_name') || '',
    principalNip: localStorage.getItem('guru_wali_principal_nip') || localStorage.getItem('journal_principal_nip') || '',
    teacherName: localStorage.getItem('guru_wali_teacher_name') || user.fullName || '',
    teacherNip: localStorage.getItem('guru_wali_teacher_nip') || user.nip || ''
  });

  useEffect(() => {
    localStorage.setItem('guru_wali_place_name', signatureData.placeName);
    localStorage.setItem('guru_wali_principal_name', signatureData.principalName);
    localStorage.setItem('guru_wali_principal_nip', signatureData.principalNip);
    localStorage.setItem('guru_wali_teacher_name', signatureData.teacherName);
    localStorage.setItem('guru_wali_teacher_nip', signatureData.teacherNip);
  }, [signatureData]);

  useEffect(() => {
    loadInitialData();
  }, [user.id, user.schoolNpsn]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [menteeList, classList] = await Promise.all([
        getMenteesByGuruWali(user.id),
        getClasses(user.id, user.schoolNpsn)
      ]);
      
      setMentees(menteeList);
      setClasses(classList);
      
      const cMap: Record<string, string> = {};
      classList.forEach(c => {
        cMap[c.id] = c.name;
      });
      setClassMap(cMap);
    } catch (e) {
      console.error('Failed to load initial guru wali data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllStudentsForModal = async () => {
    try {
      let studentList: Student[] = [];
      if (user.schoolNpsn && user.schoolNpsn !== 'DEFAULT') {
        studentList = await db.students.where('schoolNpsn').equals(user.schoolNpsn).toArray();
      } else {
        studentList = await db.students.toArray();
      }
      setAllSchoolStudents(studentList);
      const currentMenteeIds = studentList
        .filter(s => s.guruWaliId === user.id)
        .map(s => s.id);
      setTempSelectedIds(currentMenteeIds);
    } catch (e) {
      console.error('Failed to load all students for modal:', e);
    }
  };

  const handleOpenSelectModal = async () => {
    await loadAllStudentsForModal();
    setModalSearchTerm('');
    setModalClassFilter('ALL');
    setModalStatusFilter('ALL');
    setIsSelectModalOpen(true);
  };

  const toggleStudentSelection = (studentId: string) => {
    setTempSelectedIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllVisible = (visibleIds: string[]) => {
    setTempSelectedIds(prev => {
      const set = new Set(prev);
      visibleIds.forEach(id => set.add(id));
      return Array.from(set);
    });
  };

  const handleDeselectAllVisible = (visibleIds: string[]) => {
    setTempSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
  };

  const handleSaveMenteeSelection = async () => {
    setSavingMentees(true);
    try {
      const currentMenteeIds = mentees.map(m => m.id);
      const toAssignIds = tempSelectedIds.filter(id => !currentMenteeIds.includes(id));
      const toRemoveIds = currentMenteeIds.filter(id => !tempSelectedIds.includes(id));

      if (toAssignIds.length === 0 && toRemoveIds.length === 0) {
        setIsSelectModalOpen(false);
        setSavingMentees(false);
        return;
      }

      await bulkUpdateTeacherMentees(user, toAssignIds, toRemoveIds);
      
      const updatedMentees = await getMenteesByGuruWali(user.id);
      setMentees(updatedMentees);
      
      setFeedbackMessage({
        type: 'success',
        text: `Berhasil memperbarui siswa bimbingan (+${toAssignIds.length} ditambah, -${toRemoveIds.length} dilepas). Total: ${updatedMentees.length} siswa.`
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      setIsSelectModalOpen(false);
    } catch (e: any) {
      console.error(e);
      alert('Gagal menyimpan perubahan siswa bimbingan: ' + (e.message || 'Terjadi kesalahan'));
    } finally {
      setSavingMentees(false);
    }
  };

  const handleRemoveSingleMentee = async (student: Student, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin melepas ${student.name} dari daftar siswa bimbingan Anda?`)) {
      return;
    }

    try {
      await removeMenteeFromGuruWali(user, student.id);
      setMentees(prev => prev.filter(m => m.id !== student.id));
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(null);
        setView('LIST');
      }
      setFeedbackMessage({
        type: 'success',
        text: `Siswa ${student.name} telah dilepas dari bimbingan Anda.`
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (e) {
      console.error(e);
      alert('Gagal melepas siswa bimbingan.');
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setLoading(true);
    try {
      const [jData, aData] = await Promise.all([
        getMentoringJournals(student.id, user),
        getGraduateProfileAssessments(student.id)
      ]);
      setJournals(jData.sort((a: MentoringJournal, b: MentoringJournal) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setAssessments(aData);
      setView('DETAIL');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddForm = () => {
    setEditingJournal(null);
    setJournalDate(new Date().toISOString().split('T')[0]);
    setTopic('AKADEMIK');
    setNotes('');
    setActionPlan('');
    setActionStatus('OPEN');
    setIsPrivate(false);
    setView('FORM');
  };

  const handleOpenEditForm = (journal: MentoringJournal) => {
    setEditingJournal(journal);
    setJournalDate(journal.date ? journal.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setTopic(journal.topic || 'AKADEMIK');
    setNotes(journal.notes || '');
    setActionPlan(journal.actionPlan || '');
    setActionStatus(journal.actionStatus || 'OPEN');
    setIsPrivate(!!journal.isPrivate);
    setView('FORM');
  };

  const handleDeleteJournal = async (journal: MentoringJournal, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const formattedDate = format(new Date(journal.date), 'dd MMMM yyyy', { locale: id });
    if (!confirm(`Apakah Anda yakin ingin menghapus catatan bimbingan tanggal ${formattedDate} (Topik: ${journal.topic})?`)) {
      return;
    }

    try {
      await deleteMentoringJournal(journal.id);
      setJournals(prev => prev.filter(j => j.id !== journal.id));
      setFeedbackMessage({
        type: 'success',
        text: 'Catatan bimbingan berhasil dihapus.'
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus catatan bimbingan.');
    }
  };

  const handleSaveJournal = async () => {
    if (!selectedStudent || !notes.trim()) return;
    setSavingJournal(true);
    try {
      if (editingJournal) {
        // Update existing journal
        await updateMentoringJournal(editingJournal.id, {
          topic,
          notes,
          actionPlan,
          actionStatus,
          isPrivate,
          date: new Date(journalDate).toISOString()
        });

        setFeedbackMessage({
          type: 'success',
          text: 'Perubahan catatan bimbingan berhasil disimpan.'
        });
      } else {
        // Create new journal
        await saveMentoringJournal({
          guruWaliId: user.id,
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          date: new Date(journalDate).toISOString(),
          topic,
          notes,
          actionPlan,
          actionStatus,
          isPrivate,
          schoolNpsn: user.schoolNpsn || 'DEFAULT'
        });

        setFeedbackMessage({
          type: 'success',
          text: 'Catatan bimbingan baru berhasil ditambahkan.'
        });
      }

      // Refresh list
      const jData = await getMentoringJournals(selectedStudent.id, user);
      setJournals(jData.sort((a: MentoringJournal, b: MentoringJournal) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
      setEditingJournal(null);
      setNotes('');
      setActionPlan('');
      setView('DETAIL');
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (e) {
      alert('Gagal menyimpan jurnal bimbingan.');
    } finally {
      setSavingJournal(false);
    }
  };

  const handleSaveAssessment = async () => {
    if (!selectedStudent) return;
    try {
      await saveGraduateProfileAssessment({
        studentId: selectedStudent.id,
        guruWaliId: user.id,
        date: new Date().toISOString(),
        scores,
        schoolNpsn: user.schoolNpsn || 'DEFAULT'
      });
      const aData = await getGraduateProfileAssessments(selectedStudent.id);
      setAssessments(aData);
      setView('DETAIL');
      setFeedbackMessage({
        type: 'success',
        text: 'Evaluasi 8 Dimensi Profil Lulusan berhasil disimpan.'
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (e) {
      alert('Gagal menyimpan penilaian.');
    }
  };

  const handleUpdateStatus = async (journalId: string, status: 'OPEN' | 'RESOLVED') => {
    try {
      await updateMentoringActionStatus(journalId, status);
      setJournals(prev => prev.map(j => j.id === journalId ? { ...j, actionStatus: status } : j));
    } catch (e) {
      console.error(e);
    }
  };

  // --- PRINT PER-STUDENT REPORT ---
  const handlePrintStudentReport = () => {
    if (!selectedStudent) return;

    const printWindow = window.open('', '_blank', 'height=850,width=1000');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan pop-up diizinkan pada browser Anda.');
      return;
    }

    const className = classMap[selectedStudent.classId] || 'Kelas';
    const formattedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const latestAssessment = assessments.length > 0 ? assessments[assessments.length - 1] : null;

    const getPredikat = (score: number) => {
      if (score >= 4.5) return 'Sangat Baik (A)';
      if (score >= 3.5) return 'Baik (B)';
      if (score >= 2.5) return 'Cukup (C)';
      return 'Perlu Pendampingan (D)';
    };

    const getScoreColor = (score: number) => {
      if (score >= 4) return '#15803d'; // green-700
      if (score === 3) return '#4338ca'; // indigo-700
      return '#c2410c'; // orange-700
    };

    // Rows for journals table
    const journalRowsHtml = journals.map((j, idx) => {
      const jDate = format(new Date(j.date), 'dd/MM/yyyy');
      const isResolved = j.actionStatus === 'RESOLVED';
      return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td class="text-center">${jDate}</td>
          <td class="text-center font-bold">${j.topic}</td>
          <td>
            <div style="white-space: pre-wrap;">${j.notes}</div>
            ${j.isPrivate ? '<div style="margin-top: 4px; font-size: 9px; color: #b91c1c; font-style: italic;">[Catatan Bersifat Konfidensial/Privat]</div>' : ''}
          </td>
          <td>${j.actionPlan || '-'}</td>
          <td class="text-center">
            <span class="status-badge ${isResolved ? 'badge-resolved' : 'badge-open'}">
              ${isResolved ? 'Selesai' : 'Terbuka'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    // Rows for 8 Dimensions Profil Lulusan
    const dimensionList: Array<{ key: keyof typeof scores; name: string; desc: string }> = [
      { key: 'imanTaqwa', name: '1. Keimanan, Ketakwaan & Akhlak Mulia', desc: 'Menghayati nilai-nilai keagamaan, toleransi, dan budi pekerti luhur.' },
      { key: 'kebinekaanGlobal', name: '2. Kebinekaan Global', desc: 'Menghargai keragaman budaya, berwawasan luas, dan berpikiran terbuka.' },
      { key: 'gotongRoyong', name: '3. Gotong Royong & Kepedulian', desc: 'Kemampuan berkolaborasi, peduli terhadap sesama, dan proaktif membantu.' },
      { key: 'mandiri', name: '4. Kemandirian', desc: 'Bertanggung jawab atas proses dan hasil belajar serta pengelolaan diri.' },
      { key: 'nalarKritis', name: '5. Bernalar Kritis', desc: 'Mampu memproses informasi, menganalisis masalah, dan mengambil keputusan logis.' },
      { key: 'kreatif', name: '6. Kreativitas & Inovasi', desc: 'Menghasilkan gagasan orisinal, solusi inovatif, dan karya yang bermanfaat.' },
      { key: 'integritas', name: '7. Integritas & Kejujuran', desc: 'Konsisten memegang prinsip kebenaran, etika moral, dan kedisiplinan.' },
      { key: 'leadershipResilience', name: '8. Kepemimpinan & Resiliensi', desc: 'Mampu memimpin diri/kelompok serta gigih menghadapi tantangan pembelajaran.' }
    ];

    const dimensionRowsHtml = dimensionList.map((dim, idx) => {
      const scoreVal = latestAssessment && latestAssessment.scores ? latestAssessment.scores[dim.key] : null;
      return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>
            <strong>${dim.name}</strong>
            <div style="font-size: 10px; color: #555; margin-top: 2px;">${dim.desc}</div>
          </td>
          <td class="text-center font-bold" style="font-size: 13px; color: ${scoreVal ? getScoreColor(scoreVal) : '#666'};">
            ${scoreVal !== null ? `${scoreVal} / 5` : '-'}
          </td>
          <td class="text-center">
            ${scoreVal !== null ? `<strong>${getPredikat(scoreVal)}</strong>` : '<span style="color: #888;">Belum Dievaluasi</span>'}
          </td>
        </tr>
      `;
    }).join('');

    const resolvedCount = journals.filter(j => j.actionStatus === 'RESOLVED').length;
    const openCount = journals.length - resolvedCount;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Laporan Bimbingan Guru Wali - ${selectedStudent.name} (${selectedStudent.nis})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 12mm 15mm 12mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 11pt;
              line-height: 1.35;
              color: #111;
              margin: 0;
              padding: 0;
            }
            .header-kop {
              text-align: center;
              border-bottom: 3px double #000;
              padding-bottom: 8px;
              margin-bottom: 15px;
            }
            .header-kop h3 {
              margin: 0;
              font-size: 13pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-kop h2 {
              margin: 3px 0;
              font-size: 15pt;
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
              margin: 15px 0 12px 0;
            }
            .report-title h4 {
              margin: 0;
              font-size: 12pt;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
            }
            .report-title p {
              margin: 3px 0 0 0;
              font-size: 10pt;
              color: #444;
            }
            .student-info-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
            }
            .student-info-table td {
              padding: 3px 6px;
              font-size: 10.5pt;
              vertical-align: top;
            }
            .student-info-table td.label {
              width: 22%;
              font-weight: bold;
            }
            .student-info-table td.colon {
              width: 2%;
            }
            .section-header {
              font-family: Arial, sans-serif;
              font-size: 10pt;
              font-weight: bold;
              background-color: #f1f5f9;
              padding: 5px 8px;
              margin-top: 14px;
              margin-bottom: 6px;
              border-left: 4px solid #1e40af;
              text-transform: uppercase;
              page-break-after: avoid;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              page-break-inside: auto;
            }
            table.data-table th, table.data-table td {
              border: 1px solid #444;
              padding: 5px 6px;
              font-size: 10pt;
              vertical-align: top;
            }
            table.data-table th {
              background-color: #e2e8f0;
              font-family: Arial, sans-serif;
              font-size: 9pt;
              text-align: center;
              font-weight: bold;
              text-transform: uppercase;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 8.5pt;
              font-weight: bold;
              font-family: Arial, sans-serif;
            }
            .badge-resolved {
              background-color: #dcfce7;
              color: #166534;
              border: 1px solid #86efac;
            }
            .badge-open {
              background-color: #fef3c7;
              color: #92400e;
              border: 1px solid #fde68a;
            }
            .recap-box {
              display: flex;
              gap: 12px;
              margin-bottom: 12px;
              font-family: Arial, sans-serif;
              font-size: 9.5pt;
            }
            .recap-item {
              flex: 1;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              border-radius: 4px;
            }
            .recap-item strong {
              color: #1e3a8a;
            }
            .signature-container {
              margin-top: 30px;
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
              font-size: 10.5pt;
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
            <p>Sistem Informasi Manajemen Bimbingan Guru Wali & Profil Lulusan Siswa</p>
          </div>

          <!-- JUDUL LAPORAN -->
          <div class="report-title">
            <h4>LEMBAR REKAPITULASI BIMBINGAN GURU WALI</h4>
            <p>Dokumen Pembinaan Personal & Perkembangan Profil Lulusan</p>
          </div>

          <!-- BIODATA SISWA -->
          <table class="student-info-table">
            <tr>
              <td class="label">Nama Siswa</td>
              <td class="colon">:</td>
              <td><strong>${selectedStudent.name}</strong></td>
              <td class="label">Kelas</td>
              <td class="colon">:</td>
              <td><strong>${className}</strong></td>
            </tr>
            <tr>
              <td class="label">Nomor Induk Siswa (NIS)</td>
              <td class="colon">:</td>
              <td>${selectedStudent.nis}</td>
              <td class="label">Jenis Kelamin</td>
              <td class="colon">:</td>
              <td>${selectedStudent.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}</td>
            </tr>
            <tr>
              <td class="label">Guru Wali Pembimbing</td>
              <td class="colon">:</td>
              <td><strong>${signatureData.teacherName || user.fullName}</strong></td>
              <td class="label">Tanggal Cetak</td>
              <td class="colon">:</td>
              <td>${formattedDate}</td>
            </tr>
          </table>

          <!-- STATISTIK RINGKASAN -->
          <div class="recap-box">
            <div class="recap-item">
              Total Sesi Bimbingan: <strong>${journals.length} Sesi</strong>
            </div>
            <div class="recap-item">
              Tindak Lanjut Tuntas: <strong>${resolvedCount}</strong> | Berjalan: <strong>${openCount}</strong>
            </div>
            <div class="recap-item">
              Status Evaluasi 8 Dimensi: <strong>${latestAssessment ? 'Sudah Terevaluasi' : 'Belum Ada Evaluasi'}</strong>
            </div>
          </div>

          <!-- BAGIAN A: RIWAYAT SESI BIMBINGAN -->
          <div class="section-header">A. Riwayat Jurnal Catatan Sesi Bimbingan (${journals.length} Catatan)</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 75px;">Tanggal</th>
                <th style="width: 80px;">Topik</th>
                <th>Catatan / Observasi Pembimbing</th>
                <th style="width: 140px;">Rencana Tindak Lanjut</th>
                <th style="width: 70px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${journals.length === 0 ? `
                <tr>
                  <td colspan="6" class="text-center" style="padding: 15px; color: #666; font-style: italic;">
                    Belum ada catatan jurnal bimbingan yang tercatat untuk siswa ini.
                  </td>
                </tr>
              ` : journalRowsHtml}
            </tbody>
          </table>

          <!-- BAGIAN B: EVALUASI 8 DIMENSI PROFIL LULUSAN -->
          <div class="section-header">B. Evaluasi Capaian 8 Dimensi Profil Lulusan</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th>Dimensi Profil Lulusan & Indikator</th>
                <th style="width: 75px;">Skor (1-5)</th>
                <th style="width: 150px;">Predikat Capaian</th>
              </tr>
            </thead>
            <tbody>
              ${dimensionRowsHtml}
            </tbody>
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

  const getTopicIcon = (t: MentoringTopic) => {
    switch (t) {
      case 'AKADEMIK': return <BookOpen className="w-4 h-4" />;
      case 'PRIBADI': return <UserIcon className="w-4 h-4" />;
      case 'SOSIAL': return <MessageCircle className="w-4 h-4" />;
      case 'KARIER': return <Briefcase className="w-4 h-4" />;
    }
  };

  const getTopicColor = (t: MentoringTopic) => {
    switch (t) {
      case 'AKADEMIK': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PRIBADI': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'SOSIAL': return 'bg-green-100 text-green-700 border-green-200';
      case 'KARIER': return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  const dimensionLabels: Record<keyof typeof scores, string> = {
    imanTaqwa: 'Iman & Taqwa',
    kebinekaanGlobal: 'Kebinekaan Global',
    gotongRoyong: 'Gotong Royong',
    mandiri: 'Mandiri',
    nalarKritis: 'Bernalar Kritis',
    kreatif: 'Kreatif',
    integritas: 'Integritas',
    leadershipResilience: 'Kepemimpinan & Resiliensi'
  };

  // Filtered mentees on main screen
  const filteredMentees = mentees.filter(m => {
    const q = searchTerm.toLowerCase();
    const className = (classMap[m.classId] || '').toLowerCase();
    return m.name.toLowerCase().includes(q) || m.nis.includes(q) || className.includes(q);
  });

  // Filtered students inside modal
  const filteredModalStudents = allSchoolStudents.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
                          s.nis.includes(modalSearchTerm);
    const matchesClass = modalClassFilter === 'ALL' || s.classId === modalClassFilter;
    
    let matchesStatus = true;
    if (modalStatusFilter === 'UNASSIGNED') {
      matchesStatus = !s.guruWaliId;
    } else if (modalStatusFilter === 'MY_MENTEES') {
      matchesStatus = s.guruWaliId === user.id || tempSelectedIds.includes(s.id);
    } else if (modalStatusFilter === 'OTHER') {
      matchesStatus = !!s.guruWaliId && s.guruWaliId !== user.id && !tempSelectedIds.includes(s.id);
    }
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  const visibleModalStudentIds = filteredModalStudents.map(s => s.id);
  const allVisibleSelected = visibleModalStudentIds.length > 0 && visibleModalStudentIds.every(id => tempSelectedIds.includes(id));

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="p-1 hover:bg-black/5 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW: LIST OF MENTEES */}
      {view === 'LIST' && (
        <>
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">Bimbingan Guru Wali</h2>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">
                    {mentees.length} Siswa Bimbingan
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Pendampingan personal, pencatatan sesi bimbingan, evaluasi profil lulusan, dan cetak laporan per siswa.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleOpenSelectModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm shadow-indigo-200 hover:shadow-indigo-300"
              >
                <UserPlus className="w-4 h-4" />
                <span>Pilih Siswa Bimbingan</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          {mentees.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, NIS, atau kelas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 self-end sm:self-center">
                Menampilkan <strong>{filteredMentees.length}</strong> dari <strong>{mentees.length}</strong> siswa
              </p>
            </div>
          )}

          {/* Mentees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl"></div>
              ))
            ) : mentees.length === 0 ? (
              <div className="col-span-full py-16 px-6 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-sm space-y-4">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">Belum Ada Siswa Bimbingan</h3>
                  <p className="text-sm text-gray-500">
                    Anda belum memiliki siswa yang terdaftar dalam bimbingan Guru Wali. Anda dapat memilih siswa binaan Anda sendiri sekarang secara mandiri.
                  </p>
                </div>
                <button
                  onClick={handleOpenSelectModal}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-100"
                >
                  <UserPlus className="w-4 h-4" />
                  Pilih Siswa Bimbingan Sekarang
                </button>
              </div>
            ) : filteredMentees.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl text-gray-500 text-sm">
                Tidak ada siswa bimbingan yang cocok dengan pencarian "<strong>{searchTerm}</strong>".
              </div>
            ) : (
              filteredMentees.map((student) => {
                const className = classMap[student.classId] || 'Kelas';
                return (
                  <motion.div
                    key={student.id}
                    whileHover={{ y: -2 }}
                    className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between group relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold">
                            {className}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">
                            NIS: {student.nis}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {student.name}
                        </h4>
                      </div>

                      <button
                        onClick={(e) => handleRemoveSingleMentee(student, e)}
                        title="Lepas dari Siswa Bimbingan Saya"
                        className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <button
                        onClick={() => handleSelectStudent(student)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group/btn"
                      >
                        <span>Buka Bimbingan</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>

                      <Link
                        to={`/student-360/${student.id}`}
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1"
                      >
                        <Activity className="w-3 h-3 text-indigo-500" />
                        <span>Profil 360</span>
                      </Link>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* VIEW: DETAIL / FORM / ASSESSMENT FOR SELECTED STUDENT */}
      {selectedStudent && view !== 'LIST' && (
        <div className="space-y-6">
          {/* Top Bar for Selected Student */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setView('LIST');
                  setSelectedStudent(null);
                  setEditingJournal(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                title="Kembali ke Daftar Siswa"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h2>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">
                    {classMap[selectedStudent.classId] || 'Kelas'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  NIS: {selectedStudent.nis} • {selectedStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'} • Siswa Bimbingan Guru Wali
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePrintStudentReport}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-indigo-200 shadow-sm"
                title="Cetak Lembar Rekap Bimbingan & Profil Lulusan"
              >
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Cetak Laporan Siswa</span>
              </button>

              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="p-2 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition-colors"
                title="Pengaturan Tanda Tangan Cetak"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleRemoveSingleMentee(selectedStudent)}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Lepas Siswa dari Bimbingan"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lepas Bimbingan</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button 
              onClick={() => {
                setEditingJournal(null);
                setView('DETAIL');
              }} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                view === 'DETAIL' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Riwayat & Ringkasan ({journals.length})</span>
            </button>
            
            <button 
              onClick={handleOpenAddForm} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                view === 'FORM' && !editingJournal
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Plus className="w-4 h-4" /> 
              <span>Catat Bimbingan</span>
            </button>

            <button 
              onClick={() => setView('ASSESSMENT')} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                view === 'ASSESSMENT' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Star className="w-4 h-4" /> 
              <span>Evaluasi 8 Dimensi</span>
            </button>

            <button
              onClick={handlePrintStudentReport}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>Cetak Laporan</span>
            </button>

            <Link 
              to={`/student-360/${selectedStudent.id}`}
              className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all whitespace-nowrap"
            >
              <Activity className="w-4 h-4" /> Profil 360
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {/* DETAIL & HISTORY VIEW */}
            {view === 'DETAIL' && (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/70 to-white">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History className="w-5 h-5 text-indigo-600" />
                        <span>Riwayat Jurnal Mentoring ({journals.length} Catatan)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrintStudentReport}
                          className="text-xs font-bold text-gray-700 hover:text-indigo-600 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg flex items-center gap-1 shadow-2xs hover:bg-gray-50"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Cetak</span>
                        </button>
                        <button
                          onClick={handleOpenAddForm}
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100 max-h-[650px] overflow-y-auto">
                      {journals.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 space-y-3">
                          <BookOpen className="w-10 h-10 mx-auto text-gray-300" />
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-600">Belum ada catatan bimbingan untuk siswa ini.</p>
                            <p className="text-xs text-gray-400">Mulailah mencatat observasi akademik, pribadi, sosial, atau karier.</p>
                          </div>
                          <button
                            onClick={handleOpenAddForm}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Catat Sesi Bimbingan Pertama
                          </button>
                        </div>
                      ) : (
                        journals.map((journal) => (
                          <div key={journal.id} className="p-5 space-y-3 hover:bg-gray-50/60 transition-colors group relative">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getTopicColor(journal.topic)}`}>
                                  {getTopicIcon(journal.topic)}
                                  {journal.topic}
                                </span>
                                {journal.isPrivate && (
                                  <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                    <Shield className="w-3 h-3" /> Privasi
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  {format(new Date(journal.date), 'dd MMM yyyy', { locale: id })}
                                </span>

                                {/* EDIT AND DELETE BUTTONS */}
                                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shadow-2xs">
                                  <button
                                    onClick={() => handleOpenEditForm(journal)}
                                    title="Edit Catatan Bimbingan"
                                    className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteJournal(journal, e)}
                                    title="Hapus Catatan Bimbingan"
                                    className="p-1 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
                              {journal.notes}
                            </p>

                            {journal.actionPlan && (
                              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
                                  Rencana Tindak Lanjut:
                                </p>
                                <div className="flex items-start justify-between gap-4">
                                  <p className="text-sm text-indigo-950">{journal.actionPlan}</p>
                                  <button
                                    onClick={() => handleUpdateStatus(journal.id, journal.actionStatus === 'OPEN' ? 'RESOLVED' : 'OPEN')}
                                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                      journal.actionStatus === 'RESOLVED' 
                                      ? 'bg-emerald-600 text-white shadow-2xs' 
                                      : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                                    }`}
                                  >
                                    {journal.actionStatus === 'RESOLVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                    <span>{journal.actionStatus === 'RESOLVED' ? 'Selesai' : 'Terbuka'}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar Stats & Assessment Summary */}
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Ringkasan Bimbingan
                      </h4>
                      <button
                        onClick={handlePrintStudentReport}
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" /> Cetak Lembar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                        <p className="text-[11px] font-bold text-gray-500 uppercase">Total Sesi</p>
                        <p className="text-xl font-black text-indigo-600 mt-0.5">{journals.length}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                        <p className="text-[11px] font-bold text-gray-500 uppercase">Tindak Lanjut</p>
                        <p className="text-xl font-black text-emerald-600 mt-0.5">
                          {journals.filter(j => j.actionStatus === 'RESOLVED').length}
                          <span className="text-xs font-normal text-gray-400">/{journals.length}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 8 Dimensions Profil Lulusan Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                        <span>Profil Lulusan (8 Dimensi)</span>
                      </div>
                      <button
                        onClick={() => setView('ASSESSMENT')}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        {assessments.length === 0 ? '+ Mulai Nilai' : 'Update Nilai'}
                      </button>
                    </div>

                    {assessments.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-sm space-y-2">
                        <Star className="w-7 h-7 mx-auto text-gray-300" />
                        <p>Belum ada evaluasi dimensi profil lulusan.</p>
                        <button
                          onClick={() => setView('ASSESSMENT')}
                          className="text-xs font-bold text-indigo-600 hover:underline block mx-auto"
                        >
                          Isi Evaluasi Sekarang
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {Object.entries(assessments[assessments.length - 1].scores).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-700 font-medium">{dimensionLabels[key as keyof typeof scores]}</span>
                              <span className="font-bold text-indigo-700">{value}/5</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(value as number) * 20}%` }}
                                className={`h-full rounded-full ${
                                  (value as number) > 3 ? 'bg-emerald-500' : (value as number) === 3 ? 'bg-indigo-500' : 'bg-amber-500'
                                }`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* FORM VIEW (ADD OR EDIT JOURNAL) */}
            {view === 'FORM' && (
              <motion.div 
                key="form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg max-w-2xl mx-auto"
              >
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      {editingJournal ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {editingJournal ? 'Edit Catatan Sesi Bimbingan' : 'Catat Sesi Bimbingan Baru'}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Siswa: <strong>{selectedStudent.name}</strong> ({selectedStudent.nis})
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingJournal(null);
                      setView('DETAIL');
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Tanggal & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Tanggal Bimbingan
                      </label>
                      <input
                        type="date"
                        value={journalDate}
                        onChange={(e) => setJournalDate(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Status Tindak Lanjut
                      </label>
                      <select
                        value={actionStatus}
                        onChange={(e) => setActionStatus(e.target.value as any)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      >
                        <option value="OPEN">Terbuka / Dalam Proses</option>
                        <option value="RESOLVED">Selesai / Tuntas</option>
                      </select>
                    </div>
                  </div>

                  {/* Topik Bimbingan */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Topik Bimbingan
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['AKADEMIK', 'PRIBADI', 'SOSIAL', 'KARIER'] as MentoringTopic[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setTopic(t);
                            if (t === 'PRIBADI' || t === 'SOSIAL') setIsPrivate(true);
                          }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            topic === t 
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-800 font-bold shadow-2xs' 
                            : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                          }`}
                        >
                          {getTopicIcon(t)}
                          <span className="text-xs font-bold">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catatan / Observasi */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Catatan / Observasi Perkembangan Siswa <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Tuliskan dinamika permasalahan, observasi sikap/hasil belajar, dan proses bimbingan..."
                      rows={4}
                      className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm leading-relaxed"
                    />
                  </div>

                  {/* Rencana Tindak Lanjut */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Rencana Tindak Lanjut (Opsional)
                    </label>
                    <input
                      type="text"
                      value={actionPlan}
                      onChange={(e) => setActionPlan(e.target.value)}
                      placeholder="Contoh: Remedial pekan depan / Pemanggilan kolaboratif wali / Pemantauan presensi"
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>

                  {/* Privasi Catatan */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isPrivate ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-500'}`}>
                        {isPrivate ? <Shield className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Privasi Catatan</p>
                        <p className="text-[11px] text-gray-500">Hanya dapat dilihat oleh Guru Wali, BK, dan Kepala Sekolah/Wakasek.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isPrivate} 
                        onChange={(e) => setIsPrivate(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingJournal(null);
                        setView('DETAIL');
                      }}
                      className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                    >
                      Batal
                    </button>
                    <button 
                      type="button"
                      onClick={handleSaveJournal}
                      disabled={!notes.trim() || savingJournal}
                      className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                    >
                      {savingJournal ? (
                        <span>Menyimpan...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{editingJournal ? 'Simpan Perubahan' : 'Simpan Jurnal Bimbingan'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ASSESSMENT VIEW (8 DIMENSI) */}
            {view === 'ASSESSMENT' && (
              <motion.div 
                key="assessment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg max-w-3xl mx-auto"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    Evaluasi 8 Dimensi Profil Lulusan
                  </h3>
                  <button 
                    onClick={() => setView('DETAIL')}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mb-6">
                  Berikan evaluasi skala 1-5 berdasarkan capaian dan perkembangan perilaku siswa <strong>{selectedStudent.name}</strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                  {Object.entries(dimensionLabels).map(([key, label]) => (
                    <div key={key} className="space-y-2 p-3 bg-gray-50/70 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{label}</label>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-xs">
                          {scores[key as keyof typeof scores]}/5
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setScores(prev => ({ ...prev, [key]: val }))}
                            className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                              scores[key as keyof typeof scores] >= val 
                              ? val > 3 ? 'bg-emerald-600 text-white' : val === 3 ? 'bg-indigo-600 text-white' : 'bg-amber-600 text-white'
                              : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setView('DETAIL')}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                  >
                    Batal
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveAssessment}
                    className="flex-[2] px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan Evaluasi Profil</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* MODAL: PILIH SISWA BIMBINGAN */}
      <AnimatePresence>
        {isSelectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-200">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Pilih Siswa Bimbingan Guru Wali</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pilih siswa di sekolah ini yang akan menjadi binaan mentor personal Anda.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSelectModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Search and Filters */}
              <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama atau NIS..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Filter Kelas */}
                  <div>
                    <select
                      value={modalClassFilter}
                      onChange={(e) => setModalClassFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">Semua Kelas ({allSchoolStudents.length} Siswa)</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Status */}
                  <div>
                    <select
                      value={modalStatusFilter}
                      onChange={(e) => setModalStatusFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">Semua Status Bimbingan</option>
                      <option value="UNASSIGNED">Belum Ada Guru Wali</option>
                      <option value="MY_MENTEES">Bimbingan Saya (Dipilih)</option>
                      <option value="OTHER">Sudah Dibimbing Guru Lain</option>
                    </select>
                  </div>
                </div>

                {/* Quick Selection Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => allVisibleSelected ? handleDeselectAllVisible(visibleModalStudentIds) : handleSelectAllVisible(visibleModalStudentIds)}
                      disabled={visibleModalStudentIds.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                    >
                      {allVisibleSelected ? <Square className="w-3.5 h-3.5 text-indigo-600" /> : <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />}
                      <span>{allVisibleSelected ? 'Batalkan Pilihan yang Ditampilkan' : 'Pilih Semua yang Ditampilkan'}</span>
                    </button>
                  </div>

                  <div className="text-xs text-gray-500">
                    Ditemukan: <strong>{filteredModalStudents.length}</strong> siswa • Dipilih: <strong className="text-indigo-600 font-bold">{tempSelectedIds.length}</strong> siswa
                  </div>
                </div>
              </div>

              {/* Modal Student List */}
              <div className="p-4 overflow-y-auto flex-1 max-h-[480px]">
                {filteredModalStudents.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-gray-300" />
                    <p className="text-sm">Tidak ada siswa yang sesuai kriteria filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredModalStudents.map(student => {
                      const isSelected = tempSelectedIds.includes(student.id);
                      const className = classMap[student.classId] || 'Kelas';
                      const hasOtherMentor = student.guruWaliId && student.guruWaliId !== user.id;

                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected 
                              ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400 shadow-sm' 
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {student.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
                                <span className="font-semibold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded text-[11px]">
                                  {className}
                                </span>
                                <span>NIS: {student.nis}</span>
                                <span>({student.gender === 'L' ? 'L' : 'P'})</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            {isSelected ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Terpilih
                              </span>
                            ) : hasOtherMentor ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded-full truncate max-w-[120px]" title={`Guru Wali: ${student.guruWaliName || 'Guru Lain'}`}>
                                {student.guruWaliName || 'Guru Lain'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full">
                                Belum Ada
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Total Siswa Terpilih: <strong>{tempSelectedIds.length} Siswa</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setIsSelectModalOpen(false)}
                    disabled={savingMentees}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveMenteeSelection}
                    disabled={savingMentees}
                    className="flex-1 sm:flex-none px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingMentees ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Simpan Siswa Bimbingan ({tempSelectedIds.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: PENGATURAN TANDA TANGAN CETAK */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-gray-900 text-base">Pengaturan Tanda Tangan Cetak</h3>
                </div>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kota / Tempat Penandatanganan</label>
                  <input
                    type="text"
                    value={signatureData.placeName}
                    onChange={(e) => setSignatureData(prev => ({ ...prev, placeName: e.target.value }))}
                    placeholder="Contoh: Banjarbaru"
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Kepala Sekolah</label>
                    <input
                      type="text"
                      value={signatureData.principalName}
                      onChange={(e) => setSignatureData(prev => ({ ...prev, principalName: e.target.value }))}
                      placeholder="Nama Kepala Sekolah"
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      value={signatureData.principalNip}
                      onChange={(e) => setSignatureData(prev => ({ ...prev, principalNip: e.target.value }))}
                      placeholder="NIP Kepala Sekolah"
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Guru Wali</label>
                    <input
                      type="text"
                      value={signatureData.teacherName}
                      onChange={(e) => setSignatureData(prev => ({ ...prev, teacherName: e.target.value }))}
                      placeholder="Nama Guru Wali"
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">NIP Guru Wali</label>
                    <input
                      type="text"
                      value={signatureData.teacherNip}
                      onChange={(e) => setSignatureData(prev => ({ ...prev, teacherNip: e.target.value }))}
                      placeholder="NIP Guru Wali"
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    handlePrintStudentReport();
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Simpan & Cetak</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
