
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student, ScopeMaterial, AssessmentScore } from '../types';
import { getClasses, getStudents, getScopeMaterials, getAssessmentScores, saveBulkAssessmentScores } from '../services/database';
import { Calculator, Save, Filter, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, RefreshCcw } from './Icons';
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
  // Main scores (Averages for LM, or Raw STS/SAS)
  const [scores, setScores] = useState<{[key: string]: number}>({}); 
  // Sub scores (Raw values for sub-columns)
  // Key format: studentId-LM-materialId-subName
  const [subScores, setSubScores] = useState<{[key: string]: number}>({});

  // UI State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('Ganjil');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);

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

  // Helper to parse subScopes safely
  const parseSubScopes = (item: any): string[] => {
      if (!item.subScopes) return [];
      if (Array.isArray(item.subScopes)) return item.subScopes;
      // Handle case where sync might store it as JSON string
      if (typeof item.subScopes === 'string') {
          try {
              const parsed = JSON.parse(item.subScopes);
              return Array.isArray(parsed) ? parsed : [];
          } catch {
              return [];
          }
      }
      return [];
  };

  const fetchData = async () => {
    setLoading(true);
    // PASS user.id to getScopeMaterials to fetch correct data
    const [stData, matData, scoreData] = await Promise.all([
      getStudents(selectedClassId),
      getScopeMaterials(selectedClassId, selectedSemester, user.id),
      getAssessmentScores(selectedClassId, selectedSemester)
    ]);

    setStudents(stData);
    
    // Normalize materials data immediately
    const cleanMaterials = matData.map(m => ({
        ...m,
        subScopes: parseSubScopes(m)
    }));
    setMaterials(cleanMaterials);

    // Map Scores to State Dictionary
    const scoreDict: {[key: string]: number} = {};
    const subScoreDict: {[key: string]: number} = {};

    scoreData.forEach(s => {
      if (!s.subject || s.subject === user.subject) {
          // 1. Main Score
          const key = s.category === 'LM' 
            ? `${s.studentId}-LM-${s.materialId}`
            : `${s.studentId}-${s.category}`;
          scoreDict[key] = s.score;

          // 2. Sub Scores (if any)
          if (s.scoreDetails) {
              // Handle potential stringified scoreDetails from DB
              let details = s.scoreDetails;
              if (typeof details === 'string') {
                  try { details = JSON.parse(details); } catch {}
              }

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
    setLoading(false);
    setHasChanges(false);
    setSaveStatus('idle');
    
    // Reset refs on data reload
    inputRefs.current = {};
  };

  const handleScoreChange = (studentId: string, category: 'LM' | 'STS' | 'SAS', val: string, materialId?: string, subName?: string) => {
    const numVal = Math.min(100, Math.max(0, parseInt(val) || 0));
    
    // CASE 1: Sub-Scope Input
    if (category === 'LM' && materialId && subName) {
        const subKey = `${studentId}-LM-${materialId}-${subName}`;
        const newSubScores = { ...subScores, [subKey]: numVal };
        setSubScores(newSubScores);

        // Auto Calculate Average for Main LM Score
        const material = materials.find(m => m.id === materialId);
        if (material && material.subScopes) {
            let total = 0;
            let count = 0;
            const validSubScopes = material.subScopes.filter(s => s.trim() !== ''); // STRICT FILTER
            
            validSubScopes.forEach(sName => {
                const sKey = `${studentId}-LM-${materialId}-${sName}`;
                // Use new value if it's the one currently being edited
                // Use existing subscore otherwise
                let valToCheck = (sName === subName) ? numVal : (newSubScores[sKey]);
                
                if (valToCheck === undefined) valToCheck = 0;
                total += valToCheck;
                count++;
            });
            
            // Divide by total number of sub-scopes defined for this material
            const avg = count > 0 ? Math.round(total / count) : numVal;
            
            setScores(prev => ({
                ...prev,
                [`${studentId}-LM-${materialId}`]: avg
            }));
        }
    } 
    // CASE 2: Regular LM Input (No Sub-scopes) OR STS/SAS
    else {
        const key = category === 'LM' ? `${studentId}-LM-${materialId}` : `${studentId}-${category}`;
        setScores(prev => ({
          ...prev,
          [key]: numVal
        }));
    }

    setHasChanges(true);
    setSaveStatus('idle'); 
  };

  // --- EXCEL-LIKE NAVIGATION LOGIC ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();

      let nextRow = rowIndex;
      let nextCol = colIndex;

      if (e.key === 'ArrowUp') nextRow = rowIndex - 1;
      if (e.key === 'ArrowDown' || e.key === 'Enter') nextRow = rowIndex + 1;
      if (e.key === 'ArrowLeft') nextCol = colIndex - 1;
      if (e.key === 'ArrowRight') nextCol = colIndex + 1;

      const nextInput = inputRefs.current[`cell-${nextRow}-${nextCol}`];
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const calculateFinalScore = (studentId: string) => {
    // Rata-rata LM
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

    // Rumus: (2*LM + STS + SAS) / 4
    const final = (2 * avgLM + sts + sas) / 4;
    return parseFloat(final.toFixed(1));
  };

  // --- OPTIMISTIC SAVE ---
  const handleSave = () => {
    setSaveStatus('saving');
    
    const scoresToSave: Omit<AssessmentScore, 'id'>[] = [];
    students.forEach(s => {
      // LM
      materials.forEach(m => {
        const key = `${s.id}-LM-${m.id}`;
        const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
        
        // Prepare scoreDetails if subscopes exist
        let details: Record<string, number> | undefined = undefined;
        if (validSubScopes.length > 0) {
            details = {};
            validSubScopes.forEach(sub => {
                const subKey = `${s.id}-LM-${m.id}-${sub}`;
                if (subScores[subKey] !== undefined) {
                    details![sub] = subScores[subKey];
                }
            });
        }

        if (scores[key] !== undefined || details) {
          scoresToSave.push({
            studentId: s.id,
            classId: selectedClassId,
            semester: selectedSemester,
            category: 'LM',
            materialId: m.id,
            score: scores[key] || 0,
            scoreDetails: details,
            subject: user.subject 
          });
        }
      });
      // STS
      if (scores[`${s.id}-STS`] !== undefined) {
        scoresToSave.push({
           studentId: s.id,
           classId: selectedClassId,
           semester: selectedSemester,
           category: 'STS',
           score: scores[`${s.id}-STS`],
           subject: user.subject 
        });
      }
      // SAS
      if (scores[`${s.id}-SAS`] !== undefined) {
        scoresToSave.push({
           studentId: s.id,
           classId: selectedClassId,
           semester: selectedSemester,
           category: 'SAS',
           score: scores[`${s.id}-SAS`],
           subject: user.subject 
        });
      }
    });

    saveBulkAssessmentScores(scoresToSave, user.id, user.fullName).then(() => {
        setSaveStatus('saved');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
    }).catch(err => {
        console.error("Save failed in background", err);
        setSaveStatus('error');
        setHasChanges(true); 
        alert("Gagal menyimpan ke database lokal. Data mungkin belum aman.");
    });
  };

  const exportToExcel = () => {
    // Generate Headers
    const headers = ['No', 'Nama Siswa', 'NIS'];
    materials.forEach(m => {
        const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
        if (validSubScopes.length > 0) {
            validSubScopes.forEach(sub => headers.push(`${m.code} - ${sub}`));
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
          const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
          if (validSubScopes.length > 0) {
              validSubScopes.forEach(sub => {
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

  // Helper to calculate colIndex for refs
  // We need a stable index for keyboard navigation
  const getColIndexMap = () => {
      let idx = 0;
      const map: { [key: string]: number } = {}; // materialId -> startColIndex
      materials.forEach(m => {
          map[m.id] = idx;
          const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
          if (validSubScopes.length > 0) {
              idx += validSubScopes.length + 1; // Sub inputs + Avg
          } else {
              idx += 1;
          }
      });
      // STS and SAS indices
      map['STS'] = idx;
      map['SAS'] = idx + 1;
      return map;
  };
  
  const colMap = getColIndexMap();

  return (
    <div className="space-y-6 pb-20">
      
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
                     <span>Belum ada Lingkup Materi (TP). Tambahkan di menu "Lingkup Materi".</span>
                  </div>
               ) : (
                  <div className="text-sm text-gray-500">
                     Mapel: <strong>{user.subject || 'Umum'}</strong> • Gunakan <kbd className="bg-gray-100 border border-gray-300 rounded px-1 text-xs">Panah</kbd> navigasi
                  </div>
               )}
               <button 
                  onClick={fetchData} 
                  className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition" 
                  title="Refresh Data"
               >
                  <RefreshCcw size={16} />
               </button>
           </div>

           <div className="flex gap-2 ml-auto">
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
                 {/* HEADER ROW 1: MATERI NAMES */}
                 <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                   <th className="p-3 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 w-10" rowSpan={2}>No</th>
                   <th className="p-3 border-r border-gray-200 sticky left-10 bg-gray-50 z-20 min-w-[200px]" rowSpan={2}>Nama Siswa</th>
                   
                   {materials.map((m) => {
                      const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
                      return (
                        <th 
                            key={m.id} 
                            className="p-2 border-r border-gray-200 text-center font-bold bg-blue-50/30 text-blue-900 border-b border-blue-100"
                            colSpan={validSubScopes.length > 0 ? validSubScopes.length + 1 : 1}
                            title={m.content}
                        >
                            {m.code}
                            <div className="text-[9px] font-normal text-gray-500 truncate max-w-[150px] mx-auto">{m.content}</div>
                        </th>
                      );
                   })}
                   
                   <th className="p-2 border-r border-gray-200 text-center bg-gray-100 w-20" rowSpan={2}>Rata LM</th>
                   <th className="p-2 border-r border-gray-200 text-center min-w-[70px] font-bold" rowSpan={2}>STS</th>
                   <th className="p-2 border-r border-gray-200 text-center min-w-[70px] font-bold" rowSpan={2}>SAS</th>
                   <th className="p-2 text-center bg-gray-100 font-bold w-20" rowSpan={2}>Akhir</th>
                 </tr>

                 {/* HEADER ROW 2: SUB COLUMNS */}
                 <tr className="bg-gray-50 text-gray-600 border-b border-gray-200 text-xs">
                    {materials.map(m => {
                        const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
                        if (validSubScopes.length > 0) {
                            return (
                                <React.Fragment key={m.id}>
                                    {validSubScopes.map(sub => (
                                        <th key={`${m.id}-${sub}`} className="p-1 border-r border-gray-200 text-center min-w-[60px] font-medium bg-white">
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
                                <th key={m.id} className="p-1 border-r border-gray-200 text-center min-w-[80px] bg-white text-[10px] italic text-gray-400">
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
                          <td className="p-3 border-r border-gray-100 sticky left-10 bg-white z-10 font-medium text-gray-800">{student.name}</td>
                          
                          {/* DYNAMIC COLUMNS */}
                          {materials.map((m) => {
                             const startIdx = colMap[m.id];
                             const validSubScopes = m.subScopes?.filter(s => s.trim() !== '') || [];
                             
                             // 1. COMPLEX MODE: Sub Scopes
                             if (validSubScopes.length > 0) {
                                 return (
                                     <React.Fragment key={m.id}>
                                         {validSubScopes.map((sub, i) => (
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
                                         {/* Read Only Average for Sub Scope */}
                                         <td className="p-1 border-r border-gray-100 text-center bg-blue-50/50 font-bold text-blue-700 text-xs">
                                             {scores[`${student.id}-LM-${m.id}`] ?? '-'}
                                         </td>
                                     </React.Fragment>
                                 );
                             } 
                             // 2. SIMPLE MODE: Single Input
                             else {
                                 return (
                                     <td key={m.id} className="p-1 border-r border-gray-100 text-center">
                                        <input 
                                          ref={(el) => { inputRefs.current[`cell-${rowIdx}-${startIdx}`] = el; }}
                                          type="number" 
                                          min="0" max="100"
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
                          
                          {/* STS Input */}
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
                          
                          {/* SAS Input */}
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
    </div>
  );
};

export default TeacherSummative;
