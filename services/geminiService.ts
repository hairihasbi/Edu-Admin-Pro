
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

      **INSTRUKSI STRUKTUR OUTPUT (WAJIB IKUTI PERSIS):**
      Gunakan format Markdown. Pastikan semua tabel dibuat rapi. Gunakan bahasa Indonesia formal dan pedagogis.

      --- MULAI DOKUMEN ---

      # MODUL AJAR KURIKULUM MERDEKA
      ## ${request.subject.toUpperCase()} - ${request.topic.toUpperCase()}

      ### I. INFORMASI UMUM

      **A. IDENTITAS MODUL**
      (Buat dalam TABEL rapi, isi rata kiri)
      | Komponen | Keterangan |
      | :--- | :--- |
      | Penyusun | ${request.teacherName} |
      | Instansi | ${request.schoolName} |
      | Tahun Pelajaran | ${request.academicYear} |
      | Jenjang Sekolah | SMA/SMK |
      | Mata Pelajaran | ${request.subject} |
      | Fase / Kelas | ${request.phase} / ${request.grade} |
      | Topik / Materi | ${request.topic} |
      | Alokasi Waktu | ${request.timeAllocation} |
      | Pendekatan | **Deep Learning** |

      **B. PENDEKATAN DEEP LEARNING**
      (Jelaskan implementasi Mindful, Meaningful, Joyful yang akan dilakukan dalam materi ini. Tulisan harus justify/rata kanan kiri dalam tabel).
      | Aspek | Deskripsi Implementasi |
      | :--- | :--- |
      | **MINDFUL** (Kesadaran Penuh) | (Jelaskan bagaimana guru membangun kesadaran dan fokus siswa pada materi ini) |
      | **MEANINGFUL** (Bermakna) | (Jelaskan relevansi materi ini dengan kehidupan nyata siswa agar pembelajaran bermakna) |
      | **JOYFUL** (Menyenangkan) | (Jelaskan strategi agar suasana belajar menjadi positif dan menyenangkan bagi siswa) |

      **C. KOMPETENSI AWAL**
      (Tuliskan 1-2 paragraf yang menjelaskan pengetahuan atau keterampilan prasyarat yang perlu dimiliki siswa sebelum mempelajari materi ini. Penulisan justify).

      **D. PROFIL LULUSAN YANG DIKEMBANGKAN**
      (Jelaskan secara rinci bagaimana dimensi: **${request.graduateProfileDimensions.join(', ')}** dikembangkan melalui materi ini secara berkesinambungan).

      **E. SARANA DAN PRASARANA**
      (Sebutkan alat, bahan, media, dan sumber belajar yang RELEVAN dengan materi "${request.topic}" dan model "${request.learningModel}").

      **F. TARGET PESERTA DIDIK**
      (Jelaskan target peserta didik, misal: Peserta didik reguler, dengan kesulitan belajar, dan pencapaian tinggi).

      **G. MODEL DAN STRATEGI PEMBELAJARAN**
      | Komponen | Deskripsi Rinci |
      | :--- | :--- |
      | **Model Pembelajaran** | **${request.learningModel}**.<br>(Jelaskan alasan pemilihan model ini dan bagaimana kecocokannya dengan materi). |
      | **Strategi Pembelajaran** | **${request.learningStrategy}**.<br>(Jelaskan langkah taktis operasional strategi ini dalam kelas). |

      ---

      ### II. KOMPONEN INTI

      **A. CAPAIAN PEMBELAJARAN (CP)**
      (Tuliskan narasi CP lengkap).

      **B. KEGIATAN PEMBELAJARAN**

      **1. KEGIATAN PENDAHULUAN (Durasi Total: 7 Menit)**
      (Pecah durasi 7 menit ke aktivitas di bawah. Kolom Deskripsi Detail harus rinci).
      | Waktu | Aktivitas | Deskripsi Detail Aktivitas | Deep Learning |
      | :--- | :--- | :--- | :--- |
      | ... menit | Pembukaan | Guru memberi salam, menyapa siswa... | Joyful |
      | ... menit | Mindful Moment | Teknik STOP / Bernafas sejenak... | Mindful |
      | ... menit | Apersepsi | Mengaitkan materi dengan... | Meaningful |
      | ... menit | Ice Breaker | (Aktivitas singkat semangat)... | Joyful |
      | ... menit | Tujuan | Menyampaikan tujuan pembelajaran... | Meaningful |

      **2. KEGIATAN INTI (Durasi Total: 31 Menit)**
      (Tabel ini memuat sintaks model **${request.learningModel}**. Pastikan total waktu 31 menit terbagi proporsional. Jelaskan aktivitas guru dan siswa secara detail).
      | Fase / Sintaks | Waktu | Aktivitas Guru | Aktivitas Siswa | Deep Learning |
      | :--- | :--- | :--- | :--- | :--- |
      | (Sintaks 1) | ... menit | (Detail...) | (Detail...) | ... |
      | (Sintaks 2) | ... menit | (Detail...) | (Detail...) | ... |
      | (Sintaks dst) | ... menit | (Detail...) | (Detail...) | ... |

      **3. KEGIATAN PENUTUP (Durasi Total: 7 Menit)**
      (Pecah durasi 7 menit ke aktivitas di bawah).
      | Waktu | Aktivitas | Deskripsi Detail Aktivitas | Deep Learning |
      | :--- | :--- | :--- | :--- |
      | ... menit | Refleksi | Guru mengajak siswa merefleksikan... | Mindful |
      | ... menit | Kesimpulan | Menyimpulkan poin utama materi... | Meaningful |
      | ... menit | Apresiasi & Doa | Memberikan penghargaan dan menutup... | Joyful |

      **C. ASESMEN**
      (Jelaskan detail asesmen sesuai jenis: ${request.assessmentType} dan instrumen: ${request.assessmentInstrument}).
      
      **1. Instrumen Asesmen**
      (Buatkan contoh/draft instrumen penilaiannya secara konkret di sini, bisa berupa rubrik tabel, daftar soal, atau lembar ceklis sesuai pilihan user).

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
        { key: "MODEL DAN STRATEGI", percent: 45, status: "Menentukan Strategi..." },
        { key: "KOMPONEN INTI", percent: 60, status: "Menyusun Kegiatan Inti..." },
        { key: "KEGIATAN PENUTUP", percent: 80, status: "Finalisasi Pembelajaran..." },
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
