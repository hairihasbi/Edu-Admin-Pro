
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, ArrowRight, CheckCircle, BrainCircuit, 
  CalendarCheck, NotebookPen, Calculator, ShieldCheck, 
  Users, Menu, X, Star, Zap, Smartphone, FileSpreadsheet, Globe, Heart, MapPin,
  IdCard, School, BookOpen, CalendarDays, Layout, ClipboardList, TrendingUp
} from './Icons';

const HomePage: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Konfigurasi Link Kontak Real
  const phoneNumber = "6285248481527";
  const whatsappLink = `https://wa.me/${phoneNumber}?text=Halo%20Admin%20EduAdmin%20Pro,%20saya%20tertarik%20menggunakan%20aplikasi%20ini%20atau%20butuh%20bantuan.`;
  const emailLink = "mailto:admin@genquiz.my.id";

  const features = [
    {
      icon: <BrainCircuit size={28} className="text-white" />,
      title: "AI Lesson Planner",
      desc: "Buat Rencana Pelaksanaan Pembelajaran (RPP) dalam hitungan detik dengan bantuan kecerdasan buatan Gemini AI.",
      color: "bg-purple-600"
    },
    {
      icon: <CalendarCheck size={28} className="text-white" />,
      title: "Absensi Digital",
      desc: "Pencatatan kehadiran siswa yang mudah, rekap otomatis, dan dapat diunduh ke format Excel/PDF.",
      color: "bg-blue-600"
    },
    {
      icon: <NotebookPen size={28} className="text-white" />,
      title: "Jurnal Mengajar",
      desc: "Catat kegiatan pembelajaran, tujuan, dan refleksi harian dengan antarmuka yang intuitif dan terstruktur.",
      color: "bg-teal-600"
    },
    {
      icon: <Calculator size={28} className="text-white" />,
      title: "Asesmen Sumatif",
      desc: "Kelola nilai Lingkup Materi (LM), STS, dan SAS dengan kalkulasi nilai rapor otomatis.",
      color: "bg-orange-600"
    },
    {
      icon: <Users size={28} className="text-white" />,
      title: "Manajemen Data",
      desc: "Database siswa yang terpusat, aman, dan mudah dikelola guru sendiri.",
      color: "bg-indigo-600"
    },
    {
      icon: <FileSpreadsheet size={28} className="text-white" />, 
      title: "Ekspor Laporan",
      desc: "Semua data administrasi dapat diekspor ke Excel dan dicetak PDF untuk kebutuhan arsip fisik.",
      color: "bg-green-600"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
      {/* --- NAVBAR --- */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <GraduationCap size={24} />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">EduAdmin Pro</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#fitur" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition">Fitur Utama</a>
              <a href="#manfaat" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition">Keunggulan</a>
              <a href="#testimoni" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition">Testimoni</a>
              <Link 
                to="/login" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-md hover:shadow-lg flex items-center gap-2"
              >
                Masuk Aplikasi <ArrowRight size={16} />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600 p-2">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 absolute w-full">
            <div className="px-4 pt-2 pb-6 space-y-2 shadow-lg">
              <a href="#fitur" className="block px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Fitur Utama</a>
              <a href="#manfaat" className="block px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Keunggulan</a>
              <a href="#testimoni" className="block px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>Testimoni</a>
              <div className="pt-4">
                <Link 
                  to="/login" 
                  className="block w-full text-center bg-blue-600 text-white px-5 py-3 rounded-lg font-bold"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Masuk Sekarang
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-gradient-to-b from-blue-50 to-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            
            {/* Text Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide mb-6">
                <Zap size={14} fill="currentColor" /> Gratis untuk Semua Guru
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                Administrasi Sekolah <br/>
                <span className="text-blue-600">Lebih Cerdas & Gratis</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Solusi all-in-one untuk Guru. Kelola absensi, jurnal, nilai, hingga pembuatan RPP otomatis. Bebas biaya langganan selamanya.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link 
                  to="/login" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-bold transition shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2"
                >
                  Mulai Gunakan Gratis
                </Link>
                <a 
                  href="#fitur" 
                  className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-8 py-4 rounded-xl text-lg font-semibold transition flex items-center justify-center"
                >
                  Pelajari Fitur
                </a>
              </div>
              
              <div className="mt-10 flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-500 font-medium">
                <span className="flex items-center gap-1"><CheckCircle size={16} className="text-green-500" /> Tanpa Biaya Tersembunyi</span>
                <span className="flex items-center gap-1"><Heart size={16} className="text-pink-500" /> Didukung Donasi Sukarela</span>
              </div>
            </div>

            {/* Hero Image / Abstract */}
            <div className="flex-1 w-full max-w-lg lg:max-w-full relative">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
              <div className="absolute -bottom-8 -left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
              
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 transform rotate-2 hover:rotate-0 transition duration-500 overflow-hidden">
                {/* Simulated Dashboard UI */}
                <div className="bg-gray-50 rounded-xl overflow-hidden h-full flex flex-col">
                   {/* Top Bar */}
                   <div className="h-12 bg-white border-b flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                         <Menu size={20} className="text-gray-400"/>
                         <span className="font-bold text-gray-700 text-sm">Dashboard Guru</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      </div>
                   </div>
                   
                   {/* Main Area */}
                   <div className="p-4 space-y-4">
                      {/* Identity Card */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white shadow-md">
                         <div className="flex items-center gap-2 mb-3 border-b border-blue-500 pb-2">
                            <IdCard size={16} className="text-blue-200"/>
                            <span className="font-semibold text-sm">Identitas Guru</span>
                         </div>
                         <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                               <p className="text-blue-200 uppercase tracking-wide text-[10px]">Nama Lengkap</p>
                               <p className="font-bold text-sm">Budi Santoso, S.Pd</p>
                            </div>
                            <div>
                               <p className="text-blue-200 uppercase tracking-wide text-[10px]">Mata Pelajaran</p>
                               <p className="font-bold text-sm">Matematika</p>
                            </div>
                         </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Layout size={16}/></div>
                            <div><p className="text-[10px] text-gray-500 uppercase">Kelas</p><p className="font-bold text-gray-800">5 Rombel</p></div>
                         </div>
                         <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Users size={16}/></div>
                            <div><p className="text-[10px] text-gray-500 uppercase">Siswa</p><p className="font-bold text-gray-800">165 Anak</p></div>
                         </div>
                         <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg"><ClipboardList size={16}/></div>
                            <div><p className="text-[10px] text-gray-500 uppercase">Jurnal</p><p className="font-bold text-gray-800">24 Entri</p></div>
                         </div>
                         <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><CheckCircle size={16}/></div>
                            <div><p className="text-[10px] text-gray-500 uppercase">Absensi</p><p className="font-bold text-gray-800">98% Hadir</p></div>
                         </div>
                      </div>

                      {/* Schedule Snippet */}
                      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                         <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700">Jadwal Hari Ini</span>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Senin</span>
                         </div>
                         <div className="p-2 space-y-2">
                            <div className="flex justify-between items-center text-xs p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100 transition">
                               <div className="flex items-center gap-2">
                                  <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                                  <div>
                                     <p className="font-bold text-gray-800">X IPA 1</p>
                                     <p className="text-gray-500 text-[10px]">07:30 - 09:00</p>
                                  </div>
                               </div>
                               <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">Berlangsung</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-gray-100 flex items-center gap-3 animate-bounce-slow z-20">
                   <div className="bg-green-100 p-2 rounded-full text-green-600">
                      <CheckCircle size={24} />
                   </div>
                   <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Status RPP</p>
                      <p className="font-bold text-gray-800">Generated by AI</p>
                   </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- STATS SECTION --- */}
      <section className="py-10 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-blue-500/50">
            <div>
              <div className="text-3xl md:text-4xl font-bold mb-1">50+</div>
              <div className="text-blue-100 text-sm font-medium">Sekolah Mitra</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold mb-1">12rb+</div>
              <div className="text-blue-100 text-sm font-medium">Siswa Terdata</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold mb-1">500+</div>
              <div className="text-blue-100 text-sm font-medium">Guru Aktif</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold mb-1">100%</div>
              <div className="text-blue-100 text-sm font-medium">Gratis</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="fitur" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Fitur Lengkap, Tanpa Biaya</h2>
            <p className="text-gray-600 text-lg">
              Kami menggabungkan kebutuhan administrasi konvensional dengan teknologi terkini untuk memudahkan pekerjaan Guru.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Link 
                to="/login" 
                key={idx} 
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition duration-300 group block relative overflow-hidden"
              >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-blue-500">
                   <ArrowRight size={20} />
                </div>
                <div className={`${feature.color} w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --- WHY US (AI FOCUS) --- */}
      <section id="manfaat" className="py-20 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            
            <div className="flex-1 w-full order-2 lg:order-1">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl transform rotate-3 opacity-20"></div>
                <div className="bg-gray-900 rounded-2xl p-6 md:p-8 relative shadow-2xl text-white font-mono text-sm leading-relaxed overflow-hidden">
                   <div className="flex gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   </div>
                   <p className="text-gray-400 mb-2">// Input Guru:</p>
                   <p className="mb-4 text-green-400">
                     {'>'} Buatkan RPP Matematika kelas X topik Eksponen durasi 90 menit.
                   </p>
                   <p className="text-gray-400 mb-2">// Output AI:</p>
                   <div className="space-y-2">
                      <p>generating_lesson_plan...</p>
                      <p>1. <span className="text-blue-400">Tujuan Pembelajaran:</span> Peserta didik mampu menggeneralisasi sifat-sifat eksponen...</p>
                      <p>2. <span className="text-blue-400">Kegiatan Inti:</span> Guru membagi siswa dalam kelompok diskusi...</p>
                      <p>3. <span className="text-blue-400">Asesmen:</span> Tes tertulis dan observasi...</p>
                      <p className="animate-pulse">_</p>
                   </div>
                </div>
              </div>
            </div>

            <div className="flex-1 order-1 lg:order-2">
              <div className="inline-block px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-xs uppercase tracking-wide mb-4">
                 Powered by Google Gemini
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Asisten Cerdas untuk <br/> Efisiensi Maksimal
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Lupakan menghabiskan waktu berjam-jam untuk administrasi manual. Asisten AI kami membantu Anda membuat draf dokumen pengajaran berkualitas tinggi dalam hitungan detik.
              </p>
              
              <ul className="space-y-4">
                {[
                  "Hemat waktu persiapan mengajar hingga 70%",
                  "Materi terstruktur sesuai Kurikulum Merdeka",
                  "Inspirasi metode pembelajaran kreatif",
                  "Fokus kembali pada interaksi dengan siswa"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                    <CheckCircle className="text-blue-600 flex-shrink-0" size={20} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* --- TESTIMONIALS --- */}
      <section id="testimoni" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Apa Kata Pengguna Kami?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Budi Santoso, S.Pd",
                role: "Guru Matematika",
                quote: "Fitur AI-nya sangat membantu! Saya bisa membuat RPP dasar hanya dalam 1 menit, tinggal edit sedikit lalu cetak."
              },
              {
                name: "Siti Aminah, M.Pd",
                role: "Kepala Sekolah",
                quote: "Monitoring kehadiran dan jurnal guru jadi jauh lebih mudah. Dashboard admin memberikan gambaran real-time yang saya butuhkan."
              },
              {
                name: "Rizky Pratama",
                role: "Operator Sekolah",
                quote: "Tampilan antarmukanya bersih dan mudah dipahami bahkan oleh guru-guru senior. Sangat user-friendly."
              }
            ].map((testi, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex gap-1 text-yellow-400 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} size={16} fill="currentColor" />)}
                </div>
                <p className="text-gray-600 mb-6 italic">"{testi.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                    {testi.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{testi.name}</h4>
                    <p className="text-xs text-gray-500">{testi.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-blue-600 rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
            {/* Decorative Circles */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-x-1/2 translate-y-1/2"></div>

            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Siap Mengubah Cara Anda Mengajar?</h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Bergabunglah dengan EduAdmin Pro sekarang. Gratis, tanpa syarat, dan didukung sepenuhnya oleh komunitas guru.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to="/login"
                  className="bg-white text-blue-700 px-8 py-4 rounded-xl text-lg font-bold hover:bg-gray-100 transition shadow-lg"
                >
                  Mulai Sekarang
                </Link>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-transparent border border-white text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition"
                >
                  Hubungi Kami
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-gray-900 text-gray-300 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4 text-white">
                <GraduationCap size={24} />
                <span className="text-xl font-bold">EduAdmin Pro</span>
              </div>
              <p className="text-sm text-gray-400">
                Platform administrasi sekolah terpadu dengan integrasi AI untuk masa depan pendidikan Indonesia.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4">Produk</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login" className="hover:text-blue-400">Dashboard</Link></li>
                <li><Link to="/login" className="hover:text-blue-400">Manajemen Kelas</Link></li>
                <li><a href="https://www.genquiz.my.id/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">AI Generator Soal</a></li>
                <li><Link to="/donation" className="hover:text-blue-400">Dukungan / Donasi</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Dukungan</h4>
              <ul className="space-y-2 text-sm">
                <li><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Pusat Bantuan</a></li>
                <li><a href="#fitur" className="hover:text-blue-400">Dokumentasi</a></li>
                <li><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Kontak Admin</a></li>
                <li><a href="#" className="hover:text-blue-400" onClick={(e) => e.preventDefault()}>Kebijakan Privasi</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Hubungi Kami</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                    <Smartphone size={16}/> 
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                      +62 852 4848 1527
                    </a>
                </li>
                <li className="flex items-center gap-2">
                    <Globe size={16}/> 
                    <a href={emailLink} className="hover:text-blue-400">
                      admin@genquiz.my.id
                    </a>
                </li>
                <li className="flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0"/> 
                    <span>Banjarbaru,<br/>Kalimantan Selatan</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} EduAdmin Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
