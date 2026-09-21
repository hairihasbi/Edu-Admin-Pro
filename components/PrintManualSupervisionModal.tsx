import React, { useState, useEffect } from 'react';
import { User, SupervisionAssignment } from '../types';
import { Printer, X, FileText, School, User as UserIcon, Calendar, CheckCircle } from './Icons';
import { DEEP_LEARNING_SUPERVISION_ITEMS } from './deepLearningSupervisionConstants';

export const PLANNING_ADMIN_COMPONENTS = [
  "Kalender Pendidikan",
  "Program Tahunan",
  "Program Semester",
  "Silabus",
  "RPP",
  "Jadwal Pelajaran",
  "Agenda Harian",
  "Daftar Nilai",
  "KKM",
  "Daftar Hadir Peserta Didik",
  "Ketersediaan Bahan Ajar",
  "Buku Pedoman Guru"
];

export const LESSON_PLAN_COMPONENTS = [
  "Identitas Sekolah",
  "Identitas Mata Pelajaran",
  "Kelas/Semester",
  "Materi Pokok/Kompetensi Dasar",
  "Alokasi Waktu",
  "Tujuan Pembelajaran",
  "Metode & Model Pembelajaran",
  "Media Pembelajaran (LMS)",
  "Media Pembelajaran (Visual)",
  "Sumber Belajar",
  "Kegiatan Pembelajaran (Sistematis)",
  "Kegiatan Inti (HOTS)",
  "Langkah Integrasi (4C, PPK, Literasi)",
  "Penilaian Proses (Otentik)",
  "Penilaian Hasil (Mencerminkan Proses)",
  "Teknik Penilaian (Alat Tes/Instrumen)",
  "Kunci Jawaban/Rubrik"
];

export const IMPLEMENTATION_COMPONENTS = [
  "Memberikan motivasi & menyiapkan peserta didik",
  "Mengajukan pertanyaan & mengaitkan pengetahuan sebelumnya",
  "Menjelaskan tujuan pembelajaran/KD",
  "Penanaman/Pembudayaan karakter dan literasi",
  "Menyampaikan tugas & arahan mekanisme penyelesaian",
  "Menggunakan Learning Manajemen Sistem (LMS)",
  "Memanfaatkan fasilitas akun belajar.id",
  "Memanfaatkan penggunaan video, power point, dll",
  "Metode/Pendekatan mewujudkan suasana menyenangkan (integrasi 21st Century)",
  "Menggunakan media pembelajaran sebagai alat bantu",
  "Memanfaatkan berbagai fasilitas Sumber belajar",
  "Kesimpulan bersama & manfaat pembelajaran",
  "Memberikan umpan balik proses & hasil",
  "Kegiatan tindak lanjut (tugas individu/kelompok)",
  "Rencana kegiatan pertemuan berikutnya",
  "Penilaian proses sesuai perencanaan",
  "Penilaian hasil (tes, portofolio, penugasan)",
  "Teknik Penilaian (instrumen sesuai KD)",
  "Penerapan TIK terintegrasi & efektif"
];

interface PrintManualSupervisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  teachers: User[];
  selectedAssignment?: SupervisionAssignment | null;
  defaultTeacherId?: string;
  defaultSupervisorId?: string;
}

export const PrintManualSupervisionModal: React.FC<PrintManualSupervisionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  teachers,
  selectedAssignment,
  defaultTeacherId,
  defaultSupervisorId
}) => {
  // Instrument selection
  const [instrumentType, setInstrumentType] = useState<'ALL' | 'PLANNING' | 'LESSON_PLAN' | 'IMPLEMENTATION'>('ALL');

  // Teacher identity state
  const [teacherId, setTeacherId] = useState<string>('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherNip, setTeacherNip] = useState('');
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('X / Ganjil');
  const [supervisionDate, setSupervisionDate] = useState(new Date().toISOString().split('T')[0]);
  const [supervisionDayTime, setSupervisionDayTime] = useState('Jam ke 1 - 2 (07.30 - 09.00)');
  const [topic, setTopic] = useState('');

  // Supervisor identity state
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorNip, setSupervisorNip] = useState('');
  const [supervisorPosition, setSupervisorPosition] = useState('Supervisor / Penilai');

  // School & print configuration
  const [schoolName, setSchoolName] = useState(currentUser.schoolName || '');
  const [location, setLocation] = useState(localStorage.getItem('sup_location') || 'Banjarmasin');
  const [principalName, setPrincipalName] = useState(localStorage.getItem('sup_principal_name') || '');
  const [principalNip, setPrincipalNip] = useState(localStorage.getItem('sup_principal_nip') || '');
  const [letterheadUrl, setLetterheadUrl] = useState(localStorage.getItem('sup_letterhead_url') || '');
  const [marginTop, setMarginTop] = useState(localStorage.getItem('sup_margin_top') || '1.5');
  const [marginBottom, setMarginBottom] = useState(localStorage.getItem('sup_margin_bottom') || '1.5');

  // Initialize or update fields when modal opens or selections change
  useEffect(() => {
    if (!isOpen) return;

    // Detect principal from teachers list if not already saved
    if (!principalName) {
      const kepsek = teachers.find(t => t.additionalRole === 'KEPALA_SEKOLAH');
      if (kepsek) {
        setPrincipalName(kepsek.fullName);
        setPrincipalNip(kepsek.nip || '');
      }
    }

    // Determine target teacher
    const targetTeacherId = selectedAssignment?.teacherId || defaultTeacherId;
    if (targetTeacherId) {
      setTeacherId(targetTeacherId);
      const target = teachers.find(t => t.id === targetTeacherId);
      if (target) {
        setTeacherName(target.fullName);
        setTeacherNip(target.nip || '');
        setSubject(target.subject || '');
      }
    }

    // Determine supervisor
    const targetSupervisorId = selectedAssignment?.supervisorId || defaultSupervisorId || currentUser.id;
    setSupervisorId(targetSupervisorId);
    const sup = teachers.find(t => t.id === targetSupervisorId) || currentUser;
    if (sup) {
      setSupervisorName(sup.fullName);
      setSupervisorNip(sup.nip || '');
      if (sup.additionalRole === 'KEPALA_SEKOLAH') {
        setSupervisorPosition('Kepala Sekolah / Supervisor');
      } else if (sup.additionalRole === 'WAKASEK_KURIKULUM') {
        setSupervisorPosition('Wakasek Kurikulum / Supervisor');
      } else {
        setSupervisorPosition('Guru Senior / Supervisor');
      }
    }

    // Determine date
    if (selectedAssignment?.startDate) {
      setSupervisionDate(selectedAssignment.startDate);
    } else if (selectedAssignment?.scheduledDate) {
      setSupervisionDate(selectedAssignment.scheduledDate);
    }
  }, [isOpen, selectedAssignment, defaultTeacherId, defaultSupervisorId, teachers, currentUser]);

  // Handle teacher dropdown change
  const handleTeacherChange = (id: string) => {
    setTeacherId(id);
    const target = teachers.find(t => t.id === id);
    if (target) {
      setTeacherName(target.fullName);
      setTeacherNip(target.nip || '');
      setSubject(target.subject || '');
    } else if (!id) {
      setTeacherName('');
      setTeacherNip('');
      setSubject('');
    }
  };

  // Handle supervisor dropdown change
  const handleSupervisorChange = (id: string) => {
    setSupervisorId(id);
    const sup = teachers.find(t => t.id === id);
    if (sup) {
      setSupervisorName(sup.fullName);
      setSupervisorNip(sup.nip || '');
    }
  };

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    // Save configurations to localStorage for persistent ease of use
    localStorage.setItem('sup_location', location);
    localStorage.setItem('sup_principal_name', principalName);
    localStorage.setItem('sup_principal_nip', principalNip);
    localStorage.setItem('sup_letterhead_url', letterheadUrl);
    localStorage.setItem('sup_margin_top', marginTop);
    localStorage.setItem('sup_margin_bottom', marginBottom);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Gagal membuka jendela cetak. Pastikan pop-up diizinkan pada browser Anda.");
      return;
    }

    const formattedSupervisionDate = formatDateIndo(supervisionDate);

    // Letterhead HTML
    const letterheadHtml = letterheadUrl
      ? `<div class="letterhead-container"><img src="${letterheadUrl}" style="width: 100%; max-height: 140px; object-fit: contain; margin-bottom: 15px;" /></div>`
      : `<div class="school-header">
           <h1 style="font-size: 14pt; margin: 0; text-transform: uppercase; font-weight: bold;">${schoolName || 'PEMERINTAH DAERAH'}</h1>
           <div style="font-size: 10pt; margin-top: 2px;">INSTRUMEN SUPERVISI AKADEMIK GURU</div>
           <div style="border-bottom: 3px double #000; margin-top: 10px; margin-bottom: 15px;"></div>
         </div>`;

    // Identity Box (two columns, clean tabular format)
    const identityHtml = `
      <div class="identity-box">
        <table class="identity-table">
          <tr>
            <td width="20%">Satuan Pendidikan</td>
            <td width="2%">:</td>
            <td width="28%"><strong>${schoolName || '-'}</strong></td>
            <td width="20%">Nama Supervisor</td>
            <td width="2%">:</td>
            <td width="28%"><strong>${supervisorName || '................................'}</strong></td>
          </tr>
          <tr>
            <td>Nama Guru</td>
            <td>:</td>
            <td><strong>${teacherName || '................................'}</strong></td>
            <td>NIP Supervisor</td>
            <td>:</td>
            <td>${supervisorNip || '................................'}</td>
          </tr>
          <tr>
            <td>NIP Guru</td>
            <td>:</td>
            <td>${teacherNip || '................................'}</td>
            <td>Jabatan Penilai</td>
            <td>:</td>
            <td>${supervisorPosition || 'Supervisor'}</td>
          </tr>
          <tr>
            <td>Mata Pelajaran</td>
            <td>:</td>
            <td>${subject || '................................'}</td>
            <td>Hari, Tanggal</td>
            <td>:</td>
            <td>${formattedSupervisionDate}</td>
          </tr>
          <tr>
            <td>Kelas / Semester</td>
            <td>:</td>
            <td>${className || '................................'}</td>
            <td>Waktu / Jam ke-</td>
            <td>:</td>
            <td>${supervisionDayTime || '................................'}</td>
          </tr>
          <tr>
            <td>Materi Pokok / Topik</td>
            <td>:</td>
            <td colspan="4">${topic || '........................................................................................................'}</td>
          </tr>
        </table>
      </div>
    `;

    // Signatures Section - 3 columns aligned horizontally to save space and guarantee 1-page fit
    const signaturesHtml = `
      <div class="signature-container">
        <div style="text-align: right; margin-bottom: 6px; font-size: 8.5pt;">
          ${location}, ${new Date(supervisionDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
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
              <strong style="text-decoration: underline;">${teacherName || '...........................................'}</strong><br>
              <span style="font-size: 8pt;">NIP. ${teacherNip || '...........................................'}</span>
            </td>
            <td style="width: 33.3%; text-align: center; padding: 0 4px; vertical-align: top;">
              <strong style="text-decoration: underline;">${supervisorName || '...........................................'}</strong><br>
              <span style="font-size: 8pt;">NIP. ${supervisorNip || '...........................................'}</span>
            </td>
            <td style="width: 33.4%; text-align: center; padding: 0 4px; vertical-align: top;">
              <strong style="text-decoration: underline;">${principalName || '...........................................'}</strong><br>
              <span style="font-size: 8pt;">NIP. ${principalNip || '...........................................'}</span>
            </td>
          </tr>
        </table>
      </div>
    `;

    // Section 1: Instrumen Supervisi Persiapan Pembelajaran Mendalam
    const section1Html = `
      <div class="instrument-section">
        ${letterheadHtml}
        <h2 class="doc-title">INSTRUMEN SUPERVISI</h2>
        <div class="doc-subtitle">PERSIAPAN PEMBELAJARAN MENDALAM</div>
        
        ${identityHtml}

        <div style="font-weight: bold; font-size: 10pt; margin: 10px 0 6px 0; color: #111;">
          1. Instrumen Penilaian
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th width="30">No</th>
              <th width="125">Komponen yang Dimonitor</th>
              <th width="125">Indikator</th>
              <th>Pertanyaan/Aspek yang Dinilai</th>
              <th width="75">Skor (1–4)*</th>
              <th width="160">Catatan/Temuan</th>
            </tr>
          </thead>
          <tbody>
            ${DEEP_LEARNING_SUPERVISION_ITEMS.map((item) => `
              <tr>
                ${item.isFirstInGroup ? `
                  <td rowspan="${item.groupRowSpan}" style="text-align: center; font-weight: bold; vertical-align: top; background: #fafafa;">${item.groupLetter}</td>
                  <td rowspan="${item.groupRowSpan}" style="font-weight: 600; vertical-align: top; background: #fafafa;">${item.component}</td>
                ` : ''}
                <td style="font-weight: 500; vertical-align: top;">${item.indicator}</td>
                <td style="vertical-align: top;">${item.question}</td>
                <td style="text-align: center; vertical-align: top;">
                  <div class="score-manual-boxes" style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start; padding-left: 6px;">
                    <span>[ &nbsp; ] 1</span>
                    <span>[ &nbsp; ] 2</span>
                    <span>[ &nbsp; ] 3</span>
                    <span>[ &nbsp; ] 4</span>
                  </div>
                </td>
                <td class="notes-line" style="vertical-align: top;"></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #fafafa; font-size: 8.5pt;">
              <td colspan="6" style="padding: 6px 8px; border: 1px solid #333;">
                <strong>Keterangan Skor:</strong> 
                1 = Tidak ada &nbsp;|&nbsp; 
                2 = Ada tetapi belum lengkap &nbsp;|&nbsp; 
                3 = Lengkap namun belum optimal &nbsp;|&nbsp; 
                4 = Lengkap dan sangat baik
              </td>
            </tr>
            <tr style="font-weight: bold; background: #fafafa;">
              <td colspan="4" style="text-align: right;">Total Skor: ................ / 80 &nbsp;&nbsp;(Skor Riil: ................ / 72)</td>
              <td colspan="2" style="font-size: 8.5pt;">
                Kategori Kesiapan: [ &nbsp; ] Sangat Kurang &nbsp;&nbsp; [ &nbsp; ] Kurang &nbsp;&nbsp; [ &nbsp; ] Baik &nbsp;&nbsp; [ &nbsp; ] Sangat Baik
              </td>
            </tr>
          </tfoot>
        </table>

        <div style="font-weight: bold; font-size: 10pt; margin: 16px 0 8px 0; color: #111;">
          2. Rekomendasi Tindak Lanjut
        </div>

        <div class="coaching-manual-box" style="margin-bottom: 8px;">
          <strong>1. Penguatan pada Aspek yang Lemah:</strong>
          <div class="manual-lined-area" style="min-height: 44px;">
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>

        <div class="coaching-manual-box" style="margin-bottom: 8px;">
          <strong>2. Strategi Perbaikan Jangka Pendek (1–4 Minggu):</strong>
          <div class="manual-lined-area" style="min-height: 44px;">
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>

        <div class="coaching-manual-box" style="margin-bottom: 8px;">
          <strong>3. Strategi Pengembangan Jangka Panjang (Satu Semester/Tahun):</strong>
          <div class="manual-lined-area" style="min-height: 44px;">
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>

        <div class="coaching-manual-box" style="margin-bottom: 12px;">
          <strong>4. Sumber Daya/ Dukungan yang Dibutuhkan:</strong>
          <div class="manual-lined-area" style="min-height: 44px;">
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>

        ${signaturesHtml}
      </div>
    `;

    // Section 2: RPP Guru
    const section2Html = `
      <div class="instrument-section">
        ${letterheadHtml}
        <h2 class="doc-title">INSTRUMEN SUPERVISI AKADEMIK</h2>
        <div class="doc-subtitle">BAGIAN II: TELAAH RENCANA PELAKSANAAN PEMBELAJARAN (RPP / MODUL AJAR)</div>
        
        ${identityHtml}

        <div class="instructions-box">
          <strong>Petunjuk Pengisian:</strong><br>
          Lakukan telaah terhadap dokumen RPP / Modul Ajar guru dan berikan tanda centang (✓) pada kriteria skor:<br>
          <strong>0</strong> = Tidak Ada &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>1</strong> = Kurang Sesuai / Perlu Perbaikan &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>2</strong> = Sesuai / Memenuhi Standar Proses
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th width="35">No</th>
              <th>Komponen / Aspek Telaah RPP / Modul Ajar</th>
              <th width="120">Kriteria Skor<br><span style="font-size: 8pt; font-weight: normal;">(0 = Tidak, 1 = Kurang, 2 = Sesuai)</span></th>
              <th width="230">Catatan / Saran Masukan Perbaikan</th>
            </tr>
          </thead>
          <tbody>
            ${LESSON_PLAN_COMPONENTS.map((comp, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 500;">${comp}</td>
                <td style="text-align: center;">
                  <div class="score-manual-boxes">
                    <span>[ &nbsp; ] 0</span>
                    <span>[ &nbsp; ] 1</span>
                    <span>[ &nbsp; ] 2</span>
                  </div>
                </td>
                <td class="notes-line"></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #fafafa;">
              <td colspan="2" style="text-align: right;">JUMLAH SKOR RIIL PEROLEHAN</td>
              <td style="text-align: center; font-size: 11pt;">...............</td>
              <td style="font-size: 8pt; color: #555;">(Maksimum Skor Ideal = 34)</td>
            </tr>
            <tr style="font-weight: bold; background: #fafafa;">
              <td colspan="2" style="text-align: right;">NILAI AKHIR = (Skor Riil / 34) x 100</td>
              <td style="text-align: center; font-size: 11pt;">...............</td>
              <td style="text-align: center; font-size: 9pt;">
                Predikat: [ &nbsp; ] A (Amat Baik) &nbsp; [ &nbsp; ] B (Baik) &nbsp; [ &nbsp; ] C (Cukup) &nbsp; [ &nbsp; ] D (Kurang)
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="coaching-manual-box">
          <strong>Catatan Pembinaan / Rekomendasi Penyempurnaan RPP:</strong>
          <div class="manual-lined-area">
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>

        ${signaturesHtml}
      </div>
    `;

    // Section 3: Pelaksanaan Pembelajaran
    const implGroups = [
      { code: 'A', title: 'KEGIATAN PENDAHULUAN', startIdx: 0, endIdx: 5 },
      { code: 'B', title: 'KEGIATAN INTI', startIdx: 5, endIdx: 11 },
      { code: 'C', title: 'KEGIATAN PENUTUP', startIdx: 11, endIdx: 15 },
      { code: 'D', title: 'KEGIATAN PENILAIAN HASIL BELAJAR', startIdx: 15, endIdx: 19 }
    ];

    const generateImplRowsHtml = () => {
      let rows = '';
      implGroups.forEach(group => {
        rows += `
          <tr style="background-color: #f0f4f8; font-weight: bold;">
            <td style="text-align: center;">${group.code}</td>
            <td colspan="3" style="text-transform: uppercase; letter-spacing: 0.5px;">${group.title}</td>
          </tr>
        `;
        const groupComps = IMPLEMENTATION_COMPONENTS.slice(group.startIdx, group.endIdx);
        groupComps.forEach((comp, idx) => {
          rows += `
            <tr>
              <td style="text-align: center; font-weight: bold;">${group.startIdx + idx + 1}</td>
              <td style="font-weight: 500;">${comp}</td>
              <td style="text-align: center;">
                <div class="score-manual-boxes-4">
                  <span>[ &nbsp; ] 1</span>
                  <span>[ &nbsp; ] 2</span>
                  <span>[ &nbsp; ] 3</span>
                  <span>[ &nbsp; ] 4</span>
                </div>
              </td>
              <td class="notes-line"></td>
            </tr>
          `;
        });
      });
      return rows;
    };

    const section3Html = `
      <div class="instrument-section">
        ${letterheadHtml}
        <h2 class="doc-title">INSTRUMEN OBSERVASI SUPERVISI AKADEMIK</h2>
        <div class="doc-subtitle">BAGIAN III: PELAKSANAAN PROSES PEMBELAJARAN (OBSERVASI KELAS)</div>
        
        ${identityHtml}

        <div class="instructions-box">
          <strong>Petunjuk Pengisian:</strong><br>
          Lakukan observasi langsung terhadap aktivitas belajar-mengajar di kelas. Berilah tanda centang (✓) pada skor 1-4:<br>
          <strong>1</strong> = Kurang &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>2</strong> = Cukup &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>3</strong> = Baik &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>4</strong> = Amat Baik / Sempurna
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th width="35">No</th>
              <th>Aspek / Indikator Kegiatan Pembelajaran</th>
              <th width="150">Skor Observasi<br><span style="font-size: 8pt; font-weight: normal;">(Skala 1 - 4)</span></th>
              <th width="220">Catatan / Temuan Observasi Kelas</th>
            </tr>
          </thead>
          <tbody>
            ${generateImplRowsHtml()}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #fafafa;">
              <td colspan="2" style="text-align: right;">JUMLAH SKOR RIIL OBSERVASI</td>
              <td style="text-align: center; font-size: 11pt;">...............</td>
              <td style="font-size: 8pt; color: #555;">(Maksimum Skor Ideal = 76)</td>
            </tr>
            <tr style="font-weight: bold; background: #fafafa;">
              <td colspan="2" style="text-align: right;">NILAI AKHIR = (Skor Riil / 76) x 100</td>
              <td style="text-align: center; font-size: 11pt;">...............</td>
              <td style="text-align: center; font-size: 9pt;">
                Predikat: [ &nbsp; ] A (Amat Baik) &nbsp; [ &nbsp; ] B (Baik) &nbsp; [ &nbsp; ] C (Cukup) &nbsp; [ &nbsp; ] D (Kurang)
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="coaching-manual-box">
          <strong>Catatan Temuan & Rekomendasi Penguatan Guru Pasca Observasi Kelas:</strong>
          <div class="manual-lined-area">
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>

        ${signaturesHtml}
      </div>
    `;

    // Assemble document sections according to selected option
    let bodyContent = '';
    if (instrumentType === 'ALL') {
      bodyContent = `
        ${section1Html}
        <div class="page-break"></div>
        ${section2Html}
        <div class="page-break"></div>
        ${section3Html}
      `;
    } else if (instrumentType === 'PLANNING') {
      bodyContent = section1Html;
    } else if (instrumentType === 'LESSON_PLAN') {
      bodyContent = section2Html;
    } else if (instrumentType === 'IMPLEMENTATION') {
      bodyContent = section3Html;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Instrumen Supervisi Akademik - ${teacherName || 'Manual'}</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              font-size: 9.5pt;
              line-height: 1.25;
              color: #111;
              margin: 0;
              padding: 0.3cm;
            }
            .school-header {
              text-align: center;
              margin-bottom: 10px;
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
            .instructions-box {
              border: 1px dashed #666;
              background: #f9f9f9;
              padding: 4px 8px;
              font-size: 8pt;
              margin-bottom: 6px;
              line-height: 1.2;
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
            .score-manual-boxes {
              display: flex;
              justify-content: center;
              gap: 10px;
              font-size: 8.5pt;
              font-weight: bold;
            }
            .score-manual-boxes-4 {
              display: flex;
              justify-content: center;
              gap: 7px;
              font-size: 8.5pt;
              font-weight: bold;
            }
            .notes-line {
              min-height: 18px;
            }
            .coaching-manual-box {
              border: 1px solid #222;
              padding: 5px 8px;
              margin-top: 5px;
              margin-bottom: 6px;
              font-size: 8.5pt;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .manual-lined-area {
              margin-top: 4px;
            }
            .write-line {
              border-bottom: 1px dotted #888;
              height: 15px;
              width: 100%;
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
            .letterhead-container {
              width: 100%;
              text-align: center;
              margin-bottom: 10px;
              border-bottom: 4px double #000;
              padding-bottom: 6px;
            }
            @media print {
              @page {
                size: 215mm 330mm; /* Standar Ukuran Kertas F4 / Folio Indonesia */
                margin-top: ${marginTop || '0.8'}cm;
                margin-bottom: ${marginBottom || '0.8'}cm;
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
          ${bodyContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl overflow-hidden my-8">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Printer size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Cetak Instrumen Supervisi Manual</h3>
              <p className="text-purple-100 text-xs mt-0.5">
                Format lembar observasi lapangan lengkap untuk pengisian manual/offline saat gangguan koneksi.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Pilihan Dokumen Instrumen */}
          <div>
            <label className="block text-xs font-black uppercase text-gray-600 tracking-wider mb-2">
              Pilihan Instrumen yang Dicetak
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInstrumentType('ALL')}
                className={`p-3 text-left rounded-xl border transition flex items-start gap-3 ${
                  instrumentType === 'ALL'
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText size={18} className={instrumentType === 'ALL' ? 'text-purple-600' : 'text-gray-400'} />
                <div>
                  <div className="text-xs font-bold text-gray-800">Semua Instrumen (3 Bagian)</div>
                  <div className="text-[10px] text-gray-500">Lengkap: Administrasi, RPP & Pelaksanaan</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setInstrumentType('PLANNING')}
                className={`p-3 text-left rounded-xl border transition flex items-start gap-3 ${
                  instrumentType === 'PLANNING'
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CheckCircle size={18} className={instrumentType === 'PLANNING' ? 'text-purple-600' : 'text-gray-400'} />
                <div>
                  <div className="text-xs font-bold text-gray-800">Bagian I: Persiapan Pembelajaran Mendalam</div>
                  <div className="text-[10px] text-gray-500">18 Indikator Evaluasi & 4 Rekomendasi Tindak Lanjut</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setInstrumentType('LESSON_PLAN')}
                className={`p-3 text-left rounded-xl border transition flex items-start gap-3 ${
                  instrumentType === 'LESSON_PLAN'
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CheckCircle size={18} className={instrumentType === 'LESSON_PLAN' ? 'text-purple-600' : 'text-gray-400'} />
                <div>
                  <div className="text-xs font-bold text-gray-800">Bagian II: Telaah RPP / Modul Ajar</div>
                  <div className="text-[10px] text-gray-500">17 Komponen Sistematika RPP</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setInstrumentType('IMPLEMENTATION')}
                className={`p-3 text-left rounded-xl border transition flex items-start gap-3 ${
                  instrumentType === 'IMPLEMENTATION'
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CheckCircle size={18} className={instrumentType === 'IMPLEMENTATION' ? 'text-purple-600' : 'text-gray-400'} />
                <div>
                  <div className="text-xs font-bold text-gray-800">Bagian III: Pelaksanaan Pembelajaran</div>
                  <div className="text-[10px] text-gray-500">19 Indikator Observasi Kelas Langsung</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 1: Data Guru yang Disupervisi */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <UserIcon size={16} className="text-indigo-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
                1. Data Guru yang Disupervisi
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Pilih Guru dari Daftar Sekolah (Auto-fill)
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">-- Pilih Guru atau Ketik Manual di Bawah --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} {t.subject ? `(${t.subject})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Nama Lengkap Guru</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Nama Lengkap dan Gelar Guru"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">NIP Guru</label>
                <input
                  type="text"
                  value={teacherNip}
                  onChange={(e) => setTeacherNip(e.target.value)}
                  placeholder="NIP atau tanda strip (-)"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Contoh: Matematika / Bahasa Indonesia"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Kelas / Fase / Semester</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Contoh: Kelas X.A / Ganjil"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Tanggal Supervisi</label>
                <input
                  type="date"
                  value={supervisionDate}
                  onChange={(e) => setSupervisionDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Jam ke- / Waktu Pelaksanaan</label>
                <input
                  type="text"
                  value={supervisionDayTime}
                  onChange={(e) => setSupervisionDayTime(e.target.value)}
                  placeholder="Contoh: Jam 1 - 2 (07.30 - 09.00)"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Materi Pokok / Topik / CP</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Topik pembelajaran atau kompetensi dasar yang diobservasi"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Data Supervisor */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <School size={16} className="text-purple-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
                2. Data Supervisor / Penilai
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Pilih Supervisor (Default: Akun Aktif)
                </label>
                <select
                  value={supervisorId}
                  onChange={(e) => handleSupervisorChange(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} {t.isSupervisor ? '(Supervisor)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Nama Lengkap Supervisor</label>
                <input
                  type="text"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  placeholder="Nama Supervisor"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">NIP Supervisor</label>
                <input
                  type="text"
                  value={supervisorNip}
                  onChange={(e) => setSupervisorNip(e.target.value)}
                  placeholder="NIP Supervisor"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Jabatan Penilai</label>
                <input
                  type="text"
                  value={supervisorPosition}
                  onChange={(e) => setSupervisorPosition(e.target.value)}
                  placeholder="Contoh: Guru Senior / Supervisor Akademik"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Data Pengesahan & Format Cetak */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <Calendar size={16} className="text-blue-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
                3. Data Pengesahan & Pengaturan Cetak
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Nama Satuan Pendidikan</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Nama Sekolah"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Kota / Lokasi Pengesahan</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Banjarmasin"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="Nama Kepala Sekolah"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">NIP Kepala Sekolah</label>
                <input
                  type="text"
                  value={principalNip}
                  onChange={(e) => setPrincipalNip(e.target.value)}
                  placeholder="NIP Kepala Sekolah"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  URL Kop Surat Sekolah (Opsional)
                </label>
                <input
                  type="text"
                  value={letterheadUrl}
                  onChange={(e) => setLetterheadUrl(e.target.value)}
                  placeholder="https://... atau biarkan kosong untuk header teks resmi otomatis"
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[11px] text-gray-500 italic">
            Format cetak didesain standar kertas F4 / Folio (215 x 330 mm), bagian tanda tangan terpadu dalam satu halaman tanpa terpisah.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200 hover:opacity-95 transition"
            >
              <Printer size={16} />
              Cetak Dokumen Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
