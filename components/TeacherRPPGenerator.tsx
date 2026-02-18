
import React, { useState, useEffect, useRef } from 'react';
import { User, LessonPlanRequest, SystemSettings } from '../types';
import { generateLessonPlan } from '../services/geminiService';
import { getSystemSettings } from '../services/database';
import { BrainCircuit, ChevronLeft, ChevronRight, CheckCircle, BookOpen, Save, Printer, FileText, ShieldCheck, RefreshCcw, Trash2, Cloud, AlertTriangle } from './Icons';

interface TeacherRPPGeneratorProps {
  user: User;
}

// --- DATA LISTS ---
const LEARNING_MODELS = [
  // Flipped Classroom
  "Flipped Classroom - Standard",
  "Flipped Classroom - Debate Oriented",
  "Flipped Classroom - Mastery",
  "Flipped Classroom - Group Based",
  
  // Cooperative Learning
  "Cooperative Learning - STAD",
  "Cooperative Learning - Jigsaw",
  "Cooperative Learning - Group Investigation",
  "Cooperative Learning - TGT",
  "Cooperative Learning - Think-Pair-Share",
  
  // Problem Based Learning (PBL)
  "Problem Based Learning (PBL) - Model De Grave",
  "Problem Based Learning (PBL) - Model Maastricht (Seven Jump)",
  "Problem Based Learning (PBL) - Problem Posing",
  
  // Project Based Learning (PjBL)
  "Project Based Learning (PjBL) - Structured",
  "Project Based Learning (PjBL) - Challenge Based",
  "Project Based Learning (PjBL) - Place Based",
  
  // Discovery Learning
  "Discovery Learning - Pure Discovery",
  "Discovery Learning - Guided Discovery",
  "Discovery Learning - Simulations & Microworlds",
  
  // Inquiry Learning
  "Inquiry Learning - Confirmation (Level 1)",
  "Inquiry Learning - Structured (Level 2)",
  "Inquiry Learning - Guided (Level 3)",
  "Inquiry Learning - Open (Level 4)"
];

const LEARNING_STRATEGIES = [
  "Ceramah Interaktif",
  "Diskusi Kelompok",
  "Eksperimen",
  "Observasi",
  "Presentasi",
  "Role Playing",
  "Think Pair Share",
  "Jigsaw",
  "Numbered Heads Together",
  "Gallery Walk",
  "Brainstorming",
  "Demonstrasi",
  "Simulasi",
  "Studi Kasus",
  "Mind Mapping"
];

const GRADUATE_DIMENSIONS = [
  "Keimanan & Ketakwaan", "Kewargaan", "Penalaran Kritis", 
  "Kreativitas", "Kolaborasi", "Kemandirian", "Kesehatan", "Komunikasi"
];

const ASSESSMENT_TYPES = [
  "Asesmen Formatif dan Sumatif", "Asesmen Autentik", "Asesmen Portofolio", 
  "Asesmen Kinerja", "Asesmen Proyek", "Asesmen Tertulis", 
  "Asesmen Lisan", "Asesmen Praktik", "Peer Assessment", "Self Assessment"
];

const ASSESSMENT_INSTRUMENTS = [
  "Rubrik Penilaian", "Checklist", "Rating Scale", "Anecdotal Record", 
  "Soal Pilihan Ganda", "Soal Uraian", "Lembar Observasi", "Jurnal Refleksi"
];

const TeacherRPPGenerator: React.FC<TeacherRPPGeneratorProps> = ({ user }) => {
  const DRAFT_KEY = `rpp_draft_${user.id}`;
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [rppStep, setRppStep] = useState(1);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  
  // Initial State Definition
  const initialRppData: LessonPlanRequest = {
    // Step 1
    curriculumType: 'MERDEKA',
    teacherName: user.fullName || '',
    teacherNip: user.nip || '',
    headmasterName: '',
    headmasterNip: '',
    schoolName: user.schoolName || '',
    subject: user.subject || '',
    grade: '',
    phase: '',
    semester: 'Ganjil',
    academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    timeAllocation: '2 x 45 Menit',
    city: '',
    date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
    
    // Step 2
    topic: '',
    learningModel: LEARNING_MODELS[0],
    learningStrategy: LEARNING_STRATEGIES[0],
    cpMode: 'AUTO',
    cpManualContent: '',
    graduateProfileDimensions: [],

    // Step 3
    assessmentType: ASSESSMENT_TYPES[0],
    assessmentInstrument: ASSESSMENT_INSTRUMENTS[0]
  };

  const [rppData, setRppData] = useState<LessonPlanRequest>(initialRppData);
  const [rppResult, setRppResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Progress State
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState('Menginisialisasi AI...');

  const resultEndRef = useRef<HTMLDivElement>(null);

  // --- FEATURE TOGGLE CHECK ---
  useEffect(() => {
      const checkFeature = async () => {
          setLoadingSettings(true);
          const sysSettings = await getSystemSettings();
          setSettings(sysSettings);
          setLoadingSettings(false);
      };
      checkFeature();
  }, []);

  // --- AUTO SAVE & LOAD LOGIC ---

  // 1. Load Draft on Mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
        try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.data) {
                setRppData(prev => ({ ...prev, ...parsed.data }));
            }
            if (parsed.step) {
                setRppStep(parsed.step);
            }
            if (parsed.result) {
                setRppResult(parsed.result);
            }
        } catch (e) {
            console.error("Failed to load draft:", e);
        }
    }
    setIsDraftLoaded(true);
  }, [user.id]);

  // 2. Save Draft on Change (Only after draft is initially loaded)
  useEffect(() => {
    if (isDraftLoaded) {
        const payload = {
            data: rppData,
            step: rppStep,
            result: rppResult,
            lastSaved: new Date().toISOString()
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }
  }, [rppData, rppStep, rppResult, isDraftLoaded, user.id]);

  // 3. Sync User Profile (Only if fields are empty/default to avoid overwriting draft)
  useEffect(() => {
    if (isDraftLoaded) {
        setRppData(prev => ({
            ...prev,
            teacherName: prev.teacherName || user.fullName,
            teacherNip: prev.teacherNip || user.nip || '',
            schoolName: prev.schoolName || user.schoolName || '',
            subject: prev.subject || user.subject || ''
        }));
    }
  }, [user, isDraftLoaded]);

  // Auto scroll to bottom during streaming
  useEffect(() => {
    if (isGenerating && resultEndRef.current) {
        resultEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [rppResult, isGenerating]);

  const handleGenerateRPP = async () => {
    setIsGenerating(true);
    setRppResult(''); 
    setGenProgress(0);
    setGenStatus('Menghubungkan ke Gemini AI...');
    
    await generateLessonPlan(
        rppData, 
        user.id, // PASS User ID for Rate Limiting
        (chunk) => {
            setRppResult(prev => prev + chunk);
        },
        (percent, status) => {
            setGenProgress(percent);
            setGenStatus(status);
        }
    );
    
    setIsGenerating(false);
    setGenProgress(100);
    setGenStatus('Selesai');
  };

  const handleResetDraft = () => {
      if (confirm("Hapus draft yang tersimpan dan mulai formulir dari awal?")) {
          localStorage.removeItem(DRAFT_KEY);
          setRppData(initialRppData);
          setRppStep(1);
          setRppResult('');
          // Re-sync user data immediately
          setRppData(prev => ({
            ...prev,
            teacherName: user.fullName,
            teacherNip: user.nip || '',
            schoolName: user.schoolName || '',
            subject: user.subject || ''
          }));
      }
  };

  const handleRppChange = (field: keyof LessonPlanRequest, value: any) => {
    setRppData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDimension = (dim: string) => {
    setRppData(prev => {
        const current = prev.graduateProfileDimensions;
        if (current.includes(dim)) {
            return { ...prev, graduateProfileDimensions: current.filter(d => d !== dim) };
        } else {
            return { ...prev, graduateProfileDimensions: [...current, dim] };
        }
    });
  };

  // --- EXPORT FUNCTIONS ---
  const handleExportDocx = () => {
    if (!rppResult) return;

    // Simple HTML wrapper for Docx compatibility
    let formattedContent = rppResult
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
        .replace(/\n/g, '<br/>'); // Newlines

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>RPP Export</title></head>
      <body style="font-family: 'Times New Roman', serif; font-size: 12pt;">
        ${formattedContent}
      </body></html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPP_${rppData.subject.replace(/\s+/g, '_')}_${rppData.topic.replace(/\s+/g, '_') || 'Draft'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!rppResult) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;

    // Keep formatting
    const formattedContent = rppResult
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak RPP - ${rppData.subject}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; font-size: 12pt; line-height: 1.5; }
            h1, h2, h3 { color: #000; }
            white-space: pre-wrap;
          </style>
        </head>
        <body>
          <div style="white-space: pre-wrap;">${formattedContent}</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loadingSettings) {
      return <div className="p-8 text-center text-gray-500">Memuat status fitur...</div>;
  }

  // --- MAINTENANCE VIEW ---
  if (settings && !settings.featureRppEnabled && user.role !== 'ADMIN') {
      return (
          <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-yellow-200 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <BrainCircuit size={40} className="text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Fitur Sedang Dalam Pemeliharaan</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                  {settings.maintenanceMessage || "Mohon maaf, fitur AI RPP Generator sedang dinonaktifkan sementara untuk peningkatan sistem dan perbaikan. Silakan coba lagi nanti."}
              </p>
              <div className="flex justify-center gap-4">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-gray-600">
                      <RefreshCcw size={16} /> Sedang Diperbarui
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-start">
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <BrainCircuit className="text-purple-600" /> AI RPP Generator
                </h2>
                <p className="text-sm text-gray-500 mt-1">Buat Modul Ajar / RPP lengkap dalam 4 langkah mudah dengan bantuan AI.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
               <div className="hidden md:flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-green-100">
                  <ShieldCheck size={16} />
                  License: Sekolah/Admin
               </div>
               <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Cloud size={14} />
                  <span>Auto-saved locally</span>
               </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Main Wizard Area */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
             
             {/* Wizard Header / Stepper */}
             <div className="bg-gray-50 p-6 border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Progress Pembuatan</span>
                    <button 
                        onClick={handleResetDraft}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium transition"
                        title="Hapus Draft & Mulai Ulang"
                    >
                        <Trash2 size={12} /> Reset Draft
                    </button>
                </div>

                {/* Steps */}
                <div className="flex items-center justify-between relative">
                   <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-0"></div>
                   {[1, 2, 3, 4].map(step => (
                      <div key={step} className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                         rppStep >= step ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                         {step}
                      </div>
                   ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-medium mt-2">
                   <span>Identitas</span>
                   <span>Detail</span>
                   <span>Asesmen</span>
                   <span>Review</span>
                </div>
             </div>

             {/* Wizard Content */}
             <div className="p-6 flex-1 overflow-y-auto max-h-[600px]">
                
                {/* STEP 1: IDENTITAS MODUL */}
                {rppStep === 1 && (
                   <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <div className="space-y-3">
                         <label className="block text-sm font-bold text-gray-800">Pilih Kurikulum</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className={`border rounded-xl p-4 cursor-pointer transition ${rppData.curriculumType === 'MERDEKA' ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                               <input type="radio" className="hidden" checked={rppData.curriculumType === 'MERDEKA'} onChange={() => handleRppChange('curriculumType', 'MERDEKA')} />
                               <div className="font-bold text-purple-900">Kurikulum Merdeka</div>
                               <div className="text-xs text-gray-500 mt-1">Permendikdasmen No. 13 Tahun 2025</div>
                            </label>
                            <label className={`border rounded-xl p-4 cursor-pointer transition ${rppData.curriculumType === 'CINTA' ? 'border-pink-600 bg-pink-50 ring-1 ring-pink-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                               <input type="radio" className="hidden" checked={rppData.curriculumType === 'CINTA'} onChange={() => handleRppChange('curriculumType', 'CINTA')} />
                               <div className="font-bold text-pink-900">Kurikulum Berbasis Cinta</div>
                               <div className="text-xs text-gray-500 mt-1">Keputusan Dirjen Pendis No. 6077 Th 2025</div>
                            </label>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Penyusun</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.teacherName} onChange={e => handleRppChange('teacherName', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">NIP Penyusun</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.teacherNip} onChange={e => handleRppChange('teacherNip', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Kepala Sekolah</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.headmasterName} onChange={e => handleRppChange('headmasterName', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">NIP Kepala Sekolah</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.headmasterNip} onChange={e => handleRppChange('headmasterNip', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Sekolah</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.schoolName} onChange={e => handleRppChange('schoolName', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Mata Pelajaran</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.subject} onChange={e => handleRppChange('subject', e.target.value)} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Kelas</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="X / 10" value={rppData.grade} onChange={e => handleRppChange('grade', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Fase</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="E" value={rppData.phase} onChange={e => handleRppChange('phase', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Semester</label>
                            <select className="w-full border rounded-lg p-2 text-sm bg-white" value={rppData.semester} onChange={e => handleRppChange('semester', e.target.value)}>
                               <option value="Ganjil">Ganjil</option>
                               <option value="Genap">Genap</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Thn Ajaran</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.academicYear} onChange={e => handleRppChange('academicYear', e.target.value)} />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Alokasi Waktu</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="2 x 45 Menit" value={rppData.timeAllocation} onChange={e => handleRppChange('timeAllocation', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Kota Pembuatan</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.city} onChange={e => handleRppChange('city', e.target.value)} />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.date} onChange={e => handleRppChange('date', e.target.value)} />
                         </div>
                      </div>
                   </div>
                )}

                {/* STEP 2: DETAIL PEMBELAJARAN */}
                {rppStep === 2 && (
                   <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <div>
                         <label className="block text-sm font-bold text-gray-800 mb-1">Topik / Materi Pokok</label>
                         <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" 
                            placeholder="Contoh: Hukum Newton tentang Gerak"
                            value={rppData.topic}
                            onChange={e => handleRppChange('topic', e.target.value)}
                         />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Model Pembelajaran</label>
                            <select 
                               className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
                               value={rppData.learningModel}
                               onChange={e => handleRppChange('learningModel', e.target.value)}
                            >
                               {LEARNING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Strategi Pembelajaran</label>
                            <select 
                               className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
                               value={rppData.learningStrategy}
                               onChange={e => handleRppChange('learningStrategy', e.target.value)}
                            >
                               {LEARNING_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                         </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                         <label className="block text-sm font-bold text-blue-900 mb-2">Capaian Pembelajaran (CP)</label>
                         <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                               <input type="radio" checked={rppData.cpMode === 'AUTO'} onChange={() => handleRppChange('cpMode', 'AUTO')} className="text-purple-600" />
                               <span className="text-sm">Generate AI (BSKAP 046)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                               <input type="radio" checked={rppData.cpMode === 'MANUAL'} onChange={() => handleRppChange('cpMode', 'MANUAL')} className="text-purple-600" />
                               <span className="text-sm">Input Manual</span>
                            </label>
                         </div>
                         {rppData.cpMode === 'MANUAL' && (
                            <textarea 
                               rows={3} 
                               className="w-full border border-blue-200 rounded-lg p-2 text-sm"
                               placeholder="Paste teks CP di sini..."
                               value={rppData.cpManualContent}
                               onChange={e => handleRppChange('cpManualContent', e.target.value)}
                            />
                         )}
                         {rppData.cpMode === 'AUTO' && (
                            <p className="text-xs text-blue-600 italic">
                               *AI akan otomatis mencari CP yang sesuai untuk mapel {rppData.subject || '...'} Fase {rppData.phase || '...'}.
                            </p>
                         )}
                      </div>

                      <div>
                         <label className="block text-sm font-bold text-gray-800 mb-2">Dimensi Profil Lulusan</label>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {GRADUATE_DIMENSIONS.map(dim => (
                               <label key={dim} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition text-xs ${rppData.graduateProfileDimensions.includes(dim) ? 'bg-purple-50 border-purple-300 text-purple-800 font-bold' : 'bg-white hover:bg-gray-50'}`}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-purple-600"
                                    checked={rppData.graduateProfileDimensions.includes(dim)}
                                    onChange={() => toggleDimension(dim)}
                                  />
                                  {dim}
                               </label>
                            ))}
                         </div>
                      </div>
                   </div>
                )}

                {/* STEP 3: ASESMEN */}
                {rppStep === 3 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                      <div>
                         <label className="block text-sm font-bold text-gray-800 mb-2">Jenis Asesmen</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ASSESSMENT_TYPES.map(type => (
                               <label key={type} className={`border rounded-lg p-3 cursor-pointer flex items-center justify-between transition ${rppData.assessmentType === type ? 'border-purple-600 bg-purple-50' : 'hover:bg-gray-50'}`}>
                                  <span className="text-sm font-medium">{type}</span>
                                  <input 
                                    type="radio" 
                                    name="assessType"
                                    checked={rppData.assessmentType === type}
                                    onChange={() => handleRppChange('assessmentType', type)}
                                    className="text-purple-600 focus:ring-purple-500"
                                  />
                               </label>
                            ))}
                         </div>
                      </div>

                      <div>
                         <label className="block text-sm font-bold text-gray-800 mb-2">Bentuk Instrumen Asesmen</label>
                         <select 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                            value={rppData.assessmentInstrument}
                            onChange={e => handleRppChange('assessmentInstrument', e.target.value)}
                         >
                            {ASSESSMENT_INSTRUMENTS.map(inst => (
                               <option key={inst} value={inst}>{inst}</option>
                            ))}
                         </select>
                      </div>
                   </div>
                )}

                {/* STEP 4: REVIEW & GENERATE */}
                {rppStep === 4 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                         <h4 className="text-yellow-800 font-bold mb-2 flex items-center gap-2">
                            <CheckCircle size={18} /> Review Data
                         </h4>
                         <p className="text-xs text-yellow-700 mb-4">Pastikan data berikut sudah benar sebelum digenerate oleh AI.</p>
                         
                         <div className="space-y-3 text-sm text-gray-700">
                            <div className="grid grid-cols-3 border-b border-yellow-200 pb-2">
                               <span className="font-bold text-gray-500">Kurikulum</span>
                               <span className="col-span-2">{rppData.curriculumType}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b border-yellow-200 pb-2">
                               <span className="font-bold text-gray-500">Mapel / Kelas</span>
                               <span className="col-span-2">{rppData.subject} / {rppData.grade} (Fase {rppData.phase})</span>
                            </div>
                            <div className="grid grid-cols-3 border-b border-yellow-200 pb-2">
                               <span className="font-bold text-gray-500">Topik</span>
                               <span className="col-span-2">{rppData.topic}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b border-yellow-200 pb-2">
                               <span className="font-bold text-gray-500">Model</span>
                               <span className="col-span-2">{rppData.learningModel}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b border-yellow-200 pb-2">
                               <span className="font-bold text-gray-500">Asesmen</span>
                               <span className="col-span-2">{rppData.assessmentType} ({rppData.assessmentInstrument})</span>
                            </div>
                         </div>
                      </div>

                      <div className="text-center text-xs text-gray-500 mb-2">
                         Menggunakan Kuota API Sekolah (Admin)
                      </div>

                      {isGenerating ? (
                          <div className="w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-bold text-purple-700">{genStatus}</span>
                                  <span className="text-xs font-bold text-gray-500">{genProgress}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                  <div 
                                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${genProgress}%` }}
                                  ></div>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-2 text-center animate-pulse">
                                  Mohon tunggu, AI sedang menyusun dokumen...
                              </p>
                          </div>
                      ) : (
                          <button
                            onClick={handleGenerateRPP}
                            className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition flex justify-center items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02]"
                          >
                            <BrainCircuit size={24} /> Generate RPP Sekarang
                          </button>
                      )}
                   </div>
                )}
             </div>

             {/* Wizard Footer (Nav Buttons) */}
             <div className="p-4 border-t border-gray-100 flex justify-between bg-white">
                <button 
                   onClick={() => setRppStep(p => Math.max(1, p - 1))}
                   disabled={rppStep === 1 || isGenerating}
                   className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1 transition"
                >
                   <ChevronLeft size={18} /> Kembali
                </button>

                {rppStep < 4 ? (
                   <button 
                      onClick={() => setRppStep(p => Math.min(4, p + 1))}
                      className="px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 transition shadow-sm"
                   >
                      Lanjut <ChevronRight size={18} />
                   </button>
                ) : (
                   <div></div> // Placeholder for step 4
                )}
             </div>
          </div>

          {/* Result Area */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    Hasil RPP AI
                    {rppResult && !isGenerating && (
                        <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle size={12} /> Generated
                        </span>
                    )}
                </h3>
                {rppResult && !isGenerating && (
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePrint}
                            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition" 
                            title="Cetak / PDF"
                        >
                            <Printer size={18} />
                        </button>
                        <button 
                            onClick={handleExportDocx}
                            className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition"
                            title="Unduh Docx"
                        >
                            <FileText size={18} />
                        </button>
                    </div>
                )}
            </div>
            
            <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-gray-300">
              {isGenerating && !rppResult ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-600"></div>
                  <p className="animate-pulse">Sedang memulai penyusunan...</p>
                </div>
              ) : rppResult ? (
                <>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                        {rppResult}
                        {isGenerating && (
                            <span className="inline-block w-2 h-4 bg-purple-600 ml-1 animate-pulse align-middle"></span>
                        )}
                    </div>
                    <div ref={resultEndRef}></div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <BookOpen size={48} className="mb-2 opacity-20" />
                  <p className="text-center">Selesaikan 4 tahap di samping<br/>untuk melihat hasil RPP.</p>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
};

export default TeacherRPPGenerator;
