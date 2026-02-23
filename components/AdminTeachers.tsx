
import React, { useState, useEffect } from 'react';
import { User, UserStatus } from '../types';
import { getTeachers, getPendingTeachers, approveTeacher, rejectTeacher, sendApprovalEmail, sendApprovalWhatsApp, deleteTeacher, runManualSync } from '../services/database';
import { User as UserIcon, CheckCircle, X, Shield, Search, School, Mail, ChevronLeft, ChevronRight, FileSpreadsheet, Smartphone, Trash2, MoreVertical, BookOpen, RefreshCcw } from './Icons';
import * as XLSX from 'xlsx';

const AdminTeachers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active');
  const [activeTeachers, setActiveTeachers] = useState<User[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Increased for list view

  useEffect(() => {
    fetchData();

    // Listen to sync events to refresh data automatically
    const handleSyncStatus = (e: any) => {
        if (e.detail === 'success') {
            fetchData();
        }
    };
    window.addEventListener('sync-status', handleSyncStatus);
    
    return () => {
        window.removeEventListener('sync-status', handleSyncStatus);
    };
  }, [activeTab]);

  // Reset pagination when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const fetchData = async () => {
    setIsLoading(true);
    
    if (activeTab === 'active') {
      const data = await getTeachers();
      setActiveTeachers(data);
    } else {
      const data = await getPendingTeachers();
      setPendingTeachers(data);
    }
    setIsLoading(false);
  };

  const handleSyncData = async () => {
      setIsSyncing(true);
      // PULL only to get latest registrations from server
      await runManualSync('PULL', (msg) => console.log(msg));
      await fetchData(); // Refresh list after pull
      setIsSyncing(false);
  };

  const handleApprove = async (teacher: User) => {
    if (window.confirm(`Setujui pendaftaran guru ${teacher.fullName}?`)) {
        setIsLoading(true);
        const success = await approveTeacher(teacher.id);
        if (success) {
            setPendingTeachers(prev => prev.filter(u => u.id !== teacher.id));
            
            // 1. Send Email Notification
            const emailResult = await sendApprovalEmail(teacher);
            
            // 2. Send WhatsApp Notification
            let waMessage = "";
            const currentUserStr = localStorage.getItem('eduadmin_user');
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                const waResult = await sendApprovalWhatsApp(teacher, currentUser.id);
                waMessage = waResult.success ? "✅ WA Terkirim" : `❌ WA Gagal (${waResult.message})`;
            } else {
                waMessage = "⚠️ WA Gagal (Admin ID tidak ditemukan)";
            }
            
            // Construct Final Message
            let message = "Guru berhasil disetujui dan aktif.";
            
            // Append Email Status
            if (emailResult.success) {
                message += "\n📧 Email Terkirim.";
            } else {
                message += "\n⚠️ Email Gagal.";
            }

            // Append WA Status
            message += `\n📱 ${waMessage}`;

            alert(message);
        } else {
            alert("Gagal menyetujui guru.");
        }
        setIsLoading(false);
    }
  };

  const handleReject = async (userId: string) => {
    if (window.confirm("Tolak dan hapus pendaftaran ini?")) {
        const success = await rejectTeacher(userId);
        if (success) {
            setPendingTeachers(prev => prev.filter(u => u.id !== userId));
        } else {
            alert("Gagal menolak guru.");
        }
    }
  };

  const handleDeleteAccount = async (teacher: User) => {
    if (window.confirm(`Yakin ingin MENGHAPUS AKUN guru: ${teacher.fullName}?\n\nPERINGATAN: Tindakan ini tidak dapat dibatalkan.`)) {
        setIsLoading(true);
        const success = await deleteTeacher(teacher.id);
        if (success) {
            setActiveTeachers(prev => prev.filter(u => u.id !== teacher.id));
            alert("Akun guru berhasil dihapus.");
        } else {
            alert("Gagal menghapus akun guru.");
        }
        setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    const data = activeTeachers.map((t, i) => ({
        No: i + 1,
        Nama: t.fullName,
        NIP: t.nip || '-',
        Mapel: t.subject || '-',
        Sekolah: t.schoolName || '-',
        Email: t.email,
        HP: t.phone,
        Status: t.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Guru");
    XLSX.writeFile(wb, "Data_Guru_EduAdmin.xlsx");
  };

  // Filter Logic
  const filteredList = (activeTab === 'active' ? activeTeachers : pendingTeachers).filter(t => 
      t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.schoolName && t.schoolName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserIcon className="text-blue-600" /> Manajemen Guru
          </h2>
          <p className="text-sm text-gray-500">Kelola akun guru, persetujuan pendaftaran, dan data sekolah.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleSyncData}
                disabled={isSyncing}
                className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-100 transition disabled:opacity-50"
            >
                <RefreshCcw size={16} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Syncing..." : "Sync Data"}
            </button>
            <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg font-medium hover:bg-green-100 transition"
            >
                <FileSpreadsheet size={16} /> Export Excel
            </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
            <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
            >
                Guru Aktif <span className="bg-blue-100 text-blue-700 px-2 rounded-full text-xs">{activeTeachers.length}</span>
            </button>
            <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'pending' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
            >
                Menunggu <span className="bg-orange-100 text-orange-700 px-2 rounded-full text-xs">{pendingTeachers.length}</span>
            </button>
          </div>

          <div className="relative w-full md:w-64">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             <input 
                type="text" 
                placeholder="Cari Nama / Sekolah..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
      </div>

      {/* List Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         {isLoading ? (
             <div className="p-10 text-center text-gray-400">Memuat data guru...</div>
         ) : filteredList.length === 0 ? (
             <div className="p-10 text-center text-gray-400">Tidak ada data guru ditemukan.</div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                         <tr>
                             <th className="p-4 w-10">No</th>
                             <th className="p-4">Nama Lengkap</th>
                             <th className="p-4">Sekolah / Instansi</th>
                             <th className="p-4">Mapel</th>
                             <th className="p-4">Kontak (WA/Email)</th>
                             <th className="p-4 text-center">Status</th>
                             <th className="p-4 text-center">Aksi</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {currentItems.map((teacher, idx) => (
                             <tr key={teacher.id} className="hover:bg-gray-50 transition">
                                 <td className="p-4 text-center text-gray-500">{indexOfFirstItem + idx + 1}</td>
                                 <td className="p-4">
                                     <div className="font-bold text-gray-800">{teacher.fullName}</div>
                                     <div className="text-xs text-gray-500">@{teacher.username}</div>
                                 </td>
                                 <td className="p-4">
                                     <div className="flex items-center gap-1 text-gray-700 font-medium">
                                         <School size={14} className="text-gray-400" /> {teacher.schoolName || '-'}
                                     </div>
                                     <div className="text-xs text-gray-400">NPSN: {teacher.schoolNpsn || '-'}</div>
                                 </td>
                                 <td className="p-4">
                                     <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                                         {teacher.subject || 'Umum'}
                                     </span>
                                 </td>
                                 <td className="p-4">
                                     <div className="flex flex-col gap-1">
                                         {teacher.phone && (
                                             <div className="flex items-center gap-1 text-xs text-green-700">
                                                 <Smartphone size={12} /> {teacher.phone}
                                             </div>
                                         )}
                                         <div className="flex items-center gap-1 text-xs text-gray-500">
                                             <Mail size={12} /> {teacher.email}
                                         </div>
                                     </div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                         teacher.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                                         teacher.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 
                                         'bg-red-100 text-red-700'
                                     }`}>
                                         {teacher.status}
                                     </span>
                                 </td>
                                 <td className="p-4 text-center">
                                     <div className="flex justify-center gap-2">
                                         {activeTab === 'pending' ? (
                                             <>
                                                 <button 
                                                     onClick={() => handleApprove(teacher)}
                                                     className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition"
                                                     title="Setujui"
                                                 >
                                                     <CheckCircle size={18} />
                                                 </button>
                                                 <button 
                                                     onClick={() => handleReject(teacher.id)}
                                                     className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition"
                                                     title="Tolak"
                                                 >
                                                     <X size={18} />
                                                 </button>
                                             </>
                                         ) : (
                                             <button 
                                                 onClick={() => handleDeleteAccount(teacher)}
                                                 className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 p-2 rounded-lg transition"
                                                 title="Hapus Akun"
                                             >
                                                 <Trash2 size={18} />
                                             </button>
                                         )}
                                     </div>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
         )}
         
         {/* Pagination */}
         {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-xs text-gray-500">
                    Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default AdminTeachers;
