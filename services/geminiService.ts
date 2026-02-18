
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
      Bertindaklah sebagai Ahli Kurikulum Senior. Tugas Anda adalah menyusun **MODUL AJAR / RPP** yang SANGAT RAPI, FORMAL, dan TERSTRUKTUR DALAM TABEL agar mudah dibaca dan dicetak.

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
      - Profil Pelajar: ${request.graduateProfileDimensions.join(', ')}
      - ${cpInstruction}

      **INSTRUKSI FORMAT OUTPUT (WAJIB IKUTI PERSIS):**
      Gunakan format Markdown. Bagian yang saya minta dalam **TABEL** wajib dibuat menggunakan sintaks tabel Markdown.

      --- MULAI DOKUMEN ---

      ## MODUL AJAR ${request.subject.toUpperCase()}
      ## ${request.topic.toUpperCase()}

      ### I. INFORMASI UMUM

      **A. IDENTITAS MODUL**
      (Buat dalam TABEL dengan 2 kolom: Atribut dan Keterangan)
      | Atribut | Keterangan |
      | :--- | :--- |
      | Penyusun | ${request.teacherName} |
      | Instansi | ${request.schoolName} |
      | Tahun Penyusunan | ${new Date().getFullYear()} |
      | Jenjang Sekolah | SMA/SMK |
      | Mata Pelajaran | ${request.subject} |
      | Fase / Kelas | ${request.phase} / ${request.grade} |
      | Bab / Tema | ${request.topic} |
      | Alokasi Waktu | ${request.timeAllocation} |

      **B. KOMPETENSI AWAL**
      (Tuliskan paragraf singkat tentang kompetensi yang perlu dimiliki siswa sebelum mempelajari materi ini)

      **C. PROFIL PELAJAR PANCASILA**
      (Sebutkan dimensi: ${request.graduateProfileDimensions.join(', ')} dan jelaskan singkat penerapannya)

      **D. SARANA DAN PRASARANA**
      *   Media: (Laptop, LCD, LKPD, dll)
      *   Sumber Belajar: (Buku Paket, Youtube, dll)

      **E. TARGET PESERTA DIDIK**
      *   Peserta didik reguler/tipikal.
      *   Peserta didik dengan kesulitan belajar.
      *   Peserta didik dengan pencapaian tinggi.

      **F. MODEL PEMBELAJARAN**
      (Buat dalam TABEL 1 baris)
      | Model Pembelajaran | Metode |
      | :--- | :--- |
      | ${request.learningModel} | ${request.learningStrategy} |

      ---

      ### II. KOMPONEN INTI

      **A. TUJUAN PEMBELAJARAN**
      1.  (Rumuskan TP 1)
      2.  (Rumuskan TP 2)

      **B. PEMAHAMAN BERMAKNA**
      (Jelaskan manfaat pembelajaran ini dalam kehidupan nyata)

      **C. PERTANYAAN PEMANTIK**
      *   (Tuliskan 2-3 pertanyaan pemantik yang menarik minat siswa)

      **D. KEGIATAN PEMBELAJARAN**
      (Bagian ini WAJIB menggunakan TABEL 3 Kolom: Tahap, Kegiatan, Alokasi Waktu. Sertakan tag **[Deep Learning]** atau **[Diferensiasi]** pada kegiatan yang relevan)

      | Tahap | Kegiatan Pembelajaran | Waktu |
      | :--- | :--- | :--- |
      | **Pendahuluan** | 1. Guru membuka salam dan doa bersama.<br>2. Guru mengecek kehadiran.<br>3. Apersepsi: ... | 15 Menit |
      | **Inti** | **Langkah 1: Orientasi Masalah**<br>...<br><br>**Langkah 2: Organisasi Belajar**<br>... | 60 Menit |
      | **Penutup** | 1. Peserta didik menyimpulkan materi.<br>2. Guru memberikan refleksi dan apresiasi.<br>3. Doa penutup. | 15 Menit |

      **E. ASESMEN**
      (Buat dalam TABEL)
      | Jenis Asesmen | Bentuk | Instrumen |
      | :--- | :--- | :--- |
      | Diagnostik | Lisan / Kuis | Pertanyaan Pemantik |
      | Formatif | Observasi / LKPD | Rubrik Penilaian Sikap & Keterampilan |
      | Sumatif | Tes Tertulis | Soal Pilihan Ganda / Essay |

      **F. PENGAYAAN DAN REMEDIAL**
      *   **Pengayaan:** (Untuk siswa nilai di atas rata-rata)
      *   **Remedial:** (Untuk siswa nilai di bawah rata-rata)

      ---

      ### III. LAMPIRAN

      **A. LEMBAR KERJA PESERTA DIDIK (LKPD)**
      (Berikan contoh judul atau kerangka LKPD singkat)

      **B. BAHAN BACAAN GURU & PESERTA DIDIK**
      (Daftar referensi)

      **C. GLOSARIUM**
      (Daftar istilah penting)

      **D. DAFTAR PUSTAKA**
      (Daftar pustaka format APA)

      <br><br>
      (Buat area tanda tangan dalam TABEL TANPA GARIS atau format rapi rata kanan kiri)
      
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

    // Mapping progress yang lebih akurat sesuai struktur A-L
    const progressMap = [
        { key: "INFORMASI UMUM", percent: 10, status: "Menyusun Identitas..." },
        { key: "KOMPETENSI AWAL", percent: 20, status: "Analisis Kompetensi..." },
        { key: "KOMPONEN INTI", percent: 40, status: "Merancang Tujuan & Pemahaman..." },
        { key: "KEGIATAN PEMBELAJARAN", percent: 60, status: "Menyusun Langkah Kegiatan..." },
        { key: "ASESMEN", percent: 80, status: "Membuat Instrumen Penilaian..." },
        { key: "LAMPIRAN", percent: 90, status: "Menambahkan Lampiran..." },
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
