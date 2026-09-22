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

export const DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS: DeepLearningSupervisionItem[] = [
  // A. Keterlaksanaan Tahapan Pembelajaran
  {
    id: 'IMP_A1',
    groupLetter: 'A',
    component: 'Keterlaksanaan Tahapan Pembelajaran',
    indicator: 'Tahap Awal',
    question: 'Apakah guru membuka pembelajaran dengan orientasi, apersepsi, dan motivasi sesuai prinsip berkesadaran, bermakna, dan menggembirakan?',
    isFirstInGroup: true,
    groupRowSpan: 5
  },
  {
    id: 'IMP_A2',
    groupLetter: 'A',
    component: 'Keterlaksanaan Tahapan Pembelajaran',
    indicator: 'Tahap Inti – Memahami',
    question: 'Apakah guru memfasilitasi siswa untuk memahami konsep melalui aktivitas yang relevan dan kontekstual?'
  },
  {
    id: 'IMP_A3',
    groupLetter: 'A',
    component: 'Keterlaksanaan Tahapan Pembelajaran',
    indicator: 'Tahap Inti - Mengaplikasi',
    question: 'Apakah guru memfasilitasi siswa mengaplikasikan konsep pada situasi nyata atau proyek pembelajaran?'
  },
  {
    id: 'IMP_A4',
    groupLetter: 'A',
    component: 'Keterlaksanaan Tahapan Pembelajaran',
    indicator: 'Tahap Inti – Merefleksi',
    question: 'Apakah guru memfasilitasi siswa merefleksikan pembelajaran yang telah dilakukan?'
  },
  {
    id: 'IMP_A5',
    groupLetter: 'A',
    component: 'Keterlaksanaan Tahapan Pembelajaran',
    indicator: 'Tahap Penutup',
    question: 'Apakah guru memberikan umpan balik konstruktif, menyimpulkan pembelajaran, dan melibatkan siswa dalam perencanaan pembelajaran selanjutnya?'
  },

  // B. Penerapan Prinsip Pembelajaran Mendalam
  {
    id: 'IMP_B1',
    groupLetter: 'B',
    component: 'Penerapan Prinsip Pembelajaran Mendalam',
    indicator: 'Prinsip Berkesadaran',
    question: 'Apakah guru menunjukkan sikap sadar tujuan dan proses pembelajaran serta membimbing siswa untuk menyadari pembelajarannya?',
    isFirstInGroup: true,
    groupRowSpan: 3
  },
  {
    id: 'IMP_B2',
    groupLetter: 'B',
    component: 'Penerapan Prinsip Pembelajaran Mendalam',
    indicator: 'Prinsip Bermakna',
    question: 'Apakah pembelajaran mengaitkan materi dengan kehidupan nyata siswa sehingga menumbuhkan relevansi?'
  },
  {
    id: 'IMP_B3',
    groupLetter: 'B',
    component: 'Penerapan Prinsip Pembelajaran Mendalam',
    indicator: 'Prinsip Menggembirakan',
    question: 'Apakah pembelajaran menciptakan suasana menyenangkan dan memotivasi siswa untuk aktif?'
  },

  // C. Pengelolaan Kelas dan Lingkungan Belajar
  {
    id: 'IMP_C1',
    groupLetter: 'C',
    component: 'Pengelolaan Kelas dan Lingkungan Belajar',
    indicator: 'Lingkungan Fisik',
    question: 'Apakah lingkungan fisik kelas mendukung pembelajaran mendalam (penataan ruang, alat, media)?',
    isFirstInGroup: true,
    groupRowSpan: 3
  },
  {
    id: 'IMP_C2',
    groupLetter: 'C',
    component: 'Pengelolaan Kelas dan Lingkungan Belajar',
    indicator: 'Lingkungan Virtual',
    question: 'Apakah guru memanfaatkan media/teknologi digital secara efektif untuk mendukung pembelajaran?'
  },
  {
    id: 'IMP_C3',
    groupLetter: 'C',
    component: 'Pengelolaan Kelas dan Lingkungan Belajar',
    indicator: 'Budaya Belajar',
    question: 'Apakah tercipta budaya belajar kolaboratif, kritis, dan reflektif di kelas?'
  },

  // D. Pelibatan Siswa
  {
    id: 'IMP_D1',
    groupLetter: 'D',
    component: 'Pelibatan Siswa',
    indicator: 'Partisipasi Aktif',
    question: 'Apakah siswa aktif bertanya, berdiskusi, mengemukakan pendapat, dan terlibat dalam pembelajaran?',
    isFirstInGroup: true,
    groupRowSpan: 2
  },
  {
    id: 'IMP_D2',
    groupLetter: 'D',
    component: 'Pelibatan Siswa',
    indicator: 'Kolaborasi',
    question: 'Apakah siswa bekerja sama secara efektif dalam kelompok dan dengan pihak luar jika relevan?'
  },

  // E. Pelaksanaan Asesmen
  {
    id: 'IMP_E1',
    groupLetter: 'E',
    component: 'Pelaksanaan Asesmen',
    indicator: 'Asesmen Awal',
    question: 'Apakah guru melaksanakan asesmen awal sesuai rencana untuk mengetahui kesiapan belajar siswa?',
    isFirstInGroup: true,
    groupRowSpan: 4
  },
  {
    id: 'IMP_E2',
    groupLetter: 'E',
    component: 'Pelaksanaan Asesmen',
    indicator: 'Asesmen Proses',
    question: 'Apakah guru melakukan asesmen formatif dan memberikan umpan balik selama pembelajaran berlangsung?'
  },
  {
    id: 'IMP_E3',
    groupLetter: 'E',
    component: 'Pelaksanaan Asesmen',
    indicator: 'Asesmen Akhir',
    question: 'Apakah guru melaksanakan asesmen akhir yang autentik dan sesuai tujuan pembelajaran?'
  },
  {
    id: 'IMP_E4',
    groupLetter: 'E',
    component: 'Pelaksanaan Asesmen',
    indicator: 'Refleksi Hasil Asesmen',
    question: 'Apakah guru dan siswa melakukan refleksi terhadap hasil asesmen untuk perbaikan ke depan?'
  }
];

export function calculateDeepLearningImplementationScore(scores: Record<string, number>) {
  const totalRealScore = DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS.reduce((sum, item) => {
    const val = scores[item.id] ?? scores[item.question] ?? 0;
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);

  const maxScore = DEEP_LEARNING_IMPLEMENTATION_SUPERVISION_ITEMS.length * 4; // 17 * 4 = 68
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

// -------------------------------------------------------------
// INSTRUMEN UMPAN BALIK PERENCANAAN PEMBELAJARAN MENDALAM
// -------------------------------------------------------------
export interface DeepLearningFeedbackItem {
  id: string; // '1' - '15'
  number: number;
  aspect: string;
}

export const DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS: DeepLearningFeedbackItem[] = [
  {
    id: '1',
    number: 1,
    aspect: 'Tujuan pembelajaran, langkah pembelajaran sudah mengarah pada pencapaian Dimensi Profil Lulusan.'
  },
  {
    id: '2',
    number: 2,
    aspect: 'Tujuan pembelajaran, langkah pembelajaran, dan asesmen pembelajaran sudah selaras.'
  },
  {
    id: '3',
    number: 3,
    aspect: 'Praktik pedagogis yang dituliskan sudah tergambar pada langkah pembelajaran dan/atau asesmen pembelajaran.'
  },
  {
    id: '4',
    number: 4,
    aspect: 'Lingkungan belajar yang dituliskan sudah tergambar pada langkah pembelajaran dan/atau asesmen pembelajaran.'
  },
  {
    id: '5',
    number: 5,
    aspect: 'Kemitraan pembelajaran yang dituliskan sudah tergambar pada langkah pembelajaran dan/atau asesmen pembelajaran.'
  },
  {
    id: '6',
    number: 6,
    aspect: 'Pemanfaatan digital yang dituliskan sudah tergambar pada langkah pembelajaran dan/atau asesmen pembelajaran.'
  },
  {
    id: '7',
    number: 7,
    aspect: 'Langkah pembelajaran dapat memfasilitasi murid untuk merasakan pengalaman belajar MEMAHAMI (mengonstruksi pengetahuan dari berbagai sumber dan konteks, menghubungkan pengetahuan awal dengan konsep baru, penalaran kritis).'
  },
  {
    id: '8',
    number: 8,
    aspect: 'Langkah pembelajaran dapat memfasilitasi murid untuk merasakan pengalaman belajar MENGAPLIKASI (menerapkan pemahaman secara kontekstual dalam kehidupan nyata).'
  },
  {
    id: '9',
    number: 9,
    aspect: 'Langkah pembelajaran dapat memfasilitasi murid untuk merasakan pengalaman belajar MEREFLEKSI (mengevaluasi dan memaknai proses serta hasil tindakan/praktik nyata, menentukan tindak lanjut, mengelola proses belajar mandiri).'
  },
  {
    id: '10',
    number: 10,
    aspect: 'Langkah perencanaan pembelajaran dapat memfasilitasi tindakan saling MEMULIAKAN antara guru dan murid, serta antarmurid yang tecermin dalam bahasa verbal dan nonverbal.'
  },
  {
    id: '11',
    number: 11,
    aspect: 'Prinsip pembelajaran mendalam berupa berkesadaran, bermakna, dan/atau menggembirakan tergambar pada setiap pengalaman belajar di langkah pembelajaran.'
  },
  {
    id: '12',
    number: 12,
    aspect: 'Perencanaan pembelajaran sudah mengakomodir pengalaman belajar yang sesuai dengan karakteristik peserta didik (diferensiasi konten, proses, produk, dan inklusivitas).'
  },
  {
    id: '13',
    number: 13,
    aspect: 'Asesmen pada awal pembelajaran dirancang untuk mengumpulkan bukti kesiapan emosional, mental, pengetahuan awal, dan kebutuhan belajar peserta didik.'
  },
  {
    id: '14',
    number: 14,
    aspect: 'Asesmen selama Proses Pembelajaran dirancang untuk memantau perkembangan belajar peserta didik dan memberikan umpan balik secara berkelanjutan.'
  },
  {
    id: '15',
    number: 15,
    aspect: 'Asesmen hasil Pembelajaran dirancang untuk mengukur ketercapaian tujuan pembelajaran secara komprehensif.'
  }
];

export function calculateDeepLearningFeedbackScore(scores: Record<string, number>) {
  const totalRealScore = DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS.reduce((sum, item) => {
    const val = scores[item.id] ?? scores[item.number.toString()] ?? scores[item.aspect] ?? 0;
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);

  const maxScore = DEEP_LEARNING_FEEDBACK_PLANNING_ITEMS.length * 4; // 15 * 4 = 60
  const finalScore = maxScore > 0 ? (totalRealScore / maxScore) * 100 : 0;

  let predicate = 'Sangat Kurang';
  if (finalScore >= 86) {
    predicate = 'Sangat Baik (Memadai)';
  } else if (finalScore >= 70) {
    predicate = 'Baik (Cukup)';
  } else if (finalScore >= 55) {
    predicate = 'Kurang (Sedikit & Lemah)';
  } else {
    predicate = 'Sangat Kurang (Hampir Tidak Ada)';
  }

  return {
    totalRealScore,
    maxScore,
    finalScore,
    predicate
  };
}

