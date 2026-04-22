
import React, { useState, useEffect } from 'react';
import { User, RfidLog } from '../types';
import { getRfidLogs } from '../services/database';
import { 
  ClipboardList, Search, Calendar, Filter, 
  Download, Printer, CheckCircle, Clock, 
  Smartphone, Wifi 
} from './Icons';

interface AttendanceMonitoringProps {
  user: User;
}

const AttendanceMonitoring: React.FC<AttendanceMonitoringProps> = ({ user }) => {
  const [logs, setLogs] = useState<RfidLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [dateFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getRfidLogs(user.schoolNpsn || '', dateFilter);
    setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(l => 
    l.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Pantau Absensi RFID</h2>
            <p className="text-sm text-gray-500">Monitor real-time kehadiran siswa via terminal RFID.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Tap', value: logs.length, color: 'blue' },
          { label: 'Tepat Waktu', value: logs.filter(l => l.status === 'HADIR').length, color: 'green' },
          { label: 'Terlambat', value: logs.filter(l => l.status === 'TERLAMBAT').length, color: 'orange' }
        ].map((stat, i) => (
          <div key={i} className={`bg-white p-4 rounded-xl border-l-4 border-${stat.color}-500 shadow-sm`}>
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
                <th className="p-4">Waktu</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4">Status</th>
                <th className="p-4">Metode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-48"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-20"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400 italic font-medium">
                    {dateFilter === new Date().toISOString().split('T')[0] 
                      ? 'Belum ada aktivitas tap hari ini.' 
                      : 'Tidak ada data log untuk tanggal ini.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition border-b border-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-700 font-medium">
                        <Clock size={14} className="text-gray-400" />
                        {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                          {log.studentName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 block">{log.studentName}</span>
                          <span className="text-[10px] text-gray-500 uppercase">{log.className}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        log.status === 'HADIR' ? 'bg-green-100 text-green-700' : 
                        log.status === 'TERLAMBAT' ? 'bg-orange-100 text-orange-700' : 
                        log.status === 'PULANG' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.status === 'HADIR' ? 'MASUK' : log.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
                        {log.method === 'SERIAL' ? <Wifi size={14} /> : <Smartphone size={14} />}
                        {log.method}
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
