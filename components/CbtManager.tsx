
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
  MoreVertical,
  ChevronRight
} from './Icons';
import { User, CbtExam } from '../types';
import { getCbtExams, deleteCbtExam, saveCbtExam } from '../services/database';

interface CbtManagerProps {
  user: User;
}

const CbtManager: React.FC<CbtManagerProps> = ({ user }) => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<CbtExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'DRAFT' | 'ACTIVE' | 'CLOSED'>('ALL');

  useEffect(() => {
    fetchExams();
  }, [user]);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const data = await getCbtExams(user.id, user.schoolNpsn || '');
      setExams(data);
    } catch (error) {
      console.error("Fetch CBT Exams Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus ujian ini beserta seluruh soalnya?')) {
      try {
        await deleteCbtExam(examId);
        setExams(prev => prev.filter(e => e.id !== examId));
      } catch (error) {
        alert('Gagal menghapus ujian.');
      }
    }
  };

  const handleToggleStatus = async (exam: CbtExam) => {
    const nextStatusMap: Record<string, 'DRAFT' | 'ACTIVE' | 'CLOSED'> = {
      'DRAFT': 'ACTIVE',
      'ACTIVE': 'CLOSED',
      'CLOSED': 'DRAFT'
    };
    
    const nextStatus = nextStatusMap[exam.status];
    const message = nextStatus === 'ACTIVE' 
      ? 'Aktifkan ujian ini? Siswa akan bisa melihat dan mengerjakan jika memiliki token.'
      : nextStatus === 'CLOSED'
      ? 'Tutup ujian ini? Siswa tidak akan bisa mengerjakan lagi.'
      : 'Kembalikan ke Draft? Ujian tidak akan terlihat oleh siswa.';

    if (window.confirm(message)) {
      try {
        const updatedExam = { ...exam, status: nextStatus, updatedAt: new Date().toISOString() };
        await saveCbtExam(updatedExam);
        setExams(prev => prev.map(e => e.id === exam.id ? updatedExam : e));
      } catch (error) {
        alert('Gagal mengubah status ujian.');
      }
    }
  };

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exam.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || exam.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Play size={10} /> Aktif</span>;
      case 'CLOSED':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Lock size={10} /> Ditutup</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Settings size={10} /> Draft</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">CBT - Computer Based Test</h1>
          <p className="text-gray-500 text-sm">Kelola ujian daring, bank soal, dan pantau hasil siswa secara real-time.</p>
        </div>
        <Link 
          to="/cbt/editor/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-100 transition flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Buat Ujian Baru
        </Link>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Total Ujian</p>
           <p className="text-xl font-black text-gray-800">{exams.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ujian Aktif</p>
           <p className="text-xl font-black text-green-600">{exams.filter(e => e.status === 'ACTIVE').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Draf Ujian</p>
           <p className="text-xl font-black text-blue-600">{exams.filter(e => e.status === 'DRAFT').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Total Bank Soal</p>
           <p className="text-xl font-black text-indigo-600">Terpusat</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Cari judul ujian atau mata pelajaran..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {(['ALL', 'DRAFT', 'ACTIVE', 'CLOSED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-xs font-bold transition ${
                filterStatus === status 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {status === 'ALL' ? 'Semua' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Exam List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({length: 6}).map((_, i) => (
            <div key={i} className="bg-white h-48 rounded-xl animate-pulse border border-gray-100"></div>
          ))
        ) : filteredExams.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">Belum ada ujian yang sesuai kriteria.</p>
            <button onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); }} className="text-blue-600 text-sm mt-2 hover:underline">Reset Filter</button>
          </div>
        ) : (
          filteredExams.map(exam => (
            <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition group">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <div className="flex gap-1">
                    {getStatusBadge(exam.status)}
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-800 text-lg mb-1 group-hover:text-blue-600 transition truncate" title={exam.title}>
                  {exam.title}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-4 font-medium uppercase tracking-wide">
                  {exam.subject}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5 py-3 border-y border-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock size={14} className="text-gray-400" />
                    <span>{exam.durationMinutes} Menit</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Eye size={14} className="text-gray-400" />
                    <span>{exam.token || 'Tanpa Token'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                   <div className="flex gap-1">
                      <button 
                        onClick={() => handleToggleStatus(exam)}
                        className={`p-2 rounded-lg transition ${
                          exam.status === 'ACTIVE' 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : exam.status === 'CLOSED'
                            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                        title={exam.status === 'ACTIVE' ? 'Tutup Ujian' : exam.status === 'CLOSED' ? 'Kembalikan ke Draft' : 'Aktifkan Ujian'}
                      >
                        {exam.status === 'ACTIVE' ? <Lock size={16} /> : <Play size={16} />}
                      </button>
                      <Link 
                        to={`/cbt/editor/${exam.id}`}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        title="Edit Ujian & Soal"
                      >
                        <Settings size={16} />
                      </Link>
                      <button 
                         onClick={() => handleDelete(exam.id)}
                         className="p-2 bg-gray-100 text-red-500 rounded-lg hover:bg-red-50"
                         title="Hapus Ujian"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                   
                   <Link 
                    to={`/cbt/results/${exam.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                   >
                     <BarChart3 size={14} /> Hasil
                   </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Help Section */}
      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-xl shadow-sm text-indigo-600">
             <AlertCircle size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
             <h4 className="font-bold text-indigo-900 mb-1">Fitur Soft-Lock Aktif!</h4>
             <p className="text-sm text-indigo-700 leading-relaxed">
                Ujian yang Anda buat secara otomatis akan menggunakan sistem <strong>Soft-Lock</strong>. 
                Siswa akan dipaksa dalam mode Fullscreen dan akan menerima peringatan otomatis jika mencoba membuka tab lain atau meminimalkan browser.
             </p>
          </div>
          <Link to="/help-center" className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-50 border border-indigo-200">
             Baca Panduan CBT
          </Link>
      </div>
    </div>
  );
};

export default CbtManager;
