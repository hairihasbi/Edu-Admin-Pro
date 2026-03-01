
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student } from '../types';
import { 
  getClasses, addClass, deleteClass, 
  getStudents, addStudent, deleteStudent, bulkDeleteStudents, importStudentsFromCSV 
} from '../services/database';
import { 
  Plus, Search, Trash2, Users, ChevronLeft, Upload, 
  Download, FileSpreadsheet, MoreVertical, CheckCircle, X, Check, Filter, Smartphone 
} from './Icons';
import Skeleton from './Skeleton';
import BroadcastModal from './BroadcastModal';

interface TeacherClassesProps {
  user: User;
}

const TeacherClasses: React.FC<TeacherClassesProps> = ({ user }) => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  // Class Form State
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');

  // Student Form State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNIS, setNewStudentNIS] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'L' | 'P'>('L');
  const [newStudentPhone, setNewStudentPhone] = useState('');

  // CSV State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Bulk Delete State
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Broadcast
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  // --- INITIAL LOAD ---
  useEffect(() => {
    fetchClasses();
  }, [user]);

  const fetchClasses = async () => {
    setLoading(true);
    const data = await getClasses(user.id);
    setClasses(data);
    setLoading(false);
  };

  const fetchStudents = async (classId: string) => {
    setLoading(true);
    const data = await getStudents(classId); // getStudents already sorts by name
    setStudents(data);
    setSelectedStudentIds(new Set()); // Reset selection
    setLoading(false);
  };

  // --- CLASS ACTIONS ---

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;
    
    const newClass = await addClass(user.id, newClassName, newClassDesc);
    if (newClass) {
      setClasses([...classes, newClass]);
      setIsAddClassModalOpen(false);
      setNewClassName('');
      setNewClassDesc('');
    }
  };

  const handleDeleteClass = async (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Yakin ingin menghapus kelas ini? Semua data siswa di dalamnya akan terhapus.')) {
      await deleteClass(classId);
      setClasses(classes.filter(c => c.id !== classId));
    }
  };

  const openClassDetail = (cls: ClassRoom) => {
    setSelectedClass(cls);
    fetchStudents(cls.id);
    setView('detail');
  };

  // --- STUDENT ACTIONS ---

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newStudentName || !newStudentNIS) return;

    const newStudent = await addStudent(selectedClass.id, newStudentName, newStudentNIS, newStudentGender, newStudentPhone);
    if (newStudent) {
      // FIX: Ensure manual addition also maintains sort order instantly
      setStudents(prev => 
        [...prev, newStudent].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      );
      setIsAddStudentModalOpen(false);
      setNewStudentName('');
      setNewStudentNIS('');
      setNewStudentPhone('');
      // Update class count visually
      setClasses(classes.map(c => c.id === selectedClass.id ? { ...c, studentCount: c.studentCount + 1 } : c));
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (window.confirm('Hapus siswa ini?')) {
      await deleteStudent(studentId);
      setStudents(students.filter(s => s.id !== studentId));
      setClasses(classes.map(c => c.id === selectedClass?.id ? { ...c, studentCount: Math.max(0, c.studentCount - 1) } : c));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudentIds(newSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(new Set(students.map(s => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.size === 0) return;
    if (window.confirm(`Yakin ingin menghapus ${selectedStudentIds.size} siswa terpilih?`)) {
      await bulkDeleteStudents(Array.from(selectedStudentIds));
      setStudents(students.filter(s => !selectedStudentIds.has(s.id)));
      // Update count roughly
      setClasses(classes.map(c => c.id === selectedClass?.id ? { ...c, studentCount: Math.max(0, c.studentCount - selectedStudentIds.size) } : c));
      setSelectedStudentIds(new Set());
    }
  };

  // --- CSV ACTIONS ---

  const handleDownloadTemplate = () => {
    // TIPS: Adding ' before numbers forces Excel to treat them as text, preserving leading zeros
    const headers = "Nama Lengkap,NIS/NISN,L/P,No HP (Wajib Format 08...)";
    const example1 = `"Budi Santoso",'12345,L,'081234567890`;
    const example2 = `"Siti Aminah",'12346,P,'085212345678`;
    
    const csvContent = `${headers}\n${example1}\n${example2}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_siswa_eduadmin_v2.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        const result = await importStudentsFromCSV(selectedClass.id, text);
        if (result.success) {
           let msg = `Import Berhasil!\n${result.count} siswa ditambahkan.`;
           if (result.errors.length > 0) {
             msg += `\n\n${result.errors.length} baris dilewati karena error:\n${result.errors.slice(0, 5).join('\n')}`;
             if (result.errors.length > 5) msg += `\n...dan ${result.errors.length - 5} lainnya.`;
           }
           alert(msg);
           // FIX: fetchStudents calls database getStudents which now has rigorous sorting
           fetchStudents(selectedClass.id);
           fetchClasses();
           
           // CRITICAL FIX: Update Sync Status Immediately for Dashboard
           window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
        } else {
           alert(`Gagal Import!\n\n${result.errors.join('\n')}`);
        }
      }
      setIsImporting(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const getStudentsForBroadcast = () => {
      if (selectedStudentIds.size > 0) {
          return students.filter(s => selectedStudentIds.has(s.id));
      }
      // If none selected, send to all in class
      return students; 
  };
  
  if (view === 'list') {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Daftar Kelas</h2>
            <p className="text-sm text-gray-500">Kelola kelas dan data siswa yang Anda ampu.</p>
          </div>
          <button 
            onClick={() => setIsAddClassModalOpen(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            <Plus size={18} />
            Tambah Kelas
          </button>
        </div>

        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {Array.from({length: 6}).map((_, i) => (
                 <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                    <div className="flex justify-between items-start mb-4">
                       <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                       <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between">
                       <div className="h-4 bg-gray-200 rounded w-20"></div>
                       <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                 </div>
              ))}
           </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 mx-4 md:mx-0">
             <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="text-gray-400" size={32} />
             </div>
             <h3 className="text-lg font-medium text-gray-900">Belum ada kelas</h3>
             <p className="text-gray-500 mb-6 px-4">Silakan buat kelas baru untuk mulai mengelola siswa.</p>
             <button 
                onClick={() => setIsAddClassModalOpen(true)}
                className="text-blue-600 font-medium hover:underline"
             >
                + Buat Kelas Baru
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {classes.map(cls => (
              <div 
                key={cls.id} 
                onClick={() => openClassDetail(cls)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer group overflow-hidden active:scale-95 duration-100"
              >
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
                <div className="p-5 md:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                      <Users size={24} />
                    </div>
                    <button 
                      onClick={(e) => handleDeleteClass(cls.id, e)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition z-10"
                      title="Hapus Kelas"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{cls.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{cls.description || 'Tidak ada deskripsi'}</p>
                  
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      {cls.studentCount} Siswa
                    </span>
                    <span className="text-xs text-blue-600 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Kelola <ChevronLeft size={14} className="rotate-180" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isAddClassModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-gray-800">Tambah Kelas Baru</h3>
                 <button onClick={() => setIsAddClassModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
               </div>
               <form onSubmit={handleAddClass} className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kelas</label>
                   <input 
                     type="text" 
                     required
                     placeholder="Contoh: X IPA 1"
                     className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                     value={newClassName}
                     onChange={e => setNewClassName(e.target.value)}
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                   <input 
                     type="text" 
                     placeholder="Contoh: Tahun Ajaran 2023/2024"
                     className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                     value={newClassDesc}
                     onChange={e => setNewClassDesc(e.target.value)}
                   />
                 </div>
                 <button 
                   type="submit" 
                   className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition"
                 >
                   Simpan Kelas
                 </button>
               </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DETAIL VIEW ---
  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header Detail */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setView('list'); fetchClasses(); }}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">{selectedClass?.name}</h2>
            <p className="text-xs md:text-sm text-gray-500 line-clamp-1">{selectedClass?.description} • {students.length} Siswa</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
           {selectedStudentIds.size > 0 && (
             <button 
               onClick={handleBulkDelete}
               className="flex-shrink-0 flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-red-100 transition mr-2"
             >
               <Trash2 size={16} /> Hapus ({selectedStudentIds.size})
             </button>
           )}
           
           <div className="flex-shrink-0 flex gap-2">
             <button 
               onClick={() => setIsBroadcastOpen(true)}
               disabled={students.length === 0}
               className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg font-medium text-xs md:text-sm hover:bg-green-700 transition"
             >
               <Smartphone size={16} /> Broadcast WA
             </button>

             <button 
               onClick={handleDownloadTemplate}
               className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-medium text-xs md:text-sm hover:bg-gray-200 transition"
             >
               <FileSpreadsheet size={16} /> <span className="hidden sm:inline">Template</span>
             </button>
             
             <div className="relative">
               <input 
                 type="file" 
                 accept=".csv"
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={handleFileChange}
               />
               <button 
                 onClick={handleUploadClick}
                 disabled={isImporting}
                 className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg font-medium text-xs md:text-sm hover:bg-green-100 border border-green-200 transition"
               >
                 {isImporting ? <span className="animate-spin">⌛</span> : <Upload size={16} />} 
                 <span className="hidden sm:inline">Import</span>
               </button>
             </div>
             
             <button 
               onClick={() => setIsAddStudentModalOpen(true)}
               className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition shadow-sm"
             >
               <Plus size={16} /> <span className="whitespace-nowrap">Siswa</span>
             </button>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
           <div className="p-6 space-y-4">
              {Array.from({length: 5}).map((_, i) => (
                 <div key={i} className="flex items-center gap-4">
                    <Skeleton variant="rectangular" className="w-5 h-5 rounded" />
                    <div className="flex-1 space-y-2">
                       <Skeleton variant="text" className="w-1/3 h-4" />
                       <Skeleton variant="text" className="w-1/4 h-3" />
                    </div>
                    <Skeleton variant="circular" className="w-8 h-8" />
                 </div>
              ))}
           </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                  <tr>
                    <th className="p-4 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        onChange={handleSelectAll}
                        checked={students.length > 0 && selectedStudentIds.size === students.length}
                      />
                    </th>
                    <th className="p-4">Nama Siswa</th>
                    <th className="p-4">NIS / NISN</th>
                    <th className="p-4 text-center">L/P</th>
                    <th className="p-4">No. HP</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Belum ada siswa di kelas ini.</td></tr>
                  ) : (
                    students.map(student => (
                      <tr key={student.id} className="hover:bg-gray-50 transition">
                        <td className="p-4">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedStudentIds.has(student.id)}
                            onChange={() => handleToggleSelectStudent(student.id)}
                          />
                        </td>
                        <td className="p-4 font-medium text-gray-900">{student.name}</td>
                        <td className="p-4 text-gray-600">{student.nis}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${student.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600 text-xs">{student.phone || '-'}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-gray-400 hover:text-red-500 transition p-2"
                            title="Hapus Siswa"
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

            <div className="md:hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2">
                   <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5" onChange={handleSelectAll} checked={students.length > 0 && selectedStudentIds.size === students.length}/>
                    <span className="text-sm font-medium text-gray-600">Pilih Semua</span>
                </div>
                <span className="text-xs text-gray-400">{students.length} Total</span>
              </div>
              <div className="divide-y divide-gray-100">
                {students.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">Belum ada siswa.</div>
                ) : (
                  students.map(student => (
                    <div key={student.id} className={`p-4 flex items-center justify-between transition active:bg-gray-50 ${selectedStudentIds.has(student.id) ? 'bg-blue-50' : 'bg-white'}`} onClick={() => handleToggleSelectStudent(student.id)}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                           <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5" checked={selectedStudentIds.has(student.id)} onChange={() => handleToggleSelectStudent(student.id)}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{student.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{student.nis}</span>
                             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${student.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{student.gender}</span>
                          </div>
                          {student.phone && <p className="text-xs text-gray-400 mt-1">{student.phone}</p>}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id); }} className="text-gray-300 hover:text-red-500 p-2 ml-2"><Trash2 size={20} /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

       {isAddStudentModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-gray-800">Tambah Siswa Baru</h3>
                 <button onClick={() => setIsAddStudentModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
               </div>
               <form onSubmit={handleAddStudent} className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                   <input type="text" required placeholder="Nama Siswa" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={newStudentName} onChange={e => setNewStudentName(e.target.value)}/>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">NIS / NISN</label>
                   <input type="text" required placeholder="Nomor Induk" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={newStudentNIS} onChange={e => setNewStudentNIS(e.target.value)}/>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">No. HP (Opsional)</label>
                   <input type="text" placeholder="0812..." className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)}/>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                   <div className="flex gap-4 mt-2">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="gender" value="L" checked={newStudentGender === 'L'} onChange={() => setNewStudentGender('L')} className="text-blue-600 focus:ring-blue-500"/>
                        <span className="text-gray-700 text-sm">Laki-laki</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="gender" value="P" checked={newStudentGender === 'P'} onChange={() => setNewStudentGender('P')} className="text-blue-600 focus:ring-blue-500"/>
                        <span className="text-gray-700 text-sm">Perempuan</span>
                     </label>
                   </div>
                 </div>
                 <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition">Simpan Siswa</button>
               </form>
            </div>
          </div>
        )}

      {isBroadcastOpen && (
          <BroadcastModal user={user} recipients={getStudentsForBroadcast()} onClose={() => setIsBroadcastOpen(false)}/>
      )}
    </div>
  );
};

export default TeacherClasses;
