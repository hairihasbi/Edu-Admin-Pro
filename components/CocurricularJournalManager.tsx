import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, ClassRoom, CocurricularJournal, SystemSettings } from '../types';
import { 
  getCocurricularJournals, 
  saveCocurricularJournal, 
  bulkSaveCocurricularJournals, 
  deleteCocurricularJournal, 
  getClasses, 
  getPicketOfficers,
  getSystemSettings, 
  getLocalDate 
} from '../services/database';
import { MathView, normalizeGeminiMathText } from './MathRenderer';
import { 
  Calendar, Clock, BookOpen, User as UserIcon, Plus, Printer, 
  Trash2, Edit3, CheckCircle2, AlertCircle, Search, 
  Filter, Sparkles, FileText, ChevronRight, Share2, 
  RefreshCw, Check, ArrowRight, Layers, Award, Info, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CocurricularJournalManagerProps {
  user: User;
}

const P5_THEMES = [
  'Gaya Hidup Berkelanjutan',
  'Kearifan Lokal',
  'Bhinneka Tunggal Ika',
  'Bangunlah Jiwa dan Raganya',
  'Suara Demokrasi',
  'Rekayasa dan Teknologi',
  'Kewirausahaan',
  'Kebekerjaan'
];

const ACTIVITY_TEMPLATES = [
  'Sosialisasi panduan proyek, penjelasan tujuan dan tahapan kegiatan kokurikuler.',
  'Eksplorasi isu kontekstual, observasi lapangan, dan pengumpulan data awal kelompok.',
  'Brainstorming ide kreatif dan perancangan desain prototipe/karya solusi.',
  'Praktik pembuatan karya/produk proyek secara kolaboratif dalam kelompok.',
  'Uji coba prototipe, evaluasi fungsi, dan perbaikan hasil karya proyek.',
  'Presentasi hasil karya, gelar karya (showcase), dan penerimaan umpan balik.',
  'Refleksi diri, asesmen formatif dimensi Profil Pelajar Pancasila, dan penyusunan laporan.'
];

export const CocurricularJournalManager: React.FC<CocurricularJournalManagerProps> = ({ user }) => {
  // --- STATE ---
  const [journals, setJournals] = useState<CocurricularJournal[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Selected date & class context
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Current date in YYYY-MM-DD
    return getLocalDate() || new Date().toISOString().split('T')[0];
  });
  const [selectedClass, setSelectedClass] = useState<string>('XII');
  const [filterMode, setFilterMode] = useState<'DATE_AND_CLASS' | 'ALL_CLASSES' | 'ALL_DATES'>('DATE_AND_CLASS');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: selectedDate,
    className: 'XII',
    classId: 'XII',
    startHour: 2,
    endHour: 2,
    isSeparateHours: true, // Split 2 to 4 into 3 individual rows for NO 1, 2, 3...
    facilitatorName: user.fullName || '',
    projectTheme: 'Gaya Hidup Berkelanjutan',
    activities: '',
    notes: ''
  });

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printIncludeEmptyRows, setPrintIncludeEmptyRows] = useState(true);
  const [printMaxHour, setPrintMaxHour] = useState(10);
  const [printThemeTitle, setPrintThemeTitle] = useState('');

  // Notification / Feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // --- INITIAL DATA LOADING ---
  useEffect(() => {
    loadBaseData();
  }, [user.id, user.schoolNpsn]);

  useEffect(() => {
    loadJournals();
  }, [user.schoolNpsn, selectedDate, selectedClass, filterMode]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadBaseData = async () => {
    try {
      const [classList, teacherList, sysSettings] = await Promise.all([
        getClasses(user.id, user.schoolNpsn),
        user.schoolNpsn ? getPicketOfficers(user.schoolNpsn) : [],
        getSystemSettings()
      ]);

      setClasses(classList || []);
      setTeachers(teacherList || []);
      setSettings(sysSettings || null);

      if (classList && classList.length > 0 && selectedClass === 'XII') {
        // If there are classes, we can keep XII or default to first class
        const hasXII = classList.some(c => c.name.toUpperCase().includes('XII'));
        if (!hasXII && classList[0]) {
          setSelectedClass(classList[0].name);
          setFormData(prev => ({ ...prev, className: classList[0].name, classId: classList[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load base data:', err);
    }
  };

  const loadJournals = async () => {
    setIsLoading(true);
    try {
      let filterParams: any = {
        schoolNpsn: user.schoolNpsn
      };

      if (filterMode === 'DATE_AND_CLASS') {
        filterParams.date = selectedDate;
        filterParams.className = selectedClass;
      } else if (filterMode === 'ALL_CLASSES') {
        filterParams.date = selectedDate;
      } else if (filterMode === 'ALL_DATES') {
        filterParams.className = selectedClass;
      }

      const list = await getCocurricularJournals(filterParams);
      setJournals(list);
    } catch (err) {
      console.error('Failed to load cocurricular journals:', err);
      showToast('error', 'Gagal memuat data jurnal');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync formData date/class when context changes
  const handleSelectClass = (cls: string) => {
    setSelectedClass(cls);
    setFormData(prev => ({ ...prev, className: cls, classId: cls }));
  };

  const handleSelectDate = (d: string) => {
    setSelectedDate(d);
    setFormData(prev => ({ ...prev, date: d }));
  };

  // Helper date formatter
  const formatIndonesianDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getDayName = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  // Compute filled hours for the selected date & class
  const dailyJournalsForActiveContext = useMemo(() => {
    return journals.filter(j => j.date === selectedDate && (j.className === selectedClass || selectedClass === 'ALL'));
  }, [journals, selectedDate, selectedClass]);

  const filledHourMap = useMemo(() => {
    const map = new Map<number, CocurricularJournal>();
    dailyJournalsForActiveContext.forEach(j => {
      const start = Number(j.meetingNo) || 1;
      const end = Number(j.meetingNoEnd) || start;
      for (let h = start; h <= end; h++) {
        map.set(h, j);
      }
    });
    return map;
  }, [dailyJournalsForActiveContext]);

  // Next available unfilled hour
  const nextUnfilledHour = useMemo(() => {
    for (let h = 1; h <= 10; h++) {
      if (!filledHourMap.has(h)) return h;
    }
    return 1;
  }, [filledHourMap]);

  // Quick set hour when teacher clicks an hour pill
  const handleQuickSelectHour = (hour: number) => {
    const existing = filledHourMap.get(hour);
    if (existing) {
      handleEdit(existing);
    } else {
      setEditingId(null);
      setFormData(prev => ({
        ...prev,
        startHour: hour,
        endHour: hour,
        date: selectedDate,
        className: selectedClass,
        classId: selectedClass,
        facilitatorName: user.fullName || ''
      }));
      setIsFormOpen(true);
    }
  };

  // --- FORM SUBMIT HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.activities.trim()) {
      showToast('error', 'Uraian kegiatan wajib diisi');
      return;
    }

    try {
      const dayName = getDayName(formData.date);
      const start = Number(formData.startHour);
      const end = Number(formData.endHour) >= start ? Number(formData.endHour) : start;

      if (editingId) {
        // Edit single entry
        await saveCocurricularJournal({
          id: editingId,
          schoolNpsn: user.schoolNpsn,
          userId: user.id,
          createdByName: user.fullName,
          facilitatorName: formData.facilitatorName.trim() || user.fullName,
          classId: formData.classId,
          className: formData.className,
          date: formData.date,
          dayName,
          meetingNo: start,
          meetingNoEnd: end > start ? end : undefined,
          activities: formData.activities.trim(),
          projectTheme: formData.projectTheme,
          notes: formData.notes.trim()
        });
        showToast('success', 'Jurnal berhasil diperbarui');
      } else {
        // Creating new entry
        if (formData.isSeparateHours && end > start) {
          // Create multiple individual rows (Jam 2, Jam 3, Jam 4...) matching exact image table rows!
          const batchItems: any[] = [];
          for (let h = start; h <= end; h++) {
            batchItems.push({
              schoolNpsn: user.schoolNpsn,
              userId: user.id,
              createdByName: user.fullName,
              facilitatorName: formData.facilitatorName.trim() || user.fullName,
              classId: formData.classId,
              className: formData.className,
              date: formData.date,
              dayName,
              meetingNo: h,
              meetingNoEnd: undefined,
              activities: formData.activities.trim(),
              projectTheme: formData.projectTheme,
              notes: formData.notes.trim()
            });
          }
          await bulkSaveCocurricularJournals(batchItems);
          showToast('success', `${batchItems.length} jam jurnal berhasil ditambahkan`);
        } else {
          // Single row or range row
          await saveCocurricularJournal({
            schoolNpsn: user.schoolNpsn,
            userId: user.id,
            createdByName: user.fullName,
            facilitatorName: formData.facilitatorName.trim() || user.fullName,
            classId: formData.classId,
            className: formData.className,
            date: formData.date,
            dayName,
            meetingNo: start,
            meetingNoEnd: end > start ? end : undefined,
            activities: formData.activities.trim(),
            projectTheme: formData.projectTheme,
            notes: formData.notes.trim()
          });
          showToast('success', 'Jurnal kokurikuler berhasil disimpan');
        }
      }

      // Reset form
      setEditingId(null);
      setFormData(prev => ({
        ...prev,
        startHour: end + 1 <= 10 ? end + 1 : 1,
        endHour: end + 1 <= 10 ? end + 1 : 1,
        activities: '',
        notes: ''
      }));

      await loadJournals();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('error', 'Gagal menyimpan jurnal');
    }
  };

  const handleEdit = (journal: CocurricularJournal) => {
    setEditingId(journal.id);
    setSelectedDate(journal.date);
    setSelectedClass(journal.className);
    setFormData({
      date: journal.date,
      className: journal.className,
      classId: journal.classId,
      startHour: Number(journal.meetingNo) || 1,
      endHour: Number(journal.meetingNoEnd) || Number(journal.meetingNo) || 1,
      isSeparateHours: false,
      facilitatorName: journal.facilitatorName || '',
      projectTheme: journal.projectTheme || P5_THEMES[0],
      activities: journal.activities || '',
      notes: journal.notes || ''
    });
    setIsFormOpen(true);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus entri jurnal ini?')) return;
    try {
      await deleteCocurricularJournal(id);
      showToast('success', 'Entri jurnal telah dihapus');
      loadJournals();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('error', 'Gagal menghapus jurnal');
    }
  };

  // --- GROUPING FOR OFFICIAL TABLE VIEW WITH ROWSPAN ---
  // Group journals by Date + Class for identical look as the user's image
  const groupedJournals = useMemo(() => {
    let filtered = journals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(j => 
        j.activities?.toLowerCase().includes(q) ||
        j.facilitatorName?.toLowerCase().includes(q) ||
        j.className?.toLowerCase().includes(q) ||
        j.projectTheme?.toLowerCase().includes(q)
      );
    }

    const groups: {
      groupKey: string;
      date: string;
      dayName: string;
      className: string;
      items: CocurricularJournal[];
    }[] = [];

    const map = new Map<string, typeof groups[0]>();

    filtered.forEach(j => {
      const key = `${j.date}__${j.className}`;
      if (!map.has(key)) {
        const item = {
          groupKey: key,
          date: j.date,
          dayName: j.dayName || getDayName(j.date),
          className: j.className,
          items: []
        };
        map.set(key, item);
        groups.push(item);
      }
      map.get(key)!.items.push(j);
    });

    // Sort items inside each group by meetingNo
    groups.forEach(g => {
      g.items.sort((a, b) => (Number(a.meetingNo) || 0) - (Number(b.meetingNo) || 0));
    });

    return groups;
  }, [journals, searchQuery]);

  // Export to Excel
  const handleExportExcel = () => {
    if (journals.length === 0) {
      showToast('error', 'Tidak ada data jurnal untuk diekspor');
      return;
    }

    const rows = journals.map((j, idx) => ({
      'NO': idx + 1,
      'HARI / TANGGAL': `${j.dayName || getDayName(j.date)}, ${j.date}`,
      'KELAS': j.className,
      'JAM KE': j.meetingNoEnd ? `${j.meetingNo} - ${j.meetingNoEnd}` : j.meetingNo,
      'TEMA / PROYEK': j.projectTheme || '-',
      'URAIAN KEGIATAN': j.activities,
      'FASILITATOR': j.facilitatorName,
      'TANDA TANGAN': ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Kokurikuler');
    XLSX.writeFile(wb, `Jurnal_Kokurikuler_${selectedClass}_${selectedDate}.xlsx`);
    showToast('success', 'File Excel berhasil diunduh');
  };

  // Trigger print
  const handlePrint = () => {
    window.print();
  };

  // Build rows for print sheet according to user's uploaded image!
  const printableData = useMemo(() => {
    // Current group for active date and class
    const items = dailyJournalsForActiveContext.slice().sort((a, b) => (Number(a.meetingNo) || 0) - (Number(b.meetingNo) || 0));
    
    if (!printIncludeEmptyRows) {
      return items.map((item, idx) => ({
        no: idx + 1,
        hour: item.meetingNoEnd ? `${item.meetingNo} - ${item.meetingNoEnd}` : item.meetingNo,
        activity: item.activities,
        facilitator: item.facilitatorName,
        isFilled: true
      }));
    }

    // Build comprehensive rows up to printMaxHour (e.g. Jam 2 to 10 or Jam 1 to 10)
    // Looking at the user's uploaded image, rows start at Jam 2 up to Jam 10!
    // We can list hours 1 to printMaxHour, filling matched hours and leaving unmatched ones empty
    const rows = [];
    let rowNumber = 1;

    for (let h = 2; h <= printMaxHour; h++) {
      // Find matching journal
      const matched = items.find(j => {
        const start = Number(j.meetingNo);
        const end = Number(j.meetingNoEnd) || start;
        return h >= start && h <= end;
      });

      rows.push({
        no: rowNumber++,
        hour: h,
        activity: matched ? matched.activities : '',
        facilitator: matched ? matched.facilitatorName : '',
        isFilled: !!matched
      });
    }

    return rows;
  }, [dailyJournalsForActiveContext, printIncludeEmptyRows, printMaxHour]);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Layers size={22} className="stroke-[2.2]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Jurnal Kokurikuler Bersama
                    <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Shared Workspace
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kolaborasi tim fasilitator per kelas & tanggal. Setiap guru dapat melihat dan menyambung kegiatan jam sebelumnya.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-xs"
                title="Cetak format lembar jurnal resmi"
              >
                <Printer size={15} className="text-slate-600" />
                <span>Cetak Jurnal Resmi</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                title="Ekspor data ke Excel"
              >
                <FileText size={15} />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    date: selectedDate,
                    className: selectedClass,
                    classId: selectedClass,
                    startHour: nextUnfilledHour,
                    endHour: nextUnfilledHour,
                    isSeparateHours: true,
                    facilitatorName: user.fullName || '',
                    projectTheme: P5_THEMES[0],
                    activities: '',
                    notes: ''
                  });
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Plus size={15} />
                <span>Input Jurnal Jam Ini</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* CONTEXT SELECTOR & FILTER BAR */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Class & Date Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Pilih Kelas / Rombel
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedClass}
                    onChange={(e) => handleSelectClass(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {classes.length > 0 ? (
                      classes.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="XII">Kelas XII</option>
                        <option value="XI">Kelas XI</option>
                        <option value="X">Kelas X</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Pilih Tanggal Kegiatan
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleSelectDate(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectDate(getLocalDate())}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 rounded border border-indigo-100"
                  >
                    Hari Ini
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cakupan Data
                </label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as any)}
                  className="bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="DATE_AND_CLASS">Tanggal & Kelas Terpilih</option>
                  <option value="ALL_CLASSES">Semua Kelas pada Tanggal Ini</option>
                  <option value="ALL_DATES">Semua Tanggal Kelas Terpilih</option>
                </select>
              </div>
            </div>

            {/* Search Filter */}
            <div className="w-full lg:w-72">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Cari Kegiatan / Fasilitator
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

          </div>
        </div>

        {/* HOUR TIMELINE TRACKER (INDIKATOR KETERISIAN JAM KOKURIKULER) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Status Alur Jam Kokurikuler
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {formatIndonesianDate(selectedDate)} • Kelas {selectedClass}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Terisi ({dailyJournalsForActiveContext.length} Jam)
              </span>
              <span className="flex items-center gap-1.5 font-medium ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                Belum Terisi
              </span>
            </div>
          </div>

          {/* Hour Pills Bar (Jam 1 to 10) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(hour => {
              const item = filledHourMap.get(hour);
              const isFilled = !!item;

              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleQuickSelectHour(hour)}
                  className={`p-2.5 rounded-lg text-left transition-all border ${
                    isFilled 
                      ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100 text-emerald-900 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500 hover:border-slate-300'
                  }`}
                  title={isFilled ? `Jam ${hour} terisi oleh: ${item.facilitatorName}. Klik untuk edit.` : `Jam ${hour} belum diisi. Klik untuk input.`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold ${isFilled ? 'text-emerald-800' : 'text-slate-600'}`}>
                      Jam {hour}
                    </span>
                    {isFilled ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">+</span>
                    )}
                  </div>
                  <div className="text-[11px] truncate font-medium">
                    {isFilled ? (
                      <span className="text-emerald-700 font-semibold">{item.facilitatorName}</span>
                    ) : (
                      <span className="text-slate-400 italic">Kosong</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Collaborative Advice Banner */}
          <div className="mt-3.5 bg-slate-50 rounded-lg p-3 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-600">
            <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Info Jurnal Bersama:</strong> Semua fasilitator yang mengampu kelas ini dapat langsung melihat apa yang telah diajarkan pada jam sebelumnya di bawah. Fasilitator jam berikutnya (misal Jam {nextUnfilledHour}) dapat langsung menekan tombol{' '}
              <button 
                type="button"
                onClick={() => handleQuickSelectHour(nextUnfilledHour)}
                className="text-indigo-600 font-bold underline hover:text-indigo-800 inline-block"
              >
                "Isi Jam {nextUnfilledHour}"
              </button>{' '}
              untuk menjaga kesinambungan tahapan proyek siswa.
            </div>
          </div>
        </div>

        {/* INPUT FORM (COLLAPSIBLE / MODULAR) */}
        {isFormOpen && (
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingId ? 'Edit Entri Jurnal Kokurikuler' : 'Formulir Pengisian Jurnal Kokurikuler Bersama'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Tutup Form"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hari & Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {formatIndonesianDate(formData.date)}
                  </span>
                </div>

                {/* Kelas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelas / Rombel
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.className}
                    onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value, classId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Contoh: XII, XII-1, Fase F"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Tampil pada kolom KELAS di cetak
                  </span>
                </div>

                {/* Jam Ke (Mulai & Selesai) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Ke (Mulai - Selesai)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.startHour}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          startHour: val,
                          endHour: prev.endHour < val ? val : prev.endHour
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                        <option key={h} value={h}>Jam {h}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400 font-bold">s/d</span>
                    <select
                      value={formData.endHour}
                      onChange={(e) => setFormData(prev => ({ ...prev, endHour: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                        <option key={h} value={h} disabled={h < formData.startHour}>
                          Jam {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.endHour > formData.startHour && !editingId && (
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSeparateHours}
                        onChange={(e) => setFormData(prev => ({ ...prev, isSeparateHours: e.target.checked }))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 text-xs"
                      />
                      <span className="text-[11px] text-indigo-700 font-medium">
                        Simpan baris per jam (Jam {formData.startHour} s.d. {formData.endHour})
                      </span>
                    </label>
                  )}
                </div>

                {/* Fasilitator */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Fasilitator
                  </label>
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      value={formData.facilitatorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, facilitatorName: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Nama guru fasilitator"
                    />
                    {teachers.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData(prev => ({ ...prev, facilitatorName: e.target.value }));
                          }
                        }}
                        className="w-full text-[11px] text-slate-500 bg-transparent border-0 p-0 cursor-pointer hover:text-indigo-600"
                        defaultValue=""
                      >
                        <option value="" disabled>Pilih dari daftar rekan guru...</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.fullName}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

              </div>

              {/* Tema / Dimensi Proyek P5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tema Proyek Kokurikuler / P5 (Opsional)
                  </label>
                  <select
                    value={formData.projectTheme}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectTheme: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {P5_THEMES.map(theme => (
                      <option key={theme} value={theme}>{theme}</option>
                    ))}
                    <option value="Lainnya">Tema Khusus Lainnya</option>
                  </select>
                </div>

                {/* Quick Templates Chips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Template Cepat Uraian Kegiatan Proyek
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {ACTIVITY_TEMPLATES.map((tmpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, activities: tmpl }))}
                        className="text-[11px] text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded border border-slate-200 transition-colors text-left truncate max-w-full"
                        title={tmpl}
                      >
                        + {tmpl.slice(0, 38)}...
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Uraian Kegiatan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Uraian Kegiatan Pembelajaran Proyek <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Mendukung rumus/simbol matematika jika menggunakan format <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">$...$</code>
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={formData.activities}
                  onChange={(e) => setFormData(prev => ({ ...prev, activities: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-normal focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                  placeholder="Tuliskan aktivitas siswa, pendampingan fasilitator, dan capaian target pada jam ini..."
                />

                {/* KaTeX Live Preview if formula present */}
                {formData.activities && /(\$|\\)/.test(formData.activities) && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Pratinjau Simbol / Rumus Eksakta:
                    </span>
                    <MathView text={formData.activities} />
                  </div>
                )}
              </div>

              {/* Submit / Reset Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData(prev => ({
                      ...prev,
                      activities: '',
                      notes: ''
                    }));
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Batal / Bersihkan
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{editingId ? 'Simpan Perubahan' : 'Simpan ke Jurnal Bersama'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TABEL RIWAYAT JURNAL BERSAMA (SESUAI DENGAN FORMAT GAMBAR) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Tabel Lembar Jurnal Kokurikuler</span>
                <span className="text-xs font-medium text-slate-500">
                  ({groupedJournals.reduce((acc, g) => acc + g.items.length, 0)} entri kegiatan)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Format tabel resmi: Hari/Tanggal & Kelas digabung secara vertikal sesuai lembar cetak fisik sekolah.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors self-start sm:self-auto"
            >
              <Printer size={14} />
              <span>Pratinjau & Cetak Lembar Ini</span>
            </button>
          </div>

          {/* TABLE CONTAINER */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-12">NO</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200 w-44">HARI/TANGGAL</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-24">KELAS</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-20">JAM KE</th>
                  <th className="py-3 px-4 border-r border-slate-200">URAIAN KEGIATAN</th>
                  <th className="py-3 px-4 border-r border-slate-200 w-44">FASILITATOR</th>
                  <th className="py-3 px-3 text-center w-28">TANDA TANGAN / AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {groupedJournals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <BookOpen size={32} className="text-slate-300" />
                        <span className="text-sm font-medium">Belum ada entri jurnal kokurikuler</span>
                        <span className="text-xs text-slate-400">
                          Gunakan tombol "Input Jurnal Jam Ini" di atas untuk menambahkan aktivitas.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedJournals.map(group => {
                    let runningNo = 1;
                    return group.items.map((item, idx) => {
                      const isFirstInGroup = idx === 0;
                      const formattedDate = formatIndonesianDate(group.date);

                      return (
                        <tr 
                          key={item.id} 
                          className="hover:bg-indigo-50/30 transition-colors group"
                        >
                          {/* NO */}
                          <td className="py-3.5 px-3 text-center font-medium text-slate-700 border-r border-slate-200">
                            {runningNo++}
                          </td>

                          {/* HARI/TANGGAL (ROW-SPANNED LIKE IN THE IMAGE) */}
                          {isFirstInGroup && (
                            <td 
                              rowSpan={group.items.length} 
                              className="py-3.5 px-4 text-slate-900 font-semibold align-middle text-center bg-white border-r border-slate-200"
                            >
                              {formattedDate}
                            </td>
                          )}

                          {/* KELAS (ROW-SPANNED LIKE IN THE IMAGE) */}
                          {isFirstInGroup && (
                            <td 
                              rowSpan={group.items.length} 
                              className="py-3.5 px-3 text-slate-900 font-bold align-middle text-center bg-white border-r border-slate-200"
                            >
                              {group.className}
                            </td>
                          )}

                          {/* JAM KE */}
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800 border-r border-slate-200">
                            {item.meetingNoEnd ? `${item.meetingNo} - ${item.meetingNoEnd}` : item.meetingNo}
                          </td>

                          {/* URAIAN KEGIATAN */}
                          <td className="py-3.5 px-4 text-slate-800 leading-relaxed border-r border-slate-200">
                            {item.projectTheme && (
                              <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5 mb-1 border border-indigo-100">
                                {item.projectTheme}
                              </span>
                            )}
                            <div className="prose prose-xs max-w-none text-slate-800">
                              <MathView text={item.activities} />
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-1">
                                Catatan: {item.notes}
                              </p>
                            )}
                          </td>

                          {/* FASILITATOR */}
                          <td className="py-3.5 px-4 font-medium text-slate-800 border-r border-slate-200">
                            <div className="flex items-center gap-1.5">
                              <UserIcon size={13} className="text-slate-400 shrink-0" />
                              <span>{item.facilitatorName}</span>
                            </div>
                          </td>

                          {/* TANDA TANGAN / AKSI */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Edit entri ini"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Hapus entri ini"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* PRINT PREVIEW MODAL (EXACT REPLICA OF THE IMAGE) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:w-full print:rounded-none">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Pratinjau Cetak Jurnal Kokurikuler
                </h3>
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printIncludeEmptyRows}
                    onChange={(e) => setPrintIncludeEmptyRows(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 text-xs"
                  />
                  <span>Lengkapi baris s.d. Jam {printMaxHour} (seperti gambar)</span>
                </label>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                >
                  <Printer size={14} />
                  <span>Cetak Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Paper Canvas */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
              <div ref={printAreaRef} className="print-sheet max-w-[210mm] mx-auto bg-white text-black font-serif text-[12px] leading-snug">
                
                {/* KOP / HEADER RESMI SEKOLAH */}
                <div className="text-center mb-5 pb-3 border-b-2 border-black">
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    {settings?.schoolName || user.schoolName || 'PEMERINTAH PROVINSI / KABUPATEN'}
                  </h2>
                  <h1 className="text-base font-extrabold uppercase mt-0.5 tracking-tight">
                    JURNAL KEGIATAN KOKURIKULER / PROYEK P5
                  </h1>
                  <p className="text-[11px] font-normal text-slate-700 mt-1">
                    Kelas: <strong>{selectedClass}</strong> • Hari, Tanggal: <strong>{formatIndonesianDate(selectedDate)}</strong> • Semester: Ganjil / Genap
                  </p>
                </div>

                {/* TABEL EXACT DENGAN IMAGE YANG DIUNGGAH USER */}
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="border border-black font-bold text-center bg-slate-50 print:bg-transparent">
                      <th className="border border-black py-2 px-2 w-[5%]">NO</th>
                      <th className="border border-black py-2 px-3 w-[22%]">HARI/TANGGAL</th>
                      <th className="border border-black py-2 px-2 w-[8%]">KELAS</th>
                      <th className="border border-black py-2 px-2 w-[8%]">JAM KE</th>
                      <th className="border border-black py-2 px-4 w-[35%]">URAIAN KEGIATAN</th>
                      <th className="border border-black py-2 px-3 w-[14%]">FASILITATOR</th>
                      <th className="border border-black py-2 px-2 w-[14%]">TANDA TANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printableData.map((row, index) => {
                      const isFirstRow = index === 0;

                      return (
                        <tr key={index} className="border border-black min-h-[44px]">
                          {/* NO */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle font-medium">
                            {row.no}
                          </td>

                          {/* HARI/TANGGAL (ROW-SPAN MENCAKUP SEMUA BARIS) */}
                          {isFirstRow && (
                            <td
                              rowSpan={printableData.length}
                              className="border border-black py-3 px-3 text-center align-middle font-semibold"
                            >
                              {formatIndonesianDate(selectedDate)}
                            </td>
                          )}

                          {/* KELAS (ROW-SPAN MENCAKUP SEMUA BARIS) */}
                          {isFirstRow && (
                            <td
                              rowSpan={printableData.length}
                              className="border border-black py-3 px-2 text-center align-middle font-bold"
                            >
                              {selectedClass}
                            </td>
                          )}

                          {/* JAM KE */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle font-semibold">
                            {row.hour}
                          </td>

                          {/* URAIAN KEGIATAN */}
                          <td className="border border-black py-2.5 px-3 align-middle leading-normal">
                            {row.activity ? (
                              <MathView text={row.activity} />
                            ) : (
                              <span className="text-transparent select-none">&nbsp;</span>
                            )}
                          </td>

                          {/* FASILITATOR */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle font-medium">
                            {row.facilitator || ''}
                          </td>

                          {/* TANDA TANGAN (KOTAK PARAF MANUAL) */}
                          <td className="border border-black py-2.5 px-2 text-center align-middle h-11">
                            {/* Kotak paraf fisik kosong untuk guru tanda tangan di kertas */}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* TITIMANGSA & TANDA TANGAN PEJABAT */}
                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-[11px] leading-relaxed break-inside-avoid">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala Sekolah</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline">
                      {settings?.headmasterName || '...................................................'}
                    </p>
                    <p>NIP. {settings?.headmasterNip || '...................................................'}</p>
                  </div>

                  <div>
                    <p>
                      {settings?.schoolCity || 'Sekolah'}, {formatIndonesianDate(selectedDate).split(', ')[1] || selectedDate}
                    </p>
                    <p className="font-semibold">Koordinator Kokurikuler / P5</p>
                    <div className="h-16"></div>
                    <p className="font-bold underline">
                      {user.fullName || '...................................................'}
                    </p>
                    <p>NIP. {user.nip || '...................................................'}</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden rounded-b-2xl">
              <span className="text-xs text-slate-500">
                Format tabel disesuaikan dengan standar format lembar kokurikuler/P5.
              </span>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT CSS STYLING */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-sheet, .print-sheet * {
            visibility: visible;
          }
          .print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
          }
        }
      `}</style>

    </div>
  );
};

export default CocurricularJournalManager;
