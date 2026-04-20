
import { LessonPlanRequest } from "../types";

export const generateLessonPlan = async (
  request: LessonPlanRequest, 
  userId: string, // UserId is passed, we use it for Auth header too
  onUpdate: (chunk: string) => void,
  onProgress?: (percent: number, status: string) => void
): Promise<void> => {
  try {
    let curriculumText = "";
    if (request.curriculumType === 'MERDEKA') {
        curriculumText = "Kurikulum Merdeka (Permendikdasmen No. 13 Tahun 2025)";
    } else {
        curriculumText = "Kurikulum Berbasis Cinta (Kepdirjen Pendis No. 6077 Th 2025)";
    }

    let cpInstruction = "";
    if (request.cpMode === 'AUTO') {
        cpInstruction = `Tentukan Capaian Pembelajaran (CP) secara rinci untuk mapel ${request.subject} Fase ${request.phase}. PENTING: Langsung jelaskan detail CP tanpa menuliskan kalimat pembuka 'Berdasarkan Keputusan Kepala BSKAP...' atau nomor regulasi.`;
    } else {
        cpInstruction = `Gunakan CP berikut: "${request.cpManualContent}".`;
    }

    let eeatInstruction = "";
    if (request.useEEAT) {
        eeatInstruction = `
        **INSTRUKSI KHUSUS E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness):**
        1. **Experience (Pengalaman Nyata):**
           - Sertakan "Catatan Lapangan" atau "Tips Manajemen Kelas" berdasarkan pengalaman riil guru.
           - Tambahkan bagian "Antisipasi Respon Siswa" (misal: "Siswa mungkin kesulitan di bagian X, maka guru perlu Y").
        2. **Expertise (Keahlian Pedagogis):**
           - Jelaskan *mengapa* strategi ini dipilih (rasionalisasi pedagogis singkat).
           - Gunakan istilah teknis pendidikan dengan tepat (scaffolding, diferensiasi konten/proses/produk, asesmen diagnostik).
        3. **Authoritativeness (Otoritas/Referensi):**
           - Wajib menyertakan minimal 2 referensi kredibel (Buku Teks Kemendikbud, Jurnal Pendidikan, atau Teori Belajar relevan) di bagian Daftar Pustaka.
        4. **Trustworthiness (Kepercayaan/Akurasi):**
           - Pastikan semua fakta materi akurat. Jika menggunakan data, sebutkan sumbernya.
           - Hindari bias. Sajikan materi secara objektif.
        `;
    }

    const prompt = `
      Bertindaklah sebagai Ahli Kurikulum Senior dan Spesialis Deep Learning. Tugas Anda adalah menyusun **MODUL AJAR KURIKULUM MERDEKA** dengan struktur yang SANGAT SPESIFIK dan DETIL.
      
      ${eeatInstruction}

      **DATA INPUT:**
      - Guru: ${request.teacherName} (NIP: ${request.teacherNip})
      - Sekolah: ${request.schoolName}
      - Kepala Sekolah: ${request.headmasterName} (NIP: ${request.headmasterNip})
      - Mapel: ${request.subject}
      - Fase/Kelas: ${request.phase} / ${request.grade}
      - Materi/Bab: ${request.topic}
      - Alokasi Waktu: ${request.timeAllocation}
      - Semester/Thn: ${request.semester} / ${request.academicYear}
      - Model: ${request.learningModel}
      - Strategi: ${request.learningStrategy}
      - Profil Pelajar: ${request.graduateProfileDimensions.join(', ')}
      - ${cpInstruction}
      - Asesmen: ${request.assessmentType} (${request.assessmentInstrument})

      **INSTRUKSI FORMAT MATEMATIKA & SAINS (PENTING):**
      - Jika materi melibatkan rumus matematika, fisika, atau kimia, **WAJIB** menuliskannya menggunakan format **LaTeX**.
      - Gunakan tanda dollar tunggal \`$ ... $\` untuk rumus inline (dalam kalimat). Contoh: Energi adalah $E=mc^2$.
      - Gunakan tanda dollar ganda \`$$ ... $$\` untuk rumus blok (baris sendiri). Contoh: $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$
      - Pastikan penulisan LaTeX valid dan tidak terpotong.

      **INSTRUKSI STRUKTUR OUTPUT (WAJIB IKUTI PERSIS):**
      Gunakan format Markdown standar.
      Gunakan bahasa Indonesia formal dan pedagogis.

      --- MULAI DOKUMEN ---

      # MODUL AJAR KURIKULUM MERDEKA

      ### I. INFORMASI UMUM

      **A. IDENTITAS MODUL**
      (Gunakan format HTML berikut persis untuk membuat tampilan sejajar rapi seperti menggunakan Tab. JANGAN GUNAKAN TABEL).
      
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Penyusun</span>: ${request.teacherName}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">NIP</span>: ${request.teacherNip}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Instansi</span>: ${request.schoolName}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Tahun Pelajaran</span>: ${request.academicYear}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Jenjang Sekolah</span>: SMA/SMK</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Mata Pelajaran</span>: ${request.subject}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Fase / Kelas</span>: ${request.phase} / ${request.grade}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Topik / Materi</span>: ${request.topic}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Alokasi Waktu</span>: ${request.timeAllocation}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Pendekatan</span>: Deep Learning (Mindful, Meaningful, Joyful)</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Model Pembelajaran</span>: ${request.learningModel}</div>
        <div><span style="display:inline-block; min-width:180px; font-weight:bold;">Strategi</span>: ${request.learningStrategy}</div>
      </div>

      **B. PENDEKATAN DEEP LEARNING**
      (Jelaskan implementasi Mindful, Meaningful, Joyful dalam bentuk tabel).
      | Aspek | Deskripsi Implementasi Konkret |
      | :--- | :--- |
      | **MINDFUL** (Kesadaran Penuh) | (Jelaskan strategi fokus siswa...) |
      | **MEANINGFUL** (Bermakna) | (Jelaskan relevansi materi dengan kehidupan nyata...) |
      | **JOYFUL** (Menyenangkan) | (Jelaskan strategi suasana positif...) |

      **C. KOMPETENSI AWAL**
      (Tuliskan 1-2 paragraf singkat tentang prasyarat pengetahuan).

      **D. DIMENSI PROFIL LULUSAN**
      (Jelaskan dimensi: **${request.graduateProfileDimensions.join(', ')}**).

      **E. SARANA DAN PRASARANA**
      (Alat, bahan, media, dan sumber belajar).

      **F. TARGET PESERTA DIDIK**
      (Peserta didik reguler/tipikal).
      
      ${request.useEEAT ? `
      **G. CATATAN PEDAGOGIS (EEAT - Experience & Expertise)**
      - **Rasionalisasi Strategi:** (Mengapa model ${request.learningModel} dipilih untuk materi ini?)
      - **Antisipasi Tantangan:** (Prediksi kesulitan siswa dan mitigasinya).
      ` : ''}

      ---

      ### II. KOMPONEN INTI

      **A. CAPAIAN PEMBELAJARAN (CP)**
      1. **Narasi CP**: (Tuliskan narasi CP lengkap dan rinci sesuai fase. JANGAN menyertakan kalimat "Berdasarkan Keputusan..." atau nomor regulasi. Langsung ke isi materi).
      2. **Indikator Pencapaian**: (WAJIB: Tuliskan penjelasan rinci mengenai indikator pencapaian yang digunakan untuk mencapai CP ini. Jelaskan kriteria keberhasilan yang spesifik dan terukur).

      **B. TUJUAN PEMBELAJARAN (TP)**
      1. **Tujuan Pembelajaran**: (Rumuskan tujuan yang spesifik, terukur, dan relevan dengan materi).
      2. **Indikator Ketercapaian Tujuan Pembelajaran (IKTP/KKTP)**: 
         (Jabarkan indikator keberhasilan secara rinci. Apa bukti spesifik siswa telah mencapai tujuan? Gunakan kata kerja operasional).
         - Indikator 1: ...
         - Indikator 2: ...
         - Indikator 3: ...

      **C. KEGIATAN PEMBELAJARAN**

      **1. PENDAHULUAN (7 Menit)**
      | Waktu | Aktivitas Guru & Siswa | Unsur Deep Learning |
      | :--- | :--- | :--- |
      | ... | ... | ... |

      **2. KEGIATAN INTI (31 Menit - Model ${request.learningModel})**
      (Pastikan sintaks model terlihat jelas di kolom Aktivitas).
      | Sintaks / Fase | Aktivitas Pembelajaran (Guru & Siswa) | Deep Learning |
      | :--- | :--- | :--- |
      | ... | ... | ... |

      **3. PENUTUP (7 Menit)**
      | Waktu | Aktivitas Guru & Siswa | Unsur Deep Learning |
      | :--- | :--- | :--- |
      | ... | ... | ... |

      ${request.useEEAT ? `
      **4. REFLEKSI & TINDAK LANJUT (EEAT)**
      - **Refleksi Guru:** (Pertanyaan kunci untuk evaluasi diri).
      - **Refleksi Siswa:** (Pertanyaan pemantik untuk siswa).
      ` : ''}

      **D. ASESMEN**
      Jenis: ${request.assessmentType}
      Instrumen: ${request.assessmentInstrument}
      
      **Lampiran Instrumen Asesmen:**
      (Buatkan contoh konkret instrumen penilaian di sini).

      ${request.useEEAT ? `
      **E. DAFTAR PUSTAKA (Authoritativeness)**
      1. (Referensi 1 - Buku Teks/Jurnal)
      2. (Referensi 2 - Sumber Digital Kredibel)
      ` : ''}

      <br><br>
      | Kepala Sekolah<br><br><br><br>**${request.headmasterName}**<br>NIP. ${request.headmasterNip} | Mengetahui,<br>${request.city}, ${request.date}<br>Guru Mata Pelajaran<br><br><br><br>**${request.teacherName}**<br>NIP. ${request.teacherNip} |
      | :---: | :---: |

      --- SELESAI ---
    `;

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}`
      },
      body: JSON.stringify({ 
          prompt, 
          userId,
          useSearch: request.useSearch || false // Activate Fact Check if requested
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
          throw new Error("Akses ditolak. Silakan login ulang.");
      }
      throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }

    if (!response.body) throw new Error("ReadableStream not supported");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullTextAccumulated = "";

    const progressMap = [
        { key: "INFORMASI UMUM", percent: 15, status: "Menyusun Identitas & Pendekatan..." },
        { key: "KOMPETENSI AWAL", percent: 30, status: "Analisis Kompetensi & Profil..." },
        { key: "KEGIATAN INTI", percent: 60, status: "Menyusun Kegiatan Inti..." },
        { key: "ASESMEN", percent: 90, status: "Membuat Instrumen Penilaian..." },
        { key: "Kepala Sekolah", percent: 95, status: "Finalisasi Dokumen..." }
    ];
    let currentProgressIndex = -1;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullTextAccumulated += chunk;
        
        if (onProgress) {
            for (let i = currentProgressIndex + 1; i < progressMap.length; i++) {
                const checkpoint = progressMap[i];
                if (fullTextAccumulated.includes(checkpoint.key)) {
                    onProgress(checkpoint.percent, checkpoint.status);
                    currentProgressIndex = i;
                }
            }
        }

        onUpdate(chunk);
    }
    
    if (onProgress) onProgress(100, "Selesai!");

  } catch (error: any) {
    console.error("Error generating lesson plan:", error);
    onUpdate(`\n\n[ERROR SYSTEM]: ${error.message || "Gagal menghubungi layanan AI."}`);
  }
};

export const generateAnnouncement = async (topic: string, userId?: string): Promise<string> => {
  try {
    const prompt = `
      Buatkan draf pengumuman resmi sekolah untuk topik: "${topic}".
      Gunakan nada yang sopan, formal, dan jelas.
      Sertakan placeholder untuk Tanggal, Tempat, dan Tanda Tangan Kepala Sekolah jika relevan.
    `;

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}` 
      },
      body: JSON.stringify({ prompt, userId }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while(true) {
        const {done, value} = await reader.read();
        if(done) break;
        result += decoder.decode(value, {stream: true});
    }
    
    return result;
  } catch (error) {
    console.error("Error generating announcement:", error);
    return "Terjadi kesalahan sistem.";
  }
};
