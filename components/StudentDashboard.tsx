
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  FileText, 
  Play, 
  Settings, 
  Trash2, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Eye,
  BarChart3,
  Lock,
  Calendar,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  BookOpen
} from './Icons';
import { User, CbtExam, CbtAttempt } from '../types';
import { getCbtExams, getCbtAttemptsByStudent } from '../services/database';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<CbtExam[]>([]);
  const [attempts, setAttempts] = useState<CbtAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Students can see all active exams in their school
      const examData = await getCbtExams('', user.schoolNpsn || '');
      const activeExams = examData.filter(e => e.status === 'ACTIVE');
      setExams(activeExams);
      
      const attemptData = await getCbtAttemptsByStudent(user.id);
      setAttempts(attemptData);
    } catch (error) {
      console.error("Fetch Student Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isExamAttempted = (examId: string) => {
    return attempts.some(a => a.examId === examId);
  };

  const getAttemptStatus = (examId: string) => {
    const attempt = attempts.find(a => a.examId === examId);
    if (!attempt) return null;
    return attempt.status;
  };

  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    exam.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExamDone = (examId: string) => {
    return attempts.some(a => a.examId === examId && a.status === 'SUBMITTED');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Memuat daftar ujian...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Halo, {user.fullName}!</h1>
          <p className="text-gray-500 dark:text-gray-400">Selamat datang di sistem manajemen ujian online (CBT).</p>
        </div>
      </div>

      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-2">Informasi Penting</h2>
          <ul className="space-y-2 text-blue-50 opacity-90 text-sm list-disc pl-5">
            <li>Pastikan koneksi internet stabil sebelum memulai ujian.</li>
            <li>Dilarang berpindah tab atau aplikasi selama ujian berlangsung (sistem akan mencatat pelanggaran).</li>
            <li>Klik tombol "Kerjakan" pada ujian yang aktif untuk memulai.</li>
            <li>Jika ujian meminta token, silakan hubungi guru pengawas Anda.</li>
          </ul>
        </div>
        <GraduationCap size={150} className="absolute -right-10 -bottom-10 text-white opacity-10 rotate-12" />
      </div>

      {/* Active Exams Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-blue-500" />
            Ujian Sedang Berlangsung
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Cari ujian..."
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map(exam => {
              const isDone = isExamDone(exam.id);
              
              return (
                <div key={exam.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <BookOpen size={24} />
                      </div>
                      {isDone ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] uppercase font-bold tracking-wider">Selesai</span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] uppercase font-bold tracking-wider animate-pulse">Running</span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-white mb-1">{exam.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{exam.subject} • {exam.level}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{exam.durationMinutes} Menit</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{exam.startTime ? new Date(exam.startTime).toLocaleDateString() : '-'}</span>
                      </div>
                    </div>

                    {isDone ? (
                      <div className="pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center border border-gray-100 dark:border-gray-600">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status Pengerjaan</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                            <CheckCircle size={16} /> Dikirim
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => navigate(`/cbt/exam/${exam.id}`)}
                        className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition shadow-sm"
                      >
                        <Play size={18} fill="currentColor" />
                        Kerjakan Sekarang
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full w-fit mx-auto mb-4">
              <ClipboardList size={32} className="text-gray-400" />
            </div>
            <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">Tidak Ada Ujian Aktif</h4>
            <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">Saat ini tidak ada ujian yang sedang berlangsung untuk kelas Anda atau tidak ditemukan ujian yang cocok.</p>
          </div>
        )}
      </div>

      {/* History Section (Optional) */}
      {attempts.length > 0 && (
        <div className="space-y-4 pt-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-indigo-500" />
            Riwayat Ujian Anda
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
             <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider">Ujian</th>
                    <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider">Tanggal</th>
                    <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider">Status</th>
                    <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {attempts.slice(0, 5).map(attempt => (
                    <tr key={attempt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800 dark:text-white">Exam ID: {attempt.examId.substring(0, 8)}...</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Score: {attempt.score?.toFixed(1) || '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(attempt.endTime || attempt.lastModified!).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold">TERKIRIM</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase">Detail</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
