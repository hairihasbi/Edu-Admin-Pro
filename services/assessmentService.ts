
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    text: "Ketika saya mengoperasikan peralatan baru, saya biasanya:",
    options: [
      { id: 'A', text: "Membaca petunjuknya terlebih dahulu", style: 'VISUAL' },
      { id: 'B', text: "Mendengarkan penjelasan dari orang lain", style: 'AUDITORI' },
      { id: 'C', text: "Langsung mencobanya sendiri", style: 'KINESTETIK' }
    ]
  },
  {
    id: 2,
    text: "Ketika saya perlu petunjuk arah untuk pergi ke suatu tempat, saya lebih suka:",
    options: [
      { id: 'A', text: "Melihat peta", style: 'VISUAL' },
      { id: 'B', text: "Meminta petunjuk lisan", style: 'AUDITORI' },
      { id: 'C', text: "Mengikuti insting atau berjalan dulu", style: 'KINESTETIK' }
    ]
  },
  {
    id: 3,
    text: "Ketika saya sedang belajar hal baru, saya paling suka:",
    options: [
      { id: 'A', text: "Melihat diagram atau ilustrasi", style: 'VISUAL' },
      { id: 'B', text: "Mendengarkan ceramah atau penjelasan", style: 'AUDITORI' },
      { id: 'C', text: "Mempraktikkannya secara langsung", style: 'KINESTETIK' }
    ]
  },
  {
    id: 4,
    text: "Jika saya ingin membeli pakaian baru, saya biasanya:",
    options: [
      { id: 'A', text: "Melihat-lihat modelnya di katalog atau toko", style: 'VISUAL' },
      { id: 'B', text: "Meminta pendapat teman atau penjual", style: 'AUDITORI' },
      { id: 'C', text: "Mencobanya langsung untuk merasakan kenyamanannya", style: 'KINESTETIK' }
    ]
  },
  {
    id: 5,
    text: "Ketika saya sedang menunggu antrean, saya cenderung:",
    options: [
      { id: 'A', text: "Melihat-lihat sekeliling (membaca brosur/poster)", style: 'VISUAL' },
      { id: 'B', text: "Berbicara dengan orang di sebelah saya", style: 'AUDITORI' },
      { id: 'C', text: "Menggerak-gerakkan kaki atau tangan (tidak bisa diam)", style: 'KINESTETIK' }
    ]
  },
  {
    id: 6,
    text: "Ketika saya berbicara dengan seseorang, saya biasanya:",
    options: [
      { id: 'A', text: "Menatap wajahnya dan memperhatikan ekspresinya", style: 'VISUAL' },
      { id: 'B', text: "Mendengarkan dengan seksama nada suaranya", style: 'AUDITORI' },
      { id: 'C', text: "Banyak menggunakan gerakan tangan atau menyentuh", style: 'KINESTETIK' }
    ]
  },
  {
    id: 7,
    text: "Saya paling mudah mengingat sesuatu jika saya:",
    options: [
      { id: 'A', text: "Menulisnya atau menggambarnya", style: 'VISUAL' },
      { id: 'B', text: "Mengucapkannya berulang kali", style: 'AUDITORI' },
      { id: 'C', text: "Melakukannya secara berulang-ulang", style: 'KINESTETIK' }
    ]
  },
  {
    id: 8,
    text: "Ketika saya sedang santai, saya lebih suka:",
    options: [
      { id: 'A', text: "Membaca buku atau menonton film", style: 'VISUAL' },
      { id: 'B', text: "Mendengarkan musik atau radio", style: 'AUDITORI' },
      { id: 'C', text: "Berolahraga atau melakukan kerajinan tangan", style: 'KINESTETIK' }
    ]
  },
  {
    id: 9,
    text: "Ketika saya sedang marah, saya biasanya:",
    options: [
      { id: 'A', text: "Menjadi diam dan cemberut", style: 'VISUAL' },
      { id: 'B', text: "Berteriak atau mengomel", style: 'AUDITORI' },
      { id: 'C', text: "Membanting barang atau berjalan mondar-mandir", style: 'KINESTETIK' }
    ]
  },
  {
    id: 10,
    text: "Saya merasa paling terganggu jika:",
    options: [
      { id: 'A', text: "Ruangan berantakan atau kotor", style: 'VISUAL' },
      { id: 'B', text: "Suasana bising atau terlalu gaduh", style: 'AUDITORI' },
      { id: 'C', text: "Harus duduk diam dalam waktu lama", style: 'KINESTETIK' }
    ]
  }
];

export const calculateDominantStyle = (scores: { visual: number; auditory: number; kinesthetic: number }) => {
  const { visual, auditory, kinesthetic } = scores;
  const max = Math.max(visual, auditory, kinesthetic);
  
  if (visual === max && visual > auditory && visual > kinesthetic) return 'VISUAL';
  if (auditory === max && auditory > visual && auditory > kinesthetic) return 'AUDITORI';
  if (kinesthetic === max && kinesthetic > visual && kinesthetic > auditory) return 'KINESTETIK';
  
  // Handle ties
  const styles = [];
  if (visual === max) styles.push('VISUAL');
  if (auditory === max) styles.push('AUDITORI');
  if (kinesthetic === max) styles.push('KINESTETIK');
  
  return styles.join(' & ');
};

export const getStyleDescription = (style: string) => {
  switch (style) {
    case 'VISUAL':
      return "Anda belajar paling baik melalui penglihatan. Anda suka melihat diagram, gambar, dan demonstrasi.";
    case 'AUDITORI':
      return "Anda belajar paling baik melalui pendengaran. Anda suka mendengarkan penjelasan, diskusi, dan musik.";
    case 'KINESTETIK':
      return "Anda belajar paling baik melalui gerakan dan sentuhan. Anda suka mempraktikkan hal-hal secara langsung.";
    default:
      if (style.includes('&')) {
        return "Anda memiliki gaya belajar campuran. Anda dapat menyesuaikan cara belajar tergantung pada situasinya.";
      }
      return "Gaya belajar Anda sedang dianalisis.";
  }
};

export const generateAssessmentPDF = (className: string, schoolName: string) => {
  console.log("Memulai pembuatan PDF untuk:", className, schoolName);
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUMEN PEMETAAN GAYA BELAJAR (VAK)', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(schoolName, pageWidth / 2, 28, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(20, 32, pageWidth - 20, 32);

    // Student Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nama Siswa : ...........................................................`, 20, 42);
    doc.text(`Kelas             : ${className}`, 20, 48);
    doc.text(`Tanggal         : ...........................`, 20, 54);

    // Instructions
    doc.setFont('helvetica', 'bold');
    doc.text('Petunjuk Pengisian:', 20, 65);
    doc.setFont('helvetica', 'normal');
    doc.text('Pilihlah satu jawaban (A, B, atau C) yang paling sesuai dengan kebiasaanmu.', 20, 70);

    // Questions Table
    const tableData = VAK_QUESTIONS.map(q => [
      q.id.toString(),
      q.text,
      `[  ] A. ${q.options[0].text}\n[  ] B. ${q.options[1].text}\n[  ] C. ${q.options[2].text}`
    ]);

    if (typeof autoTable !== 'function') {
      console.error("autoTable is not a function. Check jspdf-autotable import.");
      doc.text("Kesalahan sistem: autoTable tidak terdeteksi.", 20, 80);
    } else {
      autoTable(doc, {
        startY: 75,
        head: [['No', 'Pertanyaan', 'Pilihan Jawaban']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 80 },
          2: { cellWidth: 80 }
        },
        styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
        margin: { top: 20, bottom: 20 }
      });
    }

    // Footer / Scoring
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 200;
    
    // Check if we need a new page for the footer
    if (finalY > 260) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.text('Hasil Perhitungan (Diisi oleh Guru):', 20, 20);
      doc.setFont('helvetica', 'normal');
      doc.text(`Jumlah Jawaban A (Visual)     : ..........`, 20, 27);
      doc.text(`Jumlah Jawaban B (Auditori)   : ..........`, 20, 34);
      doc.text(`Jumlah Jawaban C (Kinestetik) : ..........`, 20, 41);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text('Hasil Perhitungan (Diisi oleh Guru):', 20, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Jumlah Jawaban A (Visual)     : ..........`, 20, finalY + 7);
      doc.text(`Jumlah Jawaban B (Auditori)   : ..........`, 20, finalY + 14);
      doc.text(`Jumlah Jawaban C (Kinestetik) : ..........`, 20, finalY + 21);
    }
    
    const fileName = `Instrumen_VAK_${className.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    doc.save(fileName);
    console.log("PDF berhasil disimpan:", fileName);
  } catch (error) {
    console.error("Gagal membuat PDF:", error);
  }
};
