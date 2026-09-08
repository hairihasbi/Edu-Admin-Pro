import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Zap, 
  Sliders, 
  BookOpen, 
  Lightbulb,
  CheckSquare,
  Calculator,
  ClipboardList,
  CheckCircle,
  ArrowRight
} from './Icons';
import { MathView, normalizeGeminiMathText, hasMathFormula } from './MathRenderer';

interface GeminiActivityAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  className: string;
  materialTopic: string;
  onApplyText?: (text: string) => void;
}

export const GeminiActivityAssistantModal: React.FC<GeminiActivityAssistantModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  className,
  materialTopic,
  onApplyText
}) => {
  // Navigation Tabs: 'PROMPT' = Prepare & Send to Gemini, 'APPLY' = Paste & Preview Gemini Result
  const [activeTab, setActiveTab] = useState<'PROMPT' | 'APPLY'>('PROMPT');

  // Prompt configuration states
  const [mode, setMode] = useState<'QUICK' | 'CUSTOM'>('QUICK');
  const [learningModel, setLearningModel] = useState('Problem-Based Learning (PBL)');
  const [duration, setDuration] = useState('2 x 45 Menit (90 Menit)');
  const [targetOutcome, setTargetOutcome] = useState('');
  
  // Custom checklist options
  const [includeIceBreaking, setIncludeIceBreaking] = useState(true);
  const [includeReflection, setIncludeReflection] = useState(true);
  const [includeDifferentiation, setIncludeDifferentiation] = useState(false);
  const [includeAssessment, setIncludeAssessment] = useState(true);

  // Exact math/science formula toggle
  const isExactContext = useMemo(() => {
    const combined = `${subjectName} ${materialTopic}`.toLowerCase();
    return combined.includes('matematika') || combined.includes('fisika') || 
           combined.includes('kimia') || combined.includes('ipa') || 
           combined.includes('biologi') || combined.includes('aljabar') || 
           combined.includes('geometri') || combined.includes('kalkulus') || 
           combined.includes('aritmatika');
  }, [subjectName, materialTopic]);

  const [includeMathNotation, setIncludeMathNotation] = useState(false);

  // Auto-enable math notation if exact context detected
  useEffect(() => {
    if (isExactContext) {
      setIncludeMathNotation(true);
    }
  }, [isExactContext]);

  // Copy states & Pasted result from Gemini
  const [copied, setCopied] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(null);

  // Generated prompt preview
  const generatedPrompt = useMemo(() => {
    const sName = subjectName.trim() || '[Mata Pelajaran]';
    const cName = className.trim() || '[Kelas / Fase]';
    const mTopic = materialTopic.trim() || '[Materi / Lingkup Materi]';

    const mathInstruction = includeMathNotation ? `
**INSTRUKSI FORMAT RUMUS EKSAKTA (KaTeX/LaTeX) - SANGAT PENTING:**
- Jika materi atau kegiatan melibatkan rumus matematika, fisika, kimia, atau sains, WAJIB tuliskan menggunakan format KaTeX/LaTeX standar diapit tanda dollar:
  • Rumus sebaris (inline): $rumus$ (contoh: $f(x) = ax^2 + bx + c$, $\\frac{a}{b}$, $\\text{H}_2\\text{O}$, $v = \\frac{s}{t}$)
  • Rumus display/blok: $$rumus$$ (contoh: $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$)
- Jangan gunakan kurung \\(...\\) atau \\[...\\], selalu gunakan tanda dollar ($...$ atau $$...$$) agar langsung otomatis dirender sempurna oleh jurnal mengajar guru.
` : '';

    if (mode === 'QUICK') {
      return `Halo Gemini, tolong buatkan rancangan "Kegiatan Pembelajaran" yang interaktif, ringkas, dan berpusat pada murid (Kurikulum Merdeka) untuk:
- Mata Pelajaran: ${sName}
- Kelas / Rombel: ${cName}
- Materi / Topik: ${mTopic}
${mathInstruction}
Tolong susun langkah-langkah pembelajarannya dalam format terstruktur yang siap disalin ke Jurnal Mengajar Guru:
1. **Kegiatan Pendahuluan (Apersepsi, Motivasi, & Pertanyaan Pemantik)**
2. **Kegiatan Inti (Aktivitas Eksplorasi, Diskusi/Praktik, & Kolaborasi Siswa)**
3. **Kegiatan Penutup (Refleksi Bersama Siswa & Asesmen Formatif Singkat)**

Gunakan bahasa Indonesia yang lugas, profesional, aplikatif, dan langsung siap pakai di kelas.`;
    } else {
      const checklistDetails: string[] = [];
      if (includeIceBreaking) checklistDetails.push('Ide Ice Breaking / Pertanyaan Pemantik kontekstual');
      if (includeReflection) checklistDetails.push('Pertanyaan refleksi bermakna untuk murid di akhir pembelajaran');
      if (includeDifferentiation) checklistDetails.push('Panduan diferensiasi proses/konten untuk siswa cepat dan yang butuh bimbingan');
      if (includeAssessment) checklistDetails.push('Bentuk asesmen formatif / teknik cek pemahaman singkat');

      return `Halo Gemini, saya sedang menyusun Jurnal Mengajar Guru dan membutuhkan rancangan kegiatan pembelajaran dengan spesifikasi berikut:
- Mata Pelajaran: ${sName}
- Kelas / Jenjang: ${cName}
- Materi Pokok / TP: ${mTopic}
- Model Pembelajaran: ${learningModel}
- Alokasi Waktu: ${duration}
${targetOutcome.trim() ? `- Catatan / Harapan Khusus: ${targetOutcome.trim()}\n` : ''}${mathInstruction}
Unsur wajib yang perlu disertakan:
${checklistDetails.map(item => `• ${item}`).join('\n')}

Format Rancangan yang Diinginkan:
1. **Pendahuluan**: Orientasi, salam/doa, apersepsi kontekstual, dan motivasi.
2. **Kegiatan Inti**: Langkah sistematis sesuai sintaks ${learningModel} yang interaktif dan berpusat pada siswa.
3. **Penutup**: Refleksi, rangkuman simpulan, dan umpan balik singkat.

Sajikan secara runtut, ringkas, dan mudah disalin ke jurnal mengajar harian!`;
    }
  }, [mode, subjectName, className, materialTopic, learningModel, duration, targetOutcome, includeIceBreaking, includeReflection, includeDifferentiation, includeAssessment, includeMathNotation]);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy prompt', err);
    }
  };

  const handleOpenGemini = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
    } catch (e) {
      console.error(e);
    }

    // Open Gemini App in new tab
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    // Seamlessly transition to Step 2 so when teacher returns, the paste box is waiting
    setActiveTab('APPLY');
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedText(text);
        setClipboardFeedback('Teks berhasil ditempel dari clipboard!');
        setTimeout(() => setClipboardFeedback(null), 3000);
      } else {
        setClipboardFeedback('Clipboard kosong. Silakan salin dari Gemini terlebih dahulu.');
        setTimeout(() => setClipboardFeedback(null), 3000);
      }
    } catch (err) {
      setClipboardFeedback('Gunakan pintasan Ctrl+V pada kotak teks di bawah.');
      setTimeout(() => setClipboardFeedback(null), 3000);
    }
  };

  const handleApplyPastedResult = () => {
    if (!pastedText.trim()) return;
    const cleanedText = normalizeGeminiMathText(pastedText.trim());
    if (onApplyText) {
      onApplyText(cleanedText);
    }
  };

  const hasFormulasInPasted = hasMathFormula(pastedText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 my-8 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl text-yellow-300 ring-1 ring-white/20 shadow-inner">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight">Asisten Kegiatan Belajar Gemini AI</h3>
                <span className="px-2 py-0.5 bg-white/20 text-[11px] font-semibold rounded-full text-indigo-100">
                  Google Gemini + KaTeX
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Rancang skenario pembelajaran & dukung rumus matematika/sains otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Step Navigation Tabs */}
        <div className="bg-gray-100/90 p-2 border-b border-gray-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('PROMPT')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'PROMPT'
                ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center">
              1
            </span>
            <span>Siapkan Prompt & Buka Gemini</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPLY')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'APPLY'
                ? 'bg-white text-indigo-700 shadow-xs border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center">
              2
            </span>
            <span>Tempel & Terapkan Hasil Gemini</span>
            {pastedText && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-gray-800 text-sm">
          {/* Detected Context Banner */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-gray-700">
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-900 mr-1">
                <BookOpen size={15} className="text-indigo-600 shrink-0" />
                Konteks:
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-100 font-medium">
                Mapel: <strong>{subjectName || 'Belum dipilih'}</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-100 font-medium">
                Kelas: <strong>{className || 'Belum dipilih'}</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-100 font-medium max-w-xs truncate" title={materialTopic}>
                Materi: <strong>{materialTopic || 'Belum diisi'}</strong>
              </span>
            </div>

            {isExactContext && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg text-[11px] shadow-2xs">
                <Calculator size={12} />
                Materi Eksakta Terdeteksi
              </span>
            )}
          </div>

          {/* TAB 1: PROMPT BUILDER */}
          {activeTab === 'PROMPT' && (
            <div className="space-y-5">
              {/* Mode Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
                  Pilih Cara Bantuan AI:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('QUICK')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      mode === 'QUICK'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${mode === 'QUICK' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-xs">Mode Cepat (Instan)</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                        Format standar (Pendahuluan, Inti, Penutup) langsung siap didiskusikan di Gemini.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('CUSTOM')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      mode === 'CUSTOM'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${mode === 'CUSTOM' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Sliders size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-xs">Mode Kustom (Pilih Model)</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                        Sesuaikan model pembelajaran (PBL, PjBL), alokasi waktu, serta fokus kegiatan.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Exact Science Formula Option Toggle */}
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg mt-0.5 shrink-0">
                    <Calculator size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <span>Format Rumus & Simbol Eksakta (KaTeX / LaTeX)</span>
                      {isExactContext && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-indigo-200 text-indigo-800 rounded font-semibold">
                          Disarankan
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-indigo-800 mt-0.5 leading-normal">
                      Memerintahkan Gemini menulis rumus matematika, kimia, fisika dalam tanda dollar (<code className="bg-white/80 px-1 py-0.2 rounded font-mono text-indigo-900">$...$</code>) agar langsung dirender visual di jurnal.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={includeMathNotation}
                    onChange={(e) => setIncludeMathNotation(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* CUSTOM MODE PARAMETERS */}
              {mode === 'CUSTOM' && (
                <div className="bg-gray-50/90 border border-gray-200 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Model Pembelajaran
                      </label>
                      <select
                        value={learningModel}
                        onChange={(e) => setLearningModel(e.target.value)}
                        className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="Problem-Based Learning (PBL)">Problem-Based Learning (PBL)</option>
                        <option value="Project-Based Learning (PjBL)">Project-Based Learning (PjBL)</option>
                        <option value="Discovery / Inquiry Learning">Discovery / Inquiry Learning</option>
                        <option value="Game-Based Learning & Gamifikasi">Game-Based / Gamifikasi</option>
                        <option value="Pembelajaran Berdiferensiasi (Differentiated Learning)">Pembelajaran Berdiferensiasi</option>
                        <option value="Cooperative Learning (Jigsaw / TGT)">Cooperative Learning (Jigsaw / TGT)</option>
                        <option value="Demonstrasi & Praktikum Interaktif">Demonstrasi & Praktikum</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Alokasi Waktu
                      </label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="1 x 45 Menit (1 JP)">1 x 45 Menit (1 Jam Pelajaran)</option>
                        <option value="2 x 45 Menit (90 Menit)">2 x 45 Menit (2 Jam Pelajaran)</option>
                        <option value="3 x 45 Menit (135 Menit)">3 x 45 Menit (3 Jam Pelajaran)</option>
                        <option value="4 x 45 Menit (Blok Praktik)">4 x 45 Menit (Blok Praktik)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Fokus & Elemen Pendukung Pembelajaran:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={includeIceBreaking}
                          onChange={(e) => setIncludeIceBreaking(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Ide Ice Breaking / Pertanyaan Pemantik</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={includeReflection}
                          onChange={(e) => setIncludeReflection(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Pertanyaan Refleksi Siswa</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={includeAssessment}
                          onChange={(e) => setIncludeAssessment(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Asesmen Formatif / Cek Pemahaman</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={includeDifferentiation}
                          onChange={(e) => setIncludeDifferentiation(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Panduan Diferensiasi Siswa</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Catatan Tambahan / Karakteristik Khusus (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: Gunakan alat peraga sederhana di sekitar, kelompok 4 orang, dll."
                      value={targetOutcome}
                      onChange={(e) => setTargetOutcome(e.target.value)}
                      className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Prompt Preview Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>Pratinjau Teks Prompt yang Siap Dikirim ke Gemini:</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copied ? 'Tersalin!' : 'Salin Teks Saja'}</span>
                  </button>
                </div>
                
                <div className="relative">
                  <textarea
                    readOnly
                    rows={5}
                    value={generatedPrompt}
                    className="w-full p-3 bg-gray-50 font-mono text-[11px] text-gray-700 border border-gray-200 rounded-xl leading-relaxed resize-none focus:outline-none select-all"
                  />
                </div>
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Lightbulb size={14} className="text-amber-500 shrink-0" />
                  <span>
                    Klik <strong>"Salin & Buka Gemini App"</strong>, lalu di Gemini tekan <strong>Ctrl+V (Paste)</strong>. Setelah mendapat jawaban, kembali ke modal ini dan buka tab <strong>"2. Tempel & Terapkan"</strong>.
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: PASTE & APPLY GEMINI RESULT */}
          {activeTab === 'APPLY' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                <Lightbulb size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Langkah Menyalin dari Gemini ke Jurnal:
                  </p>
                  <ol className="list-decimal list-inside text-blue-800 text-[11px] space-y-0.5">
                    <li>Salin (Copy) teks jawaban kegiatan pembelajaran yang dibuat oleh Gemini.</li>
                    <li>Tempelkan (Paste / Ctrl+V) pada kotak di bawah ini atau klik tombol <strong>"Tempel dari Clipboard"</strong>.</li>
                    <li>Sistem otomatis mendeteksi notasi matematika/sains dan menampilkannya di pratinjau visual.</li>
                    <li>Klik <strong>"Terapkan ke Jurnal"</strong> untuk memasukkannya ke form jurnal kegiatan.</li>
                  </ol>
                </div>
              </div>

              {/* Paste Toolbar Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <ClipboardList size={14} />
                    <span>Tempel dari Clipboard</span>
                  </button>

                  {pastedText && (
                    <button
                      type="button"
                      onClick={() => setPastedText(normalizeGeminiMathText(pastedText))}
                      className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs rounded-lg flex items-center gap-1 transition"
                      title="Ubah \[...\] dan \(...\) menjadi $...$ standar"
                    >
                      <span>Rapikan Format Rumus</span>
                    </button>
                  )}

                  {pastedText && (
                    <button
                      type="button"
                      onClick={() => setPastedText('')}
                      className="px-2.5 py-1.5 text-gray-500 hover:text-red-600 text-xs transition"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {hasFormulasInPasted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200">
                    <CheckCircle size={13} className="text-emerald-600" />
                    Rumus KaTeX Terdeteksi & Terformat
                  </span>
                )}
              </div>

              {clipboardFeedback && (
                <div className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                  {clipboardFeedback}
                </div>
              )}

              {/* Textarea for pasting Gemini output */}
              <div>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Tempelkan (Ctrl+V) jawaban kegiatan pembelajaran dari Gemini di sini...

Contoh format rumus yang didukung:
• Inline: $f(x) = ax^2 + bx + c$ atau \(v = \frac{s}{t}\)
• Display: $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$"
                  className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-xs font-mono leading-relaxed resize-y"
                />
              </div>

              {/* Live Preview Box with MathView */}
              {pastedText.trim() && (
                <div className="border border-indigo-200 bg-white rounded-xl p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900 border-b border-indigo-50 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Calculator size={14} className="text-indigo-600" />
                      Pratinjau Visual Hasil (KaTeX):
                    </span>
                    <span className="text-[11px] text-gray-500 font-normal">
                      Format siap tampil di jurnal
                    </span>
                  </div>
                  <div className="text-xs text-gray-800 max-h-60 overflow-y-auto leading-relaxed p-1 bg-gray-50/50 rounded-lg">
                    <MathView text={pastedText} displayAsBlock />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 rounded-xl transition-all"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'PROMPT' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-gray-600" />}
                  <span>{copied ? 'Berhasil Disalin!' : 'Salin Prompt'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenGemini}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300"
                >
                  <Sparkles size={16} className="text-yellow-300" />
                  <span>Salin & Buka Gemini App</span>
                  <ExternalLink size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('PROMPT')}
                  className="px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <span>&larr; Kembali ke Prompt</span>
                </button>

                <button
                  type="button"
                  disabled={!pastedText.trim()}
                  onClick={handleApplyPastedResult}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-200 hover:shadow-emerald-300"
                >
                  <Check size={16} className="text-white" />
                  <span>Terapkan ke Jurnal Mengajar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default GeminiActivityAssistantModal;
