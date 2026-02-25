
import React, { useState, useEffect, useCallback } from 'react';
import { StudentWithDetails, User } from '../types';
import { deleteStudent, bulkDeleteStudents, addSystemLog, getStudentsServerSide, updateUserProfile } from '../services/database';
import { pushToTurso } from '../services/tursoService';
import { GraduationCap, Trash2, Search, School, User as UserIcon, CheckCircle, ChevronLeft, ChevronRight, Smartphone, RefreshCcw, Database, AlertCircle, Settings, Upload } from './Icons';
import BroadcastModal from './BroadcastModal';
import { Link, useNavigate } from 'react-router-dom';

const AdminStudents: React.FC = () => {
  // Data
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  
  // Filters State
  const [schoolFilter, setSchoolFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter Options (Populated from API)
  const [schools, setSchools] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 15; // Load 15 items per page

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [isFixingAuth, setIsFixingAuth] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const navigate = useNavigate();

  // Debounce Logic
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchData(1); // Reset to page 1 on search/filter change
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm, schoolFilter, teacherFilter]);

  // Handle Page Change separately to avoid resetting to page 1
  const handlePageChange = (newPage: number) => {
      fetchData(newPage);
  };

  useEffect(() => {
    const userStr = localStorage.getItem('eduadmin_user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
    // Initial fetch handled by debounce effect on mount
  }, []);

  const fetchData = async (page: number) => {
    setIsLoading(true);
    setAuthError(false);
    
    // Call Server-Side API
    const result = await getStudentsServerSide(
        page,
        itemsPerPage,
        searchTerm,
        schoolFilter,
        teacherFilter
    );

    if (result.status === 401) {
        setAuthError(true);
        setStudents([]);
        setIsLoading(false);
        return;
    }

    setStudents(result.data);
    setTotalPages(result.meta.totalPages);
    setTotalItems(result.meta.total);
    setCurrentPage(page);
    
    // Update Filter Options if available
    if (result.filters) {
        if (result.filters.schools.length > 0) setSchools(result.filters.schools);
        if (result.filters.teachers.length > 0) setTeachers(result.filters.teachers);
    }
    
    setIsLoading(false);
  };

  const handleFixAuth = async () => {
      if (!currentUser) return;
      setIsFixingAuth(true);
      try {
          // Force status ACTIVE locally first
          const updatedUser = { ...currentUser, status: 'ACTIVE' as const };
          // Push current local user to cloud DB to register them
          // We send the modified user object to ensure it has ACTIVE status
          await pushToTurso('eduadmin_users', [updatedUser], true);
          
          // Add small delay for propagation
          await new Promise(r => setTimeout(r, 1500));
          // Retry fetch
          await fetchData(1);
          alert("Akun berhasil didaftarkan ke Database Cloud. Akses dipulihkan.");
      } catch (e: any) {
          console.error("Fix Auth Error:", e);
          alert("Gagal memperbaiki akses: " + (e.message || JSON.stringify(e)));
      } finally {
          setIsFixingAuth(false);
      }
  };

  // Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(students.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Delete Handlers
  const handleDelete = async (id: string) => {
    if (window.confirm("Yakin ingin menghapus data siswa ini?")) {
      await deleteStudent(id);
      addSystemLog('WARNING', 'Admin', 'ADMIN', 'Delete Student', `Deleted student ID: ${id}`);
      fetchData(currentPage);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Yakin ingin menghapus ${selectedIds.size} siswa terpilih?`)) {
      await bulkDeleteStudents(Array.from(selectedIds));
      addSystemLog('WARNING', 'Admin', 'ADMIN', 'Bulk Delete', `Deleted ${selectedIds.size} students`);
      fetchData(currentPage);
      setSelectedIds(new Set());
    }
  };

  // Broadcast Handler (Only broadcast to selected visible items for simplicity)
  const getSelectedStudentsForBroadcast = () => {
      if (selectedIds.size > 0) {
          return students.filter(s => selectedIds.has(s.id));
      }
      return []; 
  };

  if (authError) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-in fade-in zoom-in duration-300">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                  <AlertCircle size={48} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak (Unauthorized)</h2>
              <p className="text-gray-600 max-w-lg mb-6 leading-relaxed">
                  Database Cloud berhasil direset/diinisialisasi, namun akun Admin Anda belum terdaftar kembali di sana.
                  <br/><br/>
                  Klik tombol di bawah untuk meng-upload profil Admin Anda ke Cloud.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                      onClick={handleFixAuth}
                      disabled={isFixingAuth}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg hover:shadow-blue-500/30"
                  >
                      {isFixingAuth ? <RefreshCcw className="animate-spin" size={18} /> : <Upload size={18} />}
                      {isFixingAuth ? 'Mendaftarkan Akun...' : 'Perbaiki Akses Admin'}
                  </button>
                  <Link 
                      to="/settings" 
                      className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-50 transition"
                  >
                      <Settings size={18} />
                      Cek Database
                  </Link>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <GraduationCap className="text-blue-600" /> Data Siswa Global
            </h2>
            <p className="text-sm text-gray-500">Monitoring seluruh siswa dari semua guru (Cloud Sync).</p>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => fetchData(currentPage)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition" title="Refresh">
                <RefreshCcw size={18} />
             </button>
             <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm">
                Total DB: {totalItems}
             </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t border-gray-50">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari Nama / NIS..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="relative flex-1">
              <School className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
              >
                <option value="">Semua Sekolah</option>
                {schools.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
           </div>

           <div className="relative flex-1">
              <UserIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
              >
                <option value="">Semua Guru</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
           </div>
        </div>

        {/* Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
             <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700 font-medium">{selectedIds.size} item terpilih</span>
                <button 
                  onClick={handleBulkDelete}
                  className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2"
                >
                  <Trash2 size={14} /> Hapus
                </button>
             </div>
             
             <button 
                onClick={() => setIsBroadcastOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm"
             >
                <Smartphone size={16} /> Broadcast WA
             </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                    <RefreshCcw className="animate-spin text-blue-600" size={32} />
                    <span className="text-sm font-medium text-gray-600">Memuat data dari server...</span>
                </div>
            </div>
        )}

        <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                 <tr>
                   <th className="p-4 w-10">
                     <input 
                       type="checkbox" 
                       className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                       onChange={handleSelectAll}
                       checked={students.length > 0 && selectedIds.size === students.length}
                     />
                   </th>
                   <th className="p-4">Nama Siswa</th>
                   <th className="p-4">NIS</th>
                   <th className="p-4 text-center">L/P</th>
                   <th className="p-4">Kelas</th>
                   <th className="p-4">No. HP</th>
                   <th className="p-4">Sekolah</th>
                   <th className="p-4 text-center">Aksi</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {students.length === 0 && !isLoading ? (
                    <tr>
                        <td colSpan={8} className="p-10 text-center text-gray-400">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <Database size={48} className="text-gray-300" />
                                <p className="font-medium text-gray-500">Tidak ada data siswa ditemukan di Server.</p>
                                <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg text-left text-sm border border-yellow-200 mt-2 max-w-lg">
                                    <strong>Tips Troubleshooting:</strong>
                                    <ul className="list-disc pl-5 mt-1 space-y-1">
                                        <li>Pastikan Guru sudah <strong>Online</strong> dan data lokal mereka telah tersinkronisasi (menu Sync).</li>
                                        <li>Jika data lokal ada tapi tidak muncul disini, coba klik tombol "Refresh".</li>
                                    </ul>
                                </div>
                            </div>
                        </td>
                    </tr>
                 ) : (
                    students.map(student => (
                    <tr key={student.id} className={`hover:bg-gray-50 transition ${selectedIds.has(student.id) ? 'bg-blue-50' : ''}`}>
                        <td className="p-4">
                        <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.has(student.id)}
                            onChange={() => handleToggleSelect(student.id)}
                        />
                        </td>
                        <td className="p-4 font-medium text-gray-900">{student.name}</td>
                        <td className="p-4 text-gray-500">{student.nis}</td>
                        <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${student.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {student.gender}
                            </span>
                        </td>
                        <td className="p-4 font-semibold text-gray-700">{student.className}</td>
                        <td className="p-4 text-gray-500 text-xs">{student.phone || '-'}</td>
                        <td className="p-4 text-gray-500">{student.schoolName}</td>
                        <td className="p-4 text-center">
                            <button 
                            onClick={() => handleDelete(student.id)}
                            className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                            title="Hapus"
                            >
                            <Trash2 size={16} />
                            </button>
                        </td>
                    </tr>
                    ))
                 )}
               </tbody>
             </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500">
                Halaman {currentPage} dari {totalPages} ({totalItems} Data)
            </span>
            <div className="flex gap-2">
                <button 
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isLoading}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
                >
                <ChevronLeft size={16} />
                </button>
                
                {/* Simplified Pagination: Current Page Indicator */}
                <div className="flex items-center justify-center px-4 bg-white border border-gray-300 rounded-lg text-sm font-medium min-w-[3rem]">
                    {currentPage}
                </div>

                <button 
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || isLoading}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
                >
                <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>

      {isBroadcastOpen && currentUser && (
          <BroadcastModal 
             user={currentUser}
             recipients={getSelectedStudentsForBroadcast()}
             onClose={() => setIsBroadcastOpen(false)}
          />
      )}
    </div>
  );
};

export default AdminStudents;
