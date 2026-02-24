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
                message += "\n⚠️ Email Gagal (Cek Konfigurasi SMTP/API).";
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
    const dataToExport = activeTab === 'active' ? activeTeachers : pendingTeachers;
    
    if (dataToExport.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const rows = dataToExport.map((t, index) => ({
        'No': index + 1,
        'Nama Lengkap': t.fullName,
        'NIP/NUPTK': t.nip || '-',
        'Email': t.email || '-',
        'No. WhatsApp': t.phone || '-',
        'Username': t.username,
        'Sekolah': t.schoolName || '-',
        'Mata Pelajaran': t.subject || '-',
        'Status': t.status,
        'Role Tambahan': t.additionalRole || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Guru");
    XLSX.writeFile(wb, `Data_Guru_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filter Logic
  const allData = activeTab === 'active' ? activeTeachers : pendingTeachers;
  const filteredTeachers = allData.filter(t => 
    (t.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.schoolName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTeachers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserIcon className="text-blue-600" /> Manajemen Guru
          </h2>
          <p className="text-sm text-gray-500">Kelola daftar guru dan persetujuan akun baru.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
           {/* SYNC BUTTON */}
           <button 
             onClick={handleSyncData}
             disabled={isSyncing}
             className="px-4 py-2 bg-blue-50 text-blue-700 rounded-md text-sm font-bold hover:bg-blue-100 transition flex items-center justify-center gap-2"
           >
             <RefreshCcw size={16} className={isSyncing ? "animate-spin" : ""} />
             {isSyncing ? 'Sinkronisasi...' : 'Tarik Data Baru'}
           </button>

           <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Guru Aktif
                </button>
                <button 
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                        activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Menunggu
                    {pendingTeachers.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{pendingTeachers.length}</span>
                    )}
                </button>
           </div>
        </div>
      </div>

      {/* Search Bar & Export */}
      <div className="flex flex-col sm:flex-row gap-2">
         <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari Nama, Username, atau Sekolah..." 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
         <button 
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm hover:bg-green-700 transition whitespace-nowrap"
            title="Download Data Excel"
         >
            <FileSpreadsheet size={20} /> Excel
         </button>
      </div>

      {/* Content - LIST VIEW */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header (Desktop) */}
          <div className="hidden md:flex bg-gray-50 border-b border-gray-200 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div className="w-12 text-center">#</div>
              <div className="flex-1">Identitas Guru</div>
              <div className="flex-1">Sekolah & Mapel</div>
              <div className="w-40">Kontak</div>
              <div className="w-24 text-center">Status</div>
              <div className="w-32 text-right">Aksi</div>
          </div>

          {isLoading ? (
             <div className="p-6 space-y-4">
                {Array.from({length: 5}).map((_, i) => (
                   <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="hidden md:block flex-1 h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="w-20 h-8 bg-gray-200 rounded"></div>
                   </div>
                ))}
             </div>
          ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-20">
                  <UserIcon size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Tidak ada data guru ditemukan.</p>
                  <p className="text-sm text-gray-400">
                      {activeTab === 'pending' ? 'Belum ada pendaftaran baru. Coba klik "Tarik Data Baru".' : 'Coba ubah kata kunci pencarian.'}
                  </p>
              </div>
          ) : (
              <div className="divide-y divide-gray-100">
                {currentItems.map((teacher, index) => (
                    <div key={teacher.id} className="group hover:bg-blue-50/50 transition-colors duration-200">
                        {/* Desktop Row Layout */}
                        <div className="hidden md:flex items-center px-6 py-4">
                            <div className="w-12 text-center text-gray-400 font-medium text-sm">
                                {indexOfFirstItem + index + 1}
                            </div>
                            
                            <div className="flex-1 flex items-center gap-3 pr-4">
                                <img src={teacher.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-200 object-cover" />
                                <div className="min-w-0">
                                    <h4 className="font-bold text-gray-800 text-sm truncate" title={teacher.fullName}>{teacher.fullName}</h4>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        @{teacher.username} 
                                        {teacher.nip && <span className="bg-gray-100 px-1 rounded text-[10px]">{teacher.nip}</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 pr-4 min-w-0">
                                <div className="text-sm text-gray-700 font-medium flex items-center gap-1.5 truncate" title={teacher.schoolName}>
                                    <School size={14} className="text-blue-500 flex-shrink-0" /> 
                                    <span className="truncate">{teacher.schoolName || <i className="text-gray-400">Sekolah belum diatur</i>}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 truncate">
                                    <BookOpen size={14} className="text-purple-500 flex-shrink-0" />
                                    <span>{teacher.subject || '-'}</span>
                                </div>
                            </div>

                            <div className="w-40 flex items-center gap-2">
                                {teacher.phone ? (
                                    <a href={`https://wa.me/${teacher.phone}`} target="_blank" rel="noreferrer" className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition" title={teacher.phone}>
                                        <Smartphone size={16} />
                                    </a>
                                ) : <span className="p-1.5 text-gray-300"><Smartphone size={16} /></span>}
                                
                                {teacher.email ? (
                                    <a href={`mailto:${teacher.email}`} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title={teacher.email}>
                                        <Mail size={16} />
                                    </a>
                                ) : <span className="p-1.5 text-gray-300"><Mail size={16} /></span>}
                            </div>

                            <div className="w-24 text-center">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                    teacher.status === 'ACTIVE' 
                                    ? 'bg-green-50 text-green-600 border-green-200' 
                                    : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                                }`}>
                                    {teacher.status === 'ACTIVE' ? 'Aktif' : 'Pending'}
                                </span>
                            </div>

                            <div className="w-32 flex justify-end gap-2">
                                {activeTab === 'pending' ? (
                                    <>
                                        <button onClick={() => handleApprove(teacher)} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition" title="Setujui">
                                            <CheckCircle size={16} />
                                        </button>
                                        <button onClick={() => handleReject(teacher.id)} className="p-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition" title="Tolak">
                                            <X size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => handleDeleteAccount(teacher)} className="flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-bold transition border border-transparent hover:border-red-200">
                                        <Trash2 size={14} /> Hapus
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Mobile Row Layout */}
                        <div className="md:hidden p-4 flex gap-3">
                            <img src={teacher.avatar} alt="Avatar" className="w-12 h-12 rounded-full border border-gray-200 object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm">{teacher.fullName}</h4>
                                        <p className="text-xs text-gray-500">@{teacher.username}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        teacher.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {teacher.status === 'ACTIVE' ? 'Aktif' : 'Wait'}
                                    </span>
                                </div>
                                
                                <div className="text-xs text-gray-600 space-y-1 mb-3">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <School size={12} className="text-blue-500" /> 
                                        {teacher.schoolName || '-'}
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate">
                                        <BookOpen size={12} className="text-purple-500" />
                                        {teacher.subject || '-'}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                                    <div className="flex gap-2">
                                        {teacher.phone && <a href={`https://wa.me/${teacher.phone}`} className="text-green-600 bg-green-50 p-1.5 rounded"><Smartphone size={14}/></a>}
                                        {teacher.email && <a href={`mailto:${teacher.email}`} className="text-blue-600 bg-blue-50 p-1.5 rounded"><Mail size={14}/></a>}
                                    </div>
                                    <div className="flex gap-2">
                                        {activeTab === 'pending' ? (
                                            <>
                                                <button onClick={() => handleApprove(teacher)} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold">Setujui</button>
                                                <button onClick={() => handleReject(teacher.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold">Tolak</button>
                                            </>
                                        ) : (
                                            <button onClick={() => handleDeleteAccount(teacher)} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1">
                                                <Trash2 size={12} /> Hapus Akun
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
              </div>
          )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-500">
                Halaman {currentPage} dari {totalPages} ({filteredTeachers.length} data)
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={18} />
                </button>
                
                {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5 && currentPage > 3) p = currentPage - 2 + i;
                  if (p > totalPages) return null;
                  
                  return (
                      <button 
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                            currentPage === p 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                          {p}
                      </button>
                  )
                })}

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={18} />
                </button>
            </div>
          </div>
      )}
    </div>
  );
};

export default AdminTeachers;