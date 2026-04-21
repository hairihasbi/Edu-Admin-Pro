
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SupervisionResult } from '../types';
import { getSupervisionResults, getSupervisionResultsForSchool, getSchoolTeachers, runManualSync } from '../services/database';
import { ClipboardCheck, User as UserIcon, Calendar, Star, ChevronDown, ChevronUp, Search, Filter, Loader2, AlertCircle, Shield, Pencil as Edit, Printer, X, RefreshCcw } from './Icons';

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
  const navigate = useNavigate();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printResult, setPrintResult] = useState<SupervisionResult | null>(null);
  const [printConfig, setPrintConfig] = useState({
    className: '',
    semester: '',
    competence: '',
    timeAllocation: '',
    principalName: localStorage.getItem('sup_principal_name') || '',
    principalNip: localStorage.getItem('sup_principal_nip') || '',
    location: localStorage.getItem('sup_location') || '',
    date: new Date().toISOString().split('T')[0],
    letterheadUrl: localStorage.getItem('sup_letterhead') || '',
    marginTop: localStorage.getItem('sup_margin_top') || '1.5',
    marginBottom: localStorage.getItem('sup_margin_bottom') || '1.5'
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
      // If management, offer to sync first to get latest distributed results
      if (forceSync && navigator.onLine) {
        await runManualSync('PULL', () => {}, ['eduadmin_supervision_results', 'eduadmin_users', 'eduadmin_supervision_assignments']);
      }

      let data: SupervisionResult[] = [];
      if (isWakasek || isKepsek) {
        data = await getSupervisionResultsForSchool(user.schoolNpsn!);
      } else {
        // Supervisor sees results they have assessed, Teacher sees results for them
        const supervisorResults = await getSupervisionResults(undefined, user.id);
        const teacherResults = await getSupervisionResults(user.id, undefined);
        
        // Merge and deduplicate by ID
        const combined = [...supervisorResults, ...teacherResults];
        data = Array.from(new Map(combined.map(item => [item.id, item])).values());
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
    const teacher = teachers.find(t => t.id === r.teacherId);
    const supervisor = teachers.find(t => t.id === r.supervisorId);
    const searchStr = `${teacher?.fullName || ''} ${supervisor?.fullName || ''} ${r.date}`.toLowerCase();
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

    const printWindow = window.open('', '', 'height=800,width=1000');
    if (!printWindow) return;

    // Save preferences
    localStorage.setItem('sup_principal_name', printConfig.principalName);
    localStorage.setItem('sup_principal_nip', printConfig.principalNip);
    localStorage.setItem('sup_location', printConfig.location);
    localStorage.setItem('sup_margin_top', printConfig.marginTop);
    localStorage.setItem('sup_margin_bottom', printConfig.marginBottom);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const identityHeaderHtml = `
      <table class="header-info no-print-padding">
        <tr>
          <td width="150">Satuan Pendidikan</td><td width="10">:</td><td>${user.schoolName || '-'}</td>
          <td width="150">Kelas / Semester</td><td width="10">:</td><td>${printConfig.className} / ${printConfig.semester}</td>
        </tr>
        <tr>
          <td>Nama Guru</td><td>:</td><td>${teacher?.fullName || '-'}</td>
          <td>Kompetensi Dasar</td><td>:</td><td>${printConfig.competence}</td>
        </tr>
        <tr>
          <td>Mata Pelajaran</td><td>:</td><td>${teacher?.subject || '-'}</td>
          <td>Alokasi Waktu</td><td>:</td><td>${printConfig.timeAllocation}</td>
        </tr>
      </table>
    `;

    const letterheadHtml = printConfig.letterheadUrl 
      ? `<div class="letterhead-container"><img src="${printConfig.letterheadUrl}" style="width: 100%; max-height: 150px; object-fit: contain; margin-bottom: 20px;" /></div>` 
      : '';

    // Aggregate coaching suggestions into notes if notes is empty or as additional info
    const aggregateCoachingSuggestions = () => {
      const suggestions: string[] = [];
      if (printResult.planningAdmin?.coachingSuggestion) suggestions.push(`[Administrasi] ${printResult.planningAdmin.coachingSuggestion}`);
      if (printResult.lessonPlan?.coachingSuggestion) suggestions.push(`[RPP] ${printResult.lessonPlan.coachingSuggestion}`);
      if (printResult.implementation?.coachingSuggestion) suggestions.push(`[Pelaksanaan] ${printResult.implementation.coachingSuggestion}`);
      
      if (suggestions.length > 0) {
        return suggestions.join('<br>');
      }
      return printResult.notes || '-';
    };

    const summaryAndSignaturesHtml = `
      <div class="summary-box">
        <strong>Catatan Umum Supervisor (Saran Pembinaan):</strong><br>
        <div style="margin-top: 5px; font-style: italic; font-size: 10pt;">${aggregateCoachingSuggestions()}</div>
      </div>

      <div style="margin-top: 30px; page-break-inside: avoid;">
        <table class="signature-section" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%;">&nbsp;</td>
            <td style="width: 50%; text-align: center;">
              Mengetahui,<br>
              ${printConfig.location}, ${formatDate(printConfig.date)}<br>
              <span style="font-weight: bold;">Kepala Sekolah</span>
            </td>
          </tr>
          <tr>
            <td>&nbsp;</td>
            <td class="signature-space"></td>
          </tr>
          <tr>
            <td>&nbsp;</td>
            <td style="text-align: center; font-weight: bold; white-space: nowrap;">${printConfig.principalName || '................................'}</td>
          </tr>
          <tr>
            <td>&nbsp;</td>
            <td style="text-align: center;">NIP. ${printConfig.principalNip || '................................'}</td>
          </tr>
          
          <tr><td colspan="2" style="height: 40px;">&nbsp;</td></tr>
          
          <tr style="font-weight: bold; text-align: center;">
            <td>Supervisor / Penilai</td>
            <td>Guru Mata Pelajaran</td>
          </tr>
          <tr>
            <td class="signature-space"></td>
            <td class="signature-space"></td>
          </tr>
          <tr style="font-weight: bold; text-align: center;">
            <td style="white-space: nowrap;">${supervisor?.fullName || '................................'}</td>
            <td style="white-space: nowrap;">${teacher?.fullName || '................................'}</td>
          </tr>
          <tr style="text-align: center;">
            <td>NIP. ${supervisor?.nip || '................................'}</td>
            <td>NIP. ${teacher?.nip || '................................'}</td>
          </tr>
        </table>
      </div>
    `;

    const generateTableRows = (scores: Record<string, number>, comments: Record<string, string>, components: string[]) => {
        return components.map((comp, idx) => `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>${comp}</td>
                <td style="text-align: center;">${scores[comp] || 0}</td>
                <td>${comments[comp] || ''}</td>
            </tr>
        `).join('');
    };

    const implComponents = [
        { label: 'KEGIATAN PENDAHULUAN', startIdx: 0, endIdx: 5 },
        { label: 'KEGIATAN INTI', startIdx: 5, endIdx: 11 },
        { label: 'KEGIATAN PENUTUP', startIdx: 11, endIdx: 15 },
        { label: 'KEGIATAN PENILAIAN HASIL BELAJAR', startIdx: 15, endIdx: 19 }
    ];

    const generateImplTableRows = (scores: Record<string, number>, comments: Record<string, string>, components: string[]) => {
        let rows = '';
        implComponents.forEach((section, sIdx) => {
            rows += `
                <tr style="background-color: #f9fafb; font-weight: bold;">
                    <td style="text-align: center;">${String.fromCharCode(65 + sIdx)}</td>
                    <td colspan="3">${section.label}</td>
                </tr>
            `;
            const sectionComps = components.slice(section.startIdx, section.endIdx);
            sectionComps.forEach((comp, idx) => {
                rows += `
                    <tr>
                        <td style="text-align: center;">${section.startIdx + idx + 1}</td>
                        <td>${comp}</td>
                        <td style="text-align: center;">${scores[comp] || 0}</td>
                        <td>${comments[comp] || ''}</td>
                    </tr>
                `;
            });
        });
        return rows;
    };

    // Components from SupervisionAssessment.tsx constants
    const PLANNING_ADMIN_COMPONENTS = ["Kalender Pendidikan", "Program Tahunan", "Program Semester", "Silabus", "RPP", "Jadwal Pelajaran", "Agenda Harian", "Daftar Nilai", "KKM", "Daftar Hadir Peserta Didik", "Ketersediaan Bahan Ajar", "Buku Pedoman Guru"];
    const LESSON_PLAN_COMPONENTS = ["Identitas Sekolah", "Identitas Mata Pelajaran", "Kelas/Semester", "Materi Pokok/Kompetensi Dasar", "Alokasi Waktu", "Tujuan Pembelajaran", "Metode & Model Pembelajaran", "Media Pembelajaran (LMS)", "Media Pembelajaran (Visual)", "Sumber Belajar", "Kegiatan Pembelajaran (Sistematis)", "Kegiatan Inti (HOTS)", "Langkah Integrasi (4C, PPK, Literasi)", "Penilaian Proses (Otentik)", "Penilaian Hasil (Mencerminkan Proses)", "Teknik Penilaian (Alat Tes/Instrumen)", "Kunci Jawaban/Rubrik"];
    const IMPLEMENTATION_COMPONENTS = ["Memberikan motivasi & menyiapkan peserta didik", "Mengajukan pertanyaan & mengaitkan pengetahuan sebelumnya", "Menjelaskan tujuan pembelajaran/KD", "Penanaman/Pembudayaan karakter dan literasi", "Menyampaikan tugas & arahan mekanisme penyelesaian", "Menggunakan Learning Manajemen Sistem (LMS)", "Memanfaatkan fasilitas akun belajar.id", "Memanfaatkan penggunaan video, power point, dll", "Metode/Pendekatan mewujudkan suasana menyenangkan (integrasi 21st Century)", "Menggunakan media pembelajaran sebagai alat bantu", "Memanfaatkan berbagai fasilitas Sumber belajar", "Kesimpulan bersama & manfaat pembelajaran", "Memberikan umpan balik proses & hasil", "Kegiatan tindak lanjut (tugas individu/kelompok)", "Rencana kegiatan pertemuan berikutnya", "Penilaian proses sesuai perencanaan", "Penilaian hasil (tes, portofolio, penugasan)", "Teknik Penilaian (instrumen sesuai KD)", "Penerapan TIK terintegrasi & efektif"];

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #333; margin: 0; padding: 0.5cm; }
            .header-info { margin-bottom: 20px; width: 100%; border-collapse: collapse; }
            .header-info td { padding: 2px 5px; }
            h2 { text-align: center; font-size: 14pt; margin-top: 10px; margin-bottom: 20px; text-decoration: underline; }
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; page-break-inside: auto; }
            table.data-table tr { page-break-inside: avoid; }
            table.data-table th, table.data-table td { border: 1px solid #000; padding: 8px 6px; }
            table.data-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
            .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; background: #eee; padding: 8px; border: 1px solid #000; border-bottom: none; }
            .summary-box { margin-top: 25px; margin-bottom: 25px; border: 1px solid #000; padding: 15px; page-break-inside: avoid; }
            .letterhead-container { width: 100%; text-align: center; margin-bottom: 40px; border-bottom: 4px double #000; padding-bottom: 15px; }
            .signature-section { margin-top: 50px; width: 100%; border-collapse: collapse; page-break-inside: avoid; }
            .signature-section td { text-align: center; vertical-align: top; padding-top: 5px; padding-bottom: 5px; }
            .signature-space { height: 80px; }
            @media print {
              @page { size: portrait; margin: 0; }
              body { 
                margin-top: ${printConfig.marginTop}cm; 
                margin-bottom: ${printConfig.marginBottom}cm; 
                margin-left: 2cm; 
                margin-right: 2cm; 
              }
              button { display: none; }
              .no-print { display: none; }
              .page-break { page-break-before: always; margin-top: 2cm; }
            }
          </style>
        </head>
        <body>
          <!-- SECTION I: ADMINISTRASI -->
          ${letterheadHtml}
          <h2>INSTRUMEN SUPERVISI AKADEMIK</h2>
          ${identityHeaderHtml}
          <div class="section-title">I. ADMINISTRASI PERENCANAAN PEMBELAJARAN</div>
          <table class="data-table">
            <thead>
              <tr>
                <th width="40">No</th>
                <th>Komponen Administrasi</th>
                <th width="60">Skor</th>
                <th>Catatan Perbaikan</th>
              </tr>
            </thead>
            <tbody>
              ${generateTableRows(printResult.planningAdmin?.scores || {}, printResult.planningAdmin?.comments || {}, PLANNING_ADMIN_COMPONENTS)}
              <tr style="font-weight: bold;">
                <td colspan="2" style="text-align: right;">Skor Akhir / Predikat</td>
                <td style="text-align: center;">${printResult.planningAdmin?.finalScore.toFixed(2)}</td>
                <td style="text-align: center;">${printResult.planningAdmin?.predicate}</td>
              </tr>
            </tbody>
          </table>
          ${printResult.planningAdmin?.coachingSuggestion ? `<div style="margin-top: 5px; font-size: 10pt;"><strong>Saran Pembinaan:</strong> ${printResult.planningAdmin.coachingSuggestion}</div>` : ''}
          ${summaryAndSignaturesHtml}

          <!-- SECTION II: RPP -->
          <div class="page-break"></div>
          ${letterheadHtml}
          <h2>INSTRUMEN RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h2>
          ${identityHeaderHtml}
          <div class="section-title">II. RENCANA PELAKSANAAN PEMBELAJARAN (RPP) GURU</div>
          <table class="data-table">
            <thead>
              <tr>
                <th width="40">No</th>
                <th>Komponen RPP</th>
                <th width="60">Skor</th>
                <th>Catatan Perbaikan</th>
              </tr>
            </thead>
            <tbody>
              ${generateTableRows(printResult.lessonPlan?.scores || {}, printResult.lessonPlan?.comments || {}, LESSON_PLAN_COMPONENTS)}
              <tr style="font-weight: bold;">
                <td colspan="2" style="text-align: right;">Skor Akhir / Predikat</td>
                <td style="text-align: center;">${printResult.lessonPlan?.finalScore.toFixed(2)}</td>
                <td style="text-align: center;">${printResult.lessonPlan?.predicate}</td>
              </tr>
            </tbody>
          </table>
          ${printResult.lessonPlan?.coachingSuggestion ? `<div style="margin-top: 5px; font-size: 10pt;"><strong>Saran Pembinaan:</strong> ${printResult.lessonPlan.coachingSuggestion}</div>` : ''}
          ${summaryAndSignaturesHtml}

          <!-- SECTION III: PELAKSANAAN -->
          <div class="page-break"></div>
          ${letterheadHtml}
          <h2>INSTRUMEN SUPERVISI PELAKSANAAN PEMBELAJARAN</h2>
          ${identityHeaderHtml}
          <div class="section-title">III. PELAKSANAAN PEMBELAJARAN</div>
          <table class="data-table">
            <thead>
              <tr>
                <th width="40">No</th>
                <th>Kegiatan Pembelajaran</th>
                <th width="60">Skor</th>
                <th>Catatan / Penguatan</th>
              </tr>
            </thead>
            <tbody>
              ${generateImplTableRows(printResult.implementation?.scores || {}, printResult.implementation?.comments || {}, IMPLEMENTATION_COMPONENTS)}
              <tr style="font-weight: bold;">
                <td colspan="2" style="text-align: right;">Skor Akhir / Predikat</td>
                <td style="text-align: center;">${printResult.implementation?.finalScore.toFixed(2)}</td>
                <td style="text-align: center;">${printResult.implementation?.predicate}</td>
              </tr>
            </tbody>
          </table>
          ${printResult.implementation?.coachingSuggestion ? `<div style="margin-top: 5px; font-size: 10pt;"><strong>Saran Pembinaan:</strong> ${printResult.implementation.coachingSuggestion}</div>` : ''}
          ${summaryAndSignaturesHtml}

          <script>
            window.onload = function() { window.print(); window.close(); }
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
              {isKepsek ? 'Monitoring Supervisi (Kepsek)' : isWakasek ? 'Monitoring Supervisi (Wakasek)' : 'Laporan Hasil Supervisi'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isKepsek || isWakasek 
                ? "Pantau hasil penilaian supervisi seluruh guru di sekolah." 
                : "Lihat hasil penilaian supervisi Anda atau guru yang Anda nilai."}
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
            <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold border border-purple-100">
              <Shield size={12} />
              {isKepsek ? 'AKSES KEPALA SEKOLAH' : isWakasek ? 'AKSES WAKASEK' : 'AKSES GURU'}
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari guru atau tanggal..."
            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredResults.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm text-center">
          <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-700 mb-2">Belum Ada Hasil</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? "Tidak ditemukan hasil yang sesuai dengan pencarian Anda." : "Belum ada data penilaian supervisi yang tersedia."}
          </p>
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
                          <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                            <h5 className="text-xs font-black text-gray-500 uppercase tracking-widest">Administrasi Perencanaan Pembelajaran</h5>
                            <div className="flex items-center gap-2">
                              {supervisor?.id === user.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/supervision-assessment?assignmentId=${result.assignmentId}`);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition shadow-sm"
                                >
                                  <Edit size={12} />
                                  Edit Penilaian
                                </button>
                              )}
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                                result.planningAdmin.predicate === 'BAIK SEKALI' ? 'bg-green-500' :
                                result.planningAdmin.predicate === 'BAIK' ? 'bg-blue-500' :
                                result.planningAdmin.predicate === 'CUKUP' ? 'bg-yellow-500' : 'bg-red-500'
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
                                  <th className="border-b border-r p-2 text-left">Komponen</th>
                                  <th className="border-b border-r p-2 text-center w-16">Nilai</th>
                                  <th className="border-b p-2 text-left">Catatan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(result.planningAdmin.scores).map(([comp, score], idx) => (
                                  <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="border-b border-r p-2 text-center">{idx + 1}</td>
                                    <td className="border-b border-r p-2 font-medium">{comp}</td>
                                    <td className="border-b border-r p-2 text-center font-bold text-purple-600">{score as React.ReactNode}</td>
                                    <td className="border-b p-2 text-gray-500 italic">{result.planningAdmin?.comments[comp] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {result.lessonPlan && (
                          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="bg-blue-50 p-3 border-b border-gray-100 flex justify-between items-center">
                              <h5 className="text-xs font-black text-blue-600 uppercase tracking-widest">Rencana Pelaksanaan Pembelajaran (RPP) Guru</h5>
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
                                    <th className="border-b border-r p-2 text-left">Komponen</th>
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
                            <div className="bg-green-50 p-3 border-b border-gray-100 flex justify-between items-center">
                              <h5 className="text-xs font-black text-green-600 uppercase tracking-widest">Pelaksanaan Pembelajaran</h5>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                                result.implementation.predicate === 'BAIK SEKALI' ? 'bg-green-500' :
                                result.implementation.predicate === 'BAIK' ? 'bg-blue-500' :
                                result.implementation.predicate === 'CUKUP' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}>
                                {result.implementation.predicate} ({result.implementation.finalScore.toFixed(2)})
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px] border-collapse">
                                <thead>
                                  <tr className="bg-gray-50/50">
                                    <th className="border-b border-r p-2 text-left w-8">No</th>
                                    <th className="border-b border-r p-2 text-left">Komponen</th>
                                    <th className="border-b border-r p-2 text-center w-16">Nilai</th>
                                    <th className="border-b p-2 text-left">Catatan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(result.implementation.scores).map(([comp, score], idx) => (
                                    <React.Fragment key={idx}>
                                      {idx === 0 && (
                                        <tr className="bg-gray-50/50 font-bold text-blue-700">
                                          <td className="border-b border-r p-2 text-center">A</td>
                                          <td colSpan={3} className="border-b p-2">KEGIATAN PENDAHULUAN</td>
                                        </tr>
                                      )}
                                      {idx === 5 && (
                                        <tr className="bg-gray-50/50 font-bold text-blue-700">
                                          <td className="border-b border-r p-2 text-center">B</td>
                                          <td colSpan={3} className="border-b p-2">KEGIATAN INTI</td>
                                        </tr>
                                      )}
                                      {idx === 11 && (
                                        <tr className="bg-gray-50/50 font-bold text-blue-700">
                                          <td className="border-b border-r p-2 text-center">C</td>
                                          <td colSpan={3} className="border-b p-2">KEGIATAN PENUTUP</td>
                                        </tr>
                                      )}
                                      {idx === 15 && (
                                        <tr className="bg-gray-50/50 font-bold text-blue-700">
                                          <td className="border-b border-r p-2 text-center">D</td>
                                          <td colSpan={3} className="border-b p-2">KEGIATAN PENILAIAN HASIL BELAJAR</td>
                                        </tr>
                                      )}
                                      <tr className="hover:bg-gray-50/50">
                                        <td className="border-b border-r p-2 text-center">{idx + 1}</td>
                                        <td className="border-b border-r p-2 font-medium">{comp}</td>
                                        <td className="border-b border-r p-2 text-center font-bold text-green-600">{score as React.ReactNode}</td>
                                        <td className="border-b p-2 text-gray-500 italic">{result.implementation?.comments[comp] || '-'}</td>
                                      </tr>
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
                <h3 className="font-bold">Pengaturan Cetak Dokumen Supervisi</h3>
              </div>
              <button 
                onClick={() => setIsPrintModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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
                      <p className="text-[9px] text-gray-400 mt-1">Format: JPG, PNG, WEBP. Maks: 2MB. Akan tampil di setiap header instrumen.</p>
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
                Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisionResults;
