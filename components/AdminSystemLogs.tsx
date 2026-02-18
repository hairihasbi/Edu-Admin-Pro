
import React, { useState, useEffect, useRef } from 'react';
import { Activity, Trash2, Filter, AlertCircle, CheckCircle, Info, RefreshCcw, Shield, Server, Wifi, WifiOff, Zap } from './Icons';
import { getSystemLogs, clearSystemLogs, addSystemLog } from '../services/database';
import { LogEntry } from '../types';

const AdminSystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterActor, setFilterActor] = useState<string>('');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Server Health State
  const [serverStatus, setServerStatus] = useState<'ONLINE' | 'OFFLINE' | 'SLOW'>('ONLINE');
  const [latency, setLatency] = useState<number>(0);
  const [uptimeCheckCount, setUptimeCheckCount] = useState(0);
  const prevStatusRef = useRef<'ONLINE' | 'OFFLINE' | 'SLOW'>('ONLINE');
  
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = async () => {
    const data = await getSystemLogs();
    // Sort by newest first
    setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setLastUpdated(new Date());
  };

  // --- REALTIME SERVER MONITOR LOGIC ---
  const checkServerHealth = async () => {
      const start = Date.now();
      try {
          // Timeout 3 detik untuk menganggap server "down" jika lambat sekali
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const res = await fetch('/api/health', { signal: controller.signal });
          clearTimeout(timeoutId);

          const data = await res.json();
          const currentLatency = data.latency || (Date.now() - start);
          setLatency(currentLatency);

          let currentStatus: 'ONLINE' | 'OFFLINE' | 'SLOW' = 'ONLINE';

          if (!res.ok || data.status === 'error') {
              currentStatus = 'OFFLINE';
          } else if (currentLatency > 1500) {
              currentStatus = 'SLOW';
          }

          setServerStatus(currentStatus);
          handleAutoLogging(currentStatus, currentLatency, data.message);

      } catch (e) {
          setServerStatus('OFFLINE');
          setLatency(Date.now() - start);
          handleAutoLogging('OFFLINE', 0, 'Connection Timeout / Network Error');
      }
      setUptimeCheckCount(c => c + 1);
  };

  const handleAutoLogging = (currentStatus: string, currentLatency: number, msg: string) => {
      const prev = prevStatusRef.current;
      const now = new Date();

      // 1. Log jika Status Berubah (misal: Online -> Offline)
      if (currentStatus !== prev) {
          if (currentStatus === 'OFFLINE') {
              addSystemLog('ERROR', 'SYSTEM', 'Server Monitor', 'Connection Lost', `Server down or unreachable. Error: ${msg}`);
          } else if (currentStatus === 'SLOW') {
              addSystemLog('WARNING', 'SYSTEM', 'Server Monitor', 'High Latency', `Server response time critical: ${currentLatency}ms`);
          } else if (prev === 'OFFLINE' && currentStatus === 'ONLINE') {
              addSystemLog('SUCCESS', 'SYSTEM', 'Server Monitor', 'Connection Restored', `Server is back online. Latency: ${currentLatency}ms`);
          }
          fetchLogs(); // Refresh list immediately
      }

      // 2. Heartbeat Log (Setiap 100x pengecekan / ~sekitar 8-10 menit sekali)
      if (uptimeCheckCount > 0 && uptimeCheckCount % 100 === 0 && currentStatus === 'ONLINE') {
          addSystemLog('INFO', 'SYSTEM', 'Server Monitor', 'Heartbeat', `Routine check: Server OK. Latency: ${currentLatency}ms`);
          fetchLogs();
      }

      prevStatusRef.current = currentStatus as any;
  };

  useEffect(() => {
    fetchLogs();
    
    // Log Refresh Polling (Local DB)
    if (isAutoRefresh) {
      refreshInterval.current = setInterval(fetchLogs, 5000); 
    }

    // Server Health Ping (Real API) - Every 5 seconds
    healthCheckInterval.current = setInterval(checkServerHealth, 5000);
    checkServerHealth(); // Initial check

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);
    };
  }, [isAutoRefresh]);

  const handleClearLogs = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua log sistem? Tindakan ini tidak dapat dibatalkan.")) {
      await clearSystemLogs();
      fetchLogs();
    }
  };

  const filteredLogs = logs.filter(log => {
    let matchLevel = true;
    if (filterLevel === 'AUDIT') {
        matchLevel = log.action === 'Update Score';
    } else if (filterLevel === 'SYSTEM') {
        matchLevel = log.role === 'SYSTEM'; // New Filter
    } else if (filterLevel !== 'ALL') {
        matchLevel = log.level === filterLevel;
    }

    const matchActor = filterActor === '' || log.actor.toLowerCase().includes(filterActor.toLowerCase()) || log.action.toLowerCase().includes(filterActor.toLowerCase());
    return matchLevel && matchActor;
  });

  return (
    <div className="space-y-6 pb-10">
      
      {/* REALTIME SERVER HEALTH WIDGET */}
      <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 p-6 text-white relative overflow-hidden">
          {/* Background Animation */}
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full mix-blend-overlay filter blur-3xl opacity-20 ${
              serverStatus === 'ONLINE' ? 'bg-green-500' : 
              serverStatus === 'SLOW' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-full ${
                      serverStatus === 'ONLINE' ? 'bg-green-500/20 text-green-400' : 
                      serverStatus === 'SLOW' ? 'bg-yellow-500/20 text-yellow-400' : 
                      'bg-red-500/20 text-red-400'
                  }`}>
                      <Server size={32} />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                          Server Status Monitor
                          {serverStatus === 'ONLINE' && <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                          </span>}
                      </h2>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span className={`font-mono font-bold ${
                              serverStatus === 'ONLINE' ? 'text-green-400' : 
                              serverStatus === 'SLOW' ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                              {serverStatus === 'ONLINE' ? 'OPERATIONAL' : serverStatus === 'SLOW' ? 'HIGH LATENCY' : 'DOWN / UNREACHABLE'}
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                              <Activity size={14} /> Latency: {latency}ms
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                              <RefreshCcw size={14} className="animate-spin" /> Live Check (5s)
                          </span>
                      </div>
                  </div>
              </div>

              {/* Ping Visualizer */}
              <div className="flex items-end gap-1 h-12 w-full md:w-48">
                  {Array.from({length: 10}).map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-full rounded-t-sm transition-all duration-500 ${
                            i === 9 ? (
                                serverStatus === 'ONLINE' ? 'bg-green-500' : 
                                serverStatus === 'SLOW' ? 'bg-yellow-500' : 'bg-red-500'
                            ) : 'bg-gray-700'
                        }`}
                        style={{ 
                            height: i === 9 ? `${Math.min(100, Math.max(20, (latency / 100) * 100))}%` : '20%',
                            opacity: i === 9 ? 1 : 0.3 + (i * 0.05)
                        }}
                      ></div>
                  ))}
              </div>
          </div>
      </div>

      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <Activity size={20} className="text-blue-600" /> Log Aktivitas Sistem
            </h2>
            <p className="text-sm text-gray-500">Mencatat aktivitas user dan kesehatan server secara otomatis.</p>
        </div>

        <div className="flex items-center gap-3">
           <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600">
              <input 
                type="checkbox" 
                checked={isAutoRefresh} 
                onChange={(e) => setIsAutoRefresh(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Auto-Refresh Table
           </label>
           <button 
             onClick={handleClearLogs}
             className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition text-sm"
           >
             <Trash2 size={16} /> Reset Log
           </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
         <div className="flex items-center gap-2 text-gray-500">
            <Filter size={18} />
            <span className="text-sm font-medium">Filter:</span>
         </div>
         <select 
           value={filterLevel}
           onChange={(e) => setFilterLevel(e.target.value)}
           className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
         >
            <option value="ALL">Semua Aktivitas</option>
            <option value="SYSTEM">🖥️ System & Server</option>
            <option value="AUDIT">🔒 Audit Trail (User)</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
         </select>
         <input 
           type="text" 
           placeholder="Cari Actor / Action..."
           value={filterActor}
           onChange={(e) => setFilterActor(e.target.value)}
           className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-[200px]"
         />
      </div>

      {/* Log Terminal/Table */}
      <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-700 font-mono text-sm">
         <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
            <div className="flex gap-2">
               <div className="w-3 h-3 rounded-full bg-red-500"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
               <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-gray-400 text-xs flex items-center gap-1">
                <Server size={10} /> system_audit.log
            </span>
         </div>
         
         <div className="max-h-[600px] overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {filteredLogs.length === 0 ? (
               <div className="text-gray-500 italic text-center py-10">-- Tidak ada log ditemukan --</div>
            ) : (
               filteredLogs.map((log) => {
                  const isAudit = log.action === 'Update Score';
                  const isSystem = log.role === 'SYSTEM';
                  return (
                    <div 
                        key={log.id} 
                        className={`flex flex-col md:flex-row gap-1 md:gap-3 p-2 rounded transition group items-start ${
                            isAudit ? 'bg-yellow-900/20 border-l-2 border-yellow-500' : 
                            isSystem ? 'bg-blue-900/10 border-l-2 border-blue-500' : 
                            'hover:bg-gray-800'
                        }`}
                    >
                        <span className="text-gray-500 shrink-0 select-none w-32 text-xs pt-0.5">
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                        </span>
                        
                        <span className={`shrink-0 font-bold w-16 text-center text-xs ${
                            log.level === 'ERROR' ? 'text-red-400' : 
                            log.level === 'WARNING' ? 'text-yellow-400' : 
                            log.level === 'SUCCESS' ? 'text-green-400' : 
                            'text-blue-400'
                        }`}>
                            [{log.level}]
                        </span>

                        <span className={`shrink-0 w-24 truncate font-bold ${isSystem ? 'text-cyan-400' : 'text-purple-400'}`} title={log.actor}>
                            {isSystem ? <span className="flex items-center gap-1"><Server size={10}/> SYSTEM</span> : `@${log.actor}`}
                        </span>

                        <span className={`font-semibold shrink-0 w-40 truncate flex items-center gap-1 ${isAudit ? 'text-yellow-200' : 'text-gray-300'}`} title={log.action}>
                            {isAudit && <Shield size={10} />}
                            {log.action}
                        </span>

                        <span className={`break-all ${isAudit ? 'text-yellow-100' : 'text-gray-400'} group-hover:text-white transition flex-1`}>
                            {log.details}
                        </span>
                    </div>
                  );
               })
            )}
         </div>
      </div>
    </div>
  );
};

export default AdminSystemLogs;
