
import React, { useState, useEffect } from 'react';
import { User, ClassRoom, ScopeMaterial, TeachingJournal, SD_SUBJECTS_PHASE_A, SD_SUBJECTS_PHASE_BC, MATH_SUBJECT_OPTIONS, AbsentStudent, TeachingSchedule, Student } from '../types';
import { getClasses, getScopeMaterials, getTeachingJournals, addTeachingJournal, deleteTeachingJournal, bulkDeleteTeachingJournals, getStudents, getTeachingSchedules } from '../services/database';
import { Plus, Save, Trash2, Filter, Printer, FileSpreadsheet, NotebookPen, CalendarDays, ChevronLeft, ChevronRight, UserMinus } from './Icons';
import Skeleton from './Skeleton';
import * as XLSX from 'xlsx';

const ABSENT_STATUS_MAP: Record<string, string> = { S: 'Sakit', I: 'Ijin', A: 'Alfa' };

interface TeacherJournalProps {
  user: User;
}

const TeacherJournal: React.FC<TeacherJournalProps> = ({ user }) => {
  // 1. Form & Data States (Declare these first)
  const [formData, setFormData] = useState({
    classId: '',
    materialId: '',
    learningObjective: '',
    date: new Date().toISOString().split('T')[0],
    meetingNo: '',
    activities: '',
    reflection: '',
    followUp: '',
    examAgenda: ''
  });
  const [selectedSubject, setSelectedSubject] = useState<string>(user.subject || '');
  const [formSubject, setFormSubject] = useState<string>(user.subject || '');
  
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allMaterials, setAllMaterials] = useState<ScopeMaterial[]>([]);
  const [materialMap, setMaterialMap] = useState<Record<string, ScopeMaterial>>({});
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);
  const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([]);
  const [selectedAbsentStudentId, setSelectedAbsentStudentId] = useState('');

  // 2. Filter & UI States
  const [filterClassId, setFilterClassId] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  const [validationData, setValidationData] = useState({
    placeName: localStorage.getItem('journal_place_name') || '',
    principalName: localStorage.getItem('journal_principal_name') || '',
    principalNip: localStorage.getItem('journal_principal_nip') || '',
    teacherName: localStorage.getItem('journal_teacher_name') || user.fullName,
    teacherNip: localStorage.getItem('journal_teacher_nip') || user.nip || ''
  });

  const getDayName = (dateStr: string) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date(dateStr).getDay()];
  };

  // 3. Effects

  // Fetch Students for Absentee List
  useEffect(() => {
    if (formData.classId) {
      getStudents(formData.classId).then(setClassStudents);
      setAbsentStudents([]); // Reset absent list when class changes
    } else {
      setClassStudents([]);
      setAbsentStudents([]);
    }
  }, [formData.classId]);

  // Fetch Schedules for Jam Ke (Range)
  useEffect(() => {
    const fetchSchedules = async () => {
      if (user.id && user.schoolNpsn) {
        const allSchedules = await getTeachingSchedules(user.id, user.schoolNpsn);
        setSchedules(allSchedules);
      }
    };
    fetchSchedules();
  }, [user.id, user.schoolNpsn]);

  // Auto-populate Jam Ke (Range) based on Class, Date, and Subject
  useEffect(() => {
    if (formData.classId && formData.date && formSubject && schedules.length > 0) {
      const dayName = getDayName(formData.date);
      const cls = classes.find(c => c.id === formData.classId);
      
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const isToday = formData.date === now.toISOString().split('T')[0];

      let matchingSchedule;
      
      if (isToday) {
        // Try to find schedule matching current time
        matchingSchedule = schedules.find(s => 
          s.className === cls?.name &&
          s.day === dayName &&
          s.subject === formSubject &&
          currentTime >= (s.timeStart || '00:00') &&
          currentTime <= (s.timeEnd || '23:59')
        );
      }

      // Fallback to first match for the day if no time match or not today
      if (!matchingSchedule) {
        matchingSchedule = schedules.find(s => 
          s.className === cls?.name &&
          s.day === dayName &&
          s.subject === formSubject
        );
      }

      if (matchingSchedule) {
        const range = matchingSchedule.meetingNoEnd 
          ? `${matchingSchedule.meetingNo}-${matchingSchedule.meetingNoEnd}`
          : `${matchingSchedule.meetingNo}`;
        setFormData(prev => ({ ...prev, meetingNo: range }));
      }
    }
  }, [formData.classId, formData.date, formSubject, schedules, classes]);
  
  // Initialize Subject based on Teacher Type
  useEffect(() => {
    if (user.isMultiSubject && user.subjects && user.subjects.length > 0) {
      // For Multi-Subject, filter defaults to ALL
      setSelectedSubject('ALL');
      // Form defaults to first subject in list
      setFormSubject(user.subjects[0]);
    } else if (user.teacherType === 'CLASS') {
      const subjects = (user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A;
      // Default to first subject if not set or invalid
      if (!selectedSubject || !subjects.includes(selectedSubject)) {
         setSelectedSubject(subjects[0]);
      }
      if (!formSubject || !subjects.includes(formSubject)) {
         setFormSubject(subjects[0]);
      }
    } else if (user.subject === 'Matematika' || user.secondarySubject) {
      // Filter defaults to ALL if has multiple subjects
      if (selectedSubject !== 'ALL') {
         setSelectedSubject('ALL');
      }
      // Form defaults to first subject
      if (!formSubject) {
         setFormSubject(user.subject === 'Matematika' ? MATH_SUBJECT_OPTIONS[0] : (user.subject || ''));
      }
    } else {
      setSelectedSubject(user.subject || '');
      setFormSubject(user.subject || '');
    }
  }, [user, user.teacherType, user.phase, user.isMultiSubject, user.subjects, user.secondarySubject]);

  // Persist validation data
  useEffect(() => {
    localStorage.setItem('journal_place_name', validationData.placeName);
    localStorage.setItem('journal_principal_name', validationData.principalName);
    localStorage.setItem('journal_principal_nip', validationData.principalNip);
    localStorage.setItem('journal_teacher_name', validationData.teacherName);
    localStorage.setItem('journal_teacher_nip', validationData.teacherNip);
  }, [validationData]);

  const handleValidationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationData({ ...validationData, [e.target.name]: e.target.value });
  };

  // Constants
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  // Dynamic Year List (Realtime)
  const currentRealYear = new Date().getFullYear();
  const yearsList = [currentRealYear - 1, currentRealYear, currentRealYear + 1];

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cls = await getClasses(user.id, user.schoolNpsn);
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
        const matGanjil = await getScopeMaterials(formData.classId, 'Ganjil', user.id, formSubject);
        const matGenap = await getScopeMaterials(formData.classId, 'Genap', user.id, formSubject);
        setAllMaterials([...matGanjil, ...matGenap]);
      };
      fetchMats();
    } else {
      setAllMaterials([]);
    }
  }, [formData.classId, formSubject]);

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
    const isExam = !!formData.examAgenda;

    if (!formData.classId || (!isExam && !formData.materialId) || !formData.date || !formData.activities) {
      alert("Mohon lengkapi field wajib (Kelas, LM, Tanggal, Kegiatan).");
      return;
    }

    if (!isExam && user.subject === 'Matematika' && !formSubject) {
        alert('Mohon pilih mata pelajaran spesifik sebelum menyimpan jurnal.');
        return;
    }

    setIsSaving(true);
    const newJournal = await addTeachingJournal({
      ...formData,
      userId: user.id,
      subject: formSubject,
      absentStudents: JSON.stringify(absentStudents)
    });

    if (newJournal) {
      setJournals([newJournal, ...journals]);
      // Reset form partials (keep class/date/meeting flow)
      setFormData(prev => ({
        ...prev,
        materialId: '',
        learningObjective: '',
        activities: '',
        reflection: '',
        followUp: '',
        examAgenda: ''
      }));
      setAbsentStudents([]);
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
    
    // NEW: Subject Filter Logic
    let matchSubject = true;
    if (user.teacherType === 'CLASS') {
        // Strict match for Class Teacher
        matchSubject = j.subject === selectedSubject;
    } else {
        // Subject Teacher: Match if not ALL
        if (selectedSubject && selectedSubject !== 'ALL') {
             // Handle legacy data (missing subject) or case-insensitive
             const s = (j.subject || '').trim().toLowerCase();
             const filter = selectedSubject.trim().toLowerCase();
             // If legacy data has no subject, we might want to include it if it matches user's default subject?
             // But here we just match the filter.
             matchSubject = s === filter;
        }
    }

    return matchClass && matchMonth && matchYear && matchSubject;
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
      const materialText = j.examAgenda ? `[AGENDA: ${j.examAgenda}]` : (mat ? `[${mat.code}] ${mat.content}` : j.materialId);

      const absents: AbsentStudent[] = j.absentStudents ? JSON.parse(j.absentStudents) : [];
      const absentText = absents.map(a => `${a.name} (${ABSENT_STATUS_MAP[a.status] || a.status})`).join(', ') || '-';

      return {
        no: idx + 1,
        className: cls?.name || '-',
        date: new Date(j.date).toLocaleDateString('id-ID'),
        meeting: j.examAgenda ? '-' : j.meetingNo,
        lm: materialText, 
        tp: j.examAgenda ? '-' : j.learningObjective,
        activity: j.activities,
        absent: absentText,
        reflection: j.reflection || '-',
        followUp: j.followUp || '-'
      };
    });
  };

  const exportToExcel = () => {
    const data = getExportData();
    const headers = ['No', 'Kelas', 'Tanggal', 'Jam Ke', 'Lingkup Materi', 'Tujuan Pembelajaran', 'Kegiatan', 'Ketidakhadiran', 'Refleksi', 'Tindak Lanjut'];
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
        <td>${d.absent}</td>
        <td>${d.reflection}</td>
        <td>${d.followUp}</td>
      </tr>
    `).join('');

    const today = new Date();
    const formattedDate = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

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
            .signature-container { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .signature-box { width: 300px; text-align: center; }
            @page { size: landscape; margin: 1cm; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>JURNAL KEGIATAN PEMBELAJARAN (JURNAL MENGAJAR)</h2>
            <h4>Mata Pelajaran: ${selectedSubject === 'ALL' ? 'Semua Mata Pelajaran' : selectedSubject}</h4>
            <h4>Periode: ${monthNames[filterMonth]} ${filterYear}</h4>
            <h4>Guru: ${user.fullName}</h4>
          </div>
          <table>
            <thead>
              <tr>
                <th width="30">No</th>
                <th width="80">Tanggal</th>
                <th width="40">Jam Ke</th>
                <th width="150">Lingkup Materi</th>
                <th>Tujuan Pembelajaran</th>
                <th>Kegiatan Pembelajaran</th>
                <th>Ketidakhadiran</th>
                <th>Refleksi</th>
                <th>Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="signature-container">
            <div class="signature-box">
              <p>Mengetahui,</p>
              <p>Kepala Sekolah ${user.schoolName || '[Nama Sekolah]'}</p>
              <br><br><br><br>
              <p><strong>${validationData.principalName || '................................'}</strong></p>
              <p>NIP. ${validationData.principalNip || '................................'}</p>
            </div>
            <div class="signature-box">
              <p>${validationData.placeName || '................'}, ${formattedDate}</p>
              <p>Guru Mata Pelajaran</p>
              <br><br><br><br>
              <p><strong>${validationData.teacherName || user.fullName}</strong></p>
              <p>NIP. ${validationData.teacherNip || user.nip || '................................'}</p>
            </div>
          </div>

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
      
      {/* --- SUBJECT SELECTOR REMOVED FROM TOP --- */}

      {/* --- FORM SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
         <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
            <NotebookPen className="text-blue-600" />
            Tambah Jurnal Baru
         </h2>
         
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Baris 1: Kelas, Mapel, Agenda Ujian */}
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

               {/* Subject Selector in Form */}
               {(user.teacherType === 'CLASS' || user.subject === 'Matematika' || user.isMultiSubject || user.secondarySubject) && (
                   <div>
                       <label className="block text-sm font-semibold text-blue-700 mb-1">Mata Pelajaran *</label>
                       <select
                           value={formSubject}
                           onChange={(e) => setFormSubject(e.target.value)}
                           className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                           required={!formData.examAgenda}
                           disabled={!!formData.examAgenda}
                       >
                           {user.isMultiSubject ? (
                               (user.subjects || []).map(s => (
                                   <option key={s} value={s}>{s}</option>
                               ))
                           ) : user.teacherType === 'CLASS' ? (
                               ((user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A).map(s => (
                                   <option key={s} value={s}>{s}</option>
                               ))
                           ) : (
                               <>
                                   {user.subject === 'Matematika' ? (
                                       MATH_SUBJECT_OPTIONS.map(m => (
                                           <option key={m} value={m}>{m}</option>
                                       ))
                                   ) : (
                                       <option value={user.subject}>{user.subject}</option>
                                   )}
                                   {user.secondarySubject && (
                                       <option value={user.secondarySubject}>{user.secondarySubject}</option>
                                   )}
                               </>
                           )}
                       </select>
                   </div>
               )}

               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Agenda Ujian (Opsional)</label>
                  <select 
                     name="examAgenda"
                     value={formData.examAgenda}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  >
                     <option value="">Bukan Ujian</option>
                     <option value="Ujian Praktik">Ujian Praktik</option>
                     <option value="Ujian Tulis">Ujian Tulis</option>
                  </select>
               </div>
            </div>

            {/* Baris 2: LM, TP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Lingkup Materi *</label>
                  <select 
                     name="materialId"
                     value={formData.materialId}
                     onChange={handleInputChange}
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                     required={!formData.examAgenda}
                     disabled={!formData.classId || !!formData.examAgenda}
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
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                     required={!formData.examAgenda}
                     disabled={!!formData.examAgenda}
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
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Jam Ke (Range) *</label>
                  <input 
                     type="text"
                     name="meetingNo"
                     value={formData.meetingNo}
                     onChange={handleInputChange}
                     placeholder="Contoh: 1-2 atau 3"
                     className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50 disabled:bg-gray-200"
                     required={!formData.examAgenda}
                     disabled={!!formData.examAgenda}
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
                  placeholder={formData.examAgenda ? "Tidak aktif saat agenda ujian" : "Refleksi dari kegiatan pembelajaran (opsional)..."}
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none disabled:opacity-50 disabled:bg-gray-200"
                  disabled={!!formData.examAgenda}
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
                  placeholder={formData.examAgenda ? "Tidak aktif saat agenda ujian" : "Tindak lanjut dari refleksi (opsional)..."}
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none disabled:opacity-50 disabled:bg-gray-200"
                  disabled={!!formData.examAgenda}
               />
            </div>

            {/* Section: Siswa Tidak Hadir */}
            <div className="border-t border-gray-100 pt-6">
               <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <UserMinus className="text-red-500" />
                  Siswa Tidak Hadir
               </h3>
               
               <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="flex-1">
                     <label className="block text-sm font-semibold text-blue-700 mb-1">Pilih Siswa</label>
                     <select 
                        value={selectedAbsentStudentId}
                        onChange={(e) => setSelectedAbsentStudentId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                        disabled={!formData.classId}
                     >
                        <option value="">-- Pilih Nama Siswa --</option>
                        {classStudents
                           .filter(s => !absentStudents.find(as => as.studentId === s.id))
                           .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        }
                     </select>
                  </div>
                  <div className="flex items-end">
                     <button 
                        type="button"
                        onClick={() => {
                           if (!selectedAbsentStudentId) return;
                           const student = classStudents.find(s => s.id === selectedAbsentStudentId);
                           if (student) {
                              setAbsentStudents([...absentStudents, { studentId: student.id, name: student.name, status: 'A' }]);
                              setSelectedAbsentStudentId('');
                           }
                        }}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
                        disabled={!selectedAbsentStudentId}
                     >
                        <Plus size={18} />
                        Tambah
                     </button>
                  </div>
               </div>

               {absentStudents.length > 0 && (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                           <tr>
                              <th className="px-4 py-3 w-16">No</th>
                              <th className="px-4 py-3">Nama Siswa</th>
                              <th className="px-4 py-3 w-40">Keterangan</th>
                              <th className="px-4 py-3 w-16">Aksi</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                           {absentStudents.map((s, idx) => (
                              <tr key={s.studentId}>
                                 <td className="px-4 py-3 text-center">{idx + 1}</td>
                                 <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                                 <td className="px-4 py-3">
                                    <select 
                                       value={s.status}
                                       onChange={(e) => {
                                          const newStatus = e.target.value as 'S' | 'I' | 'A';
                                          setAbsentStudents(absentStudents.map(as => as.studentId === s.studentId ? { ...as, status: newStatus } : as));
                                       }}
                                       className="w-full border border-gray-300 rounded-md p-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                       <option value="S">Sakit</option>
                                       <option value="I">Ijin</option>
                                       <option value="A">Alfa</option>
                                    </select>
                                 </td>
                                 <td className="px-4 py-3 text-center">
                                    <button 
                                       type="button"
                                       onClick={() => setAbsentStudents(absentStudents.filter(as => as.studentId !== s.studentId))}
                                       className="text-red-500 hover:text-red-700 transition"
                                    >
                                       <Trash2 size={18} />
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
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

      {/* --- FILTER SECTION (Moved Below Form) --- */}
      {/* Filter removed for Class Teachers as requested */}

      {/* --- LIST & FILTER SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
         {/* Filter Header */}
         <div className="p-6 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-6 bg-gray-50 rounded-t-xl">
             <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                 {/* Subject Filter (For Multi-Subject) */}
                 {(user.isMultiSubject || user.teacherType === 'CLASS' || user.subject === 'Matematika' || user.secondarySubject) && (
                    <div className="relative">
                       <select 
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="w-full sm:w-48 pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm font-medium"
                       >
                          {(user.isMultiSubject || user.subject === 'Matematika' || user.secondarySubject) && <option value="ALL">Semua Mapel</option>}
                          {user.isMultiSubject ? (
                             (user.subjects || []).map(s => <option key={s} value={s}>{s}</option>)
                          ) : user.teacherType === 'CLASS' ? (
                             ((user.phase === 'B' || user.phase === 'C') ? SD_SUBJECTS_PHASE_BC : SD_SUBJECTS_PHASE_A).map(s => (
                                <option key={s} value={s}>{s}</option>
                             ))
                          ) : (
                             <>
                                {user.subject === 'Matematika' ? (
                                   MATH_SUBJECT_OPTIONS.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                   ))
                                ) : (
                                   <option value={user.subject}>{user.subject}</option>
                                )}
                                {user.secondarySubject && (
                                   <option value={user.secondarySubject}>{user.secondarySubject}</option>
                                )}
                             </>
                          )}
                       </select>
                       <Filter size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                    </div>
                 )}

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
                     onClick={() => setShowPrintSettings(!showPrintSettings)}
                     className={`flex items-center gap-2 border px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm ${showPrintSettings ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
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

          {/* Print Settings Panel */}
          {showPrintSettings && (
             <div className="p-6 bg-blue-50 border-b border-blue-100 animate-in slide-in-from-top duration-200">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      <Printer size={16} /> Pengaturan Validasi Cetak
                   </h3>
                   <button 
                      onClick={handlePrint}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2"
                   >
                      <Printer size={16} /> Cetak Sekarang
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">Kepala Sekolah</p>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">Nama Kepala Sekolah</label>
                         <input 
                            type="text"
                            name="principalName"
                            value={validationData.principalName}
                            onChange={handleValidationChange}
                            placeholder="Nama Lengkap & Gelar"
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">NIP Kepala Sekolah</label>
                         <input 
                            type="text"
                            name="principalNip"
                            value={validationData.principalNip}
                            onChange={handleValidationChange}
                            placeholder="NIP"
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">Guru Mata Pelajaran</p>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">Nama Guru</label>
                         <input 
                            type="text"
                            name="teacherName"
                            value={validationData.teacherName}
                            onChange={handleValidationChange}
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">NIP Guru</label>
                         <input 
                            type="text"
                            name="teacherNip"
                            value={validationData.teacherNip}
                            onChange={handleValidationChange}
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">Lokasi & Tanggal</p>
                      <div>
                         <label className="block text-[10px] text-gray-500 mb-1">Nama Tempat (Kota/Kecamatan)</label>
                         <input 
                            type="text"
                            name="placeName"
                            value={validationData.placeName}
                            onChange={handleValidationChange}
                            placeholder="Contoh: Jakarta"
                            className="w-full text-sm border border-blue-200 rounded p-2 outline-none focus:ring-2 focus:ring-blue-500"
                         />
                      </div>
                      <div className="p-3 bg-white rounded border border-blue-100">
                         <p className="text-[10px] text-gray-400 mb-1">Tanggal Cetak Otomatis:</p>
                         <p className="text-sm font-medium text-gray-700">
                            {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          )}

         {/* List Items */}
         <div className="overflow-x-auto">
            {loading ? (
               <div className="space-y-4 p-6">
                  {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 animate-pulse">
                          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                          <div className="flex-1 space-y-3">
                              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                              <div className="h-20 bg-gray-200 rounded w-full"></div>
                          </div>
                      </div>
                  ))}
               </div>
            ) : filteredJournals.length === 0 ? (
               <div className="p-16 text-center text-gray-400">
                  <NotebookPen size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Tidak ada jurnal pada periode ini.</p>
               </div>
            ) : (
               <>
                 {/* Desktop Table View */}
                 <div className="hidden md:block">
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
                           <th className="p-4 w-20 text-center">Jam Ke</th>
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
                                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${journal.examAgenda ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                                       {journal.examAgenda ? '-' : journal.meetingNo}
                                    </span>
                                 </td>
                                 <td className="p-4 align-top">
                                    <div className="font-bold text-gray-800 mb-1">{cls?.name || 'Unknown Class'}</div>
                                    <div className={`text-xs px-2 py-1 rounded inline-block ${journal.examAgenda ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-gray-100 text-gray-500'}`} title={mat ? mat.content : 'ID: ' + journal.materialId}>
                                       {journal.examAgenda ? `AGENDA: ${journal.examAgenda}` : (mat ? mat.code : journal.materialId.substring(0,8))}
                                    </div>
                                 </td>
                                 <td className="p-4 align-top">
                                    {!journal.examAgenda && (
                                       <div className="mb-2">
                                          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Tujuan:</span>
                                          <p className="text-gray-900 font-medium">{journal.learningObjective}</p>
                                       </div>
                                    )}
                                    <div className="mb-2">
                                       <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Kegiatan:</span>
                                       <p className="text-gray-600 whitespace-pre-line text-xs">{journal.activities}</p>
                                    </div>
                                    {journal.absentStudents && (
                                       <div className="mt-2 bg-red-50 p-2 rounded border border-red-100">
                                          <span className="text-[10px] font-bold text-red-700 uppercase">Siswa Tidak Hadir</span>
                                          <p className="text-[10px] text-red-800">
                                             {JSON.parse(journal.absentStudents).map((as: any) => `${as.name} (${ABSENT_STATUS_MAP[as.status] || as.status})`).join(', ')}
                                          </p>
                                       </div>
                                    )}
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
                 </div>

                 {/* Mobile Card View */}
                 <div className="md:hidden space-y-4 p-4">
                    {currentItems.map(journal => {
                        const cls = classes.find(c => c.id === journal.classId);
                        const mat = materialMap[journal.materialId];
                        return (
                            <div key={journal.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3 relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${journal.examAgenda ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>
                                            {journal.examAgenda ? journal.examAgenda : `Jam #${journal.meetingNo}`}
                                        </span>
                                        <h3 className="font-bold text-gray-800 mt-2">{cls?.name || 'Unknown Class'}</h3>
                                        <p className="text-xs text-gray-500">{new Date(journal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                    <button 
                                       onClick={() => handleDelete(journal.id)}
                                       className="text-gray-400 hover:text-red-600 p-1"
                                    >
                                       <Trash2 size={18} />
                                    </button>
                                </div>
                                
                                {!journal.examAgenda && (
                                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="font-semibold text-xs text-gray-500 uppercase mb-1">Materi</p>
                                        <p className="text-xs">{mat ? `${mat.code} - ${mat.content}` : journal.materialId}</p>
                                    </div>
                                )}

                                <div>
                                    <p className="font-semibold text-xs text-gray-500 uppercase mb-1">Kegiatan</p>
                                    <p className="text-sm text-gray-600 line-clamp-3">{journal.activities}</p>
                                </div>
                                {journal.absentStudents && (
                                    <div className="mt-2 bg-red-50 p-2 rounded border border-red-100">
                                        <p className="font-semibold text-[10px] text-red-700 uppercase mb-1">Tidak Hadir</p>
                                        <p className="text-[10px] text-red-800">
                                            {JSON.parse(journal.absentStudents).map((as: any) => `${as.name} (${ABSENT_STATUS_MAP[as.status] || as.status})`).join(', ')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                 </div>

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
