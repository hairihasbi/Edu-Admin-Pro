export interface DeepLearningSupervisionItem {
  id: string;
  groupLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  component: string;
  indicator: string;
  question: string;
  isFirstInGroup?: boolean;
  groupRowSpan?: number;
}

export const DEEP_LEARNING_GROUPS = [
  { letter: 'A', name: 'Identifikasi Peserta Didik', count: 2 },
  { letter: 'B', name: 'Analisis Materi Pelajaran', count: 2 },
  { letter: 'C', name: 'Dimensi Profil Lulusan (DPL)', count: 1 },
  { letter: 'D', name: 'Desain Pembelajaran', count: 7 },
  { letter: 'E', name: 'Perancangan Pengalaman Belajar', count: 2 },
  { letter: 'F', name: 'Asesmen Pembelajaran', count: 4 },
] as const;

export const DEEP_LEARNING_SUPERVISION_ITEMS: DeepLearningSupervisionItem[] = [
  // A. Identifikasi Peserta Didik
  {
    id: 'A1',
    groupLetter: 'A',
    component: 'Identifikasi Peserta Didik',
    indicator: 'Guru melakukan analisis kesiapan belajar',
    question: 'Apakah guru telah mengidentifikasi pengetahuan awal, minat, latar belakang, dan kebutuhan belajar peserta didik?',
    isFirstInGroup: true,
    groupRowSpan: 2
  },
  {
    id: 'A2',
    groupLetter: 'A',
    component: 'Identifikasi Peserta Didik',
    indicator: 'Analisis kebutuhan belajar lengkap',
    question: 'Apakah hasil identifikasi tertulis dan digunakan untuk perencanaan?'
  },

  // B. Analisis Materi Pelajaran
  {
    id: 'B1',
    groupLetter: 'B',
    component: 'Analisis Materi Pelajaran',
    indicator: 'Relevansi materi',
    question: 'Apakah materi yang dipilih relevan dengan kehidupan nyata peserta didik?',
    isFirstInGroup: true,
    groupRowSpan: 2
  },
  {
    id: 'B2',
    groupLetter: 'B',
    component: 'Analisis Materi Pelajaran',
    indicator: 'Tingkat kesulitan dan struktur materi',
    question: 'Apakah materi dianalisis dari segi jenis pengetahuan, tingkat kesulitan, dan integrasi nilai/karakter?'
  },

  // C. Dimensi Profil Lulusan (DPL)
  {
    id: 'C1',
    groupLetter: 'C',
    component: 'Dimensi Profil Lulusan (DPL)',
    indicator: 'Pemilihan DPL yang tepat',
    question: 'Apakah guru telah memilih dimensi profil lulusan sesuai tujuan pembelajaran?',
    isFirstInGroup: true,
    groupRowSpan: 1
  },

  // D. Desain Pembelajaran
  {
    id: 'D1',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Perumusan capaian pembelajaran',
    question: 'Apakah capaian pembelajaran jelas, terukur, dan sesuai fase?',
    isFirstInGroup: true,
    groupRowSpan: 7
  },
  {
    id: 'D2',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Penentuan topik pembelajaran',
    question: 'Apakah topik kontekstual, lintas disiplin, dan relevan?'
  },
  {
    id: 'D3',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Tujuan pembelajaran',
    question: 'Apakah tujuan mencakup subjek, keterampilan/pengetahuan/sikap, konteks, dan indikator keberhasilan?'
  },
  {
    id: 'D4',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Praktik pedagogis',
    question: 'Apakah guru memilih model/metode sesuai prinsip berkesadaran, bermakna, menggembirakan?'
  },
  {
    id: 'D5',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Kemitraan pembelajaran',
    question: 'Apakah ada mitra (internal/eksternal) yang dilibatkan?'
  },
  {
    id: 'D6',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Lingkungan pembelajaran',
    question: 'Apakah lingkungan fisik, virtual, dan budaya belajar telah dirancang mendukung pembelajaran mendalam?'
  },
  {
    id: 'D7',
    groupLetter: 'D',
    component: 'Desain Pembelajaran',
    indicator: 'Pemanfaatan digital',
    question: 'Apakah teknologi digunakan untuk perencanaan, pelaksanaan, dan asesmen?'
  },

  // E. Perancangan Pengalaman Belajar
  {
    id: 'E1',
    groupLetter: 'E',
    component: 'Perancangan Pengalaman Belajar',
    indicator: 'Tahapan pembelajaran',
    question: 'Apakah langkah awal, inti, penutup memuat pengalaman memahami, mengaplikasi, dan merefleksi?',
    isFirstInGroup: true,
    groupRowSpan: 2
  },
  {
    id: 'E2',
    groupLetter: 'E',
    component: 'Perancangan Pengalaman Belajar',
    indicator: 'Integrasi prinsip PM',
    question: 'Apakah prinsip berkesadaran, bermakna, menggembirakan terlihat di setiap tahapan?'
  },

  // F. Asesmen Pembelajaran
  {
    id: 'F1',
    groupLetter: 'F',
    component: 'Asesmen Pembelajaran',
    indicator: 'Asesmen awal',
    question: 'Apakah ada asesmen awal (diagnostik) sesuai tujuan pembelajaran?',
    isFirstInGroup: true,
    groupRowSpan: 4
  },
  {
    id: 'F2',
    groupLetter: 'F',
    component: 'Asesmen Pembelajaran',
    indicator: 'Asesmen proses',
    question: 'Apakah asesmen proses dirancang untuk perbaikan pembelajaran (assessment for learning)?'
  },
  {
    id: 'F3',
    groupLetter: 'F',
    component: 'Asesmen Pembelajaran',
    indicator: 'Asesmen akhir',
    question: 'Apakah asesmen akhir mengukur capaian secara autentik dan holistik?'
  },
  {
    id: 'F4',
    groupLetter: 'F',
    component: 'Asesmen Pembelajaran',
    indicator: 'Keberagaman teknik asesmen',
    question: 'Apakah guru menggunakan kombinasi assessment as, for, dan of learning?'
  }
];

export const SCORE_DESCRIPTIONS: Record<number, string> = {
  1: 'Tidak ada',
  2: 'Ada tetapi belum lengkap',
  3: 'Lengkap namun belum optimal',
  4: 'Lengkap dan sangat baik'
};

export const FOLLOW_UP_QUESTIONS = [
  {
    key: 'weakAspects' as const,
    num: 1,
    title: 'Penguatan pada Aspek yang Lemah',
    placeholder: 'Tuliskan catatan analisis dan penguatan pada aspek yang masih lemah...'
  },
  {
    key: 'shortTermStrategy' as const,
    num: 2,
    title: 'Strategi Perbaikan Jangka Pendek (1–4 Minggu)',
    placeholder: 'Tuliskan langkah konkret dan target perbaikan dalam kurun waktu 1-4 minggu ke depan...'
  },
  {
    key: 'longTermStrategy' as const,
    num: 3,
    title: 'Strategi Pengembangan Jangka Panjang (Satu Semester/Tahun)',
    placeholder: 'Tuliskan rencana pengembangan profesional dan tindak lanjut berkelanjutan satu semester/tahun...'
  },
  {
    key: 'resourcesNeeded' as const,
    num: 4,
    title: 'Sumber Daya/ Dukungan yang Dibutuhkan',
    placeholder: 'Tuliskan fasilitas, pelatihan, atau pendampingan yang dibutuhkan guru...'
  }
];

export function calculateDeepLearningScore(scores: Record<string, number>) {
  const totalRealScore = DEEP_LEARNING_SUPERVISION_ITEMS.reduce((sum, item) => {
    const val = scores[item.id] ?? scores[item.question] ?? 0;
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);

  const maxScore = DEEP_LEARNING_SUPERVISION_ITEMS.length * 4; // 18 * 4 = 72
  const finalScore = maxScore > 0 ? (totalRealScore / maxScore) * 100 : 0;
  const scaledTo80 = maxScore > 0 ? (totalRealScore / maxScore) * 80 : 0;

  let readinessCategory: 'Sangat Kurang' | 'Kurang' | 'Baik' | 'Sangat Baik' = 'Sangat Kurang';
  if (finalScore >= 86) {
    readinessCategory = 'Sangat Baik';
  } else if (finalScore >= 70) {
    readinessCategory = 'Baik';
  } else if (finalScore >= 55) {
    readinessCategory = 'Kurang';
  } else {
    readinessCategory = 'Sangat Kurang';
  }

  return {
    totalRealScore,
    maxScore,
    scaledTo80,
    finalScore,
    readinessCategory,
    predicate: readinessCategory
  };
}
