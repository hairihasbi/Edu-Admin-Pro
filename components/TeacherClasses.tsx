
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { User, ClassRoom, Student } from '../types';
import { 
  getClasses, addClass, deleteClass, 
  getStudents, addStudent, deleteStudent, bulkDeleteStudents, importStudentsFromCSV,
  updateStudentRfid, normalizeRfid
} from '../services/database';
import { 
  Plus, Search, Trash2, Users, ChevronLeft, Upload, 
  Download, FileSpreadsheet, MoreVertical, CheckCircle, X, Check, Filter, Smartphone,
  IdCard, Wifi
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

  // RFID Registration
  const [isRfidModalOpen, setIsRfidModalOpen] = useState(false);
  const [rfidStudent, setRfidStudent] = useState<Student | null>(null);
  const [tempRfid, setTempRfid] = useState('');
  const [rfidStatus, setRfidStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const rfidInputRef = useRef<HTMLInputElement>(null);

  // Unduh Seluruh Siswa State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [allStudentsExport, setAllStudentsExport] = useState<Array<{
    id: string;
    nisn: string;
    name: string;
    className: string;
    classId: string;
    gender: 'L' | 'P';
    phone?: string;
  }>>([]);
  const [exportFormat, setExportFormat] = useState<'STANDARD' | 'WITH_NO' | 'FULL'>('STANDARD');
  const [exportSortBy, setExportSortBy] = useState<'NAME' | 'NISN'>('NAME');

  // --- INITIAL LOAD ---
  useEffect(() => {
    fetchClasses();
  }, [user]);

  const fetchClasses = async () => {
    setLoading(true);
    const data = await getClasses(user.id, user.schoolNpsn);
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
      fetchClasses();
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
      try {
        await bulkDeleteStudents(Array.from(selectedStudentIds));
        const updatedStudents = students.filter(s => !selectedStudentIds.has(s.id));
        setStudents(updatedStudents);
        
        // Update class count locally
        if (selectedClass) {
          setClasses(classes.map(c => c.id === selectedClass.id ? { ...c, studentCount: updatedStudents.length } : c));
        }
        
        setSelectedStudentIds(new Set());
      } catch (e: any) {
        console.error("Gagal menghapus siswa:", e);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (students.length === 0) return;
    if (window.confirm(`PERINGATAN: Hapus SEMUA (${students.length}) siswa di kelas ini? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        const allIds = students.map(s => s.id);
        await bulkDeleteStudents(allIds);
        setStudents([]);
        
        // Update class count locally
        if (selectedClass) {
          setClasses(classes.map(c => c.id === selectedClass.id ? { ...c, studentCount: 0 } : c));
        }
        
        setSelectedStudentIds(new Set());
      } catch (e: any) {
        console.error("Gagal menghapus semua siswa:", e);
      }
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

  const handleBroadcast = () => {
      setIsBroadcastOpen(true);
  };

  // --- RFID ACTIONS ---
  const openRfidModal = (student: Student) => {
    setRfidStudent(student);
    setTempRfid(student.rfidTag || '');
    setIsRfidModalOpen(true);
    setRfidStatus('IDLE');
    setTimeout(() => rfidInputRef.current?.focus(), 300);
  };

  const handleRfidKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRegisterRfid();
    }
  };

  const handleRegisterRfid = async () => {
    if (!rfidStudent || !tempRfid) return;
    const cleanTag = normalizeRfid(tempRfid);
    const success = await updateStudentRfid(rfidStudent.id, cleanTag);
    if (success) {
      setStudents(prev => prev.map(s => s.id === rfidStudent.id ? { ...s, rfidTag: cleanTag } : s));
      setRfidStatus('SUCCESS');
      setTimeout(() => setIsRfidModalOpen(false), 1500);
    } else {
      setRfidStatus('ERROR');
    }
  };
  const getStudentsForBroadcast = () => {
    if (selectedStudentIds.size > 0) {
        return students.filter(s => selectedStudentIds.has(s.id));
    }
    // If none selected, send to all in class
    return students; 
  };

  // --- EXPORT ALL STUDENTS ACTIONS ---

  const handleOpenExportModal = async () => {
    setIsExportModalOpen(true);
    setExportLoading(true);
    try {
      let targetClasses = classes;
      if (targetClasses.length === 0) {
        targetClasses = await getClasses(user.id, user.schoolNpsn);
        setClasses(targetClasses);
      }

      // Sort classes naturally (X-1, X-2, XI-1, etc.)
      const sortedClasses = [...targetClasses].sort((a, b) => 
        a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
      );

      const gathered: Array<{
        id: string;
        nisn: string;
        name: string;
        className: string;
        classId: string;
        gender: 'L' | 'P';
        phone?: string;
      }> = [];

      for (const cls of sortedClasses) {
        const clsStudents = await getStudents(cls.id);
        const sortedStudents = [...clsStudents].sort((a, b) => 
          a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
        );

        for (const s of sortedStudents) {
          gathered.push({
            id: s.id,
            nisn: String(s.nis || '').trim(),
            name: String(s.name || '').trim(),
            className: String(cls.name || '').trim(),
            classId: cls.id,
            gender: s.gender,
            phone: s.phone
          });
        }
      }

      setAllStudentsExport(gathered);
    } catch (err) {
      console.error('Gagal mengambil data seluruh siswa:', err);
      alert('Terjadi kesalahan saat memuat data siswa.');
    } finally {
      setExportLoading(false);
    }
  };

  const getSortedExportData = () => {
    const classOrderMap = new Map<string, number>();
    const sortedClassList = [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' })
    );
    sortedClassList.forEach((c, idx) => classOrderMap.set(c.name, idx));

    return [...allStudentsExport].sort((a, b) => {
      const orderA = classOrderMap.has(a.className) ? classOrderMap.get(a.className)! : 9999;
      const orderB = classOrderMap.has(b.className) ? classOrderMap.get(b.className)! : 9999;
      if (orderA !== orderB) return orderA - orderB;

      if (exportSortBy === 'NISN') {
        return (a.nisn || '').localeCompare(b.nisn || '', undefined, { numeric: true });
      }
      return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
    });
  };

  const handleDownloadExcel = () => {
    const currentData = getSortedExportData();
    if (currentData.length === 0) {
      alert('Tidak ada data siswa untuk diunduh.');
      return;
    }

    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let nisnColIndex = 0;

    if (exportFormat === 'STANDARD') {
      // Urutan spesifik sesuai permintaan: NISN, NAMA, KELAS
      headers = ['NISN', 'NAMA', 'KELAS'];
      nisnColIndex = 0;
      rows = currentData.map(s => [
        s.nisn,
        s.name,
        s.className
      ]);
    } else if (exportFormat === 'WITH_NO') {
      headers = ['NO', 'NISN', 'NAMA', 'KELAS'];
      nisnColIndex = 1;
      rows = currentData.map((s, idx) => [
        idx + 1,
        s.nisn,
        s.name,
        s.className
      ]);
    } else {
      headers = ['NO', 'NISN', 'NAMA', 'KELAS', 'L/P', 'NO. HP'];
      nisnColIndex = 1;
      rows = currentData.map((s, idx) => [
        idx + 1,
        s.nisn,
        s.name,
        s.className,
        s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : '-',
        s.phone || '-'
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    if (exportFormat === 'STANDARD') {
      ws['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 18 }];
    } else if (exportFormat === 'WITH_NO') {
      ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 36 }, { wch: 18 }];
    } else {
      ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
    }

    // Explicitly enforce text format on NISN column to prevent Excel from dropping leading zeros
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: nisnColIndex });
      if (ws[cellAddress]) {
        ws[cellAddress].t = 's';
        ws[cellAddress].z = '@';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");

    const dateStr = new Date().toISOString().split('T')[0];
    const cleanSchool = (user.schoolNpsn && user.schoolNpsn !== 'DEFAULT') ? `_${user.schoolNpsn}` : '';
    const fileName = `Data_Seluruh_Siswa_Per_Kelas${cleanSchool}_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const handleDownloadCSV = () => {
    const currentData = getSortedExportData();
    if (currentData.length === 0) {
      alert('Tidak ada data siswa untuk diunduh.');
      return;
    }

    let headers = '';
    let lines: string[] = [];

    if (exportFormat === 'STANDARD') {
      headers = 'NISN,NAMA,KELAS';
      lines = currentData.map(s => 
        `"${s.nisn.replace(/"/g, '""')}","${s.name.replace(/"/g, '""')}","${s.className.replace(/"/g, '""')}"`
      );
    } else if (exportFormat === 'WITH_NO') {
      headers = 'NO,NISN,NAMA,KELAS';
      lines = currentData.map((s, idx) => 
        `${idx + 1},"${s.nisn.replace(/"/g, '""')}","${s.name.replace(/"/g, '""')}","${s.className.replace(/"/g, '""')}"`
      );
    } else {
      headers = 'NO,NISN,NAMA,KELAS,L/P,NO_HP';
      lines = currentData.map((s, idx) => 
        `${idx + 1},"${s.nisn.replace(/"/g, '""')}","${s.name.replace(/"/g, '""')}","${s.className.replace(/"/g, '""')}","${s.gender || ''}","${(s.phone || '').replace(/"/g, '""')}"`
      );
    }

    const csvContent = `${headers}\n${lines.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split('T')[0];
    const cleanSchool = (user.schoolNpsn && user.schoolNpsn !== 'DEFAULT') ? `_${user.schoolNpsn}` : '';
    link.setAttribute("download", `Data_Seluruh_Siswa_Per_Kelas${cleanSchool}_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCurrentClass = () => {
    if (!selectedClass || students.length === 0) {
      alert('Tidak ada data siswa di kelas ini untuk diunduh.');
      return;
    }

    const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
    const headers = ['NISN', 'NAMA', 'KELAS'];
    const rows = sorted.map(s => [
      String(s.nis || '').trim(),
      String(s.name || '').trim(),
      String(selectedClass.name || '').trim()
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 18 }];

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 0 });
      if (ws[cellAddress]) {
        ws[cellAddress].t = 's';
        ws[cellAddress].z = '@';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");

    const cleanName = selectedClass.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Data_Siswa_${cleanName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderExportModal = () => {
    if (!isExportModalOpen) return null;
    const sortedData = getSortedExportData();
    const previewData = sortedData.slice(0, 5);
    const uniqueClasses = Array.from(new Set(allStudentsExport.map(s => s.className)));

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 to-blue-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">Unduh Data Seluruh Siswa</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                    1 Sheet Terpadu
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Data siswa seluruh kelas tersusun rapi per kelas dalam satu lembar kerja.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsExportModalOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4 text-sm">
            {exportLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-gray-700">Mengumpulkan data siswa dari seluruh kelas...</p>
                <p className="text-xs text-gray-400">Mohon tunggu sebentar, data sedang disusun rapi per kelas.</p>
              </div>
            ) : (
              <>
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Kelas</p>
                    <p className="text-lg font-black text-gray-800 mt-0.5">{uniqueClasses.length} <span className="text-xs font-normal text-gray-500">Kelas</span></p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Siswa</p>
                    <p className="text-lg font-black text-emerald-800 mt-0.5">{allStudentsExport.length} <span className="text-xs font-normal text-emerald-600">Siswa</span></p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Urutan Kolom</p>
                    <p className="text-xs font-bold text-blue-800 mt-1 truncate">NISN → NAMA → KELAS</p>
                  </div>
                </div>

                {/* Format Kolom */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Pilihan Susunan Kolom:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat('STANDARD')}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        exportFormat === 'STANDARD'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-950 font-bold'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">NISN, NAMA, KELAS</span>
                        {exportFormat === 'STANDARD' && <CheckCircle size={14} className="text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-gray-500 font-normal leading-tight">
                        3 kolom standar (Sesuai Permintaan Utama). Sangat ideal untuk integrasi & olah data.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('WITH_NO')}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        exportFormat === 'WITH_NO'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-950 font-bold'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">NO, NISN, NAMA, KELAS</span>
                        {exportFormat === 'WITH_NO' && <CheckCircle size={14} className="text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-gray-500 font-normal leading-tight">
                        Menambahkan nomor urut (1, 2, 3...) di awal tabel untuk referensi nomor urut.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('FULL')}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        exportFormat === 'FULL'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-950 font-bold'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Format Lengkap</span>
                        {exportFormat === 'FULL' && <CheckCircle size={14} className="text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-gray-500 font-normal leading-tight">
                        Kolom No, NISN, Nama, Kelas, Jenis Kelamin (L/P), dan No. HP siswa.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Urutan Siswa per Kelas */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200 gap-2">
                  <div className="text-xs text-gray-700">
                    <span className="font-bold">Pengurutan Data:</span> Data dikelompokkan per kelas, lalu diurutkan berdasarkan:
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExportSortBy('NAME')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        exportSortBy === 'NAME'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Nama Siswa (A-Z)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportSortBy('NISN')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        exportSortBy === 'NISN'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      NISN Siswa
                    </button>
                  </div>
                </div>

                {/* Live Preview Table */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Pratinjau Format Data ({previewData.length} baris pertama):
                    </span>
                    <span className="text-[11px] text-gray-400 italic">
                      Tersusun otomatis per kelas
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0">
                          <tr>
                            {exportFormat !== 'STANDARD' && <th className="p-2 w-10 text-center">NO</th>}
                            <th className="p-2 w-28">NISN</th>
                            <th className="p-2">NAMA</th>
                            <th className="p-2 w-24">KELAS</th>
                            {exportFormat === 'FULL' && (
                              <>
                                <th className="p-2 w-16 text-center">L/P</th>
                                <th className="p-2 w-28">NO. HP</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {previewData.length === 0 ? (
                            <tr>
                              <td colSpan={exportFormat === 'FULL' ? 6 : exportFormat === 'WITH_NO' ? 4 : 3} className="p-4 text-center text-gray-400">
                                Belum ada siswa yang tersimpan di kelas.
                              </td>
                            </tr>
                          ) : (
                            previewData.map((s, idx) => (
                              <tr key={s.id || idx} className="hover:bg-gray-50/80 font-mono">
                                {exportFormat !== 'STANDARD' && (
                                  <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                                )}
                                <td className="p-2 font-bold text-emerald-700">{s.nisn || '-'}</td>
                                <td className="p-2 font-sans font-medium text-gray-900">{s.name}</td>
                                <td className="p-2 font-sans font-semibold text-blue-700">{s.className}</td>
                                {exportFormat === 'FULL' && (
                                  <>
                                    <td className="p-2 text-center font-sans">{s.gender}</td>
                                    <td className="p-2 text-gray-600 font-sans text-[11px]">{s.phone || '-'}</td>
                                  </>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 italic">
                    * Menampilkan 5 sampel data pertama. Seluruh data dari {uniqueClasses.length} kelas akan tersambung berurutan dalam satu sheet yang sama.
                  </p>
                </div>

                {/* NISN Leading Zero Notice */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Perlindungan Format NISN:</strong> Nilai NISN disimpan dengan format teks (<em>string</em>). Angka nol di depan (misalnya <code>0081234567</code>) tidak akan terpotong atau hilang saat dibuka di Microsoft Excel, WPS, maupun Google Spreadsheet.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-gray-500 text-center sm:text-left">
              {allStudentsExport.length > 0 ? (
                <>Siap mengunduh <strong>{allStudentsExport.length}</strong> siswa dari <strong>{uniqueClasses.length}</strong> kelas.</>
              ) : (
                'Tidak ada data siswa untuk diunduh.'
              )}
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 text-xs font-semibold hover:bg-white transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleDownloadCSV}
                disabled={allStudentsExport.length === 0 || exportLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 rounded-xl text-xs font-semibold transition"
                title="Unduh dalam format CSV"
              >
                <Download size={15} />
                <span>Unduh CSV</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={allStudentsExport.length === 0 || exportLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                title="Unduh dalam format Microsoft Excel (.xlsx)"
              >
                <FileSpreadsheet size={15} />
                <span>Unduh Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (view === 'list') {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Daftar Kelas</h2>
            <p className="text-sm text-gray-500">Kelola kelas dan data siswa yang Anda ampu.</p>
          </div>
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button 
              onClick={handleOpenExportModal}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium transition shadow-xs"
              title="Unduh seluruh data siswa tersusun per kelas dalam satu sheet (NISN, Nama, Kelas)"
            >
              <FileSpreadsheet size={18} />
              <span>Unduh Seluruh Siswa</span>
            </button>
            <button 
              onClick={() => setIsAddClassModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
            >
              <Plus size={18} />
              Tambah Kelas
            </button>
          </div>
        </div>

        {loading ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({length: 8}).map((_, i) => (
                 <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                       <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                       <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-2.5 bg-gray-200 rounded w-3/4"></div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                       <div className="h-3 bg-gray-200 rounded w-16"></div>
                       <div className="h-3 bg-gray-200 rounded w-12"></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {classes.map(cls => (
              <div 
                key={cls.id} 
                onClick={() => openClassDetail(cls)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer group overflow-hidden active:scale-95 duration-100"
              >
                <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                      <Users size={20} />
                    </div>
                    <button 
                      onClick={(e) => handleDeleteClass(cls.id, e)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition z-10"
                      title="Hapus Kelas"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-0.5">{cls.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{cls.description || 'Tidak ada deskripsi'}</p>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      {cls.studentCount} Siswa
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                      Kelola <ChevronLeft size={12} className="rotate-180" />
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
        {renderExportModal()}
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
           {selectedStudentIds.size > 0 ? (
             <button 
               onClick={handleBulkDelete}
               className="flex-shrink-0 flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-red-100 transition mr-2"
             >
               <Trash2 size={16} /> Hapus ({selectedStudentIds.size})
             </button>
           ) : (
             students.length > 0 && (
               <button 
                 onClick={handleDeleteAll}
                 className="flex-shrink-0 flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-red-100 transition mr-2"
               >
                 <Trash2 size={16} /> Hapus Semua
               </button>
             )
           )}
           
           <div className="flex-shrink-0 flex gap-2">
             <button 
               onClick={handleOpenExportModal}
               className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium text-xs md:text-sm transition shadow-xs"
               title="Unduh seluruh siswa per kelas dalam 1 sheet"
             >
               <FileSpreadsheet size={16} /> <span className="hidden sm:inline">Unduh Seluruh Siswa</span><span className="sm:hidden">Semua</span>
             </button>

             <button 
               onClick={handleDownloadCurrentClass}
               disabled={students.length === 0}
               className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 px-3 py-2 rounded-lg font-medium text-xs md:text-sm transition"
               title="Unduh data siswa kelas ini (NISN, Nama, Kelas)"
             >
               <Download size={16} /> <span className="hidden sm:inline">Unduh Kelas Ini</span><span className="sm:hidden">Kelas Ini</span>
             </button>

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
                          <div className="flex items-center justify-center gap-1">
                            {user.isRfidOfficer && (
                              <button 
                                onClick={() => openRfidModal(student)}
                                className={`p-2 transition rounded-full ${student.rfidTag ? 'text-green-500 hover:bg-green-50' : 'text-blue-500 hover:bg-blue-50'}`}
                                title={student.rfidTag ? 'Ubah RFID' : 'Daftarkan RFID'}
                              >
                                <IdCard size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-gray-400 hover:text-red-500 transition p-2"
                              title="Hapus Siswa"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
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
                      <div className="flex items-center gap-2">
                        {user.isRfidOfficer && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); openRfidModal(student); }} 
                            className={`p-2 rounded-full ${student.rfidTag ? 'text-green-500' : 'text-blue-500'}`}
                          >
                            <IdCard size={20} />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id); }} className="text-gray-300 hover:text-red-500 p-2 ml-2"><Trash2 size={20} /></button>
                      </div>
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

      {isRfidModalOpen && rfidStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-200">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
              rfidStatus === 'SUCCESS' ? 'bg-green-100 text-green-600' : 
              rfidStatus === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {rfidStatus === 'SUCCESS' ? <CheckCircle size={40} /> : <IdCard size={40} />}
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">Registrasi RFID</h3>
            <p className="text-gray-500 text-sm mb-6">Silakan Tap Kartu untuk <strong>{rfidStudent.name}</strong></p>
            
            <div className="space-y-4">
              <input 
                ref={rfidInputRef}
                type="text" 
                value={tempRfid}
                onChange={e => setTempRfid(e.target.value)}
                onKeyDown={handleRfidKeyDown}
                placeholder="ID Tag akan muncul di sini..."
                className="w-full text-center border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none font-mono text-lg"
              />
              
              {rfidStatus === 'SUCCESS' ? (
                <p className="text-green-600 font-bold flex items-center justify-center gap-2">
                  <Check size={18} /> Berhasil Terdaftar!
                </p>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsRfidModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleRegisterRfid}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Simpan
                  </button>
                </div>
              )}
            </div>
            
            <p className="mt-6 text-[10px] text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <Wifi size={12} /> Keyboard Emulator Aktif
            </p>
          </div>
        </div>
      )}

      {renderExportModal()}
    </div>
  );
};

export default TeacherClasses;
