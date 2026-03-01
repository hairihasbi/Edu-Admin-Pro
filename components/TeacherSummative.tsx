
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student, ScopeMaterial, AssessmentScore, SD_SUBJECTS_PHASE_A, SD_SUBJECTS_PHASE_BC, MATH_SUBJECT_OPTIONS } from '../types';
import { getClasses, getStudents, getScopeMaterials, getAssessmentScores, saveBulkAssessmentScores, updateScopeMaterial } from '../services/database';
import { Calculator, Save, Filter, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, RefreshCcw, Settings, Plus, Trash2, X, ChevronDown, ChevronUp, User as UserIcon, Layout } from './Icons';
import * as XLSX from 'xlsx';
import Skeleton from './Skeleton';

interface TeacherSummativeProps {
  user: User;
}

const TeacherSummative: React.FC<TeacherSummativeProps> = ({ user }) => {
  // Data State
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<ScopeMaterial[]>([]);
  
  // Scores State
  const [scores, setScores] = useState<{[key: string]: number}>({}); 
  const [subScores, setSubScores] = useState<{[key: string]: number}>({});
  const [scoreIds, setScoreIds] = useState<{[key: string]: string}>({}); // Map key to DB ID

  // UI State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('Ganjil');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  
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
    } else if (user.subject === 'Matematika') {
      // Default to first math option if not set or if it is ALL (strict mode)
      if (!selectedSubject || !MATH_SUBJECT_OPTIONS.includes(selectedSubject)) {
         setSelectedSubject(MATH_SUBJECT_OPTIONS[0]);
      }
    } else {
      setSelectedSubject(user.subject || '');
    }
  }, [user, user.teacherType, user.phase]);

  // Manage Column Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [manageMaterial, setManageMaterial] = useState<ScopeMaterial | null>(null);
  const [tempSubScopes, setTempSubScopes] = useState<string[]>([]);
  const [newSubInput, setNewSubInput] = useState('');

  // --- MOBILE VIEW STATE ---
  const [viewMode, setViewMode] = useState<'student' | 'material'>('student');
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  const toggleStudentExpansion = (id: string) => {
    const newSet = new Set(expandedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedStudentIds(newSet);
  };

  // Generate Column Options for "Per Material" View
  const columnOptions = React.useMemo(() => {
      const options: { id: string, label: string, type: 'LM' | 'STS' | 'SAS', materialId?: string, subScope?: string }[] = [];
      
      materials.forEach(m => {
          if (m.subScopes && m.subScopes.length > 0) {
              m.subScopes.forEach(sub => {
                  options.push({ 
                      id: `LM-${m.id}-${sub}`, 
                      label: `${m.code} - ${sub}`, 
                      type: 'LM', 
                      materialId: m.id, 
                      subScope: sub 
                  });
              });
          } else {
              options.push({ 
                  id: `LM-${m.id}`, 
                  label: `${m.code} - Nilai Utuh`, 
                  type: 'LM', 
                  materialId: m.id 
              });
          }
      });
      
      options.push({ id: 'STS', label: 'STS (Sumatif Tengah Semester)', type: 'STS' });
      options.push({ id: 'SAS', label: 'SAS (Sumatif Akhir Semester)', type: 'SAS' });
      
      return options;
  }, [materials]);

  // Set default column if none selected
  useEffect(() => {
      if (columnOptions.length > 0 && !selectedColumnId) {
          setSelectedColumnId(columnOptions[0].id);
      }
  }, [columnOptions, selectedColumnId]);

  const getSelectedColumnDetails = () => {
      return columnOptions.find(c => c.id === selectedColumnId);
  };

  // Refs for Excel-like navigation
  const inputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cls = await getClasses(user.id);
      setClasses(cls);
      if (cls.length > 0) setSelectedClassId(cls[0].id);
      setLoading(false);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (selectedClassId) fetchData();
  }, [selectedClassId, selectedSemester, selectedSubject]);

  // ROBUST PARSER
  const parseSubScopes = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String).filter(s => s.trim() !== '');
      if (typeof val === 'string') {
          try {
              let parsed = JSON.parse(val);
              if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { return []; } }
              return Array.isArray(parsed) ? parsed.map(String).filter((s: string) => s.trim() !== '') : [];
          } catch { return []; }
      }
      return [];
  };

  const fetchData = async () => {
    setLoading(true);
    const [stData, matData, scoreData] = await Promise.all([
      getStudents(selectedClassId),
      getScopeMaterials(selectedClassId, selectedSemester, user.id, selectedSubject),
      getAssessmentScores(selectedClassId, selectedSemester, selectedSubject)
    ]);

    setStudents(stData);
    
    const cleanMaterials = matData.map(m => ({
        ...m,
        subScopes: parseSubScopes(m.subScopes)
    }));
    setMaterials(cleanMaterials);

    const scoreDict: {[key: string]: number} = {};
    const subScoreDict: {[key: string]: number} = {};
    const idDict: {[key: string]: string} = {};

    scoreData.forEach(s => {
      if (!s.subject || s.subject === selectedSubject) {
          const key = s.category === 'LM' 
            ? `${s.studentId}-LM-${s.materialId}`
            : `${s.studentId}-${s.category}`;
          scoreDict[key] = s.score;
          if (s.id) idDict[key] = s.id;

          if (s.scoreDetails) {
              let details = s.scoreDetails;
              if (typeof details === 'string') { try { details = JSON.parse(details); } catch { details = {}; } }
              if (typeof details === 'string') { try { details = JSON.parse(details); } catch { details = {}; } }

              if (details && typeof details === 'object') {
                  Object.entries(details).forEach(([subName, val]) => {
                      const subKey = `${s.studentId}-LM-${s.materialId}-${subName}`;
                      subScoreDict[subKey] = val as number;
                  });
              }
          }
      }
    });

    setScores(scoreDict);
    setSubScores(subScoreDict);
    setScoreIds(idDict);
    setLoading(false);
    setHasChanges(false);
    setSaveStatus('idle');
    inputRefs.current = {};
  };

  // --- COLUMN MANAGEMENT LOGIC ---
  const handleOpenManage = (m: ScopeMaterial) => {
      setManageMaterial(m);
      setTempSubScopes(m.subScopes || []);
      setNewSubInput('');
      setIsManageModalOpen(true);
  };

  const handleAddSubScope = () => {
      if(newSubInput.trim() && !tempSubScopes.includes(newSubInput.trim())) {
          setTempSubScopes([...tempSubScopes, newSubInput.trim()]);
          setNewSubInput('');
      }
  };

  const handleRemoveSubScope = (index: number) => {
      setTempSubScopes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveStructure = async () => {
      if (!manageMaterial) return;
      
      // Update Database
      await updateScopeMaterial(manageMaterial.id, { subScopes: tempSubScopes });
      
      // Close and Refresh
      setIsManageModalOpen(false);
      fetchData(); // This will redraw table with new columns
  };

  const handleScoreChange = (studentId: string, category: 'LM' | 'STS' | 'SAS', val: string, materialId?: string, subName?: string) => {
    const numVal = Math.min(100, Math.max(0, parseInt(val) || 0));
    
    if (category === 'LM' && materialId && subName) {
        const subKey = `${studentId}-LM-${materialId}-${subName}`;
        const newSubScores = { ...subScores, [subKey]: numVal };
        setSubScores(newSubScores);

        // Auto Calculate Average for Main LM Score
        const material = materials.find(m => m.id === materialId);
        if (material && material.subScopes) {
            let total = 0;
            let count = 0;
            
            material.subScopes.forEach(sName => {
                const sKey = `${studentId}-LM-${materialId}-${sName}`;
                // Use new value if strictly matched, else use existing
                const valToCheck = (sName === subName) ? numVal : (newSubScores[sKey]);
                
                if (valToCheck !== undefined && !isNaN(valToCheck)) {
                    total += valToCheck;
                    count++;
                }
            });
            
            const avg = count > 0 ? Math.round(total / count) : 0;
            
            setScores(prev => ({
                ...prev,
                [`${studentId}-LM-${materialId}`]: avg
            }));
        }
    } else {
        const key = category === 'LM' ? `${studentId}-LM-${materialId}` : `${studentId}-${category}`;
        setScores(prev => ({
          ...prev,
          [key]: numVal
        }));
    }

    setHasChanges(true);
    setSaveStatus('idle'); 
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let nextRow = rowIndex;
      let nextCol = colIndex;

      if (e.key === 'ArrowUp') nextRow = rowIndex - 1;
      if (e.key === 'ArrowDown' || e.key === 'Enter') nextRow = rowIndex + 1;
      if (e.key === 'ArrowLeft') nextCol = colIndex - 1;
      if (e.key === 'ArrowRight') nextCol = colIndex + 1;

      const nextInput = inputRefs.current[`cell-${nextRow}-${nextCol}`];
      if (nextInput) nextInput.focus();
    }
  };

  const calculateFinalScore = (studentId: string) => {
    let totalLM = 0;
    let countLM = 0;
    materials.forEach(m => {
       const val = scores[`${studentId}-LM-${m.id}`];
       if (val !== undefined) {
         totalLM += val;
         countLM++;
       }
    });
    const avgLM = countLM > 0 ? totalLM / countLM : 0;
    const sts = scores[`${studentId}-STS`] || 0;
    const sas = scores[`${studentId}-SAS`] || 0;
    const final = (2 * avgLM + sts + sas) / 4;
    return parseFloat(final.toFixed(1));
  };

  const performSave = async (
      currentScores: {[key: string]: number}, 
      currentSubScores: {[key: string]: number},
      deletedIds: string[] = []
  ) => {
    if (selectedSubject === 'ALL') {
        alert('Mohon pilih mata pelajaran spesifik sebelum menyimpan nilai.');
        setSaveStatus('error');
        return;
    }

    setSaveStatus('saving');
    const scoresToSave: Omit<AssessmentScore, 'id'>[] = [];
    
    students.forEach(s => {
      // LM & SubScores
      materials.forEach(m => {
        const key = `${s.id}-LM-${m.id}`;
        const subScopes = m.subScopes || [];
        
        let details: Record<string, number> | undefined = undefined;
        if (subScopes.length > 0) {
            details = {};
            let hasDetail = false;
            subScopes.forEach(sub => {
                const subKey = `${s.id}-LM-${m.id}-${sub}`;
                if (currentSubScores[subKey] !== undefined) {
                    details![sub] = currentSubScores[subKey];
                    hasDetail = true;
                }
            });
            if (!hasDetail) details = undefined;
        }

        if (currentScores[key] !== undefined || details) {
          scoresToSave.push({
            studentId: s.id,
            classId: selectedClassId,
            semester: selectedSemester,
            category: 'LM',
            materialId: m.id,
            score: currentScores[key] || 0,
            scoreDetails: details,
            subject: selectedSubject 
          });
        }
      });
      
      // STS & SAS
      ['STS', 'SAS'].forEach(cat => {
          const val = currentScores[`${s.id}-${cat}`];
          if (val !== undefined) {
            scoresToSave.push({
               studentId: s.id,
               classId: selectedClassId,
               semester: selectedSemester,
               category: cat as any,
               score: val,
               subject: selectedSubject 
            });
          }
      });
    });

    try {
        await saveBulkAssessmentScores(scoresToSave, user.id, user.fullName, deletedIds);
        setSaveStatus('saved');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
        fetchData(); 
    } catch (err) {
        console.error("Save failed", err);
        setSaveStatus('error');
    }
  };

  const handleResetStudent = (studentId: string) => {
    if (!window.confirm("Yakin ingin mereset/mengosongkan semua nilai untuk siswa ini?")) return;

    const newScores = { ...scores };
    const newSubScores = { ...subScores };
    const idsToDelete: string[] = [];

    // Remove keys related to this student
    Object.keys(newScores).forEach(key => {
        if (key.startsWith(`${studentId}-`)) {
            if (scoreIds[key]) idsToDelete.push(scoreIds[key]);
            delete newScores[key];
        }
    });
    Object.keys(newSubScores).forEach(key => {
        if (key.startsWith(`${studentId}-`)) delete newSubScores[key];
    });

    setScores(newScores);
    setSubScores(newSubScores);
    performSave(newScores, newSubScores, idsToDelete);
  };

  const handleResetAll = () => {
    if (!window.confirm("PERINGATAN: Anda akan mengosongkan SEMUA nilai di halaman ini. Tindakan ini tidak dapat dibatalkan setelah disimpan. Lanjutkan?")) return;

    const idsToDelete = Object.values(scoreIds);
    setScores({});
    setSubScores({});
    performSave({}, {}, idsToDelete);
  };

  const handleSave = () => {
      performSave(scores, subScores);
  };

  const exportToExcel = () => {
    const headers = ['No', 'Nama Siswa', 'NIS'];
    materials.forEach(m => {
        if (m.subScopes && m.subScopes.length > 0) {
            m.subScopes.forEach(sub => headers.push(`${m.code} - ${sub}`));
            headers.push(`${m.code} - Rata2`);
        } else {
            headers.push(m.code);
        }
    });
    headers.push('Rata LM', 'STS', 'SAS', 'Nilai Akhir');

    const rows = students.map((s, i) => {
       const rowData = [i+1, s.name, s.nis];
       let totalLM = 0;
       
       materials.forEach(m => {
          if (m.subScopes && m.subScopes.length > 0) {
              m.subScopes.forEach(sub => {
                  rowData.push(subScores[`${s.id}-LM-${m.id}-${sub}`] || '');
              });
          }
          const val = scores[`${s.id}-LM-${m.id}`] || 0;
          totalLM += val;
          rowData.push(val);
       });

       const avgLM = materials.length > 0 ? (totalLM / materials.length).toFixed(1) : '0';
       const sts = scores[`${s.id}-STS`] || 0;
       const sas = scores[`${s.id}-SAS`] || 0;
       const final = calculateFinalScore(s.id);

       return [...rowData, avgLM, sts, sas, final];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nilai Sumatif");
    XLSX.writeFile(wb, `Nilai_${selectedSemester}_${classes.find(c=>c.id===selectedClassId)?.name}.xlsx`);
  };

  const getColIndexMap = () => {
      let idx = 0;
      const map: { [key: string]: number } = {}; 
      materials.forEach(m => {
          map[m.id] = idx;
          if (m.subScopes && m.subScopes.length > 0) {
              idx += m.subScopes.length + 1; 
          } else {
              idx += 1;
          }
      });
      map['STS'] = idx;
      map['SAS'] = idx + 1;
      return map;
  };
  
  const colMap = getColIndexMap();

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* --- SUBJECT SELECTOR --- */}
      {user.teacherType === 'CLASS' && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-4">
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
      )}

      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <Calculator className="text-blue-600" />
                 Asesmen Sumatif
              </h2>
              <p className="text-sm text-gray-500">Input nilai Lingkup Materi, STS, dan SAS.</p>
           </div>
           
           <div className="flex flex-col sm:flex-row gap-3">
              <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
              >
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {/* Math Subject Selector in Control Bar */}
              {user.subject === 'Matematika' && (
                  <select 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium text-blue-700"
                  >
                    {MATH_SUBJECT_OPTIONS.map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
              )}

              <select 
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
           </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-50">
           <div className="flex items-center gap-2">
               {materials.length === 0 ? (
                  <div className="flex items-center gap-2 text-yellow-600 text-sm bg-yellow-50 px-3 py-1.5 rounded-lg">
                     <AlertCircle size={16} />
                     <span>Belum ada Lingkup Materi. Tambahkan di menu "Lingkup Materi".</span>
                  </div>
               ) : (
                  <div className="text-sm text-gray-500">
                     Mapel: <strong>{selectedSubject || 'Umum'}</strong> • Klik <Settings size={12} className="inline"/> untuk atur sub-kolom
                  </div>
               )}
               <button onClick={fetchData} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition" title="Refresh Data">
                  <RefreshCcw size={16} />
               </button>
           </div>

           <div className="flex gap-2 ml-auto">
              <button 
                onClick={handleResetAll}
                className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-medium text-sm hover:bg-red-100 transition"
                title="Kosongkan Semua Nilai"
              >
                 <Trash2 size={16} /> Reset
              </button>
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg font-medium text-sm hover:bg-green-100 transition"
              >
                 <FileSpreadsheet size={16} /> Export
              </button>
              <button 
                onClick={handleSave}
                disabled={!hasChanges && saveStatus !== 'error'}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition shadow-sm ${
                   saveStatus === 'saved' ? 'bg-green-600 text-white' :
                   saveStatus === 'error' ? 'bg-red-600 text-white' :
                   saveStatus === 'saving' ? 'bg-blue-400 text-white cursor-wait' :
                   hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                 {saveStatus === 'saved' ? <CheckCircle size={16} /> : 
                  saveStatus === 'error' ? <AlertCircle size={16} /> :
                  saveStatus === 'saving' ? <RefreshCcw size={16} className="animate-spin" /> :
                  <Save size={16} />}
                 {saveStatus === 'saved' ? 'Tersimpan!' : 
                  saveStatus === 'error' ? 'Gagal Simpan' : 
                  saveStatus === 'saving' ? 'Menyimpan...' :
                  'Simpan Nilai'}
              </button>
           </div>
        </div>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden space-y-4">
          {/* View Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                  onClick={() => setViewMode('student')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${viewMode === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <UserIcon size={16} /> Per Siswa
              </button>
              <button 
                  onClick={() => setViewMode('material')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${viewMode === 'material' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <Layout size={16} /> Per Materi
              </button>
          </div>

          {/* Content */}
          {loading ? (
              <div className="space-y-3">
                  {[1,2,3].map(i => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <Skeleton variant="circular" width={40} height={40} />
                              <div className="space-y-2">
                                  <Skeleton width={120} />
                                  <Skeleton width={80} />
                              </div>
                          </div>
                          <Skeleton width={40} height={20} />
                      </div>
                  ))}
              </div>
          ) : students.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Tidak ada siswa.</div>
          ) : (
              <>
                  {/* MODE: PER SISWA (ACCORDION) */}
                  {viewMode === 'student' && (
                      <div className="space-y-3">
                          {students.map(student => {
                              const isExpanded = expandedStudentIds.has(student.id);
                              const finalScore = calculateFinalScore(student.id);
                              
                              return (
                                  <div key={student.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-blue-200 shadow-md' : 'border-gray-200 shadow-sm'}`}>
                                      <div 
                                          onClick={() => toggleStudentExpansion(student.id)}
                                          className="p-4 flex justify-between items-center cursor-pointer bg-white active:bg-gray-50"
                                      >
                                          <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                                                  {student.name.substring(0,2).toUpperCase()}
                                              </div>
                                              <div>
                                                  <h4 className="font-bold text-gray-800 text-sm">{student.name}</h4>
                                                  <p className="text-xs text-gray-500">{student.nis}</p>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                              <div className="text-right">
                                                  <span className="block text-[10px] text-gray-400 uppercase font-bold">Akhir</span>
                                                  <span className={`text-sm font-bold ${finalScore >= 75 ? 'text-green-600' : 'text-orange-500'}`}>{finalScore}</span>
                                              </div>
                                              {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                          </div>
                                      </div>

                                      {/* Expanded Content */}
                                      {isExpanded && (
                                          <div className="bg-gray-50 p-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                              {materials.map(m => (
                                                  <div key={m.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-50">
                                                          <div className="flex items-center gap-2">
                                                              <span className="font-bold text-xs text-gray-700">{m.code}</span>
                                                              <button 
                                                                  onClick={() => handleOpenManage(m)}
                                                                  className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100 transition"
                                                                  title="Atur Sub-kolom"
                                                              >
                                                                  <Settings size={16} />
                                                              </button>
                                                          </div>
                                                          <span className="text-[10px] text-gray-400 truncate max-w-[150px]">{m.content}</span>
                                                      </div>
                                                      
                                                      <div className="grid grid-cols-2 gap-3">
                                                          {m.subScopes && m.subScopes.length > 0 ? (
                                                              m.subScopes.map(sub => (
                                                                  <div key={sub}>
                                                                      <label className="block text-[10px] text-gray-500 mb-1">{sub}</label>
                                                                      <input 
                                                                          type="number" inputMode="numeric"
                                                                          className="w-full p-2 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                          value={subScores[`${student.id}-LM-${m.id}-${sub}`] ?? ''}
                                                                          onChange={(e) => handleScoreChange(student.id, 'LM', e.target.value, m.id, sub)}
                                                                          placeholder="0"
                                                                      />
                                                                  </div>
                                                              ))
                                                          ) : (
                                                              <div className="col-span-2">
                                                                  <label className="block text-[10px] text-gray-500 mb-1">Nilai Utuh</label>
                                                                  <input 
                                                                      type="number" inputMode="numeric"
                                                                      className="w-full p-2 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                      value={scores[`${student.id}-LM-${m.id}`] ?? ''}
                                                                      onChange={(e) => handleScoreChange(student.id, 'LM', e.target.value, m.id)}
                                                                      placeholder="0"
                                                                  />
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              ))}

                                              <div className="grid grid-cols-2 gap-3 pt-2">
                                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                                      <label className="block text-xs font-bold text-purple-700 mb-1 text-center">STS</label>
                                                      <input 
                                                          type="number" inputMode="numeric"
                                                          className="w-full p-2 border border-purple-200 rounded text-center text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                                          value={scores[`${student.id}-STS`] ?? ''}
                                                          onChange={(e) => handleScoreChange(student.id, 'STS', e.target.value)}
                                                          placeholder="0"
                                                      />
                                                  </div>
                                                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                                      <label className="block text-xs font-bold text-orange-700 mb-1 text-center">SAS</label>
                                                      <input 
                                                          type="number" inputMode="numeric"
                                                          className="w-full p-2 border border-orange-200 rounded text-center text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                                          value={scores[`${student.id}-SAS`] ?? ''}
                                                          onChange={(e) => handleScoreChange(student.id, 'SAS', e.target.value)}
                                                          placeholder="0"
                                                      />
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {/* MODE: PER MATERI (FOCUS LIST) */}
                  {viewMode === 'material' && (
                      <div className="space-y-4">
                          {/* Column Selector */}
                          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 sticky top-0 z-20 shadow-sm">
                              <label className="block text-xs font-bold text-blue-800 mb-1 uppercase">Pilih Kolom Input</label>
                              <div className="relative">
                                  <select 
                                      value={selectedColumnId}
                                      onChange={(e) => setSelectedColumnId(e.target.value)}
                                      className="w-full p-3 pr-10 border border-blue-300 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                  >
                                      {columnOptions.map(opt => (
                                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                                      ))}
                                  </select>
                                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                              </div>
                          </div>

                          <div className="space-y-2">
                              {students.map((student, idx) => {
                                  const colDetails = getSelectedColumnDetails();
                                  let val: string | number = '';
                                  let onChange: (val: string) => void = () => {};

                                  if (colDetails) {
                                      if (colDetails.type === 'LM') {
                                          if (colDetails.subScope) {
                                              val = subScores[`${student.id}-LM-${colDetails.materialId}-${colDetails.subScope}`] ?? '';
                                              onChange = (v) => handleScoreChange(student.id, 'LM', v, colDetails.materialId, colDetails.subScope);
                                          } else {
                                              val = scores[`${student.id}-LM-${colDetails.materialId}`] ?? '';
                                              onChange = (v) => handleScoreChange(student.id, 'LM', v, colDetails.materialId);
                                          }
                                      } else {
                                          val = scores[`${student.id}-${colDetails.type}`] ?? '';
                                          onChange = (v) => handleScoreChange(student.id, colDetails.type as any, v);
                                      }
                                  }

                                  return (
                                      <div key={student.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
                                          <div className="flex items-center gap-3 overflow-hidden">
                                              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-xs shrink-0">
                                                  {idx + 1}
                                              </div>
                                              <div className="min-w-0">
                                                  <h4 className="font-bold text-gray-800 text-sm truncate">{student.name}</h4>
                                              </div>
                                          </div>
                                          <div className="w-20 shrink-0">
                                              <input 
                                                  type="number" inputMode="numeric"
                                                  className={`w-full p-2 border rounded-lg text-center font-bold text-lg focus:ring-2 outline-none ${val ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white'}`}
                                                  value={val}
                                                  onChange={(e) => onChange(e.target.value)}
                                                  placeholder="-"
                                              />
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}
              </>
          )}
      </div>

      {/* Table Section (Desktop Only) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
           <div className="p-10 text-center text-gray-400">Memuat data nilai...</div>
        ) : students.length === 0 ? (
           <div className="p-10 text-center text-gray-400">Tidak ada siswa di kelas ini.</div>
        ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left border-collapse">
               <thead>
                 {/* ROW 1: MATERI GROUPS */}
                 <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                   <th className="p-3 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 w-10" rowSpan={2}>No</th>
                   <th className="p-3 border-r border-gray-200 sticky left-10 bg-gray-50 z-20 min-w-[200px]" rowSpan={2}>Nama Siswa</th>
                   
                   {materials.map((m) => {
                      const subCols = m.subScopes || [];
                      return (
                        <th 
                            key={`${m.id}-head-${subCols.length}`}
                            className="p-2 border-r border-gray-200 text-center font-bold bg-blue-50/30 text-blue-900 border-b border-blue-100 group relative"
                            colSpan={subCols.length > 0 ? subCols.length + 1 : 1}
                            title={m.content}
                        >
                            <div className="flex items-center justify-center gap-1">
                                {m.code}
                                <button 
                                    onClick={() => handleOpenManage(m)}
                                    className="p-1 hover:bg-blue-100 rounded text-blue-400 hover:text-blue-700 transition"
                                    title="Edit Sub Elemen"
                                >
                                    <Settings size={12} />
                                </button>
                            </div>
                            <div className="text-[9px] font-normal text-gray-500 truncate max-w-[150px] mx-auto">{m.content}</div>
                        </th>
                      );
                   })}
                   
                   <th className="p-2 border-r border-gray-200 text-center bg-gray-100 w-20" rowSpan={2}>Rata LM</th>
                   <th className="p-2 border-r border-gray-200 text-center min-w-[70px] font-bold" rowSpan={2}>STS</th>
                   <th className="p-2 border-r border-gray-200 text-center min-w-[70px] font-bold" rowSpan={2}>SAS</th>
                   <th className="p-2 text-center bg-gray-100 font-bold w-20" rowSpan={2}>Akhir</th>
                 </tr>

                 {/* ROW 2: SUB COLUMNS */}
                 <tr className="bg-gray-50 text-gray-600 border-b border-gray-200 text-xs">
                    {materials.map(m => {
                        const subCols = m.subScopes || [];
                        if (subCols.length > 0) {
                            return (
                                <React.Fragment key={`${m.id}-subcols`}>
                                    {subCols.map((sub, idx) => (
                                        <th key={`${m.id}-sub-${idx}`} className="p-1 border-r border-gray-200 text-center min-w-[60px] font-medium bg-white">
                                            {sub}
                                        </th>
                                    ))}
                                    <th className="p-1 border-r border-gray-200 text-center min-w-[60px] font-bold bg-blue-50 text-blue-800">
                                        Rata
                                    </th>
                                </React.Fragment>
                            );
                        } else {
                            return (
                                <th key={`${m.id}-single`} className="p-1 border-r border-gray-200 text-center min-w-[80px] bg-white text-[10px] italic text-gray-400">
                                    (Nilai Utuh)
                                </th>
                            );
                        }
                    })}
                 </tr>
               </thead>
               <tbody>
                 {students.map((student, rowIdx) => {
                    let totalLM = 0;
                    let countLM = 0;
                    materials.forEach(m => {
                       const v = scores[`${student.id}-LM-${m.id}`];
                       if (v !== undefined) { totalLM += v; countLM++; }
                    });
                    const avgLM = countLM > 0 ? (totalLM / countLM).toFixed(0) : '-';

                    return (
                       <tr key={student.id} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="p-3 text-center border-r border-gray-100 sticky left-0 bg-white z-10">{rowIdx+1}</td>
                          <td className="p-3 border-r border-gray-100 sticky left-10 bg-white z-10 font-medium text-gray-800 group">
                              <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{student.name}</span>
                                  <button 
                                      onClick={() => handleResetStudent(student.id)}
                                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50"
                                      title="Reset Nilai Siswa Ini"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          </td>
                          
                          {/* DYNAMIC COLUMNS */}
                          {materials.map((m) => {
                             const startIdx = colMap[m.id];
                             const subCols = m.subScopes || [];
                             
                             if (subCols.length > 0) {
                                 // MULTI COLUMNS
                                 return (
                                     <React.Fragment key={`${m.id}-${student.id}`}>
                                         {subCols.map((sub, i) => (
                                             <td key={`${m.id}-${sub}`} className="p-1 border-r border-gray-100 text-center">
                                                 <input 
                                                    ref={(el) => { inputRefs.current[`cell-${rowIdx}-${startIdx + i}`] = el; }}
                                                    type="number" min="0" max="100"
                                                    className="w-full text-center p-1 rounded hover:bg-gray-100 focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-300 transition text-xs"
                                                    value={subScores[`${student.id}-LM-${m.id}-${sub}`] ?? ''}
                                                    onChange={(e) => handleScoreChange(student.id, 'LM', e.target.value, m.id, sub)}
                                                    onKeyDown={(e) => handleKeyDown(e, rowIdx, startIdx + i)}
                                                    onFocus={(e) => e.target.select()}
                                                 />
                                             </td>
                                         ))}
                                         <td className="p-1 border-r border-gray-100 text-center bg-blue-50/50 font-bold text-blue-700 text-xs">
                                             {scores[`${student.id}-LM-${m.id}`] ?? '-'}
                                         </td>
                                     </React.Fragment>
                                 );
                             } else {
                                 // SINGLE COLUMN
                                 return (
                                     <td key={`${m.id}-${student.id}`} className="p-1 border-r border-gray-100 text-center">
                                        <input 
                                          ref={(el) => { inputRefs.current[`cell-${rowIdx}-${startIdx}`] = el; }}
                                          type="number" min="0" max="100"
                                          className="w-full text-center p-1 rounded hover:bg-gray-100 focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-300 transition"
                                          value={scores[`${student.id}-LM-${m.id}`] ?? ''}
                                          onChange={(e) => handleScoreChange(student.id, 'LM', e.target.value, m.id)}
                                          onKeyDown={(e) => handleKeyDown(e, rowIdx, startIdx)}
                                          onFocus={(e) => e.target.select()}
                                        />
                                     </td>
                                 );
                             }
                          })}

                          <td className="p-2 text-center border-r border-gray-100 bg-gray-100 font-bold text-gray-700">{avgLM}</td>
                          
                          <td className="p-1 border-r border-gray-100 text-center">
                             <input 
                                ref={(el) => { inputRefs.current[`cell-${rowIdx}-${colMap['STS']}`] = el; }}
                                type="number" min="0" max="100" 
                                className="w-full text-center p-1 rounded font-medium hover:bg-gray-100 focus:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-300" 
                                value={scores[`${student.id}-STS`] ?? ''} 
                                onChange={(e) => handleScoreChange(student.id, 'STS', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIdx, colMap['STS'])}
                                onFocus={(e) => e.target.select()}
                             />
                          </td>
                          <td className="p-1 border-r border-gray-100 text-center">
                             <input 
                                ref={(el) => { inputRefs.current[`cell-${rowIdx}-${colMap['SAS']}`] = el; }}
                                type="number" min="0" max="100" 
                                className="w-full text-center p-1 rounded font-medium hover:bg-gray-100 focus:bg-orange-50 focus:outline-none focus:ring-1 focus:ring-orange-300" 
                                value={scores[`${student.id}-SAS`] ?? ''} 
                                onChange={(e) => handleScoreChange(student.id, 'SAS', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIdx, colMap['SAS'])}
                                onFocus={(e) => e.target.select()}
                             />
                          </td>
                          <td className="p-2 text-center bg-gray-100 font-bold text-gray-900">
                             {calculateFinalScore(student.id)}
                          </td>
                       </tr>
                    );
                 })}
               </tbody>
             </table>
           </div>
        )}
      </div>

      {/* MANAGE STRUCTURE MODAL */}
      {isManageModalOpen && manageMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <div>
                          <h3 className="font-bold text-gray-800">Edit Struktur Penilaian</h3>
                          <p className="text-xs text-gray-500">{manageMaterial.code} - {manageMaterial.content.substring(0, 30)}...</p>
                      </div>
                      <button onClick={() => setIsManageModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6">
                      <div className="mb-4">
                          <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">Daftar Sub-Elemen</label>
                          <div className="flex flex-wrap gap-2 mb-3">
                              {tempSubScopes.length === 0 && <span className="text-sm text-gray-400 italic">Belum ada sub-elemen (Nilai Tunggal)</span>}
                              {tempSubScopes.map((scope, idx) => (
                                  <span key={idx} className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-3 py-1 rounded-full flex items-center gap-2">
                                      {scope}
                                      <button onClick={() => handleRemoveSubScope(idx)} className="text-red-400 hover:text-red-600 rounded-full hover:bg-red-50 p-0.5">
                                          <X size={14} />
                                      </button>
                                  </span>
                              ))}
                          </div>
                      </div>

                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Tambah Sub (Misal: Tugas 1)"
                              value={newSubInput}
                              onChange={(e) => setNewSubInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddSubScope()}
                          />
                          <button 
                              onClick={handleAddSubScope}
                              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition"
                          >
                              <Plus size={18} />
                          </button>
                      </div>
                      
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800">
                          <p><strong>Catatan:</strong></p>
                          <ul className="list-disc pl-4 mt-1 space-y-1">
                              <li>Jika sub-elemen kosong, input nilai hanya satu kolom (Nilai Utuh).</li>
                              <li>Jika ada sub-elemen, nilai Lingkup Materi akan dihitung dari <strong>Rata-rata Sub-elemen</strong>.</li>
                          </ul>
                      </div>
                  </div>

                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                      <button 
                          onClick={() => setIsManageModalOpen(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                      >
                          Batal
                      </button>
                      <button 
                          onClick={handleSaveStructure}
                          className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold transition shadow-sm"
                      >
                          Simpan Perubahan
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default TeacherSummative;
