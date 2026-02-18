
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassRoom, Student, ScopeMaterial, AssessmentScore } from '../types';
import { getClasses, getStudents, getScopeMaterials, getAssessmentScores, saveBulkAssessmentScores } from '../services/database';
import { Calculator, Save, Filter, FileSpreadsheet, AlertCircle, CheckCircle } from './Icons';
import * as XLSX from 'xlsx';

interface TeacherSummativeProps {
  user: User;
}

const TeacherSummative: React.FC<TeacherSummativeProps> = ({ user }) => {
  // Data State
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<ScopeMaterial[]>([]);
  const [scores, setScores] = useState<{[key: string]: number}>({}); // key: studentId-category-materialId
  
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

  const fetchData = async () => {
    setLoading(true);
    // PASS user.id to getScopeMaterials
    const [stData, matData, scoreData] = await Promise.all([
      getStudents(selectedClassId),
      getScopeMaterials(selectedClassId, selectedSemester, user.id),
      getAssessmentScores(selectedClassId, selectedSemester)
    ]);

    setStudents(stData);
    setMaterials(matData);

    // Map Scores to State Dictionary
    const scoreDict: {[key: string]: number} = {};
    scoreData.forEach(s => {
      // Filter logic if needed, currently assumes data is correct for this class/semester
      const key = s.category === 'LM' 
        ? `${s.studentId}-LM-${s.materialId}`
        : `${s.studentId}-${s.category}`;
      
      // Strict: Only show scores that belong to this subject or were created by generic (legacy)
      // With new userId logic, we might filter further, but for now subject match is good UI filter
      if (!s.subject || s.subject === user.subject) {
         scoreDict[key] = s.score;
      }
    });
    setScores(scoreDict);
    setLoading(false);
    setHasChanges(false);
    setSaveStatus('idle');
    
    // Reset refs on data reload
    inputRefs.current = {};
  };

  const handleScoreChange = (studentId: string, category: 'LM' | 'STS' | 'SAS', val: string, materialId?: string) => {
    const numVal = Math.min(100, Math.max(0, parseInt(val) || 0));
    const key = category === 'LM' ? `${studentId}-LM-${materialId}` : `${studentId}-${category}`;
    
    setScores(prev => ({
      ...prev,
      [key]: numVal
    }));
    setHasChanges(true);
    setSaveStatus('idle'); 
  };

  // --- EXCEL-LIKE NAVIGATION LOGIC ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Prevent default behavior for arrow keys (especially Up/Down which change number values)
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
        // setTimeout(() => nextInput.select(), 0); // Optional: Ensure selection persists
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
    // 1. Instant UI Feedback (Zero Latency)
    setHasChanges(false);
    setSaveStatus('saved');
    
    // 2. Prepare Data
    const scoresToSave: Omit<AssessmentScore, 'id'>[] = [];
    students.forEach(s => {
      // LM
      materials.forEach(m => {
        const key = `${s.id}-LM-${m.id}`;
        if (scores[key] !== undefined) {
          scoresToSave.push({
            studentId: s.id,
            classId: selectedClassId,
            semester: selectedSemester,
            category: 'LM',
            materialId: m.id,
            score: scores[key],
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

    // 3. Fire and Forget to Database (Background)
    // Pass user.id explicitly as the owner of these scores
    saveBulkAssessmentScores(scoresToSave, user.id, user.fullName).catch(err => {
        console.error("Save failed in background", err);
        setSaveStatus('error');
        setHasChanges(true); // Re-enable save button
        alert("Gagal menyimpan ke database lokal. Data mungkin belum aman.");
    });
    
    // Auto-hide success status after 3s
    setTimeout(() => {
        setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
    }, 3000);
  };

  const exportToExcel = () => {
    const headers = ['No', 'Nama Siswa', 'NIS', ...materials.map(m => `LM: ${m.code}`), 'Rata LM', 'STS', 'SAS', 'Nilai Akhir'];
    const rows = students.map((s, i) => {
       let totalLM = 0;
       const lmScores = materials.map(m => {
          const val = scores[`${s.id}-LM-${m.id}`] || 0;
          totalLM += val;
          return val;
       });
       const avgLM = materials.length > 0 ? (totalLM / materials.length).toFixed(1) : '0';
       const sts = scores[`${s.id}-STS`] || 0;
       const sas = scores[`${s.id}-SAS`] || 0;
       const final = calculateFinalScore(s.id);

       return [i+1, s.name, s.nis, ...lmScores, avgLM, sts, sas, final];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nilai Sumatif");
    XLSX.writeFile(wb, `Nilai_${selectedSemester}_${classes.find(c=>c.id===selectedClassId)?.name}.xlsx`);
  };

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
              <p className="text-sm text-gray-500">Input nilai Lingkup Materi, STS, dan SAS untuk rapor.</p>
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
           {materials.length === 0 ? (
              <div className="flex items-center gap-2 text-yellow-600 text-sm bg-yellow-50 px-3 py-1.5 rounded-lg">
                 <AlertCircle size={16} />
                 <span>Belum ada Lingkup Materi (TP). Tambahkan di menu "Lingkup Materi".</span>
              </div>
           ) : (
              <div className="text-sm text-gray-500">
                 Mapel: <strong>{user.subject || 'Umum'}</strong> • {materials.length} Kolom Nilai • Gunakan <kbd className="bg-gray-100 border border-gray-300 rounded px-1 text-xs">Panah</kbd> & <kbd className="bg-gray-100 border border-gray-300 rounded px-1 text-xs">Enter</kbd> untuk navigasi
              </div>
           )}

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
                   hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                 {saveStatus === 'saved' ? <CheckCircle size={16} /> : 
                  saveStatus === 'error' ? <AlertCircle size={16} /> :
                  <Save size={16} />}
                 {saveStatus === 'saved' ? 'Tersimpan!' : 
                  saveStatus === 'error' ? 'Gagal Simpan' : 
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
                 <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                   <th className="p-3 border-r border-gray-200 sticky left-0 bg-gray-50 z-10 w-10">No</th>
                   <th className="p-3 border-r border-gray-200 sticky left-10 bg-gray-50 z-10 min-w-[200px]">Nama Siswa</th>
                   
                   {/* LM Columns */}
                   {materials.map((m, i) => (
                      <th key={m.id} className="p-2 border-r border-gray-200 text-center min-w-[80px]">
                         <div className="text-[10px] text-gray-500 font-normal">LM {i+1}</div>
                         <div className="font-bold text-blue-700" title={m.content}>{m.code}</div>
                      </th>
                   ))}
                   
                   <th className="p-2 border-r border-gray-200 text-center bg-blue-50 w-20">Rata LM</th>
                   <th className="p-2 border-r border-gray-200 text-center min-w-[80px] font-bold">STS</th>
                   <th className="p-2 border-r border-gray-200 text-center min-w-[80px] font-bold">SAS</th>
                   <th className="p-2 text-center bg-gray-100 font-bold w-20">Akhir</th>
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
                          <td className="p-3 text-center border-r border-gray-100 sticky left-0 bg-white">{rowIdx+1}</td>
                          <td className="p-3 border-r border-gray-100 sticky left-10 bg-white font-medium text-gray-800">{student.name}</td>
                          
                          {/* LM Inputs */}
                          {materials.map((m, colIdx) => (
                             <td key={m.id} className="p-1 border-r border-gray-100 text-center">
                                <input 
                                  ref={(el) => { inputRefs.current[`cell-${rowIdx}-${colIdx}`] = el; }}
                                  type="number" 
                                  min="0" max="100"
                                  className="w-full text-center p-1 rounded hover:bg-gray-100 focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-300 transition"
                                  value={scores[`${student.id}-LM-${m.id}`] ?? ''}
                                  onChange={(e) => handleScoreChange(student.id, 'LM', e.target.value, m.id)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                                  onFocus={(e) => e.target.select()}
                                />
                             </td>
                          ))}

                          <td className="p-2 text-center border-r border-gray-100 bg-blue-50 font-bold text-blue-800">{avgLM}</td>
                          
                          {/* STS Input */}
                          <td className="p-1 border-r border-gray-100 text-center">
                             <input 
                                ref={(el) => { inputRefs.current[`cell-${rowIdx}-${materials.length}`] = el; }}
                                type="number" min="0" max="100" 
                                className="w-full text-center p-1 rounded font-medium hover:bg-gray-100 focus:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-300" 
                                value={scores[`${student.id}-STS`] ?? ''} 
                                onChange={(e) => handleScoreChange(student.id, 'STS', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIdx, materials.length)}
                                onFocus={(e) => e.target.select()}
                             />
                          </td>
                          
                          {/* SAS Input */}
                          <td className="p-1 border-r border-gray-100 text-center">
                             <input 
                                ref={(el) => { inputRefs.current[`cell-${rowIdx}-${materials.length + 1}`] = el; }}
                                type="number" min="0" max="100" 
                                className="w-full text-center p-1 rounded font-medium hover:bg-gray-100 focus:bg-orange-50 focus:outline-none focus:ring-1 focus:ring-orange-300" 
                                value={scores[`${student.id}-SAS`] ?? ''} 
                                onChange={(e) => handleScoreChange(student.id, 'SAS', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIdx, materials.length + 1)}
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
