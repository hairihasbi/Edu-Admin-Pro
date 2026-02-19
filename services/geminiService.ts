
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
        cpInstruction = `Tentukan Capaian Pembelajaran (CP) yang sesuai regulasi terbaru untuk mapel ${request.subject} Fase ${request.phase}.`;
    } else {
        cpInstruction = `Gunakan CP berikut: "${request.cpManualContent}".`;
    }

    const prompt = `
      Bertindaklah sebagai Ahli Kurikulum Senior dan Spesialis Deep Learning. Tugas Anda adalah menyusun **MODUL AJAR KURIKULUM MERDEKA** dengan struktur yang SANGAT SPESIFIK dan DETIL.

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
      (WAJIB: Tuliskan data di bawah ini dalam format teks daftar biasa (Plain Text List). JANGAN GUNAKAN TABEL. Gunakan format **Label:** Isi. Tulis baris demi baris tanpa spasi kosong/enter antar baris agar hemat tempat).

      **Penyusun:** ${request.teacherName}
      **NIP:** ${request.teacherNip}
      **Instansi:** ${request.schoolName}
      **Tahun Pelajaran:** ${request.academicYear}
      **Jenjang Sekolah:** SMA/SMK
      **Mata Pelajaran:** ${request.subject}
      **Fase / Kelas:** ${request.phase} / ${request.grade}
      **Topik / Materi:** ${request.topic}
      **Alokasi Waktu:** ${request.timeAllocation}
      **Pendekatan:** Deep Learning (Mindful, Meaningful, Joyful)
      **Model Pembelajaran:** ${request.learningModel}
      **Strategi:** ${request.learningStrategy}

      **B. PENDEKATAN DEEP LEARNING**
      (Jelaskan implementasi Mindful, Meaningful, Joyful dalam bentuk tabel).
      | Aspek | Deskripsi Implementasi Konkret |
      | :--- | :--- |
      | **MINDFUL** (Kesadaran Penuh) | (Jelaskan strategi fokus siswa...) |
      | **MEANINGFUL** (Bermakna) | (Jelaskan relevansi materi dengan kehidupan nyata...) |
      | **JOYFUL** (Menyenangkan) | (Jelaskan strategi suasana positif...) |

      **C. KOMPETENSI AWAL**
      (Tuliskan 1-2 paragraf singkat tentang prasyarat pengetahuan).

      **D. PROFIL PELAJAR PANCASILA**
      (Jelaskan dimensi: **${request.graduateProfileDimensions.join(', ')}**).

      **E. SARANA DAN PRASARANA**
      (Alat, bahan, media, dan sumber belajar).

      **F. TARGET PESERTA DIDIK**
      (Peserta didik reguler/tipikal).

      ---

      ### II. KOMPONEN INTI

      **A. CAPAIAN PEMBELAJARAN (CP)**
      (Tuliskan narasi CP lengkap).

      **B. TUJUAN PEMBELAJARAN**
      (Rumuskan tujuan pembelajaran yang spesifik berdasarkan CP dan Materi).

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

      **D. ASESMEN**
      Jenis: ${request.assessmentType}
      Instrumen: ${request.assessmentInstrument}
      
      **Lampiran Instrumen Asesmen:**
      (Buatkan contoh konkret instrumen penilaian di sini).

      <br><br>
      |   |   |
      | :---: | :---: |
      | Mengetahui,<br>Kepala Sekolah<br><br><br><br>**${request.headmasterName}**<br>NIP. ${request.headmasterNip} | ${request.city}, ${request.date}<br>Guru Mata Pelajaran<br><br><br><br>**${request.teacherName}**<br>NIP. ${request.teacherNip} |

      --- SELESAI ---
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
