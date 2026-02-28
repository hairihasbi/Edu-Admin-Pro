
import React, { useState, useEffect } from 'react';
import { User, ClassRoom, ScopeMaterial, TeachingJournal, SD_SUBJECTS_PHASE_A, SD_SUBJECTS_PHASE_BC } from '../types';
import { getClasses, getScopeMaterials, getTeachingJournals, addTeachingJournal, deleteTeachingJournal, bulkDeleteTeachingJournals } from '../services/database';
import { Plus, Save, Trash2, Filter, Printer, FileSpreadsheet, NotebookPen, CalendarDays, ChevronLeft, ChevronRight } from './Icons';
import * as XLSX from 'xlsx';

interface TeacherJournalProps {
  user: User;
}

const TeacherJournal: React.FC<TeacherJournalProps> = ({ user }) => {
  // Data States
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allMaterials, setAllMaterials] = useState<ScopeMaterial[]>([]); // For Dropdown (filtered by selected class)
  const [materialMap, setMaterialMap] = useState<Record<string, ScopeMaterial>>({}); // For Display/Export (All materials)
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  
  // NEW: Subject State Logic
  const [selectedSubject, setSelectedSubject] = useState<string>(user.subject || '');

  // Initialize Subject based on Teacher Type
  useEffect(() => {
    if (user.teacherType === 'CLASS') {
      const subjects = (user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A;
      // Default to first subject if not set or invalid
      if (!selectedSubject || !subjects.includes(selectedSubject)) {
         setSelectedSubject(subjects[0]);
      }
    } else {
      setSelectedSubject(user.subject || '');
    }
  }, [user, user.teacherType, user.phase]);

  // Form States
  const [formData, setFormData] = useState({
    classId: '',
    materialId: '',
    learningObjective: '',
    date: new Date().toISOString().split('T')[0],
    meetingNo: '',
    activities: '',
    reflection: '',
    followUp: ''
  });

  // Filter List States
  const [filterClassId, setFilterClassId] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // UI States
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Constants
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  // Dynamic Year List (Realtime)
  const currentRealYear = new Date().getFullYear();
  const yearsList = [currentRealYear - 1, currentRealYear, currentRealYear + 1];

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cls = await getClasses(user.id);
      setClasses(cls);
      if (cls.length > 0) {
        // Default form class to first available, BUT FILTER defaults to All ('')
        setFormData(prev => ({ ...prev, classId: cls[0].id }));
      }
      
      // Fetch ALL Materials for Lookup Map (for Print/Export)
      const matMap: Record<string, ScopeMaterial> = {};
      const matPromises = cls.map(async (c) => {
         // PASS user.id to get own materials
         const ganjil = await getScopeMaterials(c.id, 'Ganjil', user.id, selectedSubject);
         const genap = await getScopeMaterials(c.id, 'Genap', user.id, selectedSubject);
         return [...ganjil, ...genap];
      });
      const allMatsArrays = await Promise.all(matPromises);
      allMatsArrays.flat().forEach(m => {
         matMap[m.id] = m;
      });
      setMaterialMap(matMap);

      await fetchJournals();
      setLoading(false);
    };
    init();

    // Listen to sync events to refresh data
    const handleSyncStatus = (e: any) => {
        if (e.detail === 'success') {
            fetchJournals();
        }
    };
    window.addEventListener('sync-status', handleSyncStatus);
    
    return () => {
        window.removeEventListener('sync-status', handleSyncStatus);
    };
  }, [user, selectedSubject]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterClassId, filterMonth, filterYear, selectedSubject]);

  // Fetch Materials when Form Class Changes (For Dropdown)
  useEffect(() => {
    if (formData.classId) {
      const fetchMats = async () => {
        // PASS user.id here too
        const matGanjil = await getScopeMaterials(formData.classId, 'Ganjil', user.id, selectedSubject);
        const matGenap = await getScopeMaterials(formData.classId, 'Genap', user.id, selectedSubject);
        setAllMaterials([...matGanjil, ...matGenap]);
      };
      fetchMats();
    } else {
      setAllMaterials([]);
    }
  }, [formData.classId, selectedSubject]);

  const fetchJournals = async () => {
    const data = await getTeachingJournals(user.id, selectedSubject);
    setJournals(data);
  };

  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.classId || !formData.materialId || !formData.date || !formData.activities) {
      alert("Mohon lengkapi field wajib (Kelas, LM, Tanggal, Kegiatan).");
      return;
    }

    setIsSaving(true);
    const newJournal = await addTeachingJournal({
      ...formData,
      userId: user.id,
      subject: selectedSubject
    });

    if (newJournal) {
      setJournals([newJournal, ...journals]);
      // Reset form partials (keep class/date/meeting flow)
      setFormData(prev => ({
        ...prev,
        materialId: '',
        learningObjective: '',
        meetingNo: (parseInt(prev.meetingNo || '0') + 1).toString(), // Auto increment meeting no
        activities: '',
        reflection: '',
        followUp: ''
      }));
      alert('Jurnal berhasil disimpan!');
    } else {
      alert('Gagal menyimpan jurnal.');
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus jurnal ini?')) {
      await deleteTeachingJournal(id);
      setJournals(journals.filter(j => j.id !== id));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredJournals.map(j => j.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Hapus ${selectedIds.size} jurnal terpilih?`)) {
      await bulkDeleteTeachingJournals(Array.from(selectedIds));
      setJournals(journals.filter(j => !selectedIds.has(j.id)));
      setSelectedIds(new Set());
    }
  };

  // --- FILTER & PAGINATION LOGIC ---
  const filteredJournals = journals.filter(j => {
    const d = new Date(j.date);
    const matchClass = filterClassId ? j.classId === filterClassId : true;
    const matchMonth = d.getMonth() === filterMonth;
    const matchYear = d.getFullYear() === filterYear;
    return matchClass && matchMonth && matchYear;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredJournals.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);

  // --- EXPORT ---

  const getExportData = () => {
    return filteredJournals.map((j, idx) => {
      const cls = classes.find(c => c.id === j.classId);
      const mat = materialMap[j.materialId];
      // FIX: Resolve Material ID to Text (Code + Content)
      const materialText = mat ? `[${mat.code}] ${mat.content}` : j.materialId;

      return {
        no: idx + 1,
        className: cls?.name || '-',
        date: new Date(j.date).toLocaleDateString('id-ID'),
        meeting: j.meetingNo,
        lm: materialText, 
        tp: j.learningObjective,
        activity: j.activities,
        reflection: j.reflection || '-',
        followUp: j.followUp || '-'
      };
    });
  };

  const exportToExcel = () => {
    const data = getExportData();
    const headers = ['No', 'Kelas', 'Tanggal', 'Pertemuan Ke', 'Lingkup Materi', 'Tujuan Pembelajaran', 'Kegiatan', 'Refleksi', 'Tindak Lanjut'];
    const rows = data.map(d => Object.values(d));
    
    const ws = XLSX.utils.aoa_to_sheet([
      [`JURNAL MENGAJAR GURU - ${monthNames[filterMonth]} ${filterYear}`],
      [`Guru: ${user.fullName}`],
      [],
      headers,
      ...rows
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurnal Mengajar");
    XLSX.writeFile(wb, `Jurnal_Mengajar_${monthNames[filterMonth]}_${filterYear}.xlsx`);
  };

  const handlePrint = () => {
    const data = getExportData();
    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;

    const rows = data.map(d => `
      <tr>
        <td class="text-center">${d.no}</td>
        <td class="text-center">${d.date}</td>
        <td class="text-center">${d.meeting}</td>
        <td>${d.lm}</td>
        <td>${d.tp}</td>
        <td>${d.activity}</td>
        <td>${d.reflection}</td>
        <td>${d.followUp}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Jurnal Mengajar - ${monthNames[filterMonth]} ${filterYear}</title>
          <style>
            body { font-family: sans-serif; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #333; padding: 5px; vertical-align: top; }
            th { background-color: #f0f0f0; }
            .text-center { text-align: center; }
            h2, h4 { text-align: center; margin: 0; padding: 2px; }
            .header { margin-bottom: 20px; }
            @page { size: landscape; margin: 1cm; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>JURNAL KEGIATAN PEMBELAJARAN (JURNAL MENGAJAR)</h2>
            <h4>Periode: ${monthNames[filterMonth]} ${filterYear}</h4>
            <h4>Guru: ${user.fullName}</h4>
          </div>
          <table>
            <thead>
              <tr>
                <th width="30">No</th>
                <th width="80">Tanggal</th>
                <th width="40">Ke-</th>
                <th width="150">Lingkup Materi</th>
                <th>Tujuan Pembelajaran</th>
                <th>Kegiatan Pembelajaran</th>
                <th>Refleksi</th>
                <th>Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 pb-20">
      
      {/* --- SUBJECT SELECTOR --- */}
      {user.teacherType === 'CLASS' ? (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-4 mb-6">
            <div className="flex-1">
                <label className="block text-sm font-bold text-blue-800 mb-1">Mata Pelajaran (Mode Guru Kelas)</label>
                <select 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-2 border border-blue-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    {((user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
            <div className="text-xs text-blue-600 max-w-md hidden sm:block">
                *Anda sedang dalam mode Guru Kelas. Pilih mata pelajaran untuk memfilter Jurnal, Lingkup Materi, dan Asesmen.
            </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center gap-4 mb-6">
            <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Filter Mata Pelajaran</label>
                <select 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value={user.subject || ''}>{user.subject || 'Mapel Saya'}</option>
                    <option value="ALL">Tampilkan Semua Data (Termasuk Mapel Lain)</option>
                </select>
            </div>
            <div className="text-xs text-gray-500 max-w-md hidden sm:block">
                *Jika data tidak muncul, coba pilih "Tampilkan Semua Data".
            </div>
        </div>
      )}

      {/* --- FORM SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
         <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
            <NotebookPen className="text-blue-600" />
            Tambah Jurnal Baru
         </h2>
         
         <form onSubmit={handleSubmit} className="space-y-6">
            {/* Baris 1: Kelas, LM, TP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Kelas *</label>
                  <select 
                     name="classId"
                     value={formData.classId}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                     required
                  >
                     <option value="">Pilih Kelas</option>
                     {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Lingkup Materi *</label>
                  <select 
                     name="materialId"
                     value={formData.materialId}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                     required
                     disabled={!formData.classId}
                  >
                     <option value="">{formData.classId ? 'Pilih Materi' : 'Pilih Kelas Dulu'}</option>
                     {allMaterials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.content}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Tujuan Pembelajaran *</label>
                  <input 
                     type="text"
                     name="learningObjective"
                     value={formData.learningObjective}
                     onChange={handleInputChange}
                     placeholder="Contoh: Memahami konsep..."
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                     required
                  />
               </div>
            </div>

            {/* Baris 2: Tanggal, Pertemuan Ke */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Tanggal *</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                       type="date"
                       name="date"
                       value={formData.date}
                       onChange={handleInputChange}
                       className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                       required
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Pertemuan Ke- *</label>
                  <input 
                     type="number"
                     name="meetingNo"
                     value={formData.meetingNo}
                     onChange={handleInputChange}
                     placeholder="Contoh: 1"
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                     required
                  />
               </div>
            </div>

            {/* Baris 3: Kegiatan */}
            <div>
               <label className="block text-sm font-semibold text-blue-700 mb-1">Kegiatan Pembelajaran *</label>
               <textarea 
                  name="activities"
                  rows={3}
                  value={formData.activities}
                  onChange={handleInputChange}
                  placeholder="Uraikan kegiatan pembelajaran yang dilakukan..."
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
                  required
               />
            </div>

            {/* Baris 4: Refleksi */}
            <div>
               <label className="block text-sm font-semibold text-blue-700 mb-1">Refleksi</label>
               <textarea 
                  name="reflection"
                  rows={2}
                  value={formData.reflection}
                  onChange={handleInputChange}
                  placeholder="Refleksi dari kegiatan pembelajaran (opsional)..."
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
               />
            </div>

             {/* Baris 5: Tindak Lanjut */}
             <div>
               <label className="block text-sm font-semibold text-blue-700 mb-1">Tindak Lanjut</label>
               <textarea 
                  name="followUp"
                  rows={2}
                  value={formData.followUp}
                  onChange={handleInputChange}
                  placeholder="Tindak lanjut dari refleksi (opsional)..."
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
               />
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
               <button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition flex items-center gap-2"
               >
                  <Save size={18} />
                  {isSaving ? 'Menyimpan...' : 'Simpan Jurnal'}
               </button>
            </div>
         </form>
      </div>

      {/* --- LIST & FILTER SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
         {/* Filter Header */}
         <div className="p-6 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-6 bg-gray-50 rounded-t-xl">
             <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                 {/* Class Filter */}
                 <div className="relative">
                    <select 
                       value={filterClassId}
                       onChange={(e) => setFilterClassId(e.target.value)}
                       className="w-full sm:w-48 pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm font-medium"
                    >
                       <option value="">Semua Kelas</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Filter size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                 </div>

                 {/* Month Filter */}
                 <select 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    className="w-full sm:w-40 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                 >
                    {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                 </select>

                 {/* Year Filter */}
                 <select 
                    value={filterYear}
                    onChange={(e) => setFilterYear(parseInt(e.target.value))}
                    className="w-full sm:w-28 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                 >
                    {yearsList.map(y => (
                       <option key={y} value={y}>{y}</option>
                    ))}
                 </select>
             </div>

             <div className="flex flex-wrap gap-2">
                 {selectedIds.size > 0 && (
                   <button 
                     onClick={handleBulkDelete}
                     className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2.5 rounded-lg text-sm font-medium transition mr-auto xl:mr-0"
                   >
                     <Trash2 size={16} /> Hapus ({selectedIds.size})
                   </button>
                 )}
                 <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
                 >
                    <Printer size={16} /> Print / PDF
                 </button>
                 <button 
                    onClick={exportToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
                 >
                    <FileSpreadsheet size={16} /> Unduh Excel
                 </button>
             </div>
         </div>

         {/* List Items */}
         <div className="overflow-x-auto">
            {loading ? (
               <div className="p-8 text-center text-gray-400">Memuat data...</div>
            ) : filteredJournals.length === 0 ? (
               <div className="p-16 text-center text-gray-400">
                  <NotebookPen size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Tidak ada jurnal pada periode ini.</p>
               </div>
            ) : (
               <>
                 <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-600 font-semibold border-b border-gray-200">
                       <tr>
                          <th className="p-4 w-10">
                             <input 
                                type="checkbox" 
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                onChange={handleSelectAll}
                                checked={filteredJournals.length > 0 && selectedIds.size === filteredJournals.length}
                             />
                          </th>
                          <th className="p-4 w-32">Tanggal</th>
                          <th className="p-4 w-20 text-center">Ke-</th>
                          <th className="p-4 w-48">Kelas / Materi</th>
                          <th className="p-4 min-w-[300px]">Kegiatan Pembelajaran</th>
                          <th className="p-4 w-20 text-center">Aksi</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {currentItems.map(journal => {
                          const cls = classes.find(c => c.id === journal.classId);
                          const mat = materialMap[journal.materialId];
                          return (
                             <tr key={journal.id} className="hover:bg-gray-50 transition group">
                                <td className="p-4 align-top">
                                   <input 
                                      type="checkbox" 
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      checked={selectedIds.has(journal.id)}
                                      onChange={() => handleToggleSelect(journal.id)}
                                   />
                                </td>
                                <td className="p-4 align-top">
                                   <div className="font-medium text-gray-900">
                                      {new Date(journal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                   </div>
                                </td>
                                <td className="p-4 align-top text-center">
                                   <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">
                                      #{journal.meetingNo}
                                   </span>
                                </td>
                                <td className="p-4 align-top">
                                   <div className="font-bold text-gray-800 mb-1">{cls?.name || 'Unknown Class'}</div>
                                   <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block" title={mat ? mat.content : 'ID: ' + journal.materialId}>
                                      {mat ? mat.code : journal.materialId.substring(0,8)}
                                   </div>
                                </td>
                                <td className="p-4 align-top">
                                   <div className="mb-2">
                                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Tujuan:</span>
                                      <p className="text-gray-900 font-medium">{journal.learningObjective}</p>
                                   </div>
                                   <div className="mb-2">
                                      <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Kegiatan:</span>
                                      <p className="text-gray-600 whitespace-pre-line text-xs">{journal.activities}</p>
                                   </div>
                                   {(journal.reflection || journal.followUp) && (
                                      <div className="grid grid-cols-2 gap-4 mt-2">
                                         {journal.reflection && (
                                            <div className="bg-yellow-50 p-2 rounded border border-yellow-100">
                                               <span className="text-[10px] font-bold text-yellow-700 uppercase">Refleksi</span>
                                               <p className="text-[10px] text-yellow-800 italic">{journal.reflection}</p>
                                            </div>
                                         )}
                                         {journal.followUp && (
                                            <div className="bg-purple-50 p-2 rounded border border-purple-100">
                                               <span className="text-[10px] font-bold text-purple-700 uppercase">Tindak Lanjut</span>
                                               <p className="text-[10px] text-purple-800 italic">{journal.followUp}</p>
                                            </div>
                                         )}
                                      </div>
                                   )}
                                </td>
                                <td className="p-4 align-top text-center">
                                   <button 
                                      onClick={() => handleDelete(journal.id)}
                                      className="text-gray-300 hover:text-red-600 p-2 transition rounded-full hover:bg-red-50"
                                      title="Hapus Jurnal"
                                   >
                                      <Trash2 size={18} />
                                   </button>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>

                 {/* Pagination Controls */}
                 {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 p-4 bg-gray-50">
                       <div className="text-sm text-gray-500">
                          Halaman {currentPage} dari {totalPages}
                       </div>
                       <div className="flex gap-2">
                          <button 
                             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                             disabled={currentPage === 1}
                             className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600"
                          >
                             <ChevronLeft size={18} />
                          </button>
                          
                          {/* Simple Page Numbers */}
                          {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                             // Logic to show a window of pages
                             let p = i + 1;
                             if (totalPages > 5 && currentPage > 3) p = currentPage - 2 + i;
                             if (p > totalPages) return null;
                             
                             return (
                                <button 
                                   key={p}
                                   onClick={() => setCurrentPage(p)}
                                   className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                                      currentPage === p 
                                      ? 'bg-blue-600 text-white shadow-sm' 
                                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                   }`}
                                >
                                   {p}
                                </button>
                             )
                          })}

                          <button 
                             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                             disabled={currentPage === totalPages}
                             className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600"
                          >
                             <ChevronRight size={18} />
                          </button>
                       </div>
                    </div>
                 )}
               </>
            )}
         </div>
      </div>
    </div>
  );
};

export default TeacherJournal;
