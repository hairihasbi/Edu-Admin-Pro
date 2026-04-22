
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { db } from '../services/db';
import { updateRfidOfficerStatus } from '../services/database';
import { 
  Users, ShieldCheck, ShieldAlert, UserCheck, 
  Search, Filter, CheckCircle, Info 
} from './Icons';

interface RfidOfficerManagerProps {
  user: User;
}

const RfidOfficerManager: React.FC<RfidOfficerManagerProps> = ({ user }) => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    // Fetch all users with GURU or TENDIK role in the same school
    const users = await db.users
      .where('schoolNpsn').equals(user.schoolNpsn || 'DEFAULT')
      .filter((u: User) => u.role === UserRole.GURU || u.role === UserRole.TENDIK)
      .toArray();
    setTeachers(users.sort((a: User, b: User) => a.fullName.localeCompare(b.fullName)));
    setLoading(false);
  };

  const handleToggleOfficer = async (teacher: User) => {
    const nextStatus = !teacher.isRfidOfficer;
    const success = await updateRfidOfficerStatus(teacher.id, nextStatus);
    if (success) {
      setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, isRfidOfficer: nextStatus } : t));
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.nip && t.nip.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Petugas RFID</h2>
          <p className="text-sm text-gray-500">Tentukan siapa yang berhak mendaftarkan kartu RFID siswa.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cari Guru/Pendik..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
        <Info size={20} className="shrink-0" />
        <p>
          <strong>Informasi Kepsek:</strong> Guru atau Tendik yang dipilih sebagai Petugas RFID akan memiliki tombol 
          <strong> "Daftarkan RFID"</strong> di modul Manajemen Siswa/Kelas untuk mendaftarkan kartu kartu identitas siswa.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Guru / Tendik</th>
                <th className="p-4">NIP / Username</th>
                <th className="p-4">Peran Utama</th>
                <th className="p-4 text-center">Status Petugas RFID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-48"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-32"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
                    <td className="p-4"><div className="h-8 bg-gray-100 rounded-full w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400 italic">
                    Tidak menemukan Guru atau Tendik.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map(teacher => (
                  <tr key={teacher.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {teacher.fullName.charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900">{teacher.fullName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 font-mono text-xs">{teacher.nip || teacher.username}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${teacher.role === 'GURU' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                        {teacher.role}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleToggleOfficer(teacher)}
                        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                          teacher.isRfidOfficer 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {teacher.isRfidOfficer ? (
                          <>
                            <ShieldCheck size={14} />
                            AKTIF
                          </>
                        ) : (
                          <>
                            <ShieldAlert size={14} />
                            NON-AKTIF
                          </>
                        )}
                      </button>
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

export default RfidOfficerManager;
