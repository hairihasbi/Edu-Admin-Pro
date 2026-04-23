
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle,
  Send,
  Lock,
  Eye,
  Settings,
  XCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
  FileText,
  Globe
} from './Icons';
import { User, CbtExam, CbtQuestion, CbtAttempt } from '../types';
import { getCbtExams, getCbtQuestions, saveCbtAttempt } from '../services/database';

interface CbtExamEnvironmentProps {
  user: User;
}

const CbtExamEnvironment: React.FC<CbtExamEnvironmentProps> = ({ user }) => {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<CbtExam | null>(null);
  const [questions, setQuestions] = useState<CbtQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  const timerRef = useRef<any>(null);

  // Load Exam Data
  useEffect(() => {
    const loadData = async () => {
      if (!examId) return;
      try {
        const allExams = await getCbtExams(user.id, user.schoolNpsn || '', user.role, user.classId);
        const target = allExams.find(e => e.id === examId);
        if (target) {
          // Double check target class permissions
          if (user.role === 'SISWA' && target.targetClassIds && target.targetClassIds.length > 0) {
            if (!user.classId || !target.targetClassIds.includes(user.classId)) {
                alert('Kelas Anda tidak terdaftar untuk mengikuti ujian ini.');
                navigate('/dashboard');
                return;
            }
          }

          if (target.status !== 'ACTIVE') {
            alert('Ujian ini tidak sedang aktif.');
            navigate('/dashboard');
            return;
          }
          setExam(target);
          
          if (target.questionsType === 'EXTERNAL_LINK') {
            setQuestions([]); // No internal questions
          } else {
            const qData = await getCbtQuestions(examId);
            // Randomize if needed
            let finalQs = [...qData];
            if (target.randomizeQuestions) {
              finalQs = finalQs.sort(() => Math.random() - 0.5);
            }
            setQuestions(finalQs);
          }
          setTimeLeft(target.durationMinutes * 60);
        }
      } catch (error) {
        console.error("Load Exam Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [examId]);

  // Handle Soft-Lock (Blur detection)
  useEffect(() => {
    if (!isStarted || isFinished) return;

    const handleBlur = () => {
      setViolations(prev => prev + 1);
      alert('Peringatan! Anda terdeteksi meninggalkan halaman ujian. Aktivitas ini tercatat dan akan dilaporkan ke guru.');
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && isStarted && !isFinished) {
         setViolations(prev => prev + 1);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isStarted, isFinished]);

  // Timer logic
  useEffect(() => {
    if (isStarted && !isFinished && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isStarted, isFinished, timeLeft]);

  const handleStart = async () => {
    if (exam?.token && tokenInput !== exam.token) {
       setTokenError('Token tidak valid.');
       return;
    }
    
    if (exam?.questionsType !== 'EXTERNAL_LINK' && questions.length === 0) {
       alert('Ujian ini tidak memiliki soal. Harap hubungi pengawas.');
       return;
    }
    
    // Attempt Fullscreen
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }
    
    setIsStarted(true);
  };

  const handleFinish = async () => {
    if (isFinished) return;
    clearInterval(timerRef.current);
    setIsFinished(true);
    
    // Calculate Score
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });
    
    const score = Math.round((correct / questions.length) * 100);
    
    // Save Attempt
    const attempt: CbtAttempt = {
      id: typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
      examId: examId!,
      studentId: user.id,
      studentName: user.fullName,
      score,
      correctCount: correct,
      wrongCount: questions.length - correct,
      violationCount: violations,
      status: 'SUBMITTED',
      answers: answers,
      schoolNpsn: exam!.schoolNpsn,
      startTime: new Date(Date.now() - (exam!.durationMinutes * 60 * 1000 - timeLeft * 1000)).toISOString(),
      endTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await saveCbtAttempt(attempt);
    } catch (error) {
      console.error("Save Attempt Error:", error);
    }
    
    // Exit Fullscreen
    if (document.fullscreenElement) {
       document.exitFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Memuat Ujian...</div>;
  if (!exam) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-500 font-bold">Ujian tidak ditemukan.</div>;

  // Laporan Selesai View
  if (isFinished) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6">
           <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle size={40} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-gray-800">Ujian Selesai!</h2>
              <p className="text-gray-500 text-sm mt-1">Terima kasih telah mengerjakan ujian dengan jujur.</p>
           </div>
           
           <div className="py-6 border-y border-gray-50">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Status Keamanan</p>
              {violations > 0 ? (
                <div className="flex items-center justify-center gap-2 text-orange-600 font-bold">
                   <AlertTriangle size={16} />
                   <span>Terdeteksi {violations} Pelanggaran Soft-Lock</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-green-600 font-bold">
                   <Lock size={16} />
                   <span>Ujian Dikerjakan dengan Aman</span>
                </div>
              )}
           </div>

           <button 
             onClick={() => navigate('/dashboard')}
             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
           >
             Kembali ke Dashboard
           </button>
        </div>
      </div>
    );
  }

  // Lobby View
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 max-w-lg w-full text-center text-white space-y-8">
           <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20">
              <FileText size={40} />
           </div>
           <div>
              <p className="text-blue-400 font-black text-xs uppercase tracking-[0.2em] mb-2">{exam.subject}</p>
              <h1 className="text-3xl font-black">{exam.title}</h1>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                 <Clock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                 <p className="text-[10px] text-gray-400 font-bold uppercase">Durasi</p>
                 <p className="font-bold">{exam.durationMinutes} Menit</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                 <Settings className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                 <p className="text-[10px] text-gray-400 font-bold uppercase">Total Soal</p>
                 <p className="font-bold">{questions.length} Butir</p>
              </div>
           </div>

           {exam.token && (
              <div className="space-y-2">
                 <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest text-left ml-1">Token Ujian</label>
                 <input 
                   type="text" 
                   className={`w-full bg-white/5 border ${tokenError ? 'border-red-500 bg-red-500/10' : 'border-white/10'} rounded-xl py-3 px-4 text-center text-xl font-bold tracking-widest focus:ring-2 focus:ring-blue-500 outline-none`}
                   placeholder="MASUKKAN TOKEN"
                   value={tokenInput}
                   onChange={e => { setTokenInput(e.target.value.toUpperCase()); setTokenError(''); }}
                 />
                 {tokenError && <p className="text-xs text-red-500 font-bold">{tokenError}</p>}
              </div>
           )}

           <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs leading-relaxed text-left flex gap-3">
              <AlertTriangle className="shrink-0 text-amber-500" size={20} />
              <p>Halaman ini menggunakan sistem <strong>Soft-Lock</strong>. Dilarang menutup tab, membuka jendela lain, atau meninggalkan mode Fullscreen selama ujian berlangsung.</p>
           </div>

           <button 
             onClick={handleStart}
             className="w-full bg-white hover:bg-gray-100 text-blue-900 font-black py-4 rounded-2xl transition shadow-xl transform active:scale-95 flex items-center justify-center gap-2 group"
           >
             MULAI UJIAN SEKARANG <ChevronRight className="group-hover:translate-x-1 transition" size={20} />
           </button>
        </div>
      </div>
    );
  }

  // Active Exam View
  const q = questions[currentIdx];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col select-none">
      {/* Exam Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black">
               {exam.questionsType === 'EXTERNAL_LINK' ? <Globe size={20} /> : currentIdx + 1}
            </div>
            <div className="hidden sm:block">
               <h3 className="font-bold text-gray-800 text-sm">{exam.title}</h3>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{exam.subject} {exam.questionsType === 'EXTERNAL_LINK' && '| Link Eksternal'}</p>
            </div>
         </div>

         <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-colors ${timeLeft < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
            <Clock size={20} />
            <span className="font-black text-lg tracking-tighter">{formatTime(timeLeft)}</span>
         </div>

         <div className="flex items-center gap-2">
            <button 
              onClick={handleFinish}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-100 transition flex items-center gap-2 text-sm"
            >
              <Send size={18} /> Selesai
            </button>
         </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
         
         {exam.questionsType === 'EXTERNAL_LINK' ? (
           <div className="flex-1 flex flex-col gap-4">
              <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
                 <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600 z-20"></div>
                 <iframe 
                   src={exam.externalLink} 
                   className="w-full h-full border-none"
                   title="External Exam"
                   allow="camera; microphone; geolocation"
                 />
              </div>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                       <AlertTriangle size={20} />
                    </div>
                    <div>
                       <h5 className="text-xs font-black text-amber-900 uppercase">Petunjuk Ujian Link Eksternal</h5>
                       <p className="text-[10px] text-amber-700 font-medium">Klik tombol <span className="font-bold underline text-green-700">Selesai</span> di pojok kanan atas setelah Anda mengirimkan jawaban di form tersebut.</p>
                    </div>
                 </div>
                 <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase tracking-widest animate-pulse">
                    <Lock size={12} /> Keamanan Aktif
                 </div>
              </div>
           </div>
         ) : (
           <>
              {/* Question Area */}
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
                 <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8">
                    
                    {q && q.imageData && (
                      <div className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                         <img 
                           src={q.imageData} 
                           alt="Question" 
                           className="w-full h-auto max-h-[400px] object-contain bg-gray-50"
                           referrerPolicy="no-referrer"
                         />
                      </div>
                    )}

                    <div className="prose prose-lg max-w-none text-gray-800 font-medium leading-relaxed">
                       {q && q.questionText}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                       {q && (['SMA', 'SMK', 'MA'].includes(exam.level) ? (['a', 'b', 'c', 'd', 'e'] as const) : (['a', 'b', 'c', 'd'] as const)).map(key => (
                         <button 
                           key={key}
                           onClick={() => setAnswers(prev => ({ ...prev, [q.id]: key }))}
                           className={`group flex items-center p-5 rounded-2xl border-2 transition-all text-left ${
                             answers[q.id] === key 
                               ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-md ring-4 ring-blue-50' 
                               : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50'
                           }`}
                         >
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 mr-4 transition ${
                             answers[q.id] === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                           }`}>
                             {key.toUpperCase()}
                           </div>
                           <span className="font-semibold">{q.options?.[key]}</span>
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Navigation Buttons */}
                 <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100">
                    <button 
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx(prev => prev - 1)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronLeft size={20} /> Sebelumnya
                    </button>
                    <button 
                      onClick={() => {
                        if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1);
                        else handleFinish();
                      }}
                      className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition"
                    >
                      {currentIdx === questions.length - 1 ? 'Kirim Jawaban' : 'Selanjutnya'} <ChevronRight size={20} />
                    </button>
                 </div>
              </div>

              {/* Sidebar Navigation */}
              <aside className="lg:w-80 flex flex-col gap-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                       Navigasi Soal
                       <span className="text-blue-600">{Object.keys(answers).length} / {questions.length}</span>
                    </h4>
                    <div className="grid grid-cols-5 gap-2">
                       {questions.map((item, idx) => (
                         <button 
                           key={item.id}
                           onClick={() => setCurrentIdx(idx)}
                           className={`aspect-square rounded-lg flex items-center justify-center text-sm font-black transition ${
                             currentIdx === idx ? 'bg-blue-600 text-white ring-4 ring-blue-50' : 
                             answers[item.id] ? 'bg-green-100 text-green-700 border border-green-200' :
                             'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'
                           }`}
                         >
                           {idx + 1}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 space-y-4">
                    <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                       <AlertTriangle size={18} /> Hard-Protocol Active
                    </div>
                    <p className="text-[10px] text-orange-700 leading-relaxed font-medium uppercase tracking-wider">
                       Jangan tinggalkan halaman ini. Deteksi pindah tab atau keluar layar akan dicatat sebagai pelanggaran.
                    </p>
                    {violations > 0 && (
                      <div className="text-xs font-bold text-red-600 bg-white p-2 rounded-lg border border-red-100 text-center animate-bounce">
                         Jumlah Pelanggaran: {violations}
                      </div>
                    )}
                 </div>
              </aside>
           </>
         )}

      </main>

      {/* Fullscreen Overlay if not in fullscreen */}
      {isStarted && !isFinished && !isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
           <Maximize2 size={64} className="mb-6 animate-pulse text-blue-500" />
           <h2 className="text-2xl font-black mb-2">Peringatan Fullscreen!</h2>
           <p className="text-gray-400 max-w-sm mb-8">Halaman ujian harus dalam mode Fullscreen untuk melanjutkan. Menekan tombol ESC akan menambah pelanggaran Anda.</p>
           <button 
             onClick={() => document.documentElement.requestFullscreen()}
             className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-blue-500/20 transition transform active:scale-95"
           >
             KEMBALI KE FULLSCREEN
           </button>
        </div>
      )}
    </div>
  );
};

export default CbtExamEnvironment;
