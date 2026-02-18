
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
        curriculumText = "Kurikulum Merdeka berdasarkan Permendikdasmen No. 13 Tahun 2025";
    } else {
        curriculumText = "Kurikulum Berbasis Cinta berdasarkan KEPUTUSAN DIREKTUR JENDERAL PENDIDIKAN ISLAM NOMOR 6077 TAHUN 2025 TENTANG PANDUAN KURIKULUM BERBASIS CINTA";
    }

    let cpInstruction = "";
    if (request.cpMode === 'AUTO') {
        cpInstruction = `Tolong generate Capaian Pembelajaran (CP) secara otomatis yang sesuai dengan Keputusan Kepala BSKAP Nomor 046/H/KR/2025 untuk Mata Pelajaran ${request.subject} Fase ${request.phase}. Gunakan CP ini sebagai dasar tujuan pembelajaran.`;
    } else {
        cpInstruction = `Gunakan Capaian Pembelajaran (CP) berikut yang telah ditentukan oleh guru: "${request.cpManualContent}".`;
    }

    const prompt = `
      Bertindaklah sebagai ahli kurikulum dan konsultan pendidikan senior.
      Buatkan MODUL AJAR / RPP yang lengkap, detail, dan profesional.

      **I. IDENTITAS MODUL**
      Kurikulum: ${curriculumText}
      Nama Penyusun: ${request.teacherName} (NIP: ${request.teacherNip})
      Instansi: ${request.schoolName}
      Kepala Sekolah: ${request.headmasterName} (NIP: ${request.headmasterNip})
      Mata Pelajaran: ${request.subject}
      Kelas / Fase: ${request.grade} / ${request.phase}
      Semester: ${request.semester}
      Tahun Ajaran: ${request.academicYear}
      Alokasi Waktu: ${request.timeAllocation}
      Tempat, Tanggal: ${request.city}, ${request.date}

      **II. DETAIL PEMBELAJARAN**
      Topik / Materi Pokok: ${request.topic}
      Model Pembelajaran: ${request.learningModel}
      Strategi Pembelajaran: ${request.learningStrategy}
      Dimensi Profil Lulusan: ${request.graduateProfileDimensions.join(', ')}
      ${cpInstruction}

      **III. PENDEKATAN DEEP LEARNING (WAJIB)**
      Rancang kegiatan pembelajaran yang secara eksplisit memenuhi 3 aspek DEEP LEARNING:
      1. **MINDFUL (Berkesadaran)**: Guru hadir utuh, menyadari keberagaman/keunikan murid, dan membangun fokus.
      2. **MEANINGFUL (Bermakna)**: Pembelajaran relevan dengan kehidupan nyata, memberikan pengalaman mendalam (bukan sekadar hafal), dan berdampak.
      3. **JOYFUL (Menyenangkan)**: Suasana belajar yang positif, membahagiakan, dan memantik antusiasme murid.

      **IV. ASESMEN**
      Jenis Asesmen: ${request.assessmentType}
      Bentuk Instrumen: ${request.assessmentInstrument}

      **INSTRUKSI OUTPUT:**
      Buat dokumen dalam format Markdown yang rapi. Struktur dokumen harus mencakup:
      1.  **Informasi Umum** (Identitas Modul, Kompetensi Awal, Profil Pelajar, Sarana Prasarana, Target Peserta Didik).
      2.  **Komponen Inti**:
          *   Capaian Pembelajaran & Tujuan Pembelajaran.
          *   Pemahaman Bermakna & Pertanyaan Pemantik.
          *   **Kegiatan Pembelajaran**: Uraikan langkah-langkah (Pendahuluan, Inti, Penutup) secara spesifik sesuai Model ${request.learningModel}. 
              *   *PENTING*: Berikan label atau catatan kecil di dalam langkah pembelajaran yang menunjukkan penerapan aspek **[Mindful]**, **[Meaningful]**, dan **[Joyful]**.
      3.  **Asesmen**: Buat rubrik atau instrumen penilaian sederhana sesuai jenis ${request.assessmentType}.
      4.  **Lampiran**: Lembar Kerja Peserta Didik (LKPD) sederhana, Pengayaan & Remedial, Bahan Bacaan.
      5.  **Tanda Tangan**: Sertakan slot tanda tangan untuk Guru Mata Pelajaran dan Kepala Sekolah di bagian akhir.

      Gunakan bahasa Indonesia yang formal, edukatif, namun mengalir dan mudah dipahami.
    `;

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}` // AUTH HEADER ADDED
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

    // --- STREAM READER LOGIC ---
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullTextAccumulated = "";

    // Progress checkpoints mapping
    const progressMap = [
        { key: "I. IDENTITAS", percent: 10, status: "Menyusun Identitas Modul..." },
        { key: "II. DETAIL", percent: 25, status: "Merancang Detail & Tujuan..." },
        { key: "III. PENDEKATAN", percent: 45, status: "Integrasi Deep Learning..." },
        { key: "Kegiatan Pembelajaran", percent: 60, status: "Menulis Langkah Pembelajaran..." },
        { key: "IV. ASESMEN", percent: 80, status: "Membuat Instrumen Penilaian..." },
        { key: "Lampiran", percent: 90, status: "Menambahkan LKPD & Bahan Bacaan..." },
        { key: "Tanda Tangan", percent: 95, status: "Finalisasi Dokumen..." }
    ];
    let currentProgressIndex = -1;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullTextAccumulated += chunk;
        
        // Progress Detection Logic
        if (onProgress) {
            for (let i = currentProgressIndex + 1; i < progressMap.length; i++) {
                const checkpoint = progressMap[i];
                if (fullTextAccumulated.includes(checkpoint.key) || fullTextAccumulated.includes(checkpoint.key.toUpperCase())) {
                    onProgress(checkpoint.percent, checkpoint.status);
                    currentProgressIndex = i;
                }
            }
        }

        onUpdate(chunk);
    }
    
    // Finish
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
        'Authorization': `Bearer ${userId}` // AUTH HEADER ADDED
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
