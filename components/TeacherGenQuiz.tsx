
import React from 'react';
import { Zap, CheckCircle, ArrowRight, BrainCircuit, FileQuestion, Star, ExternalLink } from './Icons';

const TeacherGenQuiz: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-purple-400 opacity-20 rounded-full blur-2xl"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
           <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/20">
                  <Zap size={14} fill="currentColor" className="text-yellow-300" /> Premium AI Feature
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                  Buat Soal Ulangan <br/> Dalam Hitungan Detik
              </h1>
              <div className="text-indigo-100 text-lg mb-8 leading-relaxed space-y-2">
                  <p>
                    Gunakan teknologi AI untuk menghasilkan bank soal berkualitas lengkap dengan kunci jawaban dan pembahasan.
                  </p>
                  <p className="bg-white/10 p-3 rounded-lg border border-white/20 text-sm font-medium">
                    ⚠️ <strong>Informasi Penting:</strong> Fitur ini menggunakan sistem <strong>Kredit (Berbayar)</strong>. Anda perlu melakukan top-up atau membeli paket kuota untuk men-generate soal.
                  </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                  <a
                      href="https://www.genzquiz.my.id/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-yellow-400 text-yellow-900 px-6 py-3.5 rounded-xl font-bold text-base hover:bg-yellow-300 transition shadow-lg transform hover:-translate-y-1 group"
                  >
                      Buka GenZ Quiz (Baru)
                      <Zap size={18} fill="currentColor" />
                  </a>

                  <a
                      href="https://www.genquiz.my.id/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-white text-indigo-700 px-6 py-3.5 rounded-xl font-bold text-base hover:bg-gray-50 transition shadow-lg transform hover:-translate-y-1 group"
                  >
                      Buka GenQuiz (V1)
                      <ExternalLink size={18} />
                  </a>
              </div>
              
              <p className="mt-4 text-xs text-indigo-200 opacity-80">*Link akan membuka tab baru ke layanan eksternal</p>
           </div>

           <div className="hidden lg:flex justify-center">
              <div className="relative bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl max-w-sm transform rotate-3 hover:rotate-0 transition duration-500">
                  <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
                      <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                          <BrainCircuit size={24} />
                      </div>
                      <div>
                          <p className="font-bold text-sm">AI Generator</p>
                          <p className="text-xs text-indigo-200">Processing request...</p>
                      </div>
                  </div>
                  <div className="space-y-3">
                      <div className="h-2 bg-white/20 rounded w-3/4"></div>
                      <div className="h-2 bg-white/20 rounded w-full"></div>
                      <div className="h-2 bg-white/20 rounded w-5/6"></div>
                      <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-400" />
                          <span className="text-xs font-medium text-green-100">10 Soal Berhasil Dibuat!</span>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      </div>

      {/* Process Steps */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Bagaimana Cara Kerjanya?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <FileQuestion size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">1. Tentukan Topik</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Masukkan mata pelajaran, jenjang kelas, dan topik spesifik yang ingin diujikan (contoh: "Sejarah Kemerdekaan Indonesia").
                </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Star size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">2. Atur Tingkat Kesulitan</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Sesuaikan level kognitif soal berdasarkan Taksonomi Bloom (C1 - C6) dan pilih jumlah soal yang diinginkan.
                </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                <div className="w-14 h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                    <Zap size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">3. Beli Credit & Generate</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Top-up credit sesuai kebutuhan. AI akan memproses permintaan Anda dalam detik. Hasilnya dapat langsung diunduh.
                </p>
            </div>
        </div>
      </div>

      {/* Features List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Fitur Unggulan GenQuiz</h3>
                  <p className="text-gray-600 mb-6">
                      Alat bantu terbaik bagi guru modern untuk meningkatkan efisiensi administrasi pembelajaran.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                      {[
                          "Mendukung Kurikulum Merdeka",
                          "Format Pilihan Ganda & Essay",
                          "Otomatis Kunci Jawaban",
                          "Pembahasan Soal Detil",
                          "Export ke Word / PDF",
                          "Variasi Soal Tak Terbatas"
                      ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                              <CheckCircle className="text-green-500 flex-shrink-0" size={18} />
                              <span className="text-gray-700 font-medium text-sm">{item}</span>
                          </div>
                      ))}
                  </div>
              </div>
              <div className="flex-1 bg-gray-50 p-6 rounded-xl border border-gray-100 w-full">
                  <div className="text-center">
                      <p className="text-gray-500 text-sm mb-4">Sudah siap membuat soal?</p>
                      <div className="grid grid-cols-1 gap-3">
                          <a 
                              href="https://www.genzquiz.my.id/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-yellow-400 text-yellow-900 font-bold py-3 rounded-lg hover:bg-yellow-300 transition"
                          >
                              Coba GenZ Quiz (V2)
                          </a>
                          <a 
                              href="https://www.genquiz.my.id/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition"
                          >
                              Buka GenQuiz (V1)
                          </a>
                      </div>
                  </div>
              </div>
          </div>
      </div>

    </div>
  );
};

export default TeacherGenQuiz;
