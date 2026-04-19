
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { 
  ChevronLeft, 
  Save, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Type, 
  CheckCircle,
  HelpCircle,
  Clock,
  Key,
  Layout,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCcw,
  Zap,
  FileSpreadsheet,
  FileText,
  Download,
  Upload
} from './Icons';
import { User, CbtExam, CbtQuestion } from '../types';
import { getCbtExams, saveCbtExam, getCbtQuestions, saveCbtQuestions } from '../services/database';

interface CbtEditorProps {
  user: User;
}

const CbtEditor: React.FC<CbtEditorProps> = ({ user }) => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [exam, setExam] = useState<Partial<CbtExam>>({
    title: '',
    subject: user.subject || '',
    level: 'SMA', // Default to SMA or infer from school
    durationMinutes: 60,
    status: 'DRAFT',
    randomizeQuestions: true,
    randomizeOptions: true,
    schoolNpsn: user.schoolNpsn
  });

  const getOptionKeys = () => {
    return ['SMA', 'SMK', 'MA'].includes(exam.level || '') 
      ? (['a', 'b', 'c', 'd', 'e'] as const)
      : (['a', 'b', 'c', 'd'] as const);
  };

  const [questions, setQuestions] = useState<CbtQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (examId && examId !== 'new') {
        try {
          const exams = await getCbtExams(user.id, user.schoolNpsn || '');
          const currentExam = exams.find(e => e.id === examId);
          if (currentExam) {
            setExam(currentExam);
            const qData = await getCbtQuestions(examId);
            setQuestions(qData.sort((a, b) => a.order - b.order));
            if (qData.length > 0) setActiveQuestionId(qData[0].id);
          }
        } catch (error) {
          console.error("Load CBT Data Error:", error);
        }
      } else {
        // Initialize with one empty question ONLY if empty
        setQuestions(prev => {
          if (prev.length === 0) {
            const newId = crypto.randomUUID();
            const q = {
              id: newId,
              examId: 'temp',
              questionText: '',
              type: 'MULTIPLE_CHOICE' as const,
              options: { a: '', b: '', c: '', d: '', e: '' },
              correctAnswer: 'a',
              order: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setActiveQuestionId(newId);
            return [q];
          }
          return prev;
        });
      }
      setIsLoading(false);
    };
    loadData();
  }, [examId, user]);

  const handleAddQuestion = () => {
    const newId = crypto.randomUUID();
    const newQuestion: CbtQuestion = {
      id: newId,
      examId: examId || 'temp',
      questionText: '',
      type: 'MULTIPLE_CHOICE',
      options: { a: '', b: '', c: '', d: '', e: '' },
      correctAnswer: 'a',
      order: questions.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setQuestions(prev => [...prev, newQuestion]);
    setActiveQuestionId(newId);
  };

  const handleUpdateQuestion = (id: string, updates: Partial<CbtQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q));
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (activeQuestionId === id) {
      const remaining = questions.filter(q => q.id !== id);
      setActiveQuestionId(remaining[remaining.length - 1].id);
    }
  };

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const compressed = await compressImage(base64);
      handleUpdateQuestion(questionId, { imageData: compressed });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!exam.title) {
      alert('Judul ujian wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const finalExamId = examId && examId !== 'new' ? examId : crypto.randomUUID();
      const examData: CbtExam = {
        ...exam as CbtExam,
        id: finalExamId,
        userId: user.id,
        updatedAt: new Date().toISOString(),
        createdAt: exam.createdAt || new Date().toISOString()
      };

      await saveCbtExam(examData);
      
      const questionsToSave = questions.map((q, idx) => ({
        ...q,
        examId: finalExamId,
        order: idx + 1
      }));
      
      await saveCbtQuestions(finalExamId, questionsToSave);
      
      alert('Ujian berhasil disimpan!');
      navigate('/cbt');
    } catch (error) {
      console.error("Save CBT Error:", error);
      alert('Gagal menyimpan ujian.');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadExcelTemplate = () => {
    const headers = [['Soal', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'Kunci Jawaban (a/b/c/d/e)']];
    const data = [
      ['Ibu kota Indonesia adalah...', 'Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Makassar', 'a'],
      ['Hasil dari 2 + 2 adalah...', '3', '4', '5', '6', '', 'b']
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "Template_Soal_CBT.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const newQuestions: CbtQuestion[] = data.slice(1).filter(row => row[0]).map((row, idx) => ({
        id: crypto.randomUUID(),
        examId: examId || 'temp',
        questionText: String(row[0] || ''),
        type: 'MULTIPLE_CHOICE',
        options: {
          a: String(row[1] || ''),
          b: String(row[2] || ''),
          c: String(row[3] || ''),
          d: String(row[4] || ''),
          e: String(row[5] || '')
        },
        correctAnswer: String(row[6] || 'a').toLowerCase(),
        order: questions.length + idx + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      if (newQuestions.length > 0) {
        setQuestions(prev => [...prev, ...newQuestions]);
        setActiveQuestionId(newQuestions[0].id);
        alert(`${newQuestions.length} soal berhasil diimpor.`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        // Simple Parser: Question followed by 4-5 options starting with a), b), etc.
        const parsedQuestions: CbtQuestion[] = [];
        let currentQ: Partial<CbtQuestion> | null = null;

        lines.forEach(line => {
          const optionMatch = line.match(/^([a-e])[.\)]\s*(.*)/i);
          if (optionMatch) {
            if (currentQ) {
              const key = optionMatch[1].toLowerCase();
              currentQ.options = { ...currentQ.options!, [key]: optionMatch[2] };
            }
          } else {
            // New Question
            if (currentQ) parsedQuestions.push(currentQ as CbtQuestion);
            currentQ = {
              id: crypto.randomUUID(),
              examId: examId || 'temp',
              questionText: line.replace(/^\d+[.\)]\s*/, ''),
              type: 'MULTIPLE_CHOICE',
              options: { a: '', b: '', c: '', d: '', e: '' },
              correctAnswer: 'a',
              order: parsedQuestions.length + questions.length + 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          }
        });
        if (currentQ) parsedQuestions.push(currentQ as CbtQuestion);

        if (parsedQuestions.length > 0) {
          setQuestions(prev => [...prev.filter(q => q.questionText !== ''), ...parsedQuestions]);
          setActiveQuestionId(parsedQuestions[0].id);
          alert(`${parsedQuestions.length} soal berhasil diimpor dari dokumen.`);
        }
      } catch (err) {
        console.error("Docx Import Error:", err);
        alert('Gagal mengimpor file Word. Pastikan format sesuai.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Memuat editor...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-md py-4 border-b border-gray-200 -mx-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/cbt')} className="p-2 hover:bg-white rounded-lg transition text-gray-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{examId === 'new' ? 'Buat Ujian Baru' : 'Edit Ujian'}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{exam.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={handleSave} 
             disabled={isSaving}
             className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-blue-100 transition flex items-center gap-2 disabled:opacity-50"
           >
             {isSaving ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
             Simpan Ujian
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Exam Config */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b border-gray-50 pb-3">
              <Layout size={18} className="text-blue-500" />
              Konfigurasi Ujian
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Judul Ujian</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Contoh: Penilaian Akhir Semester"
                  value={exam.title}
                  onChange={e => setExam(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Jenjang Sekolah</label>
                <select 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={exam.level}
                  onChange={e => setExam(prev => ({ ...prev, level: e.target.value as any }))}
                >
                  <option value="SD">SD (4 Pilihan)</option>
                  <option value="SMP">SMP / MTs (4 Pilihan)</option>
                  <option value="SMA">SMA (5 Pilihan)</option>
                  <option value="SMK">SMK (5 Pilihan)</option>
                  <option value="MA">MA (5 Pilihan)</option>
                  <option value="OTHERS">Lainnya (4 Pilihan)</option>
                </select>
                <p className="mt-1 text-[10px] text-gray-400 font-medium italic">*SMA, SMK, MA menggunakan Pilihan A-E</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Durasi (Menit)</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                      type="number" 
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={exam.durationMinutes}
                      onChange={e => setExam(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Token Ujian</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Opsional"
                      value={exam.token}
                      onChange={e => setExam(prev => ({ ...prev, token: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full transition relative ${exam.randomizeQuestions ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exam.randomizeQuestions ? 'left-5' : 'left-1'}`}></div>
                    <input type="checkbox" className="hidden" checked={exam.randomizeQuestions} onChange={e => setExam(prev => ({ ...prev, randomizeQuestions: e.target.checked }))} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Acak Urutan Soal</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full transition relative ${exam.randomizeOptions ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exam.randomizeOptions ? 'left-5' : 'left-1'}`}></div>
                    <input type="checkbox" className="hidden" checked={exam.randomizeOptions} onChange={e => setExam(prev => ({ ...prev, randomizeOptions: e.target.checked }))} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Acak Pilihan Jawaban</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-4">
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <span>Daftar Soal</span>
                 <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">{questions.length} Butir</span>
               </h3>
               <div className="flex gap-1">
                 <button 
                   onClick={downloadExcelTemplate}
                   className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                   title="Download Template Excel"
                 >
                   <Download size={16} />
                 </button>
                 <label className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition cursor-pointer" title="Impor dari Excel">
                   <FileSpreadsheet size={16} />
                   <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                 </label>
                 <label className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer" title="Impor dari Word (.docx)">
                   <FileText size={16} />
                   <input type="file" accept=".docx" className="hidden" onChange={handleImportDocx} />
                 </label>
               </div>
             </div>
             <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {questions.map((q, idx) => (
                  <button 
                    key={q.id}
                    onClick={() => setActiveQuestionId(q.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between group ${
                      activeQuestionId === q.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-50' : 'hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                       <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeQuestionId === q.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {idx + 1}
                       </span>
                       <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
                          {q.questionText || <span className="italic text-gray-400">Belum ada teks...</span>}
                       </span>
                    </div>
                    {q.imageData && <ImageIcon size={14} className="text-blue-500" />}
                  </button>
                ))}
                
                <button 
                  onClick={handleAddQuestion}
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl hover:bg-gray-50 transition font-bold text-xs"
                >
                  <Plus size={16} /> Tambah Soal
                </button>
             </div>
          </div>
        </div>

        {/* Right: Question Editor */}
        <div className="lg:col-span-8">
           {activeQuestionId && questions.find(q => q.id === activeQuestionId) ? (
             (() => {
                const q = questions.find(q => q.id === activeQuestionId)!;
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px] relative">
                    
                    {/* Editor Toolbar */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold">
                             {questions.indexOf(q) + 1}
                          </span>
                          <h4 className="font-bold text-gray-700">Editor Butir Soal</h4>
                       </div>
                       <button 
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Soal"
                       >
                         <Trash2 size={20} />
                       </button>
                    </div>

                    <div className="p-8 space-y-8 flex-1">
                       
                       {/* Question Content */}
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-700">Teks Pertanyaan</label>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => fileInputRef.current?.click()}
                                 className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                               >
                                  <ImageIcon size={14} /> {q.imageData ? 'Ganti Gambar' : 'Unggah Gambar'}
                               </button>
                               {q.imageData && (
                                 <button 
                                   onClick={() => handleUpdateQuestion(q.id, { imageData: undefined })}
                                   className="text-xs font-bold text-red-500 flex items-center gap-1 hover:underline"
                                 >
                                    <X size={14} /> Hapus Gambar
                                 </button>
                               )}
                            </div>
                          </div>
                          
                          {/* Image Preview */}
                          {q.imageData && (
                            <div className="relative w-full max-w-md mx-auto aspect-video rounded-xl overflow-hidden border border-gray-100 shadow-sm mb-4">
                               <img 
                                 src={q.imageData} 
                                 alt="Question" 
                                 className="w-full h-full object-contain bg-gray-50"
                                 referrerPolicy="no-referrer"
                               />
                               <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded font-bold backdrop-blur-sm">
                                  Auto-Compressed
                               </div>
                            </div>
                          )}

                          <textarea 
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 min-h-[120px] resize-none"
                            placeholder="Ketikkan teks soal di sini..."
                            value={q.questionText}
                            onChange={e => handleUpdateQuestion(q.id, { questionText: e.target.value })}
                          ></textarea>
                       </div>

                       {/* Options Editor */}
                       <div className="space-y-4">
                          <label className="text-sm font-bold text-gray-700 mb-3 block">Pilihan Jawaban</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {getOptionKeys().map(key => (
                               <div key={key} className={`group relative p-4 rounded-xl border transition-all ${
                                 q.correctAnswer === key ? 'bg-green-50 border-green-200 ring-2 ring-green-50' : 'bg-gray-50 border-gray-200'
                               }`}>
                                  <label className="flex items-center gap-3 mb-2">
                                     <input 
                                       type="radio" 
                                       name={`correct_${q.id}`} 
                                       className="w-4 h-4 text-green-600 focus:ring-green-500"
                                       checked={q.correctAnswer === key}
                                       onChange={() => handleUpdateQuestion(q.id, { correctAnswer: key })}
                                     />
                                     <span className="text-xs font-black uppercase text-gray-400">Pilihan {key}</span>
                                     {q.correctAnswer === key && <span className="ml-auto text-green-600"><CheckCircle size={14} /></span>}
                                  </label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium text-gray-800"
                                    placeholder={`Isi pilihan ${key.toUpperCase()}...`}
                                    value={q.options?.[key] || ''}
                                    onChange={e => handleUpdateQuestion(q.id, { 
                                      options: { ...q.options!, [key]: e.target.value } 
                                    })}
                                  />
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                    
                    {/* Footer / Info */}
                    <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                       <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          <Zap size={14} className="text-yellow-500" />
                          <span>Auto-save to Local Storage active</span>
                       </div>
                    </div>
                  </div>
                );
             })()
           ) : (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[600px] flex flex-col items-center justify-center text-gray-400">
                <Layout size={64} className="opacity-10 mb-4" />
                <p>Silakan pilih atau tambah soal untuk dikerjakan.</p>
             </div>
           )}
        </div>
      </div>

      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept="image/*"
        onChange={(e) => activeQuestionId && handleImageUpload(e, activeQuestionId)}
      />
    </div>
  );
};

export default CbtEditor;
