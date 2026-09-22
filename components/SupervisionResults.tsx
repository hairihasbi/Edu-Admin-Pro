
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SupervisionResult } from '../types';
import { getSupervisionResults, getSupervisionResultsForSchool, getSchoolTeachers, runManualSync } from '../services/database';
import { ClipboardCheck, User as UserIcon, Calendar, Star, ChevronDown, ChevronUp, Search, Filter, Loader2, AlertCircle, Shield, Pencil as Edit, Printer, X, RefreshCcw, FileText } from './Icons';
import { DEEP_LEARNING_SUPERVISION_ITEMS, DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS, DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS } from './deepLearningSupervisionConstants';

interface SupervisionResultsProps {
  user: User;
}

const SupervisionResults: React.FC<SupervisionResultsProps> = ({ user }) => {
  const [results, setResults] = useState<SupervisionResult[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isWakasek = user.additionalRole === 'WAKASEK_KURIKULUM';
  const isKepsek = user.additionalRole === 'KEPALA_SEKOLAH' || user.role === 'ADMIN';
  const isSupervisor = Boolean(user.isSupervisor);
  const isTeacherOnly = !isWakasek && !isKepsek && !isSupervisor;
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useState('ALL');
  const navigate = useNavigate();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printResult, setPrintResult] = useState<SupervisionResult | null>(null);
  const [printConfig, setPrintConfig] = useState({
    printFormat: 'SUMMARY' as 'SUMMARY' | 'FULL',
    className: '',
    semester: '',
    competence: '',
    timeAllocation: '',
    principalName: localStorage.getItem('sup_principal_name') || '',
    principalNip: localStorage.getItem('sup_principal_nip') || '',
    location: localStorage.getItem('sup_location') || '',
    date: new Date().toISOString().split('T')[0],
    letterheadUrl: localStorage.getItem('sup_letterhead') || '',
    marginTop: localStorage.getItem('sup_margin_top') || '0.8',
    marginBottom: localStorage.getItem('sup_margin_bottom') || '0.8'
  });

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran file terlalu besar. Maksimal 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPrintConfig(prev => ({ ...prev, letterheadUrl: base64String }));
        localStorage.setItem('sup_letterhead', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async (forceSync = false) => {
    if (!forceSync) setLoading(true);
    else setIsSyncing(true);
    
    try {
      // Pull latest supervision data from cloud if online
      if ((forceSync || !results.length) && navigator.onLine) {
        try {
          await runManualSync('PULL', () => {}, ['eduadmin_supervision_results', 'eduadmin_users', 'eduadmin_supervision_assignments']);
        } catch (e) {
          console.warn("Sync pull warning:", e);
        }
      }

      let data: SupervisionResult[] = [];
      if (isWakasek || isKepsek) {
        // Kepala Sekolah and Wakasek Kurikulum can view all results for the school
        data = await getSupervisionResultsForSchool(user.schoolNpsn!);
      } else if (isSupervisor) {
        // Supervisor can view results for teachers they evaluated, plus their own evaluation
        const [supervisedResults, ownResults] = await Promise.all([
          getSupervisionResults(undefined, user.id),
          getSupervisionResults(user.id, undefined)
        ]);
        const map = new Map<string, SupervisionResult>();
        [...supervisedResults, ...ownResults].forEach(item => map.set(item.id, item));
        data = Array.from(map.values());
      } else {
        // STRICT PRIVACY: Regular teachers can ONLY see their own supervision results.
        const teacherResults = await getSupervisionResults(user.id, undefined);
        data = teacherResults.filter(item => item.teacherId === user.id);
      }
      
      const schoolTeachers = await getSchoolTeachers(user.schoolNpsn!);
      
      setResults(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setTeachers(schoolTeachers);
    } catch (error) {
      console.error("Failed to fetch supervision results:", error);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const filteredResults = results.filter(r => {
    // 1. Privacy guard
    if (isTeacherOnly && r.teacherId !== user.id) {
      return false;
    }
    if (isSupervisor && !isWakasek && !isKepsek && r.supervisorId !== user.id && r.teacherId !== user.id) {
      return false;
    }

    // 2. Supervisor filter (for Kepala Sekolah / Wakasek Kurikulum)
    if ((isWakasek || isKepsek) && selectedSupervisorFilter !== 'ALL' && r.supervisorId !== selectedSupervisorFilter) {
      return false;
    }

    // 3. Search query
    const teacher = teachers.find(t => t.id === r.teacherId);
    const supervisor = teachers.find(t => t.id === r.supervisorId);
    const searchStr = `${teacher?.fullName || ''} ${supervisor?.fullName || ''} ${teacher?.subject || ''} ${r.date}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const handlePrint = (result: SupervisionResult) => {
    setPrintResult(result);
    setIsPrintModalOpen(true);
  };

  const generatePrint = () => {
    if (!printResult) return;
    const teacher = teachers.find(t => t.id === printResult.teacherId);
    const supervisor = teachers.find(t => t.id === printResult.supervisorId);

    const printWindow = window.open('', '', 'height=850,width=1050');
    if (!printWindow) return;

    // Save preferences
    localStorage.setItem('sup_principal_name', printConfig.principalName);
    localStorage.setItem('sup_principal_nip', printConfig.principalNip);
    localStorage.setItem('sup_location', printConfig.location);
    localStorage.setItem('sup_margin_top', printConfig.marginTop);
    localStorage.setItem('sup_margin_bottom', printConfig.marginBottom);

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getPredicateLabel = (score: number) => {
      if (score >= 91) return 'AMAT BAIK (A)';
      if (score >= 81) return 'BAIK (B)';
      if (score >= 71) return 'CUKUP (C)';
      return 'KURANG (D)';
    };

    const getKetercapaian = (score: number) => {
      if (score >= 91) return 'Sangat Memuaskan';
      if (score >= 81) return 'Memenuhi Standar';
      if (score >= 71) return 'Cukup Memenuhi Standar';
      return 'Perlu Pembinaan Khusus';
    };

    // Calculate real component scores from actual supervisor inputs
    const adminScores = printResult.planningAdmin?.scores || {};
    const adminPerolehan = Object.values(adminScores).reduce((acc: number, curr: any) => acc + (typeof curr === 'number' ? curr : 0), 0);
    const adminMaxScore = printResult.planningAdmin?.maxScore || (Object.keys(adminScores).length > 12 ? 72 : 24);
    const adminFinalScore = printResult.planningAdmin?.finalScore ?? (Object.keys(adminScores).length ? (adminPerolehan / adminMaxScore) * 100 : 0);
    const adminPredicate = printResult.planningAdmin?.predicate || getPredicateLabel(adminFinalScore);

    const rppScores = printResult.lessonPlan?.scores || {};
    const rppPerolehan = Object.values(rppScores).reduce((acc: number, curr: any) => acc + (typeof curr === 'number' ? curr : 0), 0);
    const rppMaxScore = printResult.lessonPlan?.maxScore || (Object.keys(rppScores).length > 15 ? 68 : 34);
    const rppFinalScore = printResult.lessonPlan?.finalScore ?? (Object.keys(rppScores).length ? (rppPerolehan / rppMaxScore) * 100 : 0);
    const rppPredicate = printResult.lessonPlan?.predicate || getPredicateLabel(rppFinalScore);

    const implScores = printResult.implementation?.scores || {};
    const implPerolehan = Object.values(implScores).reduce((acc: number, curr: any) => acc + (typeof curr === 'number' ? curr : 0), 0);
    const implMaxScore = printResult.implementation?.maxScore || 60;
    const implFinalScore = printResult.implementation?.finalScore ?? (Object.keys(implScores).length ? (implPerolehan / implMaxScore) * 100 : 0);
    const implPredicate = printResult.implementation?.predicate || getPredicateLabel(implFinalScore);

    const totalSkorRiil = adminPerolehan + rppPerolehan + implPerolehan;
    const totalSkorMaks = adminMaxScore + rppMaxScore + implMaxScore;
    
    // Weighted / Average Final Score
    const validScores = [adminFinalScore, rppFinalScore, implFinalScore].filter(s => s > 0);
    const averageFinalScore = printResult.score || (validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0);
    const overallPredicate = getPredicateLabel(averageFinalScore);

    const letterheadHtml = printConfig.letterheadUrl 
      ? `<div class="letterhead-container"><img src="${printConfig.letterheadUrl}" style="width: 100%; max-height: 120px; object-fit: contain;" /></div>` 
      : `
        <div class="school-header-text">
          <div style="font-size: 13pt; font-weight: bold; letter-spacing: 0.5px;">${(user.schoolName || 'SATUAN PENDIDIKAN').toUpperCase()}</div>
          <div style="font-size: 9pt; color: #444; margin-top: 2px;">NPSN: ${user.schoolNpsn || '-'} &nbsp;|&nbsp; Sistem Manajemen Penilaian Supervisi Akademik Guru</div>
        </div>
      `;

    // Identity Table
    const identityHtml = `
      <div class="identity-box">
        <table class="identity-table">
          <tr>
            <td style="width: 18%;">Satuan Pendidikan</td>
            <td style="width: 2%;">:</td>
            <td style="width: 32%;"><strong>${user.schoolName || '-'}</strong></td>
            <td style="width: 18%;">Mata Pelajaran</td>
            <td style="width: 2%;">:</td>
            <td style="width: 28%;"><strong>${teacher?.subject || '-'}</strong></td>
          </tr>
          <tr>
            <td>Nama Guru</td>
            <td>:</td>
            <td><strong>${teacher?.fullName || '-'}</strong></td>
            <td>Kelas / Semester</td>
            <td>:</td>
            <td>${printConfig.className || '-'} / ${printConfig.semester || '-'}</td>
          </tr>
          <tr>
            <td>NIP Guru</td>
            <td>:</td>
            <td>${teacher?.nip || '-'}</td>
            <td>Hari / Tanggal Supervisi</td>
            <td>:</td>
            <td>${formatDate(printResult.date || printConfig.date)}</td>
          </tr>
          <tr>
            <td>Nama Supervisor</td>
            <td>:</td>
            <td><strong>${supervisor?.fullName || '-'}</strong></td>
            <td>Alokasi Waktu / Jam ke</td>
            <td>:</td>
            <td>${printConfig.timeAllocation || '-'}</td>
          </tr>
          <tr>
            <td>NIP Supervisor</td>
            <td>:</td>
            <td>${supervisor?.nip || '-'}</td>
            <td>Kompetensi / Topik</td>
            <td>:</td>
            <td>${printConfig.competence || '-'}</td>
          </tr>
        </table>
      </div>
    `;

    // Tabel Rekapitulasi Nilai Akhir
    const rekapitulasiTableHtml = `
      <div class="section-title">I. REKAPITULASI HASIL AKHIR PENILAIAN SUPERVISI AKADEMIK</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Aspek / Komponen Supervisi Akademik</th>
            <th style="width: 80px;">Skor Maks</th>
            <th style="width: 85px;">Skor Riil</th>
            <th style="width: 95px;">Nilai Akhir (0-100)</th>
            <th style="width: 110px;">Predikat</th>
            <th style="width: 130px;">Tingkat Ketercapaian</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; font-weight: bold;">1</td>
            <td style="font-weight: 500;">Persiapan Pembelajaran Mendalam</td>
            <td style="text-align: center;">${adminMaxScore}</td>
            <td style="text-align: center; font-weight: bold;">${adminPerolehan}</td>
            <td style="text-align: center; font-weight: bold;">${adminFinalScore.toFixed(2)}</td>
            <td style="text-align: center; font-weight: bold;">${adminPredicate}</td>
            <td style="text-align: center;">${getKetercapaian(adminFinalScore)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">2</td>
            <td style="font-weight: 500;">Pelaksanaan Pembelajaran Mendalam</td>
            <td style="text-align: center;">${rppMaxScore}</td>
            <td style="text-align: center; font-weight: bold;">${rppPerolehan}</td>
            <td style="text-align: center; font-weight: bold;">${rppFinalScore.toFixed(2)}</td>
            <td style="text-align: center; font-weight: bold;">${rppPredicate}</td>
            <td style="text-align: center;">${getKetercapaian(rppFinalScore)}</td>
          </tr>
          <tr>
            <td style="text-align: center; font-weight: bold;">3</td>
            <td style="font-weight: 500;">Umpan Balik Perencanaan Pembelajaran Mendalam</td>
            <td style="text-align: center;">${implMaxScore}</td>
            <td style="text-align: center; font-weight: bold;">${implPerolehan}</td>
            <td style="text-align: center; font-weight: bold;">${implFinalScore.toFixed(2)}</td>
            <td style="text-align: center; font-weight: bold;">${implPredicate}</td>
            <td style="text-align: center;">${getKetercapaian(implFinalScore)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f8fafc;">
            <td colspan="2" style="text-align: right; padding-right: 10px;">JUMLAH PEROLEHAN SKOR RIIL</td>
            <td style="text-align: center;">${totalSkorMaks}</td>
            <td style="text-align: center; font-size: 10pt; color: #111;">${totalSkorRiil}</td>
            <td colspan="3" style="text-align: center; font-size: 8.5pt; color: #4b5563;">
              Ketercapaian Kumulatif: ${((totalSkorRiil / totalSkorMaks) * 100).toFixed(1)}%
            </td>
          </tr>
          <tr style="font-weight: bold; background-color: #f1f5f9;">
            <td colspan="4" style="text-align: right; padding-right: 10px; font-size: 9.5pt;">NILAI AKHIR RATA-RATA SUPERVISI</td>
            <td style="text-align: center; font-size: 11pt; color: #1e3a8a;">${averageFinalScore.toFixed(2)}</td>
            <td style="text-align: center; font-size: 9.5pt; color: #1e3a8a;">${overallPredicate}</td>
            <td style="text-align: center; font-size: 9pt; font-weight: bold; color: #047857;">${getKetercapaian(averageFinalScore)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    // Catatan dan Rekomendasi Pembinaan Supervisor
    const coachingBoxHtml = `
      <div class="coaching-box">
        <div style="font-weight: bold; margin-bottom: 4px; font-size: 9pt;">II. CATATAN & REKOMENDASI PEMBINAAN SUPERVISOR:</div>
        ${printResult.notes ? `<div style="margin-bottom: 3px;"><strong>Catatan Umum:</strong> ${printResult.notes}</div>` : ''}
        ${printResult.planningAdmin?.coachingSuggestion ? `<div style="margin-bottom: 3px;"><strong>1. Persiapan Pembelajaran Mendalam:</strong> ${printResult.planningAdmin.coachingSuggestion}</div>` : ''}
        ${printResult.lessonPlan?.coachingSuggestion ? `<div style="margin-bottom: 3px;"><strong>2. Pelaksanaan Pembelajaran Mendalam:</strong> ${printResult.lessonPlan.coachingSuggestion}</div>` : ''}
        ${printResult.implementation?.coachingSuggestion ? `<div style="margin-bottom: 3px;"><strong>3. Umpan Balik Perencanaan Pembelajaran Mendalam:</strong> ${printResult.implementation.coachingSuggestion}</div>` : ''}
        ${!printResult.notes && !printResult.planningAdmin?.coachingSuggestion && !printResult.lessonPlan?.coachingSuggestion && !printResult.implementation?.coachingSuggestion ? '<div style="font-style: italic; color: #666;">Guru telah melaksanakan perencanaan dan pembelajaran di kelas dengan sangat baik sesuai standar kurikulum. Pertahankan dan terus tingkatkan inovasi pembelajaran.</div>' : ''}
      </div>
    `;

    // Lembar Pengesahan Tanda Tangan 3 Pihak Berdampingan
    const signaturesHtml = `
      <div class="signature-container">
        <div style="text-align: right; margin-bottom: 6px; font-size: 8.5pt;">
          ${printConfig.location || 'Ditetapkan'}, ${formatDate(printConfig.date)}
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="vertical-align: bottom;">
            <td style="width: 33.3%; text-align: center; padding: 0 4px; vertical-align: bottom; font-size: 8.5pt;">
              &nbsp;<br>
              Guru yang Disupervisi,
            </td>
            <td style="width: 33.3%; text-align: center; padding: 0 4px; vertical-align: bottom; font-size: 8.5pt;">
              &nbsp;<br>
              Supervisor / Penilai,
            </td>
            <td style="width: 33.4%; text-align: center; padding: 0 4px; vertical-align: bottom; font-size: 8.5pt;">
              Mengetahui,<br>
              <strong>Kepala Sekolah</strong>
            </td>
          </tr>
          <tr>
            <td style="height: 48px;"></td>
            <td style="height: 48px;"></td>
            <td style="height: 48px;"></td>
          </tr>
          <tr style="vertical-align: top;">
            <td style="width: 33.3%; text-align: center; padding: 0 4px; vertical-align: top;">
              <strong style="text-decoration: underline;">${teacher?.fullName || '...........................................'}</strong><br>
              <span style="font-size: 8pt;">NIP. ${teacher?.nip || '...........................................'}</span>
            </td>
            <td style="width: 33.3%; text-align: center; padding: 0 4px; vertical-align: top;">
              <strong style="text-decoration: underline;">${supervisor?.fullName || '...........................................'}</strong><br>
              <span style="font-size: 8pt;">NIP. ${supervisor?.nip || '...........................................'}</span>
            </td>
            <td style="width: 33.4%; text-align: center; padding: 0 4px; vertical-align: top;">
              <strong style="text-decoration: underline;">${printConfig.principalName || '...........................................'}</strong><br>
              <span style="font-size: 8pt;">NIP. ${printConfig.principalNip || '...........................................'}</span>
            </td>
          </tr>
        </table>
      </div>
    `;

    // Detailed Components (if FULL format selected)
    const PLANNING_ADMIN_COMPONENTS = ["Kalender Pendidikan", "Program Tahunan", "Program Semester", "Silabus", "RPP", "Jadwal Pelajaran", "Agenda Harian", "Daftar Nilai", "KKM", "Daftar Hadir Peserta Didik", "Ketersediaan Bahan Ajar", "Buku Pedoman Guru"];
    const LESSON_PLAN_COMPONENTS = ["Identitas Sekolah", "Identitas Mata Pelajaran", "Kelas/Semester", "Materi Pokok/Kompetensi Dasar", "Alokasi Waktu", "Tujuan Pembelajaran", "Metode & Model Pembelajaran", "Media Pembelajaran (LMS)", "Media Pembelajaran (Visual)", "Sumber Belajar", "Kegiatan Pembelajaran (Sistematis)", "Kegiatan Inti (HOTS)", "Langkah Integrasi (4C, PPK, Literasi)", "Penilaian Proses (Otentik)", "Penilaian Hasil (Mencerminkan Proses)", "Teknik Penilaian (Alat Tes/Instrumen)", "Kunci Jawaban/Rubrik"];
    const IMPLEMENTATION_COMPONENTS = ["Memberikan motivasi & menyiapkan peserta didik", "Mengajukan pertanyaan & mengaitkan pengetahuan sebelumnya", "Menjelaskan tujuan pembelajaran/KD", "Penanaman/Pembudayaan karakter dan literasi", "Menyampaikan tugas & arahan mekanisme penyelesaian", "Menggunakan Learning Manajemen Sistem (LMS)", "Memanfaatkan fasilitas akun belajar.id", "Memanfaatkan penggunaan video, power point, dll", "Metode/Pendekatan mewujudkan suasana menyenangkan (integrasi 21st Century)", "Menggunakan media pembelajaran sebagai alat bantu", "Memanfaatkan berbagai fasilitas Sumber belajar", "Kesimpulan bersama & manfaat pembelajaran", "Memberikan umpan balik proses & hasil", "Kegiatan tindak lanjut (tugas individu/kelompok)", "Rencana kegiatan pertemuan berikutnya", "Penilaian proses sesuai perencanaan", "Penilaian hasil (tes, portofolio, penugasan)", "Teknik Penilaian (instrumen sesuai KD)", "Penerapan TIK terintegrasi & efektif"];

    const implGroups = [
      { code: 'A', title: 'KEGIATAN PENDAHULUAN', startIdx: 0, endIdx: 5 },
      { code: 'B', title: 'KEGIATAN INTI', startIdx: 5, endIdx: 11 },
      { code: 'C', title: 'KEGIATAN PENUTUP', startIdx: 11, endIdx: 15 },
      { code: 'D', title: 'KEGIATAN PENILAIAN HASIL BELAJAR', startIdx: 15, endIdx: 19 }
    ];

    let fullDetailsHtml = '';
    if (printConfig.printFormat === 'FULL') {
      const isDlAdmin = adminMaxScore === 72 || Object.keys(adminScores).length > 12;
      const isDlRpp = rppMaxScore === 68 || Object.keys(rppScores).length > 15;

      fullDetailsHtml = `
        <div class="page-break"></div>
        <div class="section-title">III. RINCIAN PEROLEHAN SKOR PER BUTIR YANG DINILAI</div>
        
        <!-- Rincian 1: Persiapan Pembelajaran Mendalam -->
        <div style="font-weight: bold; margin: 8px 0 4px 0; font-size: 9pt;">1. Persiapan Pembelajaran Mendalam (Skor Maksimal: ${adminMaxScore})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th width="35">No</th>
              <th>Komponen / Aspek yang Diamati</th>
              <th width="70">Skor Diperoleh</th>
              <th>Catatan / Keterangan Supervisor</th>
            </tr>
          </thead>
          <tbody>
            ${(isDlAdmin ? DEEP_LEARNING_SUPERVISION_ITEMS.map(item => item.indicator) : PLANNING_ADMIN_COMPONENTS).map((comp, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 500;">${comp}</td>
                <td style="text-align: center; font-weight: bold; color: #1e3a8a;">${adminScores[comp] ?? 0}</td>
                <td style="font-style: italic; color: #4b5563;">${printResult.planningAdmin?.comments?.[comp] || '-'}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background: #f8fafc;">
              <td colspan="2" style="text-align: right;">Total Skor Riil / Nilai Akhir</td>
              <td style="text-align: center;">${adminPerolehan} / ${adminMaxScore}</td>
              <td style="text-align: center;">Nilai: ${adminFinalScore.toFixed(2)} (${adminPredicate})</td>
            </tr>
          </tbody>
        </table>

        <!-- Rincian 2: Pelaksanaan Pembelajaran Mendalam -->
        <div style="font-weight: bold; margin: 12px 0 4px 0; font-size: 9pt;">2. Pelaksanaan Pembelajaran Mendalam (Skor Maksimal: ${rppMaxScore})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th width="35">No</th>
              <th>Aspek Pengamatan Pembelajaran Mendalam</th>
              <th width="70">Skor Diperoleh</th>
              <th>Catatan / Keterangan Supervisor</th>
            </tr>
          </thead>
          <tbody>
            ${(isDlRpp ? DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS.map(i => i.indicator) : LESSON_PLAN_COMPONENTS).map((comp, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 500;">${comp}</td>
                <td style="text-align: center; font-weight: bold; color: #1e3a8a;">${rppScores[comp] ?? 0}</td>
                <td style="font-style: italic; color: #4b5563;">${printResult.lessonPlan?.comments?.[comp] || '-'}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background: #f8fafc;">
              <td colspan="2" style="text-align: right;">Total Skor Riil / Nilai Akhir</td>
              <td style="text-align: center;">${rppPerolehan} / ${rppMaxScore}</td>
              <td style="text-align: center;">Nilai: ${rppFinalScore.toFixed(2)} (${rppPredicate})</td>
            </tr>
          </tbody>
        </table>

        <!-- Rincian 3: Umpan Balik Perencanaan Pembelajaran Mendalam -->
        <div style="font-weight: bold; margin: 12px 0 4px 0; font-size: 9pt;">3. Umpan Balik Perencanaan Pembelajaran Mendalam (Skor Maksimal: ${implMaxScore})</div>
        
        ${printResult.implementation?.planningUrl || printResult.implementation?.level || printResult.implementation?.title ? `
          <table class="identity-table" style="margin-bottom: 8px;">
            <tr>
              <td style="width: 260px; font-weight: bold;">Tautan Perencanaan Pembelajaran</td>
              <td style="width: 10px;">:</td>
              <td>${printResult.implementation.planningUrl ? `<a href="${printResult.implementation.planningUrl}" target="_blank" style="color: #1e40af; text-decoration: underline;">${printResult.implementation.planningUrl}</a>` : '-'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Jenjang / Mata Pelajaran</td>
              <td>:</td>
              <td>${printResult.implementation.level || '-'} / ${printResult.implementation.subject || teacher?.subject || '-'}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Kelas / Judul Perencanaan</td>
              <td>:</td>
              <td>${printResult.implementation.gradeClass || printConfig.className || '-'} / ${printResult.implementation.title || '-'}</td>
            </tr>
          </table>
        ` : ''}

        <table class="data-table">
          <thead>
            <tr>
              <th width="35">No</th>
              <th>Aspek yang Diamati</th>
              <th>Komentar Kritis</th>
              <th width="70">Skor (1-4)</th>
            </tr>
          </thead>
          <tbody>
            ${DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS.map((item) => {
              const scoreVal = implScores[item.aspect] ?? implScores[item.id] ?? 0;
              const commentVal = printResult.implementation?.comments?.[item.aspect] || printResult.implementation?.comments?.[item.id] || '-';
              return `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${item.number}</td>
                  <td style="font-weight: 500;">${item.aspect}</td>
                  <td style="font-style: italic; color: #4b5563;">${commentVal}</td>
                  <td style="text-align: center; font-weight: bold; color: #1e3a8a;">${scoreVal}</td>
                </tr>
              `;
            }).join('')}
            <tr style="font-weight: bold; background: #f8fafc;">
              <td colspan="3" style="text-align: right;">Total Skor Riil / Nilai Akhir</td>
              <td style="text-align: center;">${implPerolehan} / ${implMaxScore}</td>
            </tr>
            <tr style="font-weight: bold; background: #f1f5f9;">
              <td colspan="3" style="text-align: right;">Predikat Capaian Nilai Akhir:</td>
              <td style="text-align: center; color: #047857;">${implFinalScore.toFixed(2)} (${implPredicate})</td>
            </tr>
          </tbody>
        </table>

        <!-- Reflektif Butir 16, 17, 18 -->
        <div style="margin-top: 10px; font-size: 8.5pt;">
          <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px;">
            <strong>No 16 . Tuliskan kelebihan Perencanaan Pembelajaran:</strong>
            <div style="margin-top: 2px; color: #334155; font-style: italic;">
              ${printResult.implementation?.advantages || '- Belum diisi -'}
            </div>
          </div>

          <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px;">
            <strong>No 17 . Tuliskan hal yang perlu ditingkatkan dari Perencanaan Pembelajaran:</strong>
            <div style="margin-top: 2px; color: #334155; font-style: italic;">
              ${printResult.implementation?.areasToImprove || '- Belum diisi -'}
            </div>
          </div>

          <div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px;">
            <strong>No 18 . Tuliskan rekomendasi dan lanjutkan dengan revisi Perencanaan Pembelajaran sesuai prinsip PM:</strong>
            <div style="margin-top: 2px; color: #334155; font-style: italic;">
              ${printResult.implementation?.recommendations || '- Belum diisi -'}
            </div>
          </div>
        </div>

        <!-- Tanda Tangan Pemberi Umpan Balik -->
        <div style="margin-top: 20px; display: flex; justify-content: flex-end; page-break-inside: avoid;">
          <div style="width: 280px; text-align: center; font-size: 8.5pt;">
            <div>${printConfig.location || 'Ditetapkan'}, ${formatDate(printResult.date || printConfig.date)}</div>
            <div style="font-weight: bold; margin-top: 4px;">Pemberi Umpan Balik,</div>
            <div style="height: 50px;"></div>
            <strong style="text-decoration: underline;">${supervisor?.fullName || '-'}</strong><br>
            <span style="font-size: 8pt;">NIP. ${supervisor?.nip || '-'}</span>
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Hasil Penilaian Supervisi Akademik - ${teacher?.fullName || 'Guru'}</title>
          <style>
            body { 
              font-family: 'Times New Roman', serif; 
              font-size: 9.5pt; 
              line-height: 1.25; 
              color: #111; 
              margin: 0; 
              padding: 0.3cm; 
            }
            .school-header-text {
              text-align: center;
              margin-bottom: 8px;
              border-bottom: 3px double #000;
              padding-bottom: 6px;
            }
            .letterhead-container { 
              width: 100%; 
              text-align: center; 
              margin-bottom: 8px; 
              border-bottom: 3px double #000; 
              padding-bottom: 6px; 
            }
            .doc-title { 
              text-align: center; 
              font-size: 12pt; 
              margin: 0 0 2px 0; 
              text-decoration: underline; 
              font-weight: bold; 
              letter-spacing: 0.5px; 
            }
            .doc-subtitle { 
              text-align: center; 
              font-size: 10pt; 
              margin: 0 0 8px 0; 
              font-weight: bold; 
              color: #222; 
            }
            .identity-box { 
              border: 1px solid #222; 
              background-color: #fdfdfd; 
              padding: 4px 8px; 
              margin-bottom: 6px; 
              border-radius: 2px; 
            }
            .identity-table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 8.5pt; 
            }
            .identity-table td { 
              padding: 1.5px 3px; 
              vertical-align: top; 
            }
            .section-title { 
              font-weight: bold; 
              margin-top: 6px; 
              margin-bottom: 4px; 
              font-size: 9pt; 
              color: #000; 
            }
            table.data-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 8px; 
              page-break-inside: auto; 
            }
            table.data-table th, table.data-table td { 
              border: 1px solid #111; 
              padding: 3px 5px; 
              vertical-align: middle; 
            }
            table.data-table th { 
              background-color: #f2f2f2; 
              text-align: center; 
              font-weight: bold; 
              font-size: 8.5pt; 
            }
            table.data-table tr { 
              page-break-inside: avoid; 
              break-inside: avoid; 
            }
            .coaching-box { 
              border: 1px solid #222; 
              background-color: #fafafa; 
              padding: 5px 8px; 
              margin-top: 4px; 
              margin-bottom: 6px; 
              font-size: 8.5pt; 
              line-height: 1.25; 
              page-break-inside: avoid; 
              break-inside: avoid; 
            }
            .signature-container { 
              margin-top: 8px; 
              page-break-inside: avoid; 
              break-inside: avoid; 
              font-size: 8.5pt; 
            }
            .signature-space { 
              height: 44px; 
            }
            @media print {
              @page { 
                size: 215mm 330mm; /* Standar Ukuran Kertas F4 / Folio Indonesia */
                margin-top: ${printConfig.marginTop || '0.8'}cm; 
                margin-bottom: ${printConfig.marginBottom || '0.8'}cm; 
                margin-left: 1.5cm; 
                margin-right: 1.5cm; 
              }
              body { 
                padding: 0; 
              }
              .page-break { 
                page-break-before: always; 
                break-before: page; 
                height: 0; 
                margin: 0; 
              }
            }
          </style>
        </head>
        <body>
          ${letterheadHtml}
          <h2 class="doc-title">LAPORAN HASIL PENILAIAN SUPERVISI AKADEMIK GURU</h2>
          <div class="doc-subtitle">TAHUN PELAJARAN ${printConfig.semester ? `SEMESTER ${printConfig.semester}` : ''}</div>
          
          ${identityHtml}
          ${rekapitulasiTableHtml}
          ${coachingBoxHtml}
          ${signaturesHtml}

          ${fullDetailsHtml}

          <script>
            window.onload = function() { 
              window.print(); 
              window.close(); 
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsPrintModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-purple-600 mb-4" size={40} />
        <p className="text-gray-500 font-medium">Memuat hasil supervisi...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Hasil Supervisi Akademik
            </h2>
            <p className="text-gray-500 text-sm">
              {isKepsek || isWakasek 
                ? "Pantau hasil penilaian dan rekapitulasi supervisi guru di sekolah." 
                : "Lihat hasil penilaian dan catatan supervisi akademik Anda yang telah diisikan oleh supervisor."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchData(true)}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition disabled:opacity-50"
            >
              <RefreshCcw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Sinkronisasi...' : 'Tarik Data Terbaru'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {(isWakasek || isKepsek) && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 w-full sm:w-auto">
              <Filter size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500">Supervisor:</span>
              <select
                value={selectedSupervisorFilter}
                onChange={(e) => setSelectedSupervisorFilter(e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="ALL">Semua Supervisor ({results.length})</option>
                {teachers.filter(t => t.isSupervisor || t.additionalRole === 'KEPALA_SEKOLAH' || results.some(r => r.supervisorId === t.id)).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({results.filter(r => r.supervisorId === s.id).length})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={isTeacherOnly ? "Cari tanggal atau supervisor..." : "Cari nama guru atau tanggal..."}
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredResults.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm text-center">
          <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-700 mb-2">
            {isTeacherOnly ? "Belum Ada Hasil Supervisi" : "Belum Ada Hasil"}
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {searchTerm 
              ? "Tidak ditemukan hasil yang sesuai dengan pencarian Anda." 
              : isTeacherOnly 
                ? "Hasil supervisi akademik Anda akan muncul di sini setelah supervisor selesai mengisi dan memvalidasi instrumen supervisi." 
                : "Belum ada data penilaian supervisi yang tersedia."}
          </p>
          {isTeacherOnly && !searchTerm && (
            <div className="mt-4">
              <button
                onClick={() => fetchData(true)}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                <RefreshCcw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data Terbaru'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((result: SupervisionResult) => {
            const teacher = teachers.find(t => t.id === result.teacherId);
            const supervisor = teachers.find(t => t.id === result.supervisorId);
            const isExpanded = expandedId === result.id;
            
            return (
              <div key={result.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div 
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold">
                      {result.score.toFixed(1)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{teacher?.fullName || 'Guru'}</h4>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <UserIcon size={12} />
                          Supervisor: {supervisor?.fullName || 'Supervisor'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(result.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrint(result);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Cetak Laporan Supervisi"
                    >
                      <Printer size={18} />
                    </button>
                    <div className="hidden md:flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={16} 
                          className={result.score >= star ? 'text-yellow-400' : 'text-gray-200'} 
                          fill={result.score >= star ? 'currentColor' : 'none'} 
                        />
                      ))}
                    </div>
                    {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-gray-50 bg-gray-50/30 animate-in slide-in-from-top-2 duration-200">
                    {result.planningAdmin ? (
                      <div className="mt-4 space-y-6">
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                          <div className="bg-purple-50/70 p-3 border-b border-gray-100 flex justify-between items-center">
                            <h5 className="text-xs font-black text-purple-700 uppercase tracking-widest">Persiapan Pembelajaran Mendalam</h5>
                            <div className="flex items-center gap-2">
                              {supervisor?.id === user.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/supervision-assessment?assignmentId=${result.assignmentId}`);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-purple-700 hover:bg-purple-50 transition shadow-sm"
                                >
                                  <Edit size={12} />
                                  Edit Penilaian
                                </button>
                              )}
                              {result.planningAdmin.readinessCategory && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  {result.planningAdmin.readinessCategory}
                                </span>
                              )}
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                                result.planningAdmin.predicate === 'BAIK SEKALI' || result.planningAdmin.predicate === 'Sangat Baik' ? 'bg-green-500' :
                                result.planningAdmin.predicate === 'BAIK' || result.planningAdmin.predicate === 'Baik' ? 'bg-blue-500' :
                                result.planningAdmin.predicate === 'CUKUP' || result.planningAdmin.predicate === 'Kurang' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}>
                                {result.planningAdmin.predicate} ({result.planningAdmin.finalScore.toFixed(2)})
                              </span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] border-collapse">
                              <thead>
                                <tr className="bg-gray-50/50">
                                  <th className="border-b border-r p-2 text-left w-8">No</th>
                                  <th className="border-b border-r p-2 text-left">Komponen / Aspek yang Dinilai</th>
                                  <th className="border-b border-r p-2 text-center w-16">Skor</th>
                                  <th className="border-b p-2 text-left">Catatan/Temuan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(result.planningAdmin.scores).map(([comp, score], idx) => (
                                  <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="border-b border-r p-2 text-center">{idx + 1}</td>
                                    <td className="border-b border-r p-2 font-medium">{comp}</td>
                                    <td className="border-b border-r p-2 text-center font-bold text-purple-600">{score as React.ReactNode}</td>
                                    <td className="border-b p-2 text-gray-500 italic">{result.planningAdmin?.comments?.[comp] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {result.planningAdmin.recommendations && (
                            <div className="p-3 bg-purple-50/40 border-t border-purple-100 space-y-2">
                              <div className="text-[11px] font-black text-purple-900 uppercase tracking-wide">
                                2. Rekomendasi Tindak Lanjut:
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                                {result.planningAdmin.recommendations.weakAspects && (
                                  <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                                    <span className="font-bold text-gray-700 block mb-0.5">1. Aspek Lemah:</span>
                                    <span className="text-gray-600 whitespace-pre-line">{result.planningAdmin.recommendations.weakAspects}</span>
                                  </div>
                                )}
                                {result.planningAdmin.recommendations.shortTermStrategy && (
                                  <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                                    <span className="font-bold text-gray-700 block mb-0.5">2. Strategi Jangka Pendek:</span>
                                    <span className="text-gray-600 whitespace-pre-line">{result.planningAdmin.recommendations.shortTermStrategy}</span>
                                  </div>
                                )}
                                {result.planningAdmin.recommendations.longTermStrategy && (
                                  <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                                    <span className="font-bold text-gray-700 block mb-0.5">3. Strategi Jangka Panjang:</span>
                                    <span className="text-gray-600 whitespace-pre-line">{result.planningAdmin.recommendations.longTermStrategy}</span>
                                  </div>
                                )}
                                {result.planningAdmin.recommendations.resourcesNeeded && (
                                  <div className="p-2.5 bg-white rounded-lg border border-purple-100 shadow-2xs">
                                    <span className="font-bold text-gray-700 block mb-0.5">4. Dukungan/Sumber Daya:</span>
                                    <span className="text-gray-600 whitespace-pre-line">{result.planningAdmin.recommendations.resourcesNeeded}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {result.lessonPlan && (
                          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="bg-blue-50 p-3 border-b border-gray-100 flex justify-between items-center">
                              <h5 className="text-xs font-black text-blue-600 uppercase tracking-widest">INSTRUMEN SUPERVISI PELAKSANAAN PEMBELAJARAN MENDALAM</h5>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                                result.lessonPlan.predicate === 'BAIK SEKALI' ? 'bg-green-500' :
                                result.lessonPlan.predicate === 'BAIK' ? 'bg-blue-500' :
                                result.lessonPlan.predicate === 'CUKUP' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}>
                                {result.lessonPlan.predicate} ({result.lessonPlan.finalScore.toFixed(2)})
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px] border-collapse">
                                <thead>
                                  <tr className="bg-gray-50/50">
                                    <th className="border-b border-r p-2 text-left w-8">No</th>
                                    <th className="border-b border-r p-2 text-left">Aspek Pengamatan Pembelajaran Mendalam</th>
                                    <th className="border-b border-r p-2 text-center w-16">Nilai</th>
                                    <th className="border-b p-2 text-left">Catatan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(result.lessonPlan.scores).map(([comp, score], idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                      <td className="border-b border-r p-2 text-center">{idx + 1}</td>
                                      <td className="border-b border-r p-2 font-medium">{comp}</td>
                                      <td className="border-b border-r p-2 text-center font-bold text-blue-600">{score as React.ReactNode}</td>
                                      <td className="border-b p-2 text-gray-500 italic">{result.lessonPlan?.comments[comp] || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {result.implementation && (
                          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="bg-purple-50 p-3 border-b border-purple-100 flex justify-between items-center">
                              <div>
                                <h5 className="text-xs font-black text-purple-700 uppercase tracking-widest">INSTRUMEN UMPAN BALIK PERENCANAAN PEMBELAJARAN MENDALAM</h5>
                                <div className="text-[10px] text-purple-500">Telaah Perencanaan Pembelajaran Mendalam & Catatan Kritis</div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                                result.implementation.predicate === 'BAIK SEKALI' ? 'bg-green-500' :
                                result.implementation.predicate === 'BAIK' ? 'bg-blue-500' :
                                result.implementation.predicate === 'CUKUP' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}>
                                {result.implementation.predicate} ({result.implementation.finalScore.toFixed(2)})
                              </span>
                            </div>

                            {/* Header Metadata Khusus Perencanaan */}
                            {(result.implementation.planningUrl || result.implementation.title || result.implementation.level) && (
                              <div className="p-3 bg-purple-50/30 border-b border-purple-100 text-[10px] space-y-1">
                                {result.implementation.planningUrl && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-600 min-w-32">Tautan Perencanaan:</span>
                                    <a 
                                      href={result.implementation.planningUrl} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="text-purple-600 hover:text-purple-800 underline truncate max-w-lg font-medium"
                                    >
                                      {result.implementation.planningUrl}
                                    </a>
                                  </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 pt-1">
                                  <div>
                                    <span className="font-bold">Jenjang / Mapel:</span> {result.implementation.level || '-'} / {result.implementation.subject || '-'}
                                  </div>
                                  <div>
                                    <span className="font-bold">Kelas / Judul:</span> {result.implementation.gradeClass || '-'} / {result.implementation.title || '-'}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px] border-collapse">
                                <thead>
                                  <tr className="bg-gray-50/50">
                                    <th className="border-b border-r p-2 text-left w-8">No</th>
                                    <th className="border-b border-r p-2 text-left">Aspek yang Diamati</th>
                                    <th className="border-b border-r p-2 text-left">Komentar Kritis</th>
                                    <th className="border-b p-2 text-center w-20">Skor (1-4)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(result.implementation.scores).map(([comp, score], idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                      <td className="border-b border-r p-2 text-center font-medium">{idx + 1}</td>
                                      <td className="border-b border-r p-2 font-medium text-gray-800">{comp}</td>
                                      <td className="border-b border-r p-2 text-gray-600 italic">{result.implementation?.comments[comp] || '-'}</td>
                                      <td className="border-b p-2 text-center font-bold text-purple-600">{score as React.ReactNode}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Refleksi Butir 16, 17, 18 */}
                            {(result.implementation.advantages || result.implementation.areasToImprove || result.implementation.recommendations) && (
                              <div className="p-3 bg-gray-50/70 border-t border-gray-100 space-y-2">
                                <div className="text-[11px] font-black text-gray-700 uppercase tracking-wide">
                                  Catatan Refleksi & Rekomendasi Revisi Perencanaan PM:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                                  {result.implementation.advantages && (
                                    <div className="p-2.5 bg-white rounded-lg border border-green-200 shadow-2xs">
                                      <span className="font-bold text-green-800 block mb-0.5">No 16. Kelebihan Perencanaan:</span>
                                      <span className="text-gray-600 whitespace-pre-line">{result.implementation.advantages}</span>
                                    </div>
                                  )}
                                  {result.implementation.areasToImprove && (
                                    <div className="p-2.5 bg-white rounded-lg border border-amber-200 shadow-2xs">
                                      <span className="font-bold text-amber-800 block mb-0.5">No 17. Hal Perlu Ditingkatkan:</span>
                                      <span className="text-gray-600 whitespace-pre-line">{result.implementation.areasToImprove}</span>
                                    </div>
                                  )}
                                  {result.implementation.recommendations && (
                                    <div className="p-2.5 bg-white rounded-lg border border-purple-200 shadow-2xs">
                                      <span className="font-bold text-purple-800 block mb-0.5">No 18. Rekomendasi Revisi PM:</span>
                                      <span className="text-gray-600 whitespace-pre-line">{result.implementation.recommendations}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {result.planningAdmin.coachingSuggestion && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saran Pembinaan (Administrasi)</h5>
                            <p className="text-xs text-gray-700 leading-relaxed italic">
                              "{result.planningAdmin.coachingSuggestion}"
                            </p>
                          </div>
                        )}

                        {result.lessonPlan?.coachingSuggestion && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saran Pembinaan (RPP)</h5>
                            <p className="text-xs text-gray-700 leading-relaxed italic">
                              "{result.lessonPlan.coachingSuggestion}"
                            </p>
                          </div>
                        )}

                        {result.implementation?.coachingSuggestion && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saran Pembinaan (Pelaksanaan)</h5>
                            <p className="text-xs text-gray-700 leading-relaxed italic">
                              "{result.implementation.coachingSuggestion}"
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest">Detail Aspek Penilaian</h5>
                          <div className="space-y-3">
                            {result.aspects?.map((aspect: any, idx: number) => (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold text-gray-700">{aspect.aspect}</span>
                                  <span className="text-xs font-black text-purple-600">{aspect.score}/5</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className="h-full bg-purple-500 rounded-full" 
                                    style={{ width: `${(aspect.score / 5) * 100}%` }}
                                  />
                                </div>
                                {aspect.comment && (
                                  <p className="text-[10px] text-gray-500 italic">"{aspect.comment}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest">Catatan & Rekomendasi</h5>
                          <div className="bg-white p-5 rounded-xl border border-gray-100 h-full">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {result.notes || "Tidak ada catatan tambahan."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Print Metadata Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
              <div className="flex items-center gap-2">
                <Printer size={20} />
                <h3 className="font-bold">Cetak Laporan Hasil Penilaian Supervisi</h3>
              </div>
              <button 
                onClick={() => setIsPrintModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Info Ukuran Kertas F4 / Folio */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                <span className="font-bold text-base leading-none">📄</span>
                <div>
                  <strong className="block font-semibold">Standar Kertas: Folio / F4 (215 x 330 mm)</strong>
                  Tata letak dokumen dirancang otomatis agar tabel nilai, rekomendasi supervisor, dan tanda tangan 3 pihak terpadu dalam satu halaman tanpa terpisah.
                </div>
              </div>

              {/* Pilihan Format Cetak */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Pilihan Format Dokumen</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, printFormat: 'SUMMARY' })}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                      printConfig.printFormat === 'SUMMARY'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${printConfig.printFormat === 'SUMMARY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-xs">Laporan Ringkasan Hasil (1 Halaman F4)</div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Rekapitulasi nilai akhir, skor riil, predikat, saran pembinaan, dan tanda tangan 3 pihak lengkap dalam 1 lembar F4.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, printFormat: 'FULL' })}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                      printConfig.printFormat === 'FULL'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${printConfig.printFormat === 'FULL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <Printer size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-xs">Laporan Hasil Lengkap (+ Rincian Butir)</div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Menampilkan lembar ringkasan hasil diikuti seluruh lembar rincian butir instrumen yang telah dinilai supervisor.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Upload Kop Surat (Opsional)</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLetterheadUpload}
                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-[9px] text-gray-400 mt-1">Format: JPG, PNG, WEBP. Maks: 2MB. Tampil di header lembar supervisi.</p>
                    </div>
                    {printConfig.letterheadUrl && (
                      <div className="relative group">
                        <img src={printConfig.letterheadUrl} className="w-20 h-10 object-contain rounded border border-gray-200" alt="Preview" />
                        <button 
                          onClick={() => setPrintConfig({...printConfig, letterheadUrl: ''})}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kelas</label>
                  <input 
                    type="text" 
                    value={printConfig.className}
                    onChange={(e) => setPrintConfig({...printConfig, className: e.target.value})}
                    placeholder="Contoh: VII A"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Semester</label>
                  <input 
                    type="text" 
                    value={printConfig.semester}
                    onChange={(e) => setPrintConfig({...printConfig, semester: e.target.value})}
                    placeholder="Contoh: 1 (Ganjil)"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kompetensi Dasar / Materi</label>
                  <input 
                    type="text" 
                    value={printConfig.competence}
                    onChange={(e) => setPrintConfig({...printConfig, competence: e.target.value})}
                    placeholder="Contoh: 3.1 Memahami teks narasi..."
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Alokasi Waktu</label>
                  <input 
                    type="text" 
                    value={printConfig.timeAllocation}
                    onChange={(e) => setPrintConfig({...printConfig, timeAllocation: e.target.value})}
                    placeholder="Contoh: 2 x 40 Menit"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Lokasi (Kota/Kecamatan)</label>
                  <input 
                    type="text" 
                    value={printConfig.location}
                    onChange={(e) => setPrintConfig({...printConfig, location: e.target.value})}
                    placeholder="Contoh: Jakarta"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tanggal Cetak</label>
                  <input 
                    type="date" 
                    value={printConfig.date}
                    onChange={(e) => setPrintConfig({...printConfig, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Margin Atas (cm)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    value={printConfig.marginTop}
                    onChange={(e) => setPrintConfig({...printConfig, marginTop: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Margin Bawah (cm)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    value={printConfig.marginBottom}
                    onChange={(e) => setPrintConfig({...printConfig, marginBottom: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-black text-gray-400 uppercase mb-3">Informasi Kepala Sekolah</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Kepala Sekolah</label>
                    <input 
                      type="text" 
                      value={printConfig.principalName}
                      onChange={(e) => setPrintConfig({...printConfig, principalName: e.target.value})}
                      placeholder="Nama Lengkap & Gelar"
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">NIP Kepala Sekolah</label>
                    <input 
                      type="text" 
                      value={printConfig.principalNip}
                      onChange={(e) => setPrintConfig({...printConfig, principalNip: e.target.value})}
                      placeholder="NIP"
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsPrintModalOpen(false)}
                className="px-6 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition"
              >
                Batal
              </button>
              <button 
                onClick={generatePrint}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-200"
              >
                <Printer size={18} />
                Cetak Hasil Supervisi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisionResults;
