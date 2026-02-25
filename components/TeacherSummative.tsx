
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student, ScopeMaterial, AssessmentScore } from '../types';
import { getClasses, getStudents, getScopeMaterials, getAssessmentScores, saveBulkAssessmentScores, updateScopeMaterial } from '../services/database';
import { Calculator, Save, Filter, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, RefreshCcw, Settings, Plus, Trash2, X } from './Icons';
import * as XLSX from 'xlsx';

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

  // Manage Column Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [manageMaterial, setManageMaterial] = useState<ScopeMaterial | null>(null);
  const [tempSubScopes, setTempSubScopes] = useState<string[]>([]);
  const [newSubInput, setNewSubInput] = useState('');

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
  }, [selectedClassId, selectedSemester]);

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
      getScopeMaterials(selectedClassId, selectedSemester, user.id),
      getAssessmentScores(selectedClassId, selectedSemester)
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
      if (!s.subject || s.subject === user.subject) {
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
            subject: user.subject 
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
               subject: user.subject 
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
                     Mapel: <strong>{user.subject || 'Umum'}</strong> • Klik <Settings size={12} className="inline"/> untuk atur sub-kolom
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

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
