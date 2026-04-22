
import React, { useState, useEffect, useRef } from 'react';
import { User, Student, RfidLog, SystemSettings } from '../types';
import { getStudentByRfid, saveRfidLog, getSystemSettings } from '../services/database';
import { 
  Wifi, WifiOff, Smartphone, IdCard, 
  CheckCircle, AlertCircle, Clock, ArrowLeftRight 
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
        const checkInLate = settings?.rfidCheckInLate || '07:30';
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

        const newLog = await saveRfidLog({
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          className: student.classId, // We should ideally have the actual class name string
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Terminal Absensi RFID</h1>
            <p className="text-blue-100 opacity-90">{user.schoolName}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setMethod('KEYBOARD')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${method === 'KEYBOARD' ? 'bg-white text-blue-600 shadow-md' : 'bg-blue-500 text-white hover:bg-blue-400'}`}
            >
              <Smartphone size={18} />
              Keyboard
            </button>
            <button 
              onClick={() => {
                setMethod('SERIAL');
                if (!serialConnected) connectSerial();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${method === 'SERIAL' ? 'bg-white text-blue-600 shadow-md' : 'bg-blue-500 text-white hover:bg-blue-400'}`}
            >
              <Wifi size={18} />
              Web Serial
            </button>
          </div>
        </div>

        <div className="p-8 md:p-12 text-center space-y-8">
          <div className="relative mx-auto w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
            {/* Background Animation */}
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
              status === 'SUCCESS' ? 'bg-green-400' : 
              status === 'ERROR' ? 'bg-red-400' : 
              status === 'READING' ? 'bg-blue-400' : 'bg-gray-200'
            }`} />
            
            <div className={`relative z-10 w-full h-full rounded-full border-8 flex items-center justify-center transition-colors duration-300 ${
              status === 'SUCCESS' ? 'border-green-500 bg-green-50' : 
              status === 'ERROR' ? 'border-red-500 bg-red-50' : 
              status === 'READING' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
            }`}>
              {status === 'SUCCESS' && lastStudent ? (
                <div className="flex flex-col items-center">
                  <CheckCircle size={64} className="text-green-500 mb-2" />
                  <span className="font-bold text-green-700">BERHASIL</span>
                </div>
              ) : status === 'ERROR' ? (
                <div className="flex flex-col items-center">
                  <AlertCircle size={64} className="text-red-500 mb-2" />
                  <span className="font-bold text-red-700">GAGAL</span>
                </div>
              ) : (
                <IdCard size={80} className={`${status === 'READING' ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className={`text-2xl md:text-3xl font-bold transition-colors ${
              status === 'SUCCESS' ? 'text-green-600' : 
              status === 'ERROR' ? 'text-red-600' : 'text-gray-800'
            }`}>
              {message}
            </h2>
            {status === 'IDLE' && (
              <p className="text-gray-500 flex items-center justify-center gap-2">
                <Clock size={16} /> Mode {method === 'KEYBOARD' ? 'Keyboard Emulator' : 'Web Serial API'} Aktif
              </p>
            )}
          </div>

          {lastStudent && status === 'SUCCESS' && (
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-4">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                <span className="text-3xl font-bold">{lastStudent.name.charAt(0)}</span>
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-xl font-bold text-gray-900">{lastStudent.name}</h3>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2 text-sm text-gray-500 font-medium">
                  <span className="bg-white px-3 py-1 rounded-full border border-gray-200">NIS: {lastStudent.nis}</span>
                  <span className={`px-3 py-1 rounded-full border ${lastStudent.gender === 'L' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-pink-50 border-pink-100 text-pink-700'}`}>
                    {lastStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-blue-600" />
            Riwayat Absensi Terakhir
          </h3>
          <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded border border-gray-200">Hari Ini</span>
        </div>
        <div className="divide-y divide-gray-50">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic text-sm">
              Belum ada log absensi terpantau.
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                    {log.studentName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{log.studentName}</h4>
                    <p className="text-[10px] text-gray-500">{new Date(log.timestamp).toLocaleTimeString('id-ID')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    log.status === 'HADIR' ? 'bg-green-100 text-green-700' : 
                    log.status === 'TERLAMBAT' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {log.status}
                  </span>
                  <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-tighter">via {log.method}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RfidTerminal;
