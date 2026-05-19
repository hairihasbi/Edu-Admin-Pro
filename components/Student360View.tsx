
import React, { useState, useEffect } from 'react';
import { 
  getStudent360Data, 
  getGraduateProfileAssessments 
} from '../services/database';
import { Student, RfidLog, StudentViolation, StudentAchievement, MentoringJournal, GraduateProfileAssessment } from '../types';
import { 
  User, 
  Calendar, 
  AlertTriangle, 
  Award, 
  MessageCircle, 
  TrendingUp, 
  Clock,
  Shield,
  FileText,
  Activity,
  UserCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts';

interface Student360ViewProps {
  studentId: string;
  currentUserId: string;
  currentUserRole: string;
}

export const Student360View: React.FC<Student360ViewProps> = ({ studentId, currentUserId, currentUserRole }) => {
  const [data, setData] = useState<{
    student: Student;
    attendance: RfidLog[];
    violations: StudentViolation[];
    achievements: StudentAchievement[];
    mentoring: MentoringJournal[];
  } | null>(null);
  const [assessments, setAssessments] = useState<GraduateProfileAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [info, evalData] = await Promise.all([
        getStudent360Data(studentId),
        getGraduateProfileAssessments(studentId)
      ]);
      setData(info);
      setAssessments(evalData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Memuat profil 360...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Data siswa tidak ditemukan.</div>;

  const { student, attendance, violations, achievements, mentoring } = data;

  // Radar Data for latest assessment
  const latestEval = assessments.length > 0 ? assessments[assessments.length - 1] : null;
  const radarData = latestEval ? [
    { subject: 'Iman & Taqwa', A: latestEval.scores.imanTaqwa, fullMark: 5 },
    { subject: 'Kebinekaan', A: latestEval.scores.kebinekaanGlobal, fullMark: 5 },
    { subject: 'Gotong Royong', A: latestEval.scores.gotongRoyong, fullMark: 5 },
    { subject: 'Mandiri', A: latestEval.scores.mandiri, fullMark: 5 },
    { subject: 'Nalar Kritis', A: latestEval.scores.nalarKritis, fullMark: 5 },
    { subject: 'Kreatif', A: latestEval.scores.kreatif, fullMark: 5 },
    { subject: 'Integritas', A: latestEval.scores.integritas, fullMark: 5 },
    { subject: 'Resiliensi', A: latestEval.scores.leadershipResilience, fullMark: 5 },
  ] : [];

  // Attendance rate
  const attendanceRate = attendance.length > 0 
    ? (attendance.filter(a => a.status === 'HADIR').length / attendance.length * 100).toFixed(1)
    : '0';

  // Total points
  const totalViolationPoints = violations.reduce((acc, v) => acc + v.points, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-3xl font-bold">
          {student.name.charAt(0)}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
          <p className="text-gray-500">NIS: {student.nis} • Kelas: {student.classId}</p>
          <div className="mt-3 flex flex-wrap justify-center md:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Mentor: {student.guruWaliName || 'Belum ditugaskan'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              totalViolationPoints > 50 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              <AlertTriangle className="w-3 h-3" /> Poin Pelanggaran: {totalViolationPoints}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-indigo-50 rounded-xl text-center">
            <p className="text-[10px] uppercase font-bold text-indigo-600 mb-1">Kehadiran</p>
            <p className="text-xl font-bold text-indigo-900">{attendanceRate}%</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl text-center">
            <p className="text-[10px] uppercase font-bold text-green-600 mb-1">Prestasi</p>
            <p className="text-xl font-bold text-green-900">{achievements.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Progress Radar & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Radar Chart 8 Dimensi */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Progres 8 Dimensi Profil Lulusan
            </h3>
            {radarData.length > 0 ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} />
                    <Radar
                      name="Progres Siswa"
                      dataKey="A"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-gray-400">
                Belum ada data evaluasi dimensi.
              </div>
            )}
          </div>

          {/* Mentoring Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-600" />
              Jurnal Mentoring & Personal Record
            </h3>
            <div className="space-y-6">
              {mentoring.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Tidak ada catatan bimbingan.</div>
              ) : (
                mentoring.map((item, idx) => (
                  <div key={item.id} className="relative pl-8 pb-6 last:pb-0">
                    <div className="absolute left-[3.5px] top-0 bottom-0 w-[1px] bg-gray-100" />
                    <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]" />
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.topic === 'AKADEMIK' ? 'bg-blue-100 text-blue-700' : 
                            item.topic === 'PRIBADI' ? 'bg-purple-100 text-purple-700' : 
                            item.topic === 'SOSIAL' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {item.topic}
                          </span>
                          {item.isPrivate && <Shield className="w-3 h-3 text-red-500" />}
                        </div>
                        <span className="text-xs text-gray-400">{format(new Date(item.date), 'dd MMM yyyy')}</span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{item.notes}</p>
                      {item.actionPlan && (
                        <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex items-start gap-2">
                          <Activity className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Rencana Tindak Lanjut</p>
                            <p className="text-xs text-gray-800">{item.actionPlan}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance & Discipline */}
        <div className="space-y-6">
          {/* Attendance Status */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Presensi RFID (Real-time)
            </h3>
            <div className="space-y-3">
              {attendance.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs font-bold text-gray-800">{log.status}</p>
                      <p className="text-[10px] text-gray-500">{format(new Date(log.timestamp), 'dd MMM, HH:mm')}</p>
                    </div>
                  </div>
                </div>
              ))}
              {attendance.length === 0 && <p className="text-center py-4 text-gray-400 text-xs">Belum ada log presensi.</p>}
            </div>
          </div>

          {/* Discipline Record */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Kedisiplinan & Pelanggaran
            </h3>
            <div className="space-y-4">
              {violations.map(v => (
                <div key={v.id} className="border-l-4 border-orange-500 pl-3 py-1">
                  <p className="text-sm font-bold text-gray-800">{v.violationName}</p>
                  <p className="text-[10px] text-gray-500">{format(new Date(v.date), 'dd MMM yyyy')} • {v.points} Poin</p>
                </div>
              ))}
              {violations.length === 0 && <p className="text-center py-4 text-gray-400 text-xs">Siswa sangat disiplin.</p>}
            </div>
          </div>

          {/* Achievement Record */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-green-600" />
              Prestasi & Penghargaan
            </h3>
            <div className="space-y-4">
              {achievements.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{a.title}</p>
                    <p className="text-[10px] text-gray-500">{a.level} • {format(new Date(a.date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
              {achievements.length === 0 && <p className="text-center py-4 text-gray-400 text-xs">Belum ada data prestasi.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
