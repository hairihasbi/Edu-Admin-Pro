/**
 * Guru Wali Initial Assessment - Manual Fill-in PDF Template Generator
 * Menghasilkan instrumen cetak / unduh PDF untuk diisi manual oleh siswa dengan tulisan tangan.
 * Setiap lembar formulir sudah memuat data identitas lengkap siswa, sekolah, dan guru wali.
 */

export interface StudentManualFormItem {
  id?: string;
  name: string;
  nis: string;
  gender: 'L' | 'P' | string;
  className: string;
  birthInfo?: string;
  phone?: string;
}

export interface ManualFormTemplateOptions {
  schoolName: string;
  academicYear?: string;
  signatureData: {
    placeName: string;
    principalName: string;
    principalNip: string;
    teacherName: string;
    teacherNip: string;
  };
  students: StudentManualFormItem[];
}

export function generateManualFillinAssessmentFormHtml(options: ManualFormTemplateOptions): string {
  const { schoolName, signatureData, students } = options;
  const currentYear = new Date().getFullYear();
  const academicYear = options.academicYear || `${currentYear}/${currentYear + 1}`;
  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  // Jika tidak ada siswa, buat 1 formulir template kosong
  const effectiveStudents: StudentManualFormItem[] = students.length > 0 ? students : [{
    name: '....................................................................',
    nis: '............................................',
    gender: '',
    className: '............................................'
  }];

  const studentPagesHtml = effectiveStudents.map((student, idx) => {
    const isBlank = student.name.startsWith('...');
    const genderDisplay = isBlank
      ? '<span class="checkbox-option"><span class="box-check"></span> Laki-laki</span> <span class="checkbox-option"><span class="box-check"></span> Perempuan</span>'
      : (student.gender === 'L' ? 'Laki-laki (L)' : student.gender === 'P' ? 'Perempuan (P)' : '-');

    return `
      <!-- ==================== SISWA ${idx + 1}: ${student.name} ==================== -->
      <div class="form-student-container ${idx < effectiveStudents.length - 1 ? 'student-page-break' : ''}">
        
        <!-- HALAMAN 1 DARI 2 -->
        <div class="sheet-page">
          <!-- KOP SURAT RESMI SEKOLAH -->
          <div class="header-kop">
            <h3>PEMERINTAH DAERAH / KEMENTERIAN PENDIDIKAN DAN KEBUDAYAAN</h3>
            <h2>${schoolName || 'SMA NEGERI INDONESIA'}</h2>
            <p>INSTRUMEN IDENTIFIKASI AWAL & KOMPAS PENDAMPINGAN GURU WALI</p>
            <div class="kop-line-double"></div>
          </div>

          <!-- JUDUL INSTRUMEN -->
          <div class="title-container">
            <h4>LEMBAR IDENTIFIKASI AWAL SISWA ASUH</h4>
            <p class="subtitle">(Formulir Isian Mandiri Siswa untuk Pemetaan Minat, Bakat, Potensi & Kebutuhan Bimbingan)</p>
            <p class="meta">Tahun Ajaran ${academicYear} • Semester Ganjil / Genap</p>
          </div>

          <!-- KOTAK PETUNJUK PENGISIAN -->
          <div class="instructions-box">
            <strong>Petunjuk Pengisian Siswa:</strong>
            <ol>
              <li>Isilah instrumen ini secara <strong>jujur, cermat, dan apa adanya</strong> dengan tulisan tangan menggunakan pulpen tinta hitam atau biru.</li>
              <li>Data ini dipergunakan oleh Guru Wali untuk mendampingi perkembangan akademik, minat bakat, dan karakter Ananda selama di sekolah.</li>
              <li>Setelah formulir ini lengkap diisi dan ditandatangani bersama Orang Tua/Wali, serahkan kembali kepada Guru Wali Pembimbing Ananda.</li>
            </ol>
          </div>

          <!-- BAGIAN I: DATA IDENTITAS SISWA LENGKAP -->
          <div class="section-banner">BAGIAN I: IDENTITAS SISWA & GURU WALI ASUH</div>
          <table class="identity-table">
            <tr>
              <td class="label">Nama Lengkap Siswa</td>
              <td class="colon">:</td>
              <td class="value"><strong>${student.name}</strong></td>
              <td class="label">Kelas / Rombel</td>
              <td class="colon">:</td>
              <td class="value"><strong>${student.className || '-'}</strong></td>
            </tr>
            <tr>
              <td class="label">Nomor Induk Siswa (NIS)</td>
              <td class="colon">:</td>
              <td class="value">${student.nis || '-'}</td>
              <td class="label">Jenis Kelamin</td>
              <td class="colon">:</td>
              <td class="value">${genderDisplay}</td>
            </tr>
            <tr>
              <td class="label">Guru Wali Pembimbing</td>
              <td class="colon">:</td>
              <td class="value"><strong>${signatureData.teacherName || 'Guru Wali'}</strong></td>
              <td class="label">NIP Guru Wali</td>
              <td class="colon">:</td>
              <td class="value">${signatureData.teacherNip || '-'}</td>
            </tr>
            <tr>
              <td class="label">Nama Sekolah</td>
              <td class="colon">:</td>
              <td class="value">${schoolName || 'SMA Negeri Indonesia'}</td>
              <td class="label">Tanggal Pengisian</td>
              <td class="colon">:</td>
              <td class="value">${isBlank ? '................................................ 202...' : todayFormatted}</td>
            </tr>
          </table>

          <!-- BAGIAN II: PILAR 1 - PENDAMPINGAN AKADEMIK -->
          <div class="section-banner">BAGIAN II: PILAR 1 - PENDAMPINGAN AKADEMIK & CARA BELAJAR</div>
          
          <div class="prompt-group">
            <div class="prompt-title">1. Mata pelajaran yang paling Ananda sukai dan apa alasannya?</div>
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">2. Mata pelajaran yang dirasa paling sulit / menantang dan membutuhkan bimbingan lebih?</div>
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">3. Pola & waktu belajar mandiri di rumah: <em>(Beri tanda centang [ √ ] pada pilihan yang sesuai)</em></div>
            <div class="options-row">
              <span class="checkbox-option"><span class="box-check"></span> Sore (15.00 - 18.00)</span>
              <span class="checkbox-option"><span class="box-check"></span> Malam (19.00 - 21.30)</span>
              <span class="checkbox-option"><span class="box-check"></span> Dini Hari / Subuh</span>
              <span class="checkbox-option"><span class="box-check"></span> Menjelang Ujian Saja</span>
            </div>
            <div class="sub-prompt">
              Rata-rata durasi belajar di rumah: <strong>............ jam / hari</strong>. Suasana belajar yang diinginkan: ..............................................................
            </div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">4. Gaya / cara belajar yang paling memudahkan Ananda memahami pelajaran:</div>
            <div class="options-row-wrap">
              <span class="checkbox-option"><span class="box-check"></span> <strong>Visual</strong> (membaca buku/rangkuman, melihat diagram, infografis, video materi)</span>
              <span class="checkbox-option"><span class="box-check"></span> <strong>Auditori</strong> (mendengarkan penjelasan guru/teman, rekaman audio, diskusi tanya-jawab)</span>
              <span class="checkbox-option"><span class="box-check"></span> <strong>Kinestetik</strong> (praktik langsung di lab/lapangan, simulasi, menulis ulang poin penting)</span>
            </div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">5. Target capaian nilai akademik atau prestasi rapor yang ingin Ananda raih semester ini:</div>
            <div class="write-line"></div>
          </div>

          <!-- BAGIAN III: PILAR 2 - PENDAMPINGAN KETERAMPILAN & MINAT BAKAT -->
          <div class="section-banner">BAGIAN III: PILAR 2 - PENDAMPINGAN KETERAMPILAN & MINAT BAKAT</div>

          <div class="prompt-group">
            <div class="prompt-title">1. Keterampilan atau keahlian khusus yang saat ini sudah Ananda miliki / kuasai:</div>
            <div class="prompt-hint">*(Contoh: Seni Musik/Vokal, Tari/Rupa, Olahraga, IT/Komputer/Coding, Desain/Editing Video, Bahasa Asing, Public Speaking, Wirausaha, dll.)*</div>
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">2. Kegiatan ekstrakurikuler atau organisasi sekolah yang sedang atau ingin Ananda ikuti:</div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">3. Keterampilan atau wawasan baru yang paling ingin Ananda pelajari selama bersekolah:</div>
            <div class="write-line"></div>
          </div>

          <div class="page-footer-note">
            <span>Lembar Identifikasi Awal Siswa Asuh • ${schoolName}</span>
            <span>Halaman 1 dari 2</span>
          </div>
        </div>

        <!-- HALAMAN 2 DARI 2 -->
        <div class="sheet-page sheet-page-2">
          <!-- MINI RUNNING HEADER -->
          <div class="running-header">
            <span><strong>LEMBAR IDENTIFIKASI AWAL SISWA ASUH</strong></span>
            <span>Nama: <strong>${student.name}</strong> | NIS: <strong>${student.nis || '-'}</strong> | Kelas: <strong>${student.className || '-'}</strong></span>
            <span>Hal. 2/2</span>
          </div>

          <!-- BAGIAN IV: PILAR 3 - PRESTASI & CITA-CITA MASA DEPAN -->
          <div class="section-banner">BAGIAN IV: PILAR 3 - PENDAMPINGAN PRESTASI & CITA-CITA</div>

          <div class="prompt-group">
            <div class="prompt-title">1. Prestasi yang pernah diraih (akademik maupun non-akademik di SMP/MTs atau kejuaraan luar sekolah):</div>
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">2. Target prestasi, lomba, atau karya yang ingin Ananda ikuti dan perjuangkan selama di SMA:</div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">3. Cita-cita / rencana studi lanjut atau karir setelah lulus SMA nanti:</div>
            <div class="options-row-wrap">
              <span class="checkbox-option"><span class="box-check"></span> Perguruan Tinggi Negeri (PTN)</span>
              <span class="checkbox-option"><span class="box-check"></span> Perguruan Tinggi Swasta (PTS)</span>
              <span class="checkbox-option"><span class="box-check"></span> Sekolah Kedinasan / TNI / POLRI</span>
              <span class="checkbox-option"><span class="box-check"></span> Wirausaha / Mandiri</span>
              <span class="checkbox-option"><span class="box-check"></span> Bekerja di Industri/Perusahaan</span>
            </div>
            <div class="sub-prompt">
              Program Studi / Bidang Profesi Impian: <strong>........................................................................................................................</strong>
            </div>
          </div>

          <!-- BAGIAN V: PILAR 4 - KARAKTER & KEBIASAAN DIRI -->
          <div class="section-banner">BAGIAN V: PILAR 4 - PENDAMPINGAN KARAKTER & KEBIASAAN DIRI</div>

          <div class="prompt-group">
            <div class="prompt-title">1. Sifat / karakter positif yang paling menonjol pada diri Ananda:</div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">2. Sikap, tantangan, atau kebiasaan yang masih dirasa kurang baik dan ingin Ananda perbaiki:</div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">3. Kebiasaan positif sehari-hari di rumah dan sekolah (ibadah, kedisiplinan, membantu keluarga):</div>
            <div class="write-line"></div>
          </div>

          <div class="prompt-group">
            <div class="prompt-title">4. Harapan Bimbingan: <em>Hal apa yang paling Ananda harapkan dari Guru Wali untuk mendampingi Ananda?</em></div>
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>

          <!-- BAGIAN VI: CATATAN AWAL & REKOMENDASI GURU WALI (DIISI OLEH GURU WALI) -->
          <div class="section-banner guru-wali-box">BAGIAN VI: CATATAN AWAL & DIAGNOSIS GURU WALI (Diisi Oleh Guru Wali Pembimbing)</div>
          <div class="guru-wali-container">
            <div class="gw-row">
              <span class="gw-label">Kategori Profil Bimbingan Awal:</span>
              <span class="checkbox-option"><span class="box-check"></span> Penguatan Akademik</span>
              <span class="checkbox-option"><span class="box-check"></span> Potensi Prestasi</span>
              <span class="checkbox-option"><span class="box-check"></span> Kedisiplinan & Karakter</span>
              <span class="checkbox-option"><span class="box-check"></span> Mandiri & Stabil</span>
            </div>
            <div class="gw-notes-label">Catatan Diagnostik & Rencana Tindak Lanjut Guru Wali:</div>
            <div class="write-line-gw"></div>
            <div class="write-line-gw"></div>
          </div>

          <!-- BAGIAN VII: PENGESAHAN & TANDA TANGAN 3 PIHAK -->
          <div class="signature-section">
            <div class="signature-intro">
              Dokumen identifikasi awal ini diisi dengan sebenarnya sebagai dasar komitmen bersama dalam pendampingan siswa asuh.
            </div>
            <table class="signature-table-3col">
              <tr>
                <td style="width: 33.33%;">
                  <p class="sig-role">Siswa Yang Mengisi,</p>
                  <p class="sig-date">${isBlank ? '......................., ......................... 202...' : todayFormatted}</p>
                  <div class="sig-space"></div>
                  <p class="sig-name"><strong>${student.name}</strong></p>
                  <p class="sig-nip">NIS. ${student.nis || '....................................'}</p>
                </td>
                <td style="width: 33.33%;">
                  <p class="sig-role">Mengetahui,</p>
                  <p class="sig-role">Orang Tua / Wali Murid,</p>
                  <div class="sig-space"></div>
                  <p class="sig-name"><strong>( .................................................... )</strong></p>
                  <p class="sig-nip">Nama Lengkap & Tanda Tangan</p>
                </td>
                <td style="width: 33.33%;">
                  <p class="sig-role">Guru Wali Pembimbing,</p>
                  <p class="sig-date">${signatureData.placeName || '.......................'}, ${todayFormatted}</p>
                  <div class="sig-space"></div>
                  <p class="sig-name"><strong>${signatureData.teacherName || 'Guru Wali'}</strong></p>
                  <p class="sig-nip">NIP. ${signatureData.teacherNip || '....................................'}</p>
                </td>
              </tr>
            </table>

            <div class="principal-approval">
              <p>Mengetahui,</p>
              <p>Kepala Sekolah ${schoolName || ''}</p>
              <div class="sig-space-small"></div>
              <p class="sig-name"><strong>${signatureData.principalName || '( .................................................... )'}</strong></p>
              <p class="sig-nip">NIP. ${signatureData.principalNip || '....................................................'}</p>
            </div>
          </div>

          <div class="page-footer-note">
            <span>Lembar Identifikasi Awal Siswa Asuh • ${schoolName}</span>
            <span>Halaman 2 dari 2</span>
          </div>
        </div>

      </div>
    `;
  }).join('\n');

  const docTitle = effectiveStudents.length === 1 && !effectiveStudents[0].name.startsWith('...')
    ? `Formulir_Isian_Identifikasi_Awal_${effectiveStudents[0].name.replace(/\s+/g, '_')}`
    : `Formulir_Isian_Identifikasi_Awal_Siswa_Asuh_${effectiveStudents.length}_Siswa`;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm 10mm 14mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #111;
      margin: 0;
      padding: 0;
      line-height: 1.3;
      font-size: 9.5pt;
      background-color: #f4f6f9;
    }

    /* TOP BAR UNTUK PREVIEW DI BROWSER SEBELUM DI-PRINT */
    .no-print-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .toolbar-info h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #38bdf8;
    }
    .toolbar-info p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #cbd5e1;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .btn-print {
      background-color: #2563eb;
      color: #fff;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print:hover {
      background-color: #1d4ed8;
    }
    .btn-close {
      background-color: #475569;
      color: #fff;
      border: none;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-close:hover {
      background-color: #334155;
    }

    /* PRINT SHEET WRAPPER */
    .sheets-wrapper {
      max-width: 210mm;
      margin: 20px auto;
      background: transparent;
    }

    .sheet-page {
      background: #ffffff;
      padding: 10mm 12mm 8mm 12mm;
      margin-bottom: 20px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      position: relative;
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }

    /* KOP SURAT */
    .header-kop {
      text-align: center;
      margin-bottom: 8px;
    }
    .header-kop h3 {
      margin: 0;
      font-size: 10pt;
      font-weight: normal;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-kop h2 {
      margin: 2px 0;
      font-size: 13.5pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000;
    }
    .header-kop p {
      margin: 1px 0 4px 0;
      font-size: 8.5pt;
      font-weight: bold;
      color: #222;
      letter-spacing: 0.4px;
    }
    .kop-line-double {
      border-top: 2.5px solid #000;
      border-bottom: 0.8px solid #000;
      height: 4px;
      margin-top: 4px;
    }

    /* TITLE */
    .title-container {
      text-align: center;
      margin: 8px 0 6px 0;
    }
    .title-container h4 {
      margin: 0;
      font-size: 11.5pt;
      font-weight: bold;
      text-transform: uppercase;
      text-decoration: underline;
      letter-spacing: 0.5px;
    }
    .title-container .subtitle {
      margin: 2px 0 0 0;
      font-size: 8.5pt;
      font-style: italic;
      color: #333;
    }
    .title-container .meta {
      margin: 1px 0 0 0;
      font-size: 8.5pt;
      font-weight: bold;
      color: #111;
    }

    /* INSTRUCTIONS */
    .instructions-box {
      border: 1px solid #777;
      background-color: #fafafa;
      padding: 5px 8px;
      margin-bottom: 8px;
      border-radius: 3px;
      font-size: 8pt;
      line-height: 1.35;
    }
    .instructions-box strong {
      display: block;
      margin-bottom: 2px;
      color: #0f172a;
    }
    .instructions-box ol {
      margin: 0;
      padding-left: 16px;
    }
    .instructions-box li {
      margin-bottom: 1px;
    }

    /* SECTION BANNER */
    .section-banner {
      background-color: #1e3a8a;
      color: #ffffff;
      font-family: Arial, sans-serif;
      font-size: 8.5pt;
      font-weight: bold;
      padding: 3.5px 7px;
      margin-top: 7px;
      margin-bottom: 5px;
      letter-spacing: 0.3px;
      border-radius: 2px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .section-banner.guru-wali-box {
      background-color: #047857;
    }

    /* IDENTITAS TABLE */
    .identity-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .identity-table td {
      border: 1px solid #555;
      padding: 3px 5px;
      font-size: 8.5pt;
      vertical-align: middle;
    }
    .identity-table td.label {
      background-color: #f1f5f9;
      font-weight: bold;
      width: 19%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .identity-table td.colon {
      width: 1.5%;
      text-align: center;
      padding: 3px 0;
    }
    .identity-table td.value {
      width: 29.5%;
    }

    /* PROMPT GROUPS */
    .prompt-group {
      margin-bottom: 6px;
    }
    .prompt-title {
      font-size: 8.5pt;
      font-weight: bold;
      color: #000;
      margin-bottom: 2px;
    }
    .prompt-hint {
      font-size: 7.5pt;
      color: #555;
      font-style: italic;
      margin-bottom: 2px;
    }
    .sub-prompt {
      font-size: 8pt;
      margin-top: 3px;
      color: #111;
    }

    /* RUANG TULIS TANGAN */
    .write-line {
      border-bottom: 1px dotted #555;
      height: 19px;
      width: 100%;
      margin-bottom: 2px;
    }

    /* CHECKBOX OPTIONS */
    .options-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin: 3px 0;
    }
    .options-row-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin: 3px 0;
    }
    .checkbox-option {
      display: inline-flex;
      align-items: center;
      font-size: 8pt;
      color: #000;
    }
    .box-check {
      display: inline-block;
      width: 11px;
      height: 11px;
      border: 1.2px solid #222;
      border-radius: 1.5px;
      margin-right: 4px;
      background: #fff;
    }

    /* MINI RUNNING HEADER */
    .running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #444;
      border-bottom: 1px solid #777;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }

    /* GURU WALI BOX */
    .guru-wali-container {
      border: 1px solid #047857;
      padding: 6px 8px;
      background-color: #f0fdf4;
      border-radius: 3px;
      margin-bottom: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .gw-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      font-size: 8pt;
      margin-bottom: 5px;
    }
    .gw-label {
      font-weight: bold;
      color: #065f46;
    }
    .gw-notes-label {
      font-size: 8pt;
      font-weight: bold;
      color: #065f46;
      margin-bottom: 2px;
    }
    .write-line-gw {
      border-bottom: 1px dotted #059669;
      height: 19px;
      width: 100%;
      margin-bottom: 2px;
    }

    /* SIGNATURE */
    .signature-section {
      margin-top: auto;
      padding-top: 6px;
    }
    .signature-intro {
      font-size: 8pt;
      font-style: italic;
      text-align: center;
      margin-bottom: 8px;
      color: #333;
    }
    .signature-table-3col {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
    }
    .signature-table-3col td {
      vertical-align: top;
      padding: 0 6px;
      font-size: 8.5pt;
    }
    .sig-role {
      margin: 0;
      font-weight: bold;
    }
    .sig-date {
      margin: 1px 0 0 0;
      font-size: 8pt;
      color: #222;
    }
    .sig-space {
      height: 48px;
    }
    .sig-space-small {
      height: 40px;
    }
    .sig-name {
      margin: 0;
      font-size: 9pt;
      text-decoration: underline;
    }
    .sig-nip {
      margin: 1px 0 0 0;
      font-size: 8pt;
      color: #333;
    }
    .principal-approval {
      text-align: center;
      margin-top: 10px;
      font-size: 8.5pt;
    }
    .principal-approval p {
      margin: 1px 0;
    }

    /* PAGE FOOTER NOTE */
    .page-footer-note {
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #777;
      margin-top: 6px;
      padding-top: 3px;
      border-top: 0.5px solid #ddd;
    }

    /* PRINT MEDIA RULES */
    @media print {
      body {
        background: #fff;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .sheets-wrapper {
        max-width: 100%;
        margin: 0;
      }
      .sheet-page {
        box-shadow: none;
        margin: 0;
        padding: 0;
        min-height: auto;
        page-break-after: always;
      }
      .sheet-page.sheet-page-2 {
        page-break-after: always;
      }
      .student-page-break {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>

  <!-- TOOLBAR DI BROWSER -->
  <div class="no-print-toolbar">
    <div class="toolbar-info">
      <h1>📄 Formulir Isian Identifikasi Awal Siswa Asuh (Siap Cetak / Unduh PDF)</h1>
      <p>Total ${effectiveStudents.length} formulir siswa siap diisi manual • Klik tombol cetak untuk menyimpan sebagai file PDF atau langsung mencetak ke printer.</p>
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="btn-print">
        🖨️ Cetak / Simpan PDF
      </button>
      <button onclick="window.close()" class="btn-close">
        ✕ Tutup
      </button>
    </div>
  </div>

  <!-- WRAPPER HALAMAN -->
  <div class="sheets-wrapper">
    ${studentPagesHtml}
  </div>

  <script>
    // Buka dialog print browser otomatis setelah DOM siap
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
  `;
}
