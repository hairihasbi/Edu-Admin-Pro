
import React, { useState, useEffect } from 'react';
import { User, Student, MasterSubject, AssessmentScore, ClassRoom, StudentViolation, StudentAchievement, CounselingSession } from '../types';
import { 
  getStudents, getMasterSubjects, getAssessmentScores, getAllClasses, 
  getStudentViolations, getStudentAchievements, getCounselingSessions 
} from '../services/database';
import { 
  UserCheck, Users, GraduationCap, AlertTriangle, FileSpreadsheet, 
  Search, Filter, Printer, ShieldAlert, Trophy, MessageSquareHeart, 
  ChevronDown, ChevronUp, AlertCircle, MessageCircle 
} from './Icons';
import * as XLSX from 'xlsx';

interface TeacherHomeroomProps {
  user: User;
}

const TeacherHomeroom: React.FC<TeacherHomeroomProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'academic' | 'behavior'>('academic');
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [detectedSubjects, setDetectedSubjects] = useState<string[]>([]);
  
  // BK Data State
  const [violations, setViolations] = useState<StudentViolation[]>([]);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [sessions, setSessions] = useState<CounselingSession[]>([]);

  const [className, setClassName] = useState('...');
  const [selectedSemester, setSelectedSemester] = useState('Ganjil');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  
  // KKM State
  const [kkm, setKkm] = useState<number>(75);
  
  // Expanded row state for Behavior tab
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const visibleSubjects = filterSubject === 'ALL' 
      ? detectedSubjects 
      : detectedSubjects.filter(s => s === filterSubject);

  useEffect(() => {
    const fetchData = async () => {
      if (!user.homeroomClassId) return;
      setIsLoading(true);

      const [allClasses, studentData, scoreData, violationData, achievementData, sessionData] = await Promise.all([
        getAllClasses(),
        getStudents(user.homeroomClassId),
        getAssessmentScores(user.homeroomClassId, selectedSemester),
        getStudentViolations(), 
        getStudentAchievements(),
        getCounselingSessions()
      ]);

      const cls = allClasses.find(c => c.id === user.homeroomClassId);
      setClassName(cls ? cls.name : 'Unknown Class');
      setStudents(studentData);
      setScores(scoreData);
      
      // Extract unique subjects from scores
      const uniqueSubjects = Array.from(new Set((scoreData as AssessmentScore[]).map(s => s.subject || 'Umum'))).sort();
      setDetectedSubjects(uniqueSubjects);

      // Filter BK Data for current students
      const studentIds = new Set(studentData.map(s => s.id));
      setViolations(violationData.filter(v => studentIds.has(v.studentId)));
      setAchievements(achievementData.filter(a => studentIds.has(a.studentId)));
      setSessions(sessionData.filter(s => studentIds.has(s.studentId)));
      
      setIsLoading(false);
    };

    fetchData();
  }, [user.homeroomClassId, selectedSemester]);

  // --- ACADEMIC CALCULATION LOGIC ---
  
  const calculateSubjectFinalGrade = (studentId: string, subject: string) => {
    // Filter scores for this student and subject
    const subjectScores = scores.filter(s => s.studentId === studentId && (s.subject === subject || (!s.subject && subject === 'Umum')));
    
    // Calculate Average LM
    const lmScores = subjectScores.filter(s => s.category === 'LM');
    const totalLM = lmScores.reduce((sum, s) => sum + s.score, 0);
    const avgLM = lmScores.length > 0 ? totalLM / lmScores.length : 0;

    // Get STS and SAS
    const sts = subjectScores.find(s => s.category === 'STS')?.score || 0;
    const sas = subjectScores.find(s => s.category === 'SAS')?.score || 0;

    // Formula: (2 * AvgLM + STS + SAS) / 4
    if (lmScores.length === 0 && sts === 0 && sas === 0) return 0; // No data at all

    const final = (2 * avgLM + sts + sas) / 4;
    return parseFloat(final.toFixed(1));
  };

  const getStudentGlobalStats = (studentId: string) => {
    let totalAllSubjects = 0;
    let subjectCount = 0;
    let belowKkmCount = 0;

    detectedSubjects.forEach(sub => {
       const grade = calculateSubjectFinalGrade(studentId, sub);
       if (grade > 0) {
          totalAllSubjects += grade;
          subjectCount++;
          if (grade < kkm) belowKkmCount++;
       }
    });

    const globalAvg = subjectCount > 0 ? parseFloat((totalAllSubjects / subjectCount).toFixed(1)) : 0;
    return { globalAvg, belowKkmCount };
  };

  // --- BEHAVIOR LOGIC ---
  const getStudentBehaviorStats = (studentId: string) => {
    const studentViolations = violations.filter(v => v.studentId === studentId);
    const totalPoints = studentViolations.reduce((sum, v) => sum + v.points, 0);
    
    let recommendation = "Pantau";
    let statusColor = "bg-green-100 text-green-700";

    if (totalPoints > 100) {
        recommendation = "PANGGILAN ORANG TUA 3";
        statusColor = "bg-red-100 text-red-800 font-bold border border-red-200";
    } else if (totalPoints > 50) {
        recommendation = "PANGGILAN ORANG TUA 2";
        statusColor = "bg-orange-100 text-orange-800 font-bold";
    } else if (totalPoints > 20) {
        recommendation = "PANGGILAN ORANG TUA 1";
        statusColor = "bg-yellow-100 text-yellow-800 font-bold";
    } else if (totalPoints > 0) {
        recommendation = "Pembinaan Wali Kelas";
        statusColor = "bg-blue-50 text-blue-700";
    }

    return { totalPoints, recommendation, statusColor };
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.nis.includes(searchQuery)
  );

  const problemStudents = filteredStudents
    .map(s => ({ 
        ...s, 
        stats: getStudentBehaviorStats(s.id),
        details: {
            violations: violations.filter(v => v.studentId === s.id),
            achievements: achievements.filter(a => a.studentId === s.id),
            sessions: sessions.filter(sess => sess.studentId === s.id)
        }
    }))
    .filter(s => s.stats.totalPoints > 0)
    .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);

  const exportLeger = () => {
    const headers = ['No', 'NIS', 'Nama Siswa', 'L/P', ...detectedSubjects, 'Rata-rata Total', 'Jml < KKM'];
    const data = filteredStudents.map((s, i) => {
      const row: any[] = [i + 1, s.nis, s.name, s.gender];
      
      // Add Subject Scores
      detectedSubjects.forEach(sub => {
         row.push(calculateSubjectFinalGrade(s.id, sub) || 0);
      });

      const stats = getStudentGlobalStats(s.id);
      row.push(stats.globalAvg);
      row.push(stats.belowKkmCount);
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leger Bayangan");
    XLSX.writeFile(wb, `Leger_Bayangan_${className}.xlsx`);
  };

  if (!user.homeroomClassId) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <UserCheck size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-800">Kelas Belum Diatur</h3>
        <p className="text-gray-500">Silakan atur "Kelas Perwalian" Anda di menu <strong>Profil & Akun</strong> terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <UserCheck size={28} className="text-white" />
               </div>
               <h1 className="text-3xl font-bold">Wali Kelas Center</h1>
            </div>
            <p className="text-indigo-100 text-lg">
               Dashboard monitoring kelas <strong>{className}</strong>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
             <div className="flex bg-white/20 backdrop-blur-md rounded-lg p-1">
                <button 
                    onClick={() => setSelectedSemester('Ganjil')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${selectedSemester === 'Ganjil' ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-white/10'}`}
                >
                    Ganjil
                </button>
                <button 
                    onClick={() => setSelectedSemester('Genap')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${selectedSemester === 'Genap' ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-white/10'}`}
                >
                    Genap
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('academic')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'academic' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <GraduationCap size={16} /> Akademik (Leger)
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'behavior' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <ShieldAlert size={16} /> Kedisiplinan & BK
          {problemStudents.length > 0 && (
             <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{problemStudents.length}</span>
          )}
        </button>
      </div>

      {/* --- TAB: ACADEMIC --- */}
      {activeTab === 'academic' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Users size={20} /></div>
                  <div><p className="text-xs text-gray-500">Total Siswa</p><h4 className="font-bold text-lg">{students.length}</h4></div>
               </div>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-full"><FileSpreadsheet size={20} /></div>
                  <div><p className="text-xs text-gray-500">Mapel Masuk</p><h4 className="font-bold text-lg">{detectedSubjects.length}</h4></div>
               </div>
               {/* Input KKM */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 col-span-2">
                  <div className="p-2 bg-yellow-50 text-yellow-600 rounded-full"><AlertTriangle size={20} /></div>
                  <div className="flex-1">
                     <p className="text-xs text-gray-500 mb-1">Simulasi KKM (Highlight Nilai &lt; KKM)</p>
                     <input 
                        type="range" min="60" max="90" 
                        value={kkm} 
                        onChange={(e) => setKkm(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                     />
                  </div>
                  <div className="font-bold text-xl w-12 text-center text-yellow-700">{kkm}</div>
               </div>
            </div>

            {/* Leger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" /> Leger Nilai Per Mapel
                        </h3>
                        <p className="text-sm text-gray-500">Nilai Akhir = (2×LM + STS + SAS) / 4. Data dinamis dari input Guru Mapel.</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Subject Filter */}
                        <select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="ALL">Semua Mapel</option>
                            {detectedSubjects.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Cari Siswa..." 
                                className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={exportLeger}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition"
                        >
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    {isLoading ? (
                    <div className="p-10 text-center text-gray-400">Memuat data nilai...</div>
                    ) : detectedSubjects.length === 0 ? (
                       <div className="p-16 text-center">
                          <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500">Belum ada nilai yang masuk dari guru mata pelajaran.</p>
                       </div>
                    ) : (
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 border-b border-gray-300">
                                <th className="p-3 border-r border-gray-300 sticky left-0 bg-gray-100 z-20 w-10 text-center">No</th>
                                <th className="p-3 border-r border-gray-300 sticky left-10 bg-gray-100 z-20 min-w-[200px]">Nama Siswa</th>
                                
                                {/* Dynamic Subject Columns */}
                                {visibleSubjects.map(sub => (
                                   <th key={sub} className="p-2 border-r border-gray-300 text-center min-w-[80px] font-bold" title={sub}>
                                      {sub.length > 15 ? sub.substring(0, 12) + '...' : sub}
                                   </th>
                                ))}
                                
                                <th className="p-3 bg-blue-50 border-r border-gray-300 text-center font-bold text-blue-800 min-w-[60px]">Rata2</th>
                                <th className="p-3 bg-red-50 text-center font-bold text-red-800 min-w-[60px]">&lt; {kkm}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredStudents.map((student, idx) => {
                                const stats = getStudentGlobalStats(student.id);
                                return (
                                <tr key={student.id} className="hover:bg-gray-50 transition border-b border-gray-100">
                                    <td className="p-3 text-center border-r border-gray-200 sticky left-0 bg-white z-10">{idx + 1}</td>
                                    <td className="p-3 font-medium text-gray-800 border-r border-gray-200 sticky left-10 bg-white z-10 truncate max-w-[200px]">
                                       {student.name}
                                       <div className="text-[10px] text-gray-500">{student.nis}</div>
                                    </td>
                                    
                                    {/* Subject Grades */}
                                    {visibleSubjects.map(sub => {
                                       const grade = calculateSubjectFinalGrade(student.id, sub);
                                       const isLow = grade > 0 && grade < kkm;
                                       return (
                                          <td key={sub} className={`p-2 text-center border-r border-gray-200 ${isLow ? 'bg-red-50 text-red-600 font-bold' : ''}`}>
                                             {grade > 0 ? grade : '-'}
                                          </td>
                                       );
                                    })}

                                    <td className="p-3 text-center border-r border-gray-200 bg-blue-50/50 font-bold text-blue-700">
                                       {stats.globalAvg > 0 ? stats.globalAvg : '-'}
                                    </td>
                                    <td className="p-3 text-center bg-red-50/50 font-bold text-red-700">
                                       {stats.belowKkmCount > 0 ? stats.belowKkmCount : '-'}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- TAB: BEHAVIOR & COUNSELING (Same as before) --- */}
      {activeTab === 'behavior' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
               <ShieldAlert className="text-red-600 shrink-0 mt-1" />
               <div>
                  <h3 className="font-bold text-red-800">Monitoring Siswa Bermasalah</h3>
                  <p className="text-sm text-red-700 mt-1">
                     Data bersumber dari input Guru Bimbingan Konseling (BK). Hanya menampilkan siswa dengan poin pelanggaran.
                  </p>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">Daftar Peringkat Poin Pelanggaran</h3>
                </div>

                <div className="overflow-x-auto">
                    {problemStudents.length === 0 ? (
                        <div className="p-16 text-center">
                            <ShieldAlert size={48} className="mx-auto text-green-200 mb-4" />
                            <h4 className="text-lg font-bold text-gray-800">Kelas Aman & Kondusif!</h4>
                            <p className="text-gray-500">Tidak ada siswa yang tercatat memiliki poin pelanggaran saat ini.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="p-4 w-12 text-center">No</th>
                                    <th className="p-4">Identitas Siswa</th>
                                    <th className="p-4 text-center">Total Poin</th>
                                    <th className="p-4">Rekomendasi Tindakan</th>
                                    <th className="p-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {problemStudents.map((s, idx) => (
                                    <React.Fragment key={s.id}>
                                        <tr 
                                            className={`hover:bg-gray-50 transition cursor-pointer ${expandedStudentId === s.id ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => setExpandedStudentId(expandedStudentId === s.id ? null : s.id)}
                                        >
                                            <td className="p-4 text-center font-bold text-gray-500">{idx + 1}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800 text-base">{s.name}</div>
                                                <div className="text-xs text-gray-500">NIS: {s.nis}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-lg font-bold text-red-600 bg-red-50 px-3 py-1 rounded">{s.stats.totalPoints}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1.5 rounded text-xs uppercase tracking-wide ${s.stats.statusColor}`}>
                                                    {s.stats.recommendation}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center text-gray-400">
                                                {expandedStudentId === s.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </td>
                                        </tr>
                                        {expandedStudentId === s.id && (
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <td colSpan={5} className="p-6 cursor-default">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm">
                                                                <AlertCircle size={16} className="text-red-600" /> Rincian Pelanggaran
                                                            </h4>
                                                            <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                                                                {s.details.violations.map(v => (
                                                                    <li key={v.id}>
                                                                        <span className="font-bold">{v.date}:</span> {v.violationName} ({v.points} pts) - {v.description}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherHomeroom;
