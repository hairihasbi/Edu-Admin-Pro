
import React, { useState, useEffect } from 'react';
import { User, SupervisionResult } from '../types';
import { getSupervisionResults, getSupervisionResultsForSchool, getSchoolTeachers } from '../services/database';
import { ClipboardCheck, User as UserIcon, Calendar, Star, ChevronDown, ChevronUp, Search, Filter, Loader2, AlertCircle, Shield } from './Icons';

interface SupervisionResultsProps {
  user: User;
}

const SupervisionResults: React.FC<SupervisionResultsProps> = ({ user }) => {
  const [results, setResults] = useState<SupervisionResult[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isWakasek = user.additionalRole === 'WAKASEK_KURIKULUM';

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let data: SupervisionResult[] = [];
      if (isWakasek) {
        data = await getSupervisionResultsForSchool(user.schoolNpsn!);
      } else {
        data = await getSupervisionResults(user.id); // As teacher (being supervised)
      }
      
      const schoolTeachers = await getSchoolTeachers(user.schoolNpsn!);
      
      setResults(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setTeachers(schoolTeachers);
    } catch (error) {
      console.error("Failed to fetch supervision results:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = results.filter(r => {
    const teacher = teachers.find(t => t.id === r.teacherId);
    const supervisor = teachers.find(t => t.id === r.supervisorId);
    const searchStr = `${teacher?.fullName} ${supervisor?.fullName} ${r.date}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-purple-600 mb-4" size={40} />
        <p className="text-gray-500 font-medium">Memuat hasil supervisi...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Hasil Supervisi Akademik</h2>
            <p className="text-gray-500 text-sm">
              {isWakasek 
                ? "Pantau hasil penilaian supervisi seluruh guru di sekolah." 
                : "Lihat hasil penilaian supervisi yang telah dilakukan terhadap Anda."}
            </p>
          </div>
          {!isWakasek && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
              <Shield size={12} />
              DATA PRIBADI
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari guru atau tanggal..."
            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredResults.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm text-center">
          <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-700 mb-2">Belum Ada Hasil</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? "Tidak ditemukan hasil yang sesuai dengan pencarian Anda." : "Belum ada data penilaian supervisi yang tersedia."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((result) => {
            const teacher = teachers.find(t => t.id === result.teacherId);
            const supervisor = teachers.find(t => t.id === result.supervisorId);
            const isExpanded = expandedId === result.id;
            
            return (
              <div key={result.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div 
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold">
                      {result.score.toFixed(1)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{teacher?.fullName || 'Guru'}</h4>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <UserIcon size={12} />
                          Supervisor: {supervisor?.fullName || 'Supervisor'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(result.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={16} 
                          className={result.score >= star ? 'text-yellow-400' : 'text-gray-200'} 
                          fill={result.score >= star ? 'currentColor' : 'none'} 
                        />
                      ))}
                    </div>
                    {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-gray-50 bg-gray-50/30 animate-in slide-in-from-top-2 duration-200">
                    {result.planningAdmin ? (
                      <div className="mt-4 space-y-6">
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                          <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                            <h5 className="text-xs font-black text-gray-500 uppercase tracking-widest">Administrasi Perencanaan Pembelajaran</h5>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                              result.planningAdmin.predicate === 'BAIK SEKALI' ? 'bg-green-500' :
                              result.planningAdmin.predicate === 'BAIK' ? 'bg-blue-500' :
                              result.planningAdmin.predicate === 'CUKUP' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}>
                              {result.planningAdmin.predicate} ({result.planningAdmin.finalScore.toFixed(2)})
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] border-collapse">
                              <thead>
                                <tr className="bg-gray-50/50">
                                  <th className="border-b border-r p-2 text-left w-8">No</th>
                                  <th className="border-b border-r p-2 text-left">Komponen</th>
                                  <th className="border-b border-r p-2 text-center w-16">Nilai</th>
                                  <th className="border-b p-2 text-left">Catatan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(result.planningAdmin.scores).map(([comp, score], idx) => (
                                  <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="border-b border-r p-2 text-center">{idx + 1}</td>
                                    <td className="border-b border-r p-2 font-medium">{comp}</td>
                                    <td className="border-b border-r p-2 text-center font-bold text-purple-600">{score}</td>
                                    <td className="border-b p-2 text-gray-500 italic">{result.planningAdmin?.comments[comp] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {result.planningAdmin.coachingSuggestion && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saran Pembinaan</h5>
                            <p className="text-xs text-gray-700 leading-relaxed italic">
                              "{result.planningAdmin.coachingSuggestion}"
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest">Detail Aspek Penilaian</h5>
                          <div className="space-y-3">
                            {result.aspects?.map((aspect, idx) => (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold text-gray-700">{aspect.aspect}</span>
                                  <span className="text-xs font-black text-purple-600">{aspect.score}/5</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className="h-full bg-purple-500 rounded-full" 
                                    style={{ width: `${(aspect.score / 5) * 100}%` }}
                                  />
                                </div>
                                {aspect.comment && (
                                  <p className="text-[10px] text-gray-500 italic">"{aspect.comment}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest">Catatan & Rekomendasi</h5>
                          <div className="bg-white p-5 rounded-xl border border-gray-100 h-full">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {result.notes || "Tidak ada catatan tambahan."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SupervisionResults;
