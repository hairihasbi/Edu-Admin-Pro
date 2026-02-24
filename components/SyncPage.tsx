
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { getSyncStats, runManualSync, resetSyncLock } from '../services/database';
import { checkConnection } from '../services/tursoService';
import { Cloud, Upload, Download, RefreshCcw, CheckCircle, AlertTriangle, ArrowLeftRight, Database, Wifi, RotateCcw } from './Icons';

interface SyncPageProps {
  user: User;
}

const SyncPage: React.FC<SyncPageProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<{table: string, count: number}[]>([]);
  const [totalUnsynced, setTotalUnsynced] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshStats();
    checkConn();

    // Listen to background sync changes to update stats in real-time
    const handleUnsavedChanges = () => {
        refreshStats();
    };
    
    window.addEventListener('unsaved-changes', handleUnsavedChanges);
    window.addEventListener('sync-status', handleUnsavedChanges);

    return () => {
        window.removeEventListener('unsaved-changes', handleUnsavedChanges);
        window.removeEventListener('sync-status', handleUnsavedChanges);
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const refreshStats = async () => {
    // Pass user to getSyncStats to apply role-based filtering
    const data = await getSyncStats(user);
    setStats(data.stats);
    setTotalUnsynced(data.totalUnsynced);
  };

  const checkConn = async () => {
    if (navigator.onLine) {
        const status = await checkConnection();
        setIsConnected(status);
    } else {
        setIsConnected(false);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleSync = async (direction: 'PUSH' | 'PULL' | 'FULL') => {
    setLoading(true);
    setLogs([]); // Clear logs for new run
    
    await runManualSync(direction, addLog);
    
    await refreshStats();
    setLoading(false);
  };

  const handleResetLock = () => {
      resetSyncLock();
      alert("Kunci sinkronisasi berhasil di-reset. Silakan coba sync ulang.");
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Sync Lock Reset Manual.`]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <ArrowLeftRight size={24} />
            </div>
            <div>
            <h2 className="text-xl font-bold text-gray-800">Sinkronisasi Data Cloud</h2>
            <p className="text-gray-500">
                {user.role === UserRole.ADMIN 
                ? 'Kelola sinkronisasi seluruh data sekolah (Admin Mode).'
                : 'Sinkronkan data kelas dan siswa Anda dengan server.'}
            </p>
            </div>
        </div>
        <button 
            onClick={handleResetLock}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition border border-red-200"
            title="Gunakan jika proses sync macet"
        >
            <RotateCcw size={14} /> Reset Status Macet
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Connection Status */}
         <div className={`p-6 rounded-xl border flex items-center justify-between ${
             isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
         }`}>
             <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-full ${isConnected ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                     {isConnected ? <Wifi size={24} /> : <AlertTriangle size={24} />}
                 </div>
                 <div>
                     <h4 className={`font-bold ${isConnected ? 'text-green-800' : 'text-red-800'}`}>
                         {isConnected ? 'Terhubung ke Server' : 'Koneksi Terputus'}
                     </h4>
                     <p className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                         {isConnected ? 'Siap melakukan sinkronisasi.' : 'Cek internet atau konfigurasi database.'}
                     </p>
                 </div>
             </div>
             <button onClick={checkConn} className="p-2 bg-white/50 rounded-full hover:bg-white transition" title="Cek Koneksi">
                 <RefreshCcw size={16} />
             </button>
         </div>

         {/* Pending Data Status */}
         <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-orange-100 text-orange-600 rounded-full">
                     <Database size={24} />
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-800">Data Pending</h4>
                     <p className="text-sm text-gray-500">
                         {totalUnsynced} item menunggu upload
                     </p>
                 </div>
             </div>
             {totalUnsynced > 0 && (
                 <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                     Perlu Sync
                 </span>
             )}
         </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                  <Upload size={32} />
              </div>
              <div>
                  <h3 className="font-bold text-gray-800 text-lg">Push (Kirim)</h3>
                  <p className="text-sm text-gray-500 mt-1">
                      Upload data offline (Nilai, Jurnal) ke server pusat.
                  </p>
              </div>
              <button 
                  onClick={() => handleSync('PUSH')}
                  disabled={loading || !isConnected}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  {loading ? <RefreshCcw className="animate-spin" /> : <Upload size={18} />}
                  Mulai Upload
              </button>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-purple-50 text-purple-600 rounded-full">
                  <Download size={32} />
              </div>
              <div>
                  <h3 className="font-bold text-gray-800 text-lg">Pull (Ambil)</h3>
                  <p className="text-sm text-gray-500 mt-1">
                      Download data terbaru dari server (Siswa/Guru baru).
                  </p>
              </div>
              <button 
                  onClick={() => handleSync('PULL')}
                  disabled={loading || !isConnected}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  {loading ? <RefreshCcw className="animate-spin" /> : <Download size={18} />}
                  Mulai Download
              </button>
          </div>

          <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center text-center space-y-4 ring-2 ring-indigo-50">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                  <RefreshCcw size={32} />
              </div>
              <div>
                  <h3 className="font-bold text-gray-800 text-lg">Full Sync (Smart)</h3>
                  <p className="text-sm text-gray-500 mt-1">
                      Sinkronisasi total (Kirim & Ambil) secara optimal.
                  </p>
              </div>
              <button 
                  onClick={() => handleSync('FULL')}
                  disabled={loading || !isConnected}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  {loading ? <RefreshCcw className="animate-spin" /> : <ArrowLeftRight size={18} />}
                  Mulai Full Sync
              </button>
          </div>
      </div>

      {/* Detail Stats & Log Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Detail Unsynced List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-1">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h4 className="font-bold text-gray-800">Rincian Data Pending</h4>
                  <button onClick={refreshStats} title="Refresh Data" className="text-gray-400 hover:text-gray-600">
                      <RefreshCcw size={14} />
                  </button>
              </div>
              
              {stats.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                      <CheckCircle size={32} className="mx-auto mb-2 text-green-200" />
                      Semua data sudah tersinkron.
                  </div>
              ) : (
                  <ul className="space-y-2">
                      {stats.map((s, idx) => (
                          <li key={idx} className="flex justify-between text-sm p-2 bg-orange-50 rounded text-orange-800">
                              <span className="capitalize">{s.table}</span>
                              <span className="font-bold">{s.count}</span>
                          </li>
                      ))}
                  </ul>
              )}
          </div>

          {/* Terminal Log */}
          <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 overflow-hidden lg:col-span-2 flex flex-col h-64">
              <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-mono">Sync Process Log</span>
                  {loading && <RefreshCcw size={12} className="text-green-400 animate-spin" />}
              </div>
              <div className="p-4 overflow-y-auto font-mono text-xs space-y-1 flex-1 text-green-400">
                  {logs.length === 0 && <span className="text-gray-600 opacity-50">Menunggu perintah...</span>}
                  {logs.map((log, i) => (
                      <div key={i}>{log}</div>
                  ))}
                  <div ref={logEndRef} />
              </div>
          </div>
      </div>

    </div>
  );
};

export default SyncPage;
