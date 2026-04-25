
import React from 'react';
import { FileText, Code2, Layers, CheckCircle2, DollarSign, Settings2, ShieldCheck, Zap } from 'lucide-react';

const ProposalPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <FileText size={300} />
        </div>
        <div className="relative z-10">
          <div className="bg-blue-500/30 w-fit px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase mb-4 border border-blue-400/30">
            PROPOSAL PENAWARAN
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tighter">Sistem Administrasi Sekolah Terpadu (SAST)</h1>
          <p className="text-blue-100 text-lg max-w-2xl font-medium leading-relaxed">
            Solusi digital komprehensif untuk mendigitalisasi kehadiran, akademik, dan konseling dalam satu platform yang efisien, modern, dan mandiri.
          </p>
        </div>
      </div>

      {/* Intro Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Zap size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Teknologi Utama</h2>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="font-bold text-blue-600 text-sm w-24 shrink-0">Frontend</div>
              <div className="text-sm text-gray-600">React 18+, TypeScript, Vite, Tailwind CSS (Modern & Responsif)</div>
            </div>
            <div className="flex gap-4">
              <div className="font-bold text-blue-600 text-sm w-24 shrink-0">Database</div>
              <div className="text-sm text-gray-600">Dexie.js (IndexedDB Lokal) untuk Mode Offline, Turso (SQLite Edge) untuk Sinkronisasi Cloud</div>
            </div>
            <div className="flex gap-4">
              <div className="font-bold text-blue-600 text-sm w-24 shrink-0">Hosting</div>
              <div className="text-sm text-gray-600">Vercel / Cloud Run (Optimized for performance & global Edge Network)</div>
            </div>
            <div className="flex gap-4">
              <div className="font-bold text-blue-600 text-sm w-24 shrink-0">Keamanan</div>
              <div className="text-sm text-gray-600">Bcrypt hashing, Role-Based Access Control (RBAC), Offline-First Encryption</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <Layers size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Fitur & Inovasi</h2>
          </div>
          <ul className="space-y-3">
             {[
               "Presensi Multi-Mode (RFID, QR Code, Manual Bulk)",
               "Computer Based Test (CBT) Terintegrasi",
               "Manajemen BK & Kedisiplinan Siswa",
               "Jurnal Mengajar & Perangkat Ajar (RPP Genius)",
               "Monitoring Real-time (Kepala Sekolah & Wakasek)",
               "Broadcast WhatsApp Otomatis (Notifikasi Presensi)",
               "Mode Offline (Tetap bisa bekerja tanpa internet)"
             ].map((feature, idx) => (
               <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                 <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                 {feature}
               </li>
             ))}
          </ul>
        </div>
      </div>

      {/* Feature Deep Dive */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black text-gray-800 mb-8 border-b border-gray-100 pb-4 flex items-center gap-3 uppercase tracking-tight">
          <Code2 size={24} className="text-indigo-600" />
          Detail Fitur Aplikasi
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div>
               <h4 className="font-black text-blue-600 text-sm uppercase mb-2">1. Manajemen Kehadiran (RFID/QR)</h4>
               <p className="text-sm text-gray-600 leading-relaxed">
                 Sistem presensi yang sangat fleksibel. Mendukung penggunaan kartu RFID, scanning QR Code melalui kamera smartphone/laptop, dan absensi manual (bulk action) untuk situasi darurat seperti hujan deras atau kendala alat. Dilengkapi dengan cooldown anti-duplikasi dan sinkronisasi otomatis ke cloud.
               </p>
            </div>
            <div>
               <h4 className="font-black text-blue-600 text-sm uppercase mb-2">2. Computer Based Test (CBT)</h4>
               <p className="text-sm text-gray-600 leading-relaxed">
                 Lingkungan ujian digital yang aman. Guru dapat membuat soal (Pilihan Ganda & Essay), mengacak soal/opsi, dan memantau progres siswa secara langsung. Dilengkapi fitur pendeteksi kecurangan (pindah tab atau minimalkan jendela).
               </p>
            </div>
            <div>
               <h4 className="font-black text-blue-600 text-sm uppercase mb-2">3. Bimbingan Konseling (BK)</h4>
               <p className="text-sm text-gray-600 leading-relaxed">
                 Modul lengkap untuk guru BK: pencatatan pelanggaran siswa (berbasis point), prestasi, kartu bimbingan individu, home visit, hingga pemanggilan orang tua. Semua terdokumentasi rapi dan dapat ditarik history-nya secara instan.
               </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
               <h4 className="font-black text-indigo-600 text-sm uppercase mb-2">4. Monitoring Manajemen</h4>
               <p className="text-sm text-gray-600 leading-relaxed">
                 Dashboard khusus Kepala Sekolah dan Wakasek memberikan pandangan luas (bird\'s eye view) terhadap operasional sekolah. Mulai dari rekap absen harian/bulanan, evaluasi kinerja guru (Supervisi), hingga ketercapaian kurikulum.
               </p>
            </div>
            <div>
               <h4 className="font-black text-indigo-600 text-sm uppercase mb-2">5. Jurnal & Perangkat Ajar</h4>
               <p className="text-sm text-gray-600 leading-relaxed">
                 Guru dapat mengisi jurnal mengajar secara digital yang langsung terintegrasi dengan data kehadiran siswa di kelas tersebut. Fitur RPP Generator membantu guru menyusun rencana pembelajaran dengan bantuan standar kurikulum terbaru.
               </p>
            </div>
            <div>
               <h4 className="font-black text-indigo-600 text-sm uppercase mb-2">6. Komunikasi WhatsApp Broadcast</h4>
               <p className="text-sm text-gray-600 leading-relaxed">
                 Meningkatkan keterlibatan orang tua melalui notifikasi WhatsApp otomatis saat siswa melakukan tapping kartu masuk atau pulang sekolah. Memastikan keamanan siswa terpantau oleh wali murid.
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Section */}
      <div className="bg-gray-900 rounded-3xl p-10 text-white shadow-xl border border-gray-800">
        <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-yellow-500/20 text-yellow-500 rounded-lg">
              <DollarSign size={24} />
            </div>
            <h2 className="text-2xl font-black">Estimasi Biaya Layanan</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vercel */}
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
            <h3 className="font-black text-lg mb-2">Platform Hosting</h3>
            <p className="text-xs text-gray-400 mb-4">(Vercel / Cloud Run)</p>
            <div className="text-2xl font-black text-blue-400 mb-2">Gratis / $20</div>
            <p className="text-xs text-gray-500">Tergantung pada volume traffic dan kebutuhan kustom domain sekolah.</p>
          </div>

          {/* Database */}
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
            <h3 className="font-black text-lg mb-2">Edge Database</h3>
            <p className="text-xs text-gray-400 mb-4">(Turso / SQLite Cloud)</p>
            <div className="text-2xl font-black text-green-400 mb-2">Gratis / $29</div>
            <p className="text-xs text-gray-500">Free tier sangat luas untut database sekolah menengah. Berbayar jika data melebihi 9GB.</p>
          </div>

          {/* WhatsApp API */}
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
            <h3 className="font-black text-lg mb-2">Layanan WhatsApp</h3>
            <p className="text-xs text-gray-400 mb-4">(Fonnte / FlowKirim)</p>
            <div className="text-2xl font-black text-indigo-400 mb-2">Rp 50rb - 150rb</div>
            <p className="text-xs text-gray-500">Biaya bulanan untuk langganan gateway agar pengiriman pesan lancar 24/7.</p>
          </div>
        </div>

        <div className="mt-10 p-6 bg-blue-900/30 rounded-2xl border border-blue-500/30">
          <div className="flex items-start gap-4">
            <Settings2 size={24} className="text-blue-400 shrink-0 mt-1" />
            <div>
              <p className="font-bold text-blue-200">Biaya Maintenance & Pengembangan (Opsional)</p>
              <p className="text-sm text-blue-100/70 leading-relaxed mt-2">
                Biaya maintenance berkisar antara 10-15% dari nilai pengadaan per tahun. Meliputi update keamanan rutin, optimasi database, perbaikan bug minor, dan bantuan teknis (support) via WhatsApp group atau Zoom.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100 flex items-center gap-6">
        <div className="p-4 bg-white rounded-2xl shadow-sm text-blue-600 hidden sm:block">
           <ShieldCheck size={48} />
        </div>
        <div>
          <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Keamanan Data Terjamin</h3>
          <p className="text-sm text-blue-800 leading-relaxed mt-1">
            Data sekolah disimpan secara eksklusif menggunakan sistem sinkronisasi yang aman. Kata sandi dienkripsi dengan standar industri (Bcrypt) dan akses data dibatasi secara ketat berdasarkan peran masing-masing pengguna.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProposalPage;
