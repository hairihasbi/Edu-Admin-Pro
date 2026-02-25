
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Filter, Shield, Server, Activity } from './Icons';
import { getSystemLogs, clearSystemLogs } from '../services/database';
import { LogEntry } from '../types';

const AdminSystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterActor, setFilterActor] = useState<string>('');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = async () => {
    const data = await getSystemLogs();
    // Sort by newest first
    setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  useEffect(() => {
    fetchLogs();
    
    // Log Refresh Polling (Local DB)
    if (isAutoRefresh) {
      refreshInterval.current = setInterval(fetchLogs, 5000); 
    }

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
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

    // Safe access to potentially undefined properties
    const actor = log.actor || '';
    const action = log.action || '';
    const matchActor = filterActor === '' || actor.toLowerCase().includes(filterActor.toLowerCase()) || action.toLowerCase().includes(filterActor.toLowerCase());
    
    return matchLevel && matchActor;
  });

  return (
    <div className="space-y-6 pb-10">
      
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
