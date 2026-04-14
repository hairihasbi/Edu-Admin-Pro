
export interface Question {
  id: number;
  text: string;
  options: {
    id: 'A' | 'B' | 'C';
    text: string;
    style: 'VISUAL' | 'AUDITORI' | 'KINESTETIK';
  }[];
}

export const VAK_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Ketika kamu menghafal sesuatu, kamu biasanya...",
    options: [
      { id: 'A', text: "Membayangkan tulisan atau gambar di dalam pikiran.", style: 'VISUAL' },
      { id: 'B', text: "Mengucapkan kata-katanya dengan keras atau berbisik.", style: 'AUDITORI' },
      { id: 'C', text: "Menulisnya berulang kali atau mempraktikkannya dengan gerakan.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 2,
    text: "Saat guru sedang menjelaskan materi di depan kelas, kamu lebih suka...",
    options: [
      { id: 'A', text: "Melihat papan tulis, slide presentasi, atau memperhatikan wajah guru.", style: 'VISUAL' },
      { id: 'B', text: "Mendengarkan suara guru dengan saksama tanpa harus melihatnya.", style: 'AUDITORI' },
      { id: 'C', text: "Mencoret-coret kertas atau memainkan alat tulis sambil mendengarkan.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 3,
    text: "Apa yang paling mengganggumu saat sedang konsentrasi belajar?",
    options: [
      { id: 'A', text: "Suasana ruangan yang berantakan atau banyak orang berlalu-lalang.", style: 'VISUAL' },
      { id: 'B', text: "Suara bising, obrolan orang lain, atau musik yang terlalu keras.", style: 'AUDITORI' },
      { id: 'C', text: "Kursi yang tidak nyaman atau suhu ruangan yang terlalu panas/dingin.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 4,
    text: "Ketika kamu sedang santai atau memiliki waktu luang, kamu lebih suka...",
    options: [
      { id: 'A', text: "Membaca buku, komik, atau menonton video/film.", style: 'VISUAL' },
      { id: 'B', text: "Mendengarkan musik, podcast, atau mengobrol dengan teman.", style: 'AUDITORI' },
      { id: 'C', text: "Berolahraga, membuat kerajinan tangan, atau jalan-jalan.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 5,
    text: "Jika kamu ingin merakit mainan atau benda baru, kamu biasanya...",
    options: [
      { id: 'A', text: "Membaca petunjuk gambar yang ada di buku panduan.", style: 'VISUAL' },
      { id: 'B', text: "Meminta seseorang menjelaskan cara merakitnya kepadamu.", style: 'AUDITORI' },
      { id: 'C', text: "Langsung mencoba merakitnya sendiri tanpa membaca petunjuk.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 6,
    text: "Saat kamu bercerita tentang suatu kejadian, kamu cenderung...",
    options: [
      { id: 'A', text: "Menggunakan banyak kata sifat untuk menggambarkan suasana/pemandangan.", style: 'VISUAL' },
      { id: 'B', text: "Menirukan suara atau ucapan orang yang ada dalam cerita tersebut.", style: 'AUDITORI' },
      { id: 'C', text: "Banyak menggunakan gerakan tangan atau bahasa tubuh.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 7,
    text: "Ketika kamu sedang menunggu antrean yang lama, kamu biasanya...",
    options: [
      { id: 'A', text: "Melihat-lihat sekeliling atau membaca tulisan yang ada di sekitar.", style: 'VISUAL' },
      { id: 'B', text: "Mengajak orang di sebelah mengobrol atau bersenandung kecil.", style: 'AUDITORI' },
      { id: 'C', text: "Tidak bisa diam, menggerakkan kaki, atau berjalan mondar-mandir.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 8,
    text: "Cara terbaik bagimu untuk mengingat nama seseorang adalah...",
    options: [
      { id: 'A', text: "Mengingat wajahnya atau bagaimana namanya tertulis.", style: 'VISUAL' },
      { id: 'B', text: "Mengingat suara atau cara dia memperkenalkan diri.", style: 'AUDITORI' },
      { id: 'C', text: "Mengingat jabat tangan atau aktivitas yang dilakukan bersamanya.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 9,
    text: "Saat kamu merasa senang, kamu biasanya menunjukkannya dengan...",
    options: [
      { id: 'A', text: "Tersenyum lebar atau wajah yang terlihat berseri-seri.", style: 'VISUAL' },
      { id: 'B', text: "Berteriak kegirangan atau menceritakannya kepada semua orang.", style: 'AUDITORI' },
      { id: 'C', text: "Melompat-lompat, bertepuk tangan, atau memeluk orang terdekat.", style: 'KINESTETIK' }
    ]
  },
  {
    id: 10,
    text: "Ketika kamu belajar hal baru, kamu merasa paling cepat paham jika...",
    options: [
      { id: 'A', text: "Melihat demonstrasi atau contoh nyata di depan mata.", style: 'VISUAL' },
      { id: 'B', text: "Mendiskusikan materi tersebut dalam kelompok atau tanya jawab.", style: 'AUDITORI' },
      { id: 'C', text: "Langsung mempraktikkannya sendiri (trial and error).", style: 'KINESTETIK' }
    ]
  }
];

export const calculateDominantStyle = (scores: { visual: number; auditory: number; kinesthetic: number }): 'VISUAL' | 'AUDITORI' | 'KINESTETIK' => {
  const { visual, auditory, kinesthetic } = scores;
  if (visual >= auditory && visual >= kinesthetic) return 'VISUAL';
  if (auditory >= visual && auditory >= kinesthetic) return 'AUDITORI';
  return 'KINESTETIK';
};

export const getStyleDescription = (style: 'VISUAL' | 'AUDITORI' | 'KINESTETIK') => {
  switch (style) {
    case 'VISUAL':
      return "Belajar lebih baik melalui penglihatan. Butuh media gambar, warna, dan peta konsep.";
    case 'AUDITORI':
      return "Belajar lebih baik melalui pendengaran. Butuh diskusi, penjelasan lisan, dan rekaman suara.";
    case 'KINESTETIK':
      return "Belajar lebih baik melalui aktivitas fisik. Butuh praktik langsung, simulasi, dan jeda untuk bergerak.";
    default:
      return "";
  }
};
