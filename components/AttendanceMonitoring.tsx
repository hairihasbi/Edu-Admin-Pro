
import React, { useState, useEffect } from 'react';
import { User, RfidLog, SystemSettings } from '../types';
import { getRfidLogs, getSystemSettings } from '../services/database';
import { 
  ClipboardList, Search, Calendar, Filter, 
  Download, Printer, CheckCircle, Clock, 
  Smartphone, Wifi, User as UserIcon
} from './Icons';

interface AttendanceMonitoringProps {
  user: User;
}

interface AggregatedAttendance {
  studentId: string;
  studentName: string;
  className: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

const AttendanceMonitoring: React.FC<AttendanceMonitoringProps> = ({ user }) => {
  const [logs, setLogs] = useState<RfidLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    const [logData, settingsData] = await Promise.all([
      getRfidLogs(user.schoolNpsn || '', dateFilter),
      getSystemSettings()
    ]);
    setLogs(logData);
    setSettings(settingsData || null);
    setLoading(false);
  };

  const aggregateLogs = (): AggregatedAttendance[] => {
    const map = new Map<string, AggregatedAttendance>();

    logs.forEach(log => {
      if (!map.has(log.studentId)) {
        map.set(log.studentId, {
          studentId: log.studentId,
          studentName: log.studentName,
          className: log.className,
          checkIn: null,
          checkOut: null,
          status: 'HADIR'
        });
      }

      const entry = map.get(log.studentId)!;
      const logTime = new Date(log.timestamp);
      
      if (log.status === 'HADIR' || log.status === 'TERLAMBAT') {
        if (!entry.checkIn || logTime < new Date(entry.checkIn)) {
          entry.checkIn = log.timestamp;
          if (log.status === 'TERLAMBAT') entry.status = 'TERLAMBAT';
        }
      } else if (log.status === 'PULANG') {
        if (!entry.checkOut || logTime > new Date(entry.checkOut)) {
          entry.checkOut = log.timestamp;
        }
      }
    });

    // Post-process for "Pulang Cepat"
    if (settings && settings.rfidCheckOutStart) {
      const threshold = settings.rfidCheckOutStart;
      map.forEach(entry => {
        if (entry.checkOut) {
          const checkOutTimeStr = new Date(entry.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
          if (checkOutTimeStr < threshold) {
            entry.status = entry.status === 'TERLAMBAT' ? 'TERLAMBAT & PULANG CEPAT' : 'PULANG CEPAT';
          }
        }
      });
    }

    return Array.from(map.values());
  };

  const aggregatedData = aggregateLogs();
  const filteredData = aggregatedData.filter(d => 
    d.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: aggregatedData.length,
    onTime: aggregatedData.filter(d => d.status === 'HADIR').length,
    late: aggregatedData.filter(d => d.status.includes('TERLAMBAT')).length,
    earlyLeave: aggregatedData.filter(d => d.status.includes('PULANG CEPAT')).length
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Pantau Absensi RFID</h2>
            <p className="text-sm text-gray-500">Monitor kehadiran siswa berdasarkan jam datang & pulang.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <input 
              type="date" 
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
              <Download size={18} /> Ekspor
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cari nama siswa..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Siswa Hadir', value: stats.total, color: 'blue' },
          { label: 'Tepat Waktu', value: stats.onTime, color: 'green' },
          { label: 'Terlambat', value: stats.late, color: 'orange' },
          { label: 'Pulang Cepat', value: stats.earlyLeave, color: 'red' }
        ].map((stat, i) => (
          <div key={i} className={`bg-white p-4 rounded-xl border-l-4 border-${stat.color}-500 shadow-sm transition-all hover:scale-[1.02]`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4">Kelas</th>
                <th className="p-4 text-center">Jam Datang</th>
                <th className="p-4 text-center">Jam Pulang</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-48"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-20"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-16 mx-auto"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-16 mx-auto"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400 italic font-medium">
                    Tidak ada aktivitas absensi ditemukan.
                  </td>
                </tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.studentId} className="hover:bg-gray-50 transition border-b border-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                          {item.studentName.charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900">{item.studentName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase">{item.className}</span>
                    </td>
                    <td className="p-4 text-center">
                      {item.checkIn ? (
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-bold text-gray-800">
                            {new Date(item.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {item.checkOut ? (
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-bold text-gray-800">
                            {new Date(item.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {item.status.split(' & ').map((s, idx) => (
                          <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                            s === 'HADIR' ? 'bg-green-100 text-green-700' : 
                            s === 'TERLAMBAT' ? 'bg-orange-100 text-orange-700' : 
                            s === 'PULANG CEPAT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {s === 'HADIR' ? 'TEPAT WAKTU' : s}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMonitoring;
