import React, { useState } from 'react';
import { Student, ClassRoom } from '../types';
import { User, ClipboardList, Search, Filter, CheckCircle, AlertCircle, Clock } from './Icons';
import { saveRfidLog } from '../services/database';

interface ManualAttendanceProps {
  students: Student[];
  classes: ClassRoom[];
  user: any;
}

const ManualAttendance: React.FC<ManualAttendanceProps> = ({ students, classes, user }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClassId === 'ALL' || s.classId === selectedClassId;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         s.nis.includes(searchQuery);
    return matchesClass && matchesSearch;
  });

  const handleManualAbsence = async (student: Student, type: 'HADIR' | 'PULANG') => {
    try {
      await saveRfidLog({
        studentId: student.id,
        studentName: student.name,
        classId: student.classId,
        className: classes.find(c => c.id === student.classId)?.name || 'Unknown',
        schoolNpsn: user.schoolNpsn,
        timestamp: new Date().toISOString(),
        status: type,
        method: 'KEYBOARD' // Categorized as manual/keyboard
      });
      
      setStatus('SUCCESS');
      setMessage(`Absensi ${type} berhasil untuk ${student.name}`);
      
      setTimeout(() => {
        setStatus('IDLE');
        setMessage('');
      }, 3000);
    } catch (error) {
      console.error(error);
      setStatus('ERROR');
      setMessage('Gagal memproses absensi manual.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-orange-500" />
            Absensi Manual (Fallback)
          </h3>
          <p className="text-xs text-gray-500">
            Gunakan jika siswa lupa membawa kartu atau QR, atau jika sistem scanner bermasalah.
          </p>
        </div>

        {/* Feedback Alert */}
        {status !== 'IDLE' && (
          <div className={`m-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${status === 'SUCCESS' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {status === 'SUCCESS' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-bold">{message}</p>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Cari nama atau NIS siswa..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              <Filter size={16} className="text-gray-400 shrink-0" />
              <button
                onClick={() => setSelectedClassId('ALL')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition ${selectedClassId === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
              >
                SEMUA KELAS
              </button>
              {classes.sort((a,b) => a.name.localeCompare(b.name)).map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition ${selectedClassId === cls.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
                >
                  {cls.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic">
              Data siswa tidak ditemukan.
            </div>
          ) : (
            filteredStudents.map((student) => (
              <div key={student.id} className="p-4 flex flex-col sm:flex-row items-center justify-between hover:bg-gray-50 transition gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{student.name}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className="font-mono">NIS: {student.nis}</span>
                      <span>•</span>
                      <span className="font-bold text-blue-600">{classes.find(c => c.id === student.classId)?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => handleManualAbsence(student, 'HADIR')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold border border-green-100 hover:bg-green-100 transition whitespace-nowrap"
                  >
                    TAP MASUK
                  </button>
                  <button 
                    onClick={() => handleManualAbsence(student, 'PULANG')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100 hover:bg-blue-100 transition whitespace-nowrap"
                  >
                    TAP PULANG
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualAttendance;
