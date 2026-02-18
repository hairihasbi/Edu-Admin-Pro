
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
      Bertindaklah sebagai Ahli Kurikulum Senior. Tugas Anda adalah menyusun **MODUL AJAR DEEP LEARNING** yang sangat detail, rapi, dan profesional.
      
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

      **INSTRUKSI STRUKTUR OUTPUT (WAJIB IKUTI URUTAN INI):**
      Gunakan format Markdown. Gunakan Heading 3 (###) untuk Judul Bagian (A, B, C...). Jangan gunakan Heading 1 atau 2.

      **JUDUL DOKUMEN:**
      Tuliskan judul besar: "MODUL AJAR DEEP LEARNING" diikuti MATA PELAJARAN dan BAB.

      **A. IDENTITAS MODUL**
      Buatkan tabel atau list rapi berisi: Nama Sekolah, Nama Penyusun, Mata Pelajaran, Elemen (jika ada), Fase/Kelas/Semester, Alokasi Waktu, dan Tahun Pelajaran.

      **B. IDENTIFIKASI KESIAPAN PESERTA DIDIK**
      Tuliskan narasi analisis kesiapan siswa. Contoh: "Peserta didik pada umumnya telah memiliki pengetahuan dasar tentang... Minat peserta didik bervariasi... Kebutuhan belajar yang mungkin muncul adalah..."

      **C. KARAKTERISTIK MATERI PELAJARAN**
      Jelaskan karakteristik materi ${request.topic} secara konseptual dan prosedural. Jelaskan relevansinya dengan kehidupan nyata dan tingkat kesulitannya.

      **D. DIMENSI PROFIL LULUSAN PEMBELAJARAN**
      Sebutkan dimensi profil (seperti ${request.graduateProfileDimensions.join(', ')}) dan jelaskan perilaku singkat yang diharapkan.

      **E. DESAIN PEMBELAJARAN**
      Jelaskan pendekatan pembelajaran yang digunakan (${request.learningModel} dan ${request.learningStrategy}) serta bagaimana metode ini memfasilitasi Deep Learning.

      **F. CAPAIAN PEMBELAJARAN (CP)**
      Tuliskan Capaian Pembelajaran lengkap.

      **G. LINTAS DISIPLIN ILMU**
      Sebutkan minimal 2 disiplin ilmu lain (misal: Fisika, Seni, TIK, Bahasa) yang terintegrasi dengan materi ini.

      **H. TUJUAN PEMBELAJARAN**
      Rumuskan Tujuan Pembelajaran (TP) yang spesifik. Jika memungkinkan, bagi menjadi Pertemuan 1 dan Pertemuan 2 beserta Indikator Keberhasilannya.

      **I. TOPIK PEMBELAJARAN KONTEKSTUAL**
      Sebutkan 3 topik penerapan materi dalam kehidupan sehari-hari / isu terkini.

      **J. KERANGKA PEMBELAJARAN**
      Buatkan poin-poin untuk:
      1. Praktik Pedagogik (Model & Strategi).
      2. Kemitraan Pembelajaran (Lingkungan Sekolah, Luar Sekolah, Masyarakat).
      3. Lingkungan Belajar (Ruang Fisik, Virtual, Budaya Belajar).
      4. Pemanfaatan Digital (Aplikasi/Platform yang dipakai).

      **K. LANGKAH-LANGKAH PEMBELAJARAN**
      Uraikan langkah pembelajaran (Pendahuluan, Inti, Penutup). 
      **SANGAT PENTING:** Pada Kegiatan Inti, berikan label eksplisit **[MINDFUL]**, **[MEANINGFUL]**, dan **[JOYFUL]** pada aktivitas yang relevan.
      Contoh: "Guru mengajak siswa melakukan ice breaking... [JOYFUL]"

      **L. ASESMEN PEMBELAJARAN**
      1. Asesmen Awal (Diagnostik): Pertanyaan pemantik/kuis.
      2. Asesmen Proses (Formatif): Observasi/LKPD.
      3. Asesmen Akhir (Sumatif): Tes tertulis/Proyek.

      **TANDA TANGAN**
      Buatkan tempat tanda tangan untuk Mengetahui Kepala Sekolah dan Guru Mata Pelajaran (Gunakan Nama & NIP dari data input), sertakan Kota (${request.city}) dan Tanggal (${request.date}).

      Gunakan bahasa Indonesia yang baku, edukatif, dan format yang rapi (gunakan bold untuk penekanan).
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
        { key: "A. IDENTITAS", percent: 10, status: "Menyusun Identitas..." },
        { key: "B. IDENTIFIKASI", percent: 20, status: "Analisis Peserta Didik..." },
        { key: "F. CAPAIAN", percent: 40, status: "Menentukan CP & TP..." },
        { key: "J. KERANGKA", percent: 60, status: "Menyusun Kerangka..." },
        { key: "K. LANGKAH", percent: 75, status: "Merancang Aktivitas Deep Learning..." },
        { key: "L. ASESMEN", percent: 90, status: "Menyusun Asesmen..." },
        { key: "TANDA TANGAN", percent: 95, status: "Finalisasi Dokumen..." }
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
