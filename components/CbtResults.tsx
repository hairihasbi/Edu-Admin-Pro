
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  User, 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Download 
} from './Icons';
import { CbtExam, CbtAttempt, User as UserType } from '../types';
import { getCbtExams, getCbtAttemptsByExam } from '../services/database';

interface CbtResultsProps {
  user: UserType;
}

const CbtResults: React.FC<CbtResultsProps> = ({ user }) => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<CbtExam | null>(null);
  const [attempts, setAttempts] = useState<CbtAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!examId) return;
      try {
        const exams = await getCbtExams(user.id, user.schoolNpsn || '', user.role);
        const currentExam = exams.find(e => e.id === examId);
        if (currentExam) {
          setExam(currentExam);
          const attemptData = await getCbtAttemptsByExam(examId);
          setAttempts(attemptData);
        }
      } catch (error) {
        console.error("Load Results Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [examId]);

  const filteredAttempts = attempts.filter(a => 
    a.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-8 text-center text-gray-500">Memuat hasil...</div>;
  if (!exam) return <div className="p-8 text-center text-red-500">Ujian tidak ditemukan.</div>;

  const averageScore = attempts.length > 0 
    ? (attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / attempts.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cbt')} className="p-2 hover:bg-white rounded-lg transition text-gray-500">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Hasil Ujian: {exam.title}</h1>
          <p className="text-gray-500 text-sm">{exam.subject} | Rata-rata Skor: <span className="text-blue-600 font-bold">{averageScore}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
               <User size={24} />
            </div>
            <div>
               <p className="text-xs text-gray-400 font-bold uppercase">Selesai Mengerjakan</p>
               <p className="text-2xl font-black text-gray-800">{attempts.length} Siswa</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-xl">
               <CheckCircle size={24} />
            </div>
            <div>
               <p className="text-xs text-gray-400 font-bold uppercase">Skor Tertinggi</p>
               <p className="text-2xl font-black text-green-600">
                 {attempts.length > 0 ? Math.max(...attempts.map(a => a.score || 0)) : 0}
               </p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl">
               <BarChart3 size={24} />
            </div>
            <div>
               <p className="text-xs text-gray-400 font-bold uppercase">Skor Terendah</p>
               <p className="text-2xl font-black text-yellow-600">
                 {attempts.length > 0 ? Math.min(...attempts.map(a => a.score || 0)) : 0}
               </p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Cari nama siswa..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold text-xs hover:bg-gray-200 transition">
              <Download size={16} /> Unduh Excel
           </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 font-black uppercase tracking-widest border-b border-gray-100">
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">Nama Siswa</th>
                <th className="px-6 py-4 text-center">Skor</th>
                <th className="px-6 py-4 text-center">Benar</th>
                <th className="px-6 py-4 text-center">Salah</th>
                <th className="px-6 py-4 text-center">Pelanggaran</th>
                <th className="px-6 py-4">Waktu Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">Belum ada data hasil.</td>
                </tr>
              ) : (
                filteredAttempts.map((attempt, idx) => (
                  <tr key={attempt.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{attempt.studentName}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`px-3 py-1 rounded-full text-xs font-black ${
                         (attempt.score || 0) >= 75 ? 'bg-green-100 text-green-700' : 
                         (attempt.score || 0) >= 50 ? 'bg-yellow-100 text-yellow-700' : 
                         'bg-red-100 text-red-700'
                       }`}>
                         {attempt.score || 0}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-green-600">{attempt.correctCount || 0}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-red-600">{attempt.wrongCount || 0}</td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex items-center justify-center gap-1">
                          <span className={`text-sm font-bold ${(attempt.violationCount || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {attempt.violationCount || 0}
                          </span>
                          {(attempt.violationCount || 0) > 0 && <XCircle size={14} className="text-orange-500" />}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                       {attempt.endTime ? new Date(attempt.endTime).toLocaleString('id-ID') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CbtResults;
