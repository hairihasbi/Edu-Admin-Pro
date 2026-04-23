
import React, { useState, useEffect, useRef } from 'react';
import { User, Student, RfidLog, SystemSettings } from '../types';
import { getStudentByRfid, saveRfidLog, getSystemSettings } from '../services/database';
import { 
  Wifi, WifiOff, Smartphone, IdCard, 
  CheckCircle, AlertCircle, Clock, ArrowLeftRight,
  Activity, Layout, X
} from './Icons';

interface RfidTerminalProps {
  user: User;
}

const RfidTerminal: React.FC<RfidTerminalProps> = ({ user }) => {
  const [method, setMethod] = useState<'KEYBOARD' | 'SERIAL'>('KEYBOARD');
  const [status, setStatus] = useState<'IDLE' | 'READING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('Silakan Tap Kartu RFID Anda');
  const [lastStudent, setLastStudent] = useState<Student | null>(null);
  const [logs, setLogs] = useState<RfidLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      terminalRef.current?.requestFullscreen().catch(err => {
        alert(`Error attempt to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getSystemSettings().then(s => setSettings(s || null));
  }, []);

  const keyboardBuffer = useRef('');
  const serialReader = useRef<ReadableStreamDefaultReader | null>(null);

  // --- AUDIO FEEDBACK ---
  const playSuccessSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});
  };

  const playErrorSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3');
    audio.play().catch(() => {});
  };

  // --- KEYBOARD EMULATOR LOGIC ---
  useEffect(() => {
    if (method !== 'KEYBOARD') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Common end markers for RFID readers are Enter or Tab
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (keyboardBuffer.current.length > 3) {
          processTag(keyboardBuffer.current.trim());
        }
        keyboardBuffer.current = '';
        e.preventDefault();
      } else if (e.key.length === 1) {
        keyboardBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [method]);

  // --- WEB SERIAL LOGIC ---
  const connectSerial = async () => {
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setSerialConnected(true);
      setStatus('IDLE');
      setMessage('Hardware Serial Terhubung. Menunggu Tap...');

      // @ts-ignore
      const reader = port.readable.getReader();
      serialReader.current = reader;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const decoder = new TextDecoder();
        const tag = decoder.decode(value).trim();
        if (tag) processTag(tag);
      }
    } catch (err) {
      console.error('Serial Error:', err);
      setSerialConnected(false);
      setStatus('ERROR');
      setMessage('Gagal terhubung ke Serial Port.');
    }
  };

  const processTag = async (tagId: string) => {
    if (scanning) return;
    setScanning(true);
    setStatus('READING');
    setMessage('Memproses...');

    try {
      const student = await getStudentByRfid(tagId, user.schoolNpsn || '');
      
      if (student) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        // Defaults if no settings
        const checkInStart = settings?.rfidCheckInStart || '06:00';
        const checkInLate = settings?.rfidCheckInLate || '08:30';
        const checkOutStart = settings?.rfidCheckOutStart || '14:00';

        let attendanceStatus: 'HADIR' | 'PULANG' | 'TERLAMBAT' = 'HADIR';
        
        if (timeStr < checkInStart) {
          setStatus('READING');
          setMessage(`Terlalu Awal (Mulai Jam ${checkInStart})`);
          playErrorSound();
          return;
        }

        if (timeStr >= checkOutStart) {
          attendanceStatus = 'PULANG';
        } else if (timeStr > checkInLate) {
          attendanceStatus = 'TERLAMBAT';
        }

        const classData = await (await import('../services/database')).getClassById(student.classId);

        const newLog = await saveRfidLog({
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          className: classData?.name || 'Unknown Class',
          schoolNpsn: user.schoolNpsn || '',
          timestamp: now.toISOString(),
          status: attendanceStatus,
          method: method
        });

        setLastStudent(student);
        setLogs(prev => [newLog, ...prev].slice(0, 5));
        setStatus('SUCCESS');
        setMessage(`Selamat ${attendanceStatus === 'PULANG' ? 'Jalan' : 'Datang'}, ${student.name}`);
        playSuccessSound();
      } else {
        setStatus('ERROR');
        setMessage(`ID Kartu (${tagId}) tidak terdaftar.`);
        playErrorSound();
        setLastStudent(null);
      }
    } catch (err) {
      setStatus('ERROR');
      setMessage('Gagal memproses data.');
    } finally {
      setScanning(false);
      // Reset status after a few seconds
      setTimeout(() => {
        setStatus('IDLE');
        setMessage('Silakan Tap Kartu RFID Anda');
      }, 3000);
    }
  };

  return (
    <div 
      ref={terminalRef}
      className={`min-h-screen transition-colors duration-500 flex flex-col p-4 md:p-8 ${
        status === 'SUCCESS' ? 'bg-green-600' : 
        status === 'ERROR' ? 'bg-red-600' : 
        status === 'READING' ? 'bg-blue-600' : 'bg-slate-900'
      } ${isFullscreen ? 'overflow-auto' : ''}`}
    >
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Top Bar: Digital Clock & Status */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-white">
          <div className="text-center md:text-left flex items-center gap-4">
            <button 
              onClick={toggleFullscreen}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition border border-white/20"
              title={isFullscreen ? "Keluar Fullscreen" : "Masuk Fullscreen"}
            >
              {isFullscreen ? <X size={20} /> : <Layout size={20} />}
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Terminal RFID {user.schoolName}</h1>
              <div className="flex items-center gap-2 text-xs font-bold opacity-80 uppercase">
                <div className={`w-2 h-2 rounded-full ${status === 'IDLE' ? 'bg-green-400 animate-pulse' : 'bg-white'}`} />
                {method === 'KEYBOARD' ? 'Keyboard Mode' : 'Serial Mode'} | {status}
                {isFullscreen && <span className="ml-2 text-yellow-400">● KIOSK MODE ACTIVE</span>}
              </div>
            </div>
          </div>
          <div className="bg-black/20 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 text-center">
            <p className="text-4xl md:text-5xl font-mono font-black tracking-tighter">
              {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
            </p>
            <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden border-4 transition-all duration-300 ${
          status === 'SUCCESS' ? 'border-green-400' : 
          status === 'ERROR' ? 'border-red-400' : 
          'border-transparent'
        }`}>
          {/* Internal Navigation/Settings */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setMethod('KEYBOARD')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${method === 'KEYBOARD' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
                >
                  <Smartphone size={14} /> KEYBOARD
                </button>
                <button 
                  onClick={() => {
                    setMethod('SERIAL');
                    if (!serialConnected) connectSerial();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${method === 'SERIAL' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
                >
                  <Wifi size={14} /> SERIAL
                </button>
             </div>
             
             <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${serialConnected || method === 'KEYBOARD' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Hardware Status</span>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-1">
                   <input 
                      type="text" 
                      readOnly 
                      placeholder="Fokus Scan..."
                      className="text-[10px] w-24 px-2 py-0.5 outline-none font-mono"
                   />
                </div>
             </div>
          </div>

          <div className="p-8 md:p-16 text-center">
            {/* Main Visual Center */}
            <div className="relative mx-auto w-48 h-48 md:w-72 md:h-72 flex items-center justify-center mb-10 transition-transform duration-300 transform hover:scale-105">
              {/* Animated Rings */}
              <div className={`absolute inset-0 rounded-full animate-ping opacity-10 ${
                status === 'SUCCESS' ? 'bg-green-400' : 
                status === 'ERROR' ? 'bg-red-400' : 
                status === 'READING' ? 'bg-blue-400' : 'bg-gray-200'
              }`} />
              <div className={`absolute inset-2 rounded-full animate-pulse opacity-20 ${
                status === 'SUCCESS' ? 'bg-green-500' : 
                status === 'ERROR' ? 'bg-red-500' : 
                status === 'READING' ? 'bg-blue-300' : 'bg-gray-100'
              }`} />
              
              <div className={`relative z-10 w-full h-full rounded-full border-8 flex items-center justify-center transition-all duration-300 shadow-xl ${
                status === 'SUCCESS' ? 'border-green-500 bg-green-50 rotate-0' : 
                status === 'ERROR' ? 'border-red-500 bg-red-50 animate-shake' : 
                status === 'READING' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'
              }`}>
                {status === 'SUCCESS' ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle size={100} className="text-green-500 animate-bounce" />
                    <span className="font-black text-green-700 tracking-tighter text-xl mt-2">BERHASIL</span>
                  </div>
                ) : status === 'ERROR' ? (
                  <div className="flex flex-col items-center">
                    <AlertCircle size={100} className="text-red-500 animate-pulse" />
                    <span className="font-black text-red-700 tracking-tighter text-xl mt-2">GAGAL</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <IdCard size={120} className={`${status === 'READING' ? 'text-blue-500 animate-pulse' : 'text-gray-300'}`} />
                    {status === 'IDLE' && <div className="text-[10px] font-black text-gray-400 animate-bounce">TEMPELKAN KARTU</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className={`text-3xl md:text-5xl font-black tracking-tighter uppercase transition-all ${
                status === 'SUCCESS' ? 'text-green-600 scale-110' : 
                status === 'ERROR' ? 'text-red-600' : 'text-gray-800'
              }`}>
                {message}
              </h2>
              
              {lastStudent && status === 'SUCCESS' && (
                <div className="max-w-md mx-auto bg-gray-50 p-6 rounded-3xl border-2 border-green-100 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                   <div className="text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">Identitas Siswa</p>
                      <h3 className="text-3xl font-black text-gray-900 leading-none">{lastStudent.name}</h3>
                      <div className="flex justify-center gap-2 mt-4">
                         <span className="bg-white px-4 py-1.5 rounded-full border border-gray-200 text-xs font-bold font-mono">NIS: {lastStudent.nis}</span>
                         <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${lastStudent.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                           {lastStudent.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                         </span>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM: RECENT HISTORY */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           {/* RIWAYAT UTAMA */}
           <div className="lg:col-span-3 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 overflow-hidden">
             <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white/50">
                <h3 className="font-black text-gray-800 text-sm flex items-center gap-2">
                   <ArrowLeftRight size={18} className="text-blue-600" />
                   RIWAYAT TAP TERBARU
                </h3>
             </div>
             <div className="p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {logs.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 italic text-xs col-span-full">
                       Belum ada transaksi tap hari ini.
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={log.id} className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
                        i === 0 ? 'bg-blue-600 text-white border-blue-500 shadow-lg scale-102 font-bold ring-4 ring-blue-500/20' : 'bg-white text-gray-700 border-gray-100'
                      }`}>
                         <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                               {log.studentName.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                               <h4 className={`text-sm truncate ${i === 0 ? 'text-white' : 'text-gray-900'}`}>{log.studentName}</h4>
                               <p className={`text-[10px] ${i === 0 ? 'text-blue-100' : 'text-gray-500'}`}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</p>
                            </div>
                         </div>
                         <div className="text-right shrink-0">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                              log.status === 'HADIR' ? (i === 0 ? 'bg-green-400 text-white' : 'bg-green-100 text-green-700') : 
                              log.status === 'TERLAMBAT' ? (i === 0 ? 'bg-yellow-400 text-white' : 'bg-yellow-100 text-yellow-700') : 
                              (i === 0 ? 'bg-blue-400 text-white' : 'bg-blue-100 text-blue-700')
                            }`}>
                               {log.status}
                            </span>
                         </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
           </div>

           {/* STATS / INFO */}
           <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 p-6 flex flex-col justify-center text-center">
              <Activity size={32} className="mx-auto text-blue-600 mb-4" />
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Tap Hari Ini</h4>
              <p className="text-6xl font-black text-gray-900 tracking-tighter">{logs.length}</p>
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
                 <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-gray-500">MASUK</span>
                    <span className="text-green-600">{logs.filter(l => l.status === 'HADIR' || l.status === 'TERLAMBAT').length}</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-gray-500">PULANG</span>
                    <span className="text-blue-600">{logs.filter(l => l.status === 'PULANG').length}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default RfidTerminal;
