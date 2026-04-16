
import React, { useState, useEffect } from 'react';
import { User, SupervisionAssignment } from '../types';
import { getSchoolTeachers, toggleSupervisorStatus, saveSupervisionAssignment, getSupervisionAssignments, deleteSupervisionAssignment } from '../services/database';
import { Users, Shield, CheckCircle, XCircle, Trash2, Plus, Search, Calendar, UserCheck, Loader2, AlertCircle, Clock } from './Icons';

interface SupervisionManagerProps {
  user: User;
}

const SupervisionManager: React.FC<SupervisionManagerProps> = ({ user }) => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<SupervisionAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form state for new assignment
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [user.schoolNpsn]);

  const fetchData = async () => {
    if (!user.schoolNpsn) return;
    setLoading(true);
    try {
      const [schoolTeachers, schoolAssignments] = await Promise.all([
        getSchoolTeachers(user.schoolNpsn),
        getSupervisionAssignments(user.schoolNpsn)
      ]);
      setTeachers(schoolTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setAssignments(schoolAssignments);
    } catch (error) {
      console.error("Failed to fetch supervision data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSupervisor = async (teacherId: string, currentStatus: boolean) => {
    try {
      await toggleSupervisorStatus(teacherId, !currentStatus);
      setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, isSupervisor: !currentStatus } : t));
    } catch (error) {
      console.error("Failed to toggle supervisor status:", error);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedSupervisor || !selectedTeacher) {
      alert("Pilih supervisor dan guru yang akan disupervisi.");
      return;
    }

    if (selectedSupervisor === selectedTeacher) {
      alert("Supervisor tidak bisa mensupervisi diri sendiri.");
      return;
    }

    setIsSaving(true);
    try {
      const newAssignment: Omit<SupervisionAssignment, 'id'|'lastModified'|'isSynced'> = {
        supervisorId: selectedSupervisor,
        teacherId: selectedTeacher,
        schoolNpsn: user.schoolNpsn!,
        status: 'PENDING',
        startDate,
        endDate
      };
      await saveSupervisionAssignment(newAssignment);
      await fetchData();
      setSelectedTeacher('');
    } catch (error) {
      console.error("Failed to save assignment:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Hapus penugasan supervisi ini?")) return;
    try {
      await deleteSupervisionAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error("Failed to delete assignment:", error);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.nip && t.nip.includes(searchQuery))
  );

  const supervisors = teachers.filter(t => t.isSupervisor);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Supervisor Management */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-purple-600" size={20} />
              <h3 className="font-bold text-gray-800">Daftar Supervisor</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Tentukan guru yang bertindak sebagai supervisor untuk menilai rekan sejawat.
            </p>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
              <input 
                type="text"
                placeholder="Cari guru..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-600" /></div>
              ) : filteredTeachers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm italic">Guru tidak ditemukan</div>
              ) : (
                filteredTeachers.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-800 truncate">{t.fullName}</div>
                      <div className="text-[10px] text-gray-500">{t.subject || 'Guru'}</div>
                    </div>
                    <button
                      onClick={() => handleToggleSupervisor(t.id, !!t.isSupervisor)}
                      className={`p-1.5 rounded-lg transition ${
                        t.isSupervisor 
                          ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                          : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                      }`}
                      title={t.isSupervisor ? "Hapus akses supervisor" : "Jadikan supervisor"}
                    >
                      <UserCheck size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Assignment Management */}
        <div className="lg:col-span-2 space-y-4">
          {/* New Assignment Form */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="text-blue-600" size={20} />
              <h3 className="font-bold text-gray-800">Tambah Penugasan Supervisi</h3>
            </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Supervisor</label>
                  <select
                    value={selectedSupervisor}
                    onChange={(e) => setSelectedSupervisor(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pilih Supervisor</option>
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Guru yang Disupervisi</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pilih Guru</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Rentang Waktu</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">s/d</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <button
                    onClick={handleAddAssignment}
                    disabled={isSaving || !selectedSupervisor || !selectedTeacher}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Tugaskan
                  </button>
                </div>
              </div>
          </div>

          {/* Assignment List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="text-purple-600" size={18} />
                Jadwal & Status Supervisi
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Supervisor</th>
                    <th className="px-6 py-3">Guru Disupervisi</th>
                    <th className="px-6 py-3">Tanggal</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto text-purple-600" /></td></tr>
                  ) : assignments.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-gray-400 italic">Belum ada penugasan supervisi</td></tr>
                  ) : (
                    assignments.map(a => {
                      const supervisor = teachers.find(t => t.id === a.supervisorId);
                      const teacher = teachers.find(t => t.id === a.teacherId);
                      return (
                        <tr key={a.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-800">{supervisor?.fullName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-700">{teacher?.fullName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-gray-600">
                              {a.startDate && a.endDate ? (
                                <>
                                  <div className="font-medium text-gray-800">
                                    {new Date(a.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(a.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                  <div className="text-[10px] text-gray-400">Rentang Waktu</div>
                                </>
                              ) : a.scheduledDate ? (
                                new Date(a.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                              ) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
                              a.status === 'COMPLETED' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                            }`}>
                              {a.status === 'COMPLETED' ? <CheckCircle size={12} /> : <Clock size={12} />}
                              {a.status === 'COMPLETED' ? 'SELESAI' : 'MENUNGGU'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="p-1.5 text-red-400 hover:text-red-600 transition"
                              title="Hapus penugasan"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisionManager;
