
import React, { useState, useEffect, useRef } from 'react';
import { User, LessonPlanRequest, SystemSettings } from '../types';
import { generateLessonPlan } from '../services/geminiService';
import { getSystemSettings } from '../services/database';
import { 
  BrainCircuit, ChevronLeft, ChevronRight, CheckCircle, BookOpen, Save, Printer, 
  FileText, ShieldCheck, RefreshCcw, Trash2, Cloud, AlertTriangle, Download, 
  Globe, Pencil, Bold, Italic, Heading, List, ListOrdered, Type, LayoutTemplate, X,
  Underline, AlignLeft, AlignCenter, AlignRight, Undo, Redo, Maximize2, Minimize2,
  PieChart, Zap
} from './Icons';
// @ts-ignore
import html2pdf from 'html2pdf.js';
// @ts-ignore
import katex from 'katex';

interface TeacherRPPGeneratorProps {
  user: User;
}

// --- DATA LISTS ---
const LEARNING_MODELS = [
  "Flipped Classroom - Standard", "Flipped Classroom - Debate Oriented", "Flipped Classroom - Mastery", "Flipped Classroom - Group Based",
  "Cooperative Learning - STAD", "Cooperative Learning - Jigsaw", "Cooperative Learning - Group Investigation", "Cooperative Learning - TGT",
  "Problem Based Learning (PBL) - Model De Grave", "Problem Based Learning (PBL) - Model Maastricht",
  "Project Based Learning (PjBL) - Structured", "Project Based Learning (PjBL) - Challenge Based",
  "Discovery Learning - Pure Discovery", "Discovery Learning - Guided Discovery",
  "Inquiry Learning - Guided (Level 3)", "Inquiry Learning - Open (Level 4)"
];

const LEARNING_STRATEGIES = [
  "Ceramah Interaktif", "Diskusi Kelompok", "Eksperimen", "Observasi", "Presentasi", "Role Playing", 
  "Think Pair Share", "Jigsaw", "Numbered Heads Together", "Gallery Walk", "Brainstorming", "Demonstrasi", "Simulasi", "Studi Kasus"
];

const GRADUATE_DIMENSIONS = [
  "Keimanan & Ketakwaan", "Kewargaan", "Penalaran Kritis", "Kreativitas", "Kolaborasi", "Kemandirian", "Kesehatan", "Komunikasi"
];

const ASSESSMENT_TYPES = [
  "Asesmen Formatif dan Sumatif", "Asesmen Autentik", "Asesmen Portofolio", "Asesmen Kinerja", "Asesmen Proyek", "Asesmen Tertulis"
];

const ASSESSMENT_INSTRUMENTS = [
  "Rubrik Penilaian", "Checklist", "Rating Scale", "Anecdotal Record", "Soal Pilihan Ganda", "Soal Uraian", "Lembar Observasi"
];

const TeacherRPPGenerator: React.FC<TeacherRPPGeneratorProps> = ({ user }) => {
  const DRAFT_KEY = `rpp_draft_${user.id}`;
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [rppStep, setRppStep] = useState(1);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  
  // Quota States
  const [quotaUsage, setQuotaUsage] = useState(user.rppUsageCount || 0);
  const [quotaLimit, setQuotaLimit] = useState(0);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  // Initial State Definition
  const initialRppData: LessonPlanRequest = {
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
    timeAllocation: '2 x 3 JP @45 menit',
    city: 'Banjarbaru',
    date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
    topic: '',
    learningModel: LEARNING_MODELS[0],
    learningStrategy: LEARNING_STRATEGIES[0],
    cpMode: 'AUTO',
    cpManualContent: '',
    graduateProfileDimensions: [],
    assessmentType: ASSESSMENT_TYPES[0],
    assessmentInstrument: ASSESSMENT_INSTRUMENTS[0],
    useSearch: false
  };

  const [rppData, setRppData] = useState<LessonPlanRequest>(initialRppData);
  const [rppResult, setRppResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState('Menginisialisasi AI...');
  const [isEditing, setIsEditing] = useState(false); 
  
  const resultEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null); // For ContentEditable

  // --- FEATURE TOGGLE & QUOTA CHECK ---
  useEffect(() => {
      const checkFeature = async () => {
          setLoadingSettings(true);
          const sysSettings = await getSystemSettings();
          setSettings(sysSettings);
          
          if (sysSettings) {
              setQuotaLimit(sysSettings.rppMonthlyLimit || 0);
              const currentUsage = user.rppUsageCount || 0;
              setQuotaUsage(currentUsage);
              // Check quota (0 means unlimited)
              if (sysSettings.rppMonthlyLimit && sysSettings.rppMonthlyLimit > 0 && currentUsage >= sysSettings.rppMonthlyLimit) {
                  setIsQuotaExceeded(true);
              } else {
                  setIsQuotaExceeded(false);
              }
          }
          
          setLoadingSettings(false);
      };
      checkFeature();
  }, [user.rppUsageCount]); // Re-run if user object updates (e.g. after sync)

  // --- AUTO SAVE & LOAD LOGIC ---
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
        try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.data) setRppData(prev => ({ ...prev, ...parsed.data }));
            if (parsed.step) setRppStep(parsed.step);
            if (parsed.result) setRppResult(parsed.result);
        } catch (e) { console.error("Failed to load draft:", e); }
    }
    setIsDraftLoaded(true);
  }, [user.id]);

  useEffect(() => {
    if (isDraftLoaded) {
        const payload = { data: rppData, step: rppStep, result: rppResult, lastSaved: new Date().toISOString() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }
  }, [rppData, rppStep, rppResult, isDraftLoaded, user.id]);

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

  useEffect(() => {
    if (isGenerating && resultEndRef.current) {
        resultEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [rppResult, isGenerating]);

  // --- WYSIWYG EDITOR LOGIC ---
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    // Focus back to editor after click button
    if (editorRef.current) editorRef.current.focus();
  };

  const handleGenerateRPP = async () => {
    if (isQuotaExceeded) {
        alert("Maaf, kuota pembuatan RPP Anda bulan ini telah habis. Silakan hubungi Admin atau tunggu bulan depan.");
        return;
    }

    setRppResult(''); 
    setIsEditing(false);
    setGenProgress(0);
    setGenStatus(rppData.useSearch ? 'Menghubungkan ke Google Search...' : 'Menghubungkan ke Gemini AI...');
    setIsGenerating(true);
    
    await new Promise(r => setTimeout(r, 100));

    await generateLessonPlan(
        rppData, 
        user.id, 
        (chunk) => { 
            // If chunk contains block message, handle it
            if (chunk.includes("[ERROR SYSTEM]")) {
                setIsGenerating(false);
                setGenStatus('Gagal');
                if (chunk.includes("Kuota")) {
                    setIsQuotaExceeded(true);
                    alert(chunk.replace("[ERROR SYSTEM]: ", ""));
                }
            }
            setRppResult(prev => prev + chunk); 
        },
        (percent, status) => { setGenProgress(percent); setGenStatus(status); }
    );
    
    setIsGenerating(false);
    setGenProgress(100);
    setGenStatus('Selesai');
    
    // Optimistic update of quota usage
    if (!isQuotaExceeded) {
        setQuotaUsage(prev => prev + 1);
        if (quotaLimit > 0 && quotaUsage + 1 >= quotaLimit) {
            setIsQuotaExceeded(true);
        }
    }
  };

  const handleResetDraft = () => {
      if (confirm("Hapus draft yang tersimpan dan mulai formulir dari awal?")) {
          localStorage.removeItem(DRAFT_KEY);
          setRppData(initialRppData);
          setRppStep(1);
          setRppResult('');
          setIsEditing(false);
          setRppData(prev => ({ ...prev, teacherName: user.fullName, teacherNip: user.nip || '', schoolName: user.schoolName || '', subject: user.subject || '' }));
      }
  };

  const handleRppChange = (field: keyof LessonPlanRequest, value: any) => {
    setRppData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDimension = (dim: string) => {
    setRppData(prev => {
        const current = prev.graduateProfileDimensions;
        return current.includes(dim) ? { ...prev, graduateProfileDimensions: current.filter(d => d !== dim) } : { ...prev, graduateProfileDimensions: [...current, dim] };
    });
  };

  const renderMath = (latex: string, displayMode: boolean) => {
      try {
          return katex.renderToString(latex, {
              throwOnError: false,
              displayMode: displayMode,
              output: 'html'
          });
      } catch (e) {
          return latex;
      }
  };

  const formatMarkdownToWordHTML = (content: string) => {
      if (!content) return '';
      
      // CRITICAL: If content looks like HTML (starts with tag), return it as is.
      // This allows the editor to save HTML back to rppResult and display it correctly.
      if (content.trim().startsWith('<') && !content.trim().startsWith('<http')) {
          return content;
      }

      let html = content
        .replace(/\$\$(.*?)\$\$/gs, (match, tex) => `<div style="text-align:center; margin: 10px 0;">${renderMath(tex, true)}</div>`)
        .replace(/\$([^$]+?)\$/g, (match, tex) => {
            if (!tex || /^\d/.test(tex)) return match;
            return renderMath(tex, false);
        })
        .replace(/###\s+(.*?)\n/g, '<h3 style="margin-top:10pt; margin-bottom:2pt; font-size:12pt; font-weight:bold; text-transform:uppercase;">$1</h3>')
        .replace(/##\s+(.*?)\n/g, '<h2 style="margin-top:15pt; margin-bottom:5pt; font-size:14pt; font-weight:bold; text-align:center; text-transform:uppercase;">$1</h2>')
        .replace(/#\s+(.*?)\n/g, '<h1 style="margin-top:15pt; margin-bottom:5pt; font-size:16pt; font-weight:bold; text-align:center; text-transform:uppercase; text-decoration: underline;">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/^\s*-\s+(.*)$/gm, '<li style="text-align: justify;">$1</li>')
        .replace(/((<li.*>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
        .replace(/^\s*\d+\.\s+(.*)$/gm, '<li style="text-align: justify;">$1</li>')
        .replace(/((<li.*>.*<\/li>\n?)+)/g, '<ol>$1</ol>')
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter((s, i, arr) => !(s.trim() === '' && (i === 0 || i === arr.length - 1)));
            if (cells.some(c => c.includes('---'))) return ''; 
            const colCount = cells.length;
            const rowContent = cells.join(' ');
            const isSignature = rowContent.includes('Mengetahui') || rowContent.includes('Guru Mata Pelajaran') || rowContent.includes('NIP.');
            return '<tr>' + cells.map((cell, index) => {
                let style = 'padding: 5px; vertical-align: top; border: 1px solid black;';
                if (isSignature) {
                    style = 'padding: 5px; vertical-align: top; border: none; width: 50%; text-align: center;'; 
                } else {
                    if (colCount === 2) {
                        if (index === 0) style += ' width: 25%; text-align: left; font-weight: bold;'; 
                        else style += ' width: 75%; text-align: justify;'; 
                    } 
                    else if (colCount === 3) {
                         if (index === 0) style += ' width: 15%; text-align: center;';
                         else if (index === 1) style += ' width: 65%; text-align: justify;';
                         else style += ' width: 20%; text-align: center; font-style: italic;';
                    }
                    else if (colCount === 4) {
                        if (index === 0) style += ' width: 10%; text-align: center;';
                        else if (index === 1) style += ' width: 20%; text-align: left; font-weight: bold;';
                        else if (index === 2) style += ' width: 55%; text-align: justify;';
                        else style += ' width: 15%; text-align: center; font-style: italic;';
                    }
                    else {
                        style += ' text-align: justify;';
                    }
                }
                return `<td style="${style}">${cell.trim() || '&nbsp;'}</td>`;
            }).join('') + '</tr>';
        })
        .replace(/\n\n/g, '</p><p style="text-align: justify; margin-bottom: 6pt;">')
        .replace(/\n/g, '<br/>');

      if (html.includes('<tr>')) {
          html = html.replace(/<tr>\s*<\/tr>/g, ''); 
          html = html.replace(/((<tr>.*?<\/tr>)+)/g, (match) => {
              if (match.includes('Mengetahui') || match.includes('Guru Mata Pelajaran')) {
                  return `<table border="0" style="width:100%; border-collapse:collapse; margin-top:30px; border: none;">${match}</table>`;
              }
              return `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse; margin-bottom:15px; border: 1px solid black;">${match}</table>`;
          });
      }
      if (!html.startsWith('<')) html = '<p style="text-align: justify; margin-bottom: 6pt;">' + html + '</p>';
      return html;
  };

  const handleExportDocx = () => {
    if (!rppResult) return;
    const formattedBody = formatMarkdownToWordHTML(rppResult);
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Modul Ajar - ${rppData.subject}</title>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.3; text-align: justify; margin: 2cm; }
          h1, h2, h3 { color: #000; font-weight: bold; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 10pt; }
          td, th { padding: 5pt; vertical-align: top; text-align: justify; }
          ul, ol { margin-top: 0; margin-bottom: 5pt; padding-left: 20pt; }
          li { margin-bottom: 2pt; }
          p { margin-top: 0; margin-bottom: 6pt; text-align: justify; }
          .katex { font-size: 1.1em; font-family: 'Times New Roman', serif; }
        </style>
      </head>
      <body>${formattedBody}</body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MODUL_AJAR_${rppData.subject.replace(/\s+/g, '_').toUpperCase()}_${rppData.grade}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (!rppResult) return;
    const formattedBody = formatMarkdownToWordHTML(rppResult);
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: 'Arial', sans-serif; padding: 25px; color: #000; font-size: 11pt; text-align: justify; line-height: 1.3;">
        <style>
           h1, h2 { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; font-size: 14pt; }
           h3 { font-weight: bold; margin-top: 10px; margin-bottom: 5px; font-size: 12pt; text-transform: uppercase; }
           table { width: 100%; border-collapse: collapse; margin-bottom: 10px; margin-top: 5px; page-break-inside: avoid !important; }
           tr { page-break-inside: avoid !important; page-break-after: auto; }
           td, th { padding: 5px; vertical-align: top; text-align: justify; }
           ul, ol { padding-left: 20px; margin-bottom: 5px; margin-top: 0; }
           li { margin-bottom: 3px; }
           p { margin-bottom: 6px; margin-top: 0; text-align: justify; }
           .page-break { page-break-before: always; }
           .katex { font-size: 1em !important; } 
        </style>
        ${formattedBody}
      </div>
    `;
    const opt = {
      margin: 15, filename: `RPP_${rppData.subject.replace(/\s+/g, '_')}_${rppData.grade}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    try { await html2pdf().set(opt).from(element).save(); } 
    catch (e) { alert("Gagal membuat PDF. Silakan coba 'Cetak' lalu 'Simpan sebagai PDF'."); }
  };

  const handlePrint = () => {
    if (!rppResult) return;
    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;
    const formattedBody = formatMarkdownToWordHTML(rppResult);
    const katexLink = (document.querySelector('link[href*="katex"]') as HTMLLinkElement)?.href || 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak RPP</title>
          <link rel="stylesheet" href="${katexLink}" crossorigin="anonymous">
          <style>
            body { font-family: 'Arial', sans-serif; padding: 40px; font-size: 12pt; line-height: 1.3; color: #000; text-align: justify; }
            h2 { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
            h3 { font-weight: bold; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; page-break-inside: avoid; }
            td, th { padding: 6px; vertical-align: top; text-align: justify; }
            ul, ol { padding-left: 25px; margin-top: 0; }
            p { text-align: justify; margin-bottom: 6px; }
            @media print { button { display: none; } body { margin: 0; padding: 0; } @page { margin: 2cm; } table { page-break-inside: avoid; } tr { page-break-inside: avoid; } }
          </style>
        </head>
        <body>${formattedBody}</body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loadingSettings) {
      return <div className="p-8 text-center text-gray-500">Memuat status fitur...</div>;
  }

  if (settings && !settings.featureRppEnabled && user.role !== 'ADMIN') {
      return (
          <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-yellow-200 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <BrainCircuit size={40} className="text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Fitur Sedang Dalam Pemeliharaan</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                  {settings.maintenanceMessage || "Mohon maaf, fitur AI RPP Generator sedang dinonaktifkan sementara untuk peningkatan sistem. Silakan coba lagi nanti."}
              </p>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20 relative">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <BrainCircuit className="text-purple-600" /> AI RPP Generator
                </h2>
                <p className="text-sm text-gray-500 mt-1">Buat Modul Ajar lengkap struktur A-L sesuai standar terbaru.</p>
            </div>
            <div className="flex items-center gap-3">
               {/* Quota Badge */}
               <div className={`px-4 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 ${
                   isQuotaExceeded 
                   ? 'bg-red-50 text-red-700 border-red-200' 
                   : 'bg-blue-50 text-blue-700 border-blue-200'
               }`}>
                   <PieChart size={16} />
                   <span>
                       Kuota Bulan Ini: {quotaUsage} / {quotaLimit > 0 ? quotaLimit : '∞'}
                   </span>
               </div>
               
               <div className="hidden md:flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-green-100">
                  <ShieldCheck size={16} /> License: Sekolah
               </div>
            </div>
        </div>

        {/* Free Access Banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-4 items-start shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-white p-2 rounded-full text-indigo-600 mt-0.5 shrink-0 border border-indigo-100 shadow-sm">
                <Zap size={20} fill="currentColor" />
            </div>
            <div>
                <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    Fitur Gratis (Free Access)
                    <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">Bulanan</span>
                </h4>
                <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                    Layanan AI Generator ini dapat digunakan secara <strong>Gratis</strong> untuk membantu administrasi guru. 
                    Demi menjaga performa server, terdapat <strong>Batas Kuota Penggunaan</strong>.
                    {quotaLimit > 0 ? (
                        <span className="block mt-1 pt-1 border-t border-indigo-200/50 font-medium">
                            Kuota Anda: {quotaUsage} / {quotaLimit} RPP bulan ini. (Reset otomatis awal bulan)
                        </span>
                    ) : (
                        <span className="block mt-1"> Saat ini penggunaan tidak dibatasi (Unlimited).</span>
                    )}
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Main Wizard Area */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
             {/* Wizard Header & Content Omitted for Brevity (Standard Steps) */}
             <div className="bg-gray-50 p-6 border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Langkah Pembuatan</span>
                    <button onClick={handleResetDraft} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium transition">
                        <Trash2 size={12} /> Reset Draft
                    </button>
                </div>
                <div className="flex items-center justify-between relative">
                   <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-0"></div>
                   {[1, 2, 3, 4].map(step => (
                      <div key={step} className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${rppStep >= step ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{step}</div>
                   ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-medium mt-2">
                   <span>Identitas</span><span>Detail</span><span>Asesmen</span><span>Review</span>
                </div>
             </div>

             <div className="p-6 flex-1 overflow-y-auto max-h-[600px]">
                {/* Step Content Rendered Here Based on rppStep - Kept Same as before */}
                {rppStep === 1 && (
                   <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <div className="space-y-3">
                         <label className="block text-sm font-bold text-gray-800">Pilih Kurikulum</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className={`border rounded-xl p-4 cursor-pointer transition ${rppData.curriculumType === 'MERDEKA' ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                               <input type="radio" className="hidden" checked={rppData.curriculumType === 'MERDEKA'} onChange={() => handleRppChange('curriculumType', 'MERDEKA')} />
                               <div className="font-bold text-purple-900">Kurikulum Merdeka</div>
                               <div className="text-xs text-gray-500 mt-1">Permendikdasmen No. 13 Th 2025</div>
                            </label>
                            <label className={`border rounded-xl p-4 cursor-pointer transition ${rppData.curriculumType === 'CINTA' ? 'border-pink-600 bg-pink-50 ring-1 ring-pink-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                               <input type="radio" className="hidden" checked={rppData.curriculumType === 'CINTA'} onChange={() => handleRppChange('curriculumType', 'CINTA')} />
                               <div className="font-bold text-pink-900">Kurikulum Berbasis Cinta</div>
                               <div className="text-xs text-gray-500 mt-1">Kepdirjen Pendis No. 6077 Th 2025</div>
                            </label>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nama Penyusun</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.teacherName} onChange={e => handleRppChange('teacherName', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">NIP Penyusun</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.teacherNip} onChange={e => handleRppChange('teacherNip', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nama Kepala Sekolah</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.headmasterName} onChange={e => handleRppChange('headmasterName', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">NIP Kepala Sekolah</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.headmasterNip} onChange={e => handleRppChange('headmasterNip', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nama Sekolah</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.schoolName} onChange={e => handleRppChange('schoolName', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Mata Pelajaran</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.subject} onChange={e => handleRppChange('subject', e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Kelas</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="X / 10" value={rppData.grade} onChange={e => handleRppChange('grade', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Fase</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="E" value={rppData.phase} onChange={e => handleRppChange('phase', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Semester</label><select className="w-full border rounded-lg p-2 text-sm bg-white" value={rppData.semester} onChange={e => handleRppChange('semester', e.target.value)}><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Thn Ajaran</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.academicYear} onChange={e => handleRppChange('academicYear', e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Alokasi Waktu</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.timeAllocation} onChange={e => handleRppChange('timeAllocation', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Kota</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.city} onChange={e => handleRppChange('city', e.target.value)} /></div>
                         <div><label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal</label><input type="text" className="w-full border rounded-lg p-2 text-sm" value={rppData.date} onChange={e => handleRppChange('date', e.target.value)} /></div>
                      </div>
                   </div>
                )}

                {rppStep === 2 && (
                   <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <div><label className="block text-sm font-bold text-gray-800 mb-1">Topik / Materi Pokok</label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" placeholder="Contoh: Hukum Newton" value={rppData.topic} onChange={e => handleRppChange('topic', e.target.value)} /></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div><label className="block text-sm font-bold text-gray-800 mb-1">Model Pembelajaran</label><select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white" value={rppData.learningModel} onChange={e => handleRppChange('learningModel', e.target.value)}>{LEARNING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                         <div><label className="block text-sm font-bold text-gray-800 mb-1">Strategi Pembelajaran</label><select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white" value={rppData.learningStrategy} onChange={e => handleRppChange('learningStrategy', e.target.value)}>{LEARNING_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                         <label className="block text-sm font-bold text-blue-900 mb-2">Capaian Pembelajaran (CP)</label>
                         <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={rppData.cpMode === 'AUTO'} onChange={() => handleRppChange('cpMode', 'AUTO')} className="text-purple-600" /><span className="text-sm">Generate AI (Otomatis)</span></label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={rppData.cpMode === 'MANUAL'} onChange={() => handleRppChange('cpMode', 'MANUAL')} className="text-purple-600" /><span className="text-sm">Input Manual</span></label>
                         </div>
                         {rppData.cpMode === 'MANUAL' && (<textarea rows={3} className="w-full border border-blue-200 rounded-lg p-2 text-sm" placeholder="Paste teks CP di sini..." value={rppData.cpManualContent} onChange={e => handleRppChange('cpManualContent', e.target.value)} />)}
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-gray-800 mb-2">Dimensi Profil Lulusan</label>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {GRADUATE_DIMENSIONS.map(dim => (
                               <label key={dim} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${rppData.graduateProfileDimensions.includes(dim) ? 'bg-purple-50 border-purple-300 text-purple-800 font-bold' : 'bg-white hover:bg-gray-50'}`}>
                                  <input type="checkbox" className="rounded text-purple-600" checked={rppData.graduateProfileDimensions.includes(dim)} onChange={() => toggleDimension(dim)} />{dim}
                               </label>
                            ))}
                         </div>
                      </div>
                   </div>
                )}

                {rppStep === 3 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                      <div><label className="block text-sm font-bold text-gray-800 mb-2">Jenis Asesmen</label><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{ASSESSMENT_TYPES.map(type => (<label key={type} className={`border rounded-lg p-3 cursor-pointer flex items-center justify-between transition ${rppData.assessmentType === type ? 'border-purple-600 bg-purple-50' : 'hover:bg-gray-50'}`}><span className="text-sm font-medium">{type}</span><input type="radio" name="assessType" checked={rppData.assessmentType === type} onChange={() => handleRppChange('assessmentType', type)} className="text-purple-600 focus:ring-purple-500" /></label>))}</div></div>
                      <div><label className="block text-sm font-bold text-gray-800 mb-2">Bentuk Instrumen Asesmen</label><select className="w-full border border-gray-300 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none" value={rppData.assessmentInstrument} onChange={e => handleRppChange('assessmentInstrument', e.target.value)}>{ASSESSMENT_INSTRUMENTS.map(inst => (<option key={inst} value={inst}>{inst}</option>))}</select></div>
                   </div>
                )}

                {rppStep === 4 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                      {isQuotaExceeded && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
                              <AlertTriangle className="text-red-600 shrink-0 mt-1" />
                              <div>
                                  <h4 className="font-bold text-red-800">Kuota Habis</h4>
                                  <p className="text-sm text-red-600">
                                      Anda telah mencapai batas pembuatan RPP bulan ini ({quotaUsage}/{quotaLimit}). 
                                      Silakan tunggu bulan depan atau hubungi Admin.
                                  </p>
                              </div>
                          </div>
                      )}

                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                         <h4 className="text-yellow-800 font-bold mb-2 flex items-center gap-2"><CheckCircle size={18} /> Review Data</h4>
                         <div className="space-y-2 text-sm text-gray-700">
                            <p><strong>Mapel:</strong> {rppData.subject} ({rppData.grade})</p>
                            <p><strong>Topik:</strong> {rppData.topic}</p>
                            <p><strong>Model:</strong> {rppData.learningModel}</p>
                         </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                          <div>
                              <h4 className="text-blue-800 font-bold flex items-center gap-2">
                                  <Globe size={16} /> AI Fact Check (Google Search)
                              </h4>
                              <p className="text-xs text-blue-600 mt-1">
                                  Aktifkan untuk mencari data terkini dan fakta relevan dari Google.
                              </p>
                          </div>
                          <label className="flex items-center cursor-pointer">
                              <div className="relative">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only"
                                    checked={rppData.useSearch || false}
                                    onChange={(e) => handleRppChange('useSearch', e.target.checked)}
                                  />
                                  <div className={`block w-12 h-7 rounded-full transition ${
                                      rppData.useSearch ? 'bg-blue-600' : 'bg-gray-300'
                                  }`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition transform ${
                                      rppData.useSearch ? 'translate-x-5' : 'translate-x-0'
                                  }`}></div>
                              </div>
                          </label>
                      </div>

                      {isGenerating ? (
                          <div className="w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
                              <div className="text-sm font-bold text-purple-700 mb-2">{genStatus} ({genProgress}%)</div>
                              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden"><div className="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${genProgress}%` }}></div></div>
                          </div>
                      ) : (
                          <button 
                            onClick={handleGenerateRPP} 
                            disabled={isQuotaExceeded}
                            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 transition ${
                                isQuotaExceeded 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02]'
                            }`}
                          >
                            <BrainCircuit size={24} /> {isQuotaExceeded ? 'Kuota Habis' : 'Generate RPP Sekarang'}
                          </button>
                      )}
                   </div>
                )}
             </div>

             <div className="p-4 border-t border-gray-100 flex justify-between bg-white">
                <button onClick={() => setRppStep(p => Math.max(1, p - 1))} disabled={rppStep === 1 || isGenerating} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1 transition"><ChevronLeft size={18} /> Kembali</button>
                {rppStep < 4 && <button onClick={() => setRppStep(p => Math.min(4, p + 1))} className="px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 transition shadow-sm">Lanjut <ChevronRight size={18} /></button>}
             </div>
          </div>

          {/* Result Area (Preview / Editor Trigger) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[600px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-500"/>
                    Preview RPP
                </h3>
                
                {rppResult && !isGenerating && (
                    <div className="flex items-center gap-2">
                        {/* TRIGGER FULLSCREEN WORKBENCH */}
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-xs font-bold shadow-sm bg-orange-500 text-white hover:bg-orange-600"
                        >
                            <Maximize2 size={14} /> Workbench (Full Edit)
                        </button>

                        <div className="flex gap-1">
                            <button onClick={handlePrint} className="p-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm" title="Cetak">
                                <Printer size={16} />
                            </button>
                            <button onClick={handleExportDocx} className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-sm" title="Word">
                                <FileText size={16} />
                            </button>
                            <button onClick={handleExportPDF} className="p-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg shadow-sm" title="PDF">
                                <Download size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Content Area (Read-Only Preview) */}
            <div className="flex-1 relative flex flex-col min-h-0 bg-gray-50">
              {isGenerating ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-600"></div>
                    <p className="animate-pulse font-medium">{genStatus} ({genProgress}%)</p>
                 </div>
              ) : !rppResult ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <BookOpen size={48} className="mb-2 opacity-20" />
                    <p>Hasil RPP akan muncul di sini.</p>
                 </div>
              ) : (
                 <div className="overflow-y-auto p-8 h-full bg-white scrollbar-thin scrollbar-thumb-gray-300 flex justify-center">
                    <div 
                        className="prose prose-sm max-w-[210mm] w-full whitespace-pre-wrap font-serif text-gray-800 leading-relaxed text-justify"
                        style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt' }}
                        dangerouslySetInnerHTML={{ __html: formatMarkdownToWordHTML(rppResult) }}
                    ></div>
                    <div ref={resultEndRef}></div>
                 </div>
              )}
            </div>
          </div>
        </div>

        {/* --- FULLSCREEN WORKBENCH OVERLAY --- */}
        {isEditing && (
            <div className="fixed inset-0 z-[100] bg-gray-900/90 backdrop-blur-sm flex flex-col h-screen w-screen animate-in fade-in zoom-in-95 duration-200">
                {/* Workbench Toolbar */}
                <div className="bg-white p-2 border-b border-gray-200 flex flex-wrap gap-2 shadow-md shrink-0 z-50 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 border-r border-gray-200">
                            <BrainCircuit className="text-purple-600" size={24} />
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm leading-none">Workbench Mode</h3>
                                <span className="text-[10px] text-gray-500">Edit Naskah RPP</span>
                            </div>
                        </div>

                        {/* Formatting Tools */}
                        <div className="flex flex-wrap gap-1 items-center">
                            <div className="flex gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('undo');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Undo"><Undo size={16}/></button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('redo');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Redo"><Redo size={16}/></button>
                            </div>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <div className="flex gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('bold');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-bold" title="Bold"><Bold size={16}/></button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('italic');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 italic" title="Italic"><Italic size={16}/></button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('underline');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 underline" title="Underline"><Underline size={16}/></button>
                            </div>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <div className="flex gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('justifyLeft');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Left"><AlignLeft size={16}/></button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('justifyCenter');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Center"><AlignCenter size={16}/></button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('justifyRight');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Right"><AlignRight size={16}/></button>
                            </div>
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>
                            <div className="flex gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('formatBlock', 'H3');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-bold text-xs" title="Heading">H1</button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('insertUnorderedList');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Bullet List"><List size={16}/></button>
                                <button onMouseDown={(e) => {e.preventDefault(); execCmd('insertOrderedList');}} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Numbered List"><ListOrdered size={16}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 italic hidden md:inline">Perubahan tersimpan otomatis di draft.</span>
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition"
                        >
                            <CheckCircle size={16} /> Selesai & Tutup
                        </button>
                    </div>
                </div>

                {/* Main Visual Editor Page */}
                <div className="flex-1 overflow-y-auto bg-gray-800/50 cursor-text" onClick={() => editorRef.current?.focus()}>
                    <div className="min-h-full p-4 md:p-8 flex justify-center pb-40">
                        <div
                            ref={editorRef}
                            contentEditable
                            className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl outline-none text-gray-800 text-justify leading-relaxed prose prose-sm max-w-none focus:ring-4 focus:ring-blue-500/20 mx-auto"
                            style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt' }}
                            dangerouslySetInnerHTML={{ __html: formatMarkdownToWordHTML(rppResult) }}
                            onInput={(e) => setRppResult(e.currentTarget.innerHTML)}
                        />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TeacherRPPGenerator;
