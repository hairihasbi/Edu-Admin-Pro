
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { VAK_QUESTIONS, calculateDominantStyle, getStyleDescription } from '../services/assessmentService';
import { db } from '../services/db';
import { saveLearningStyleAssessment } from '../services/database';
import { Student, ClassRoom } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Eye, Ear, Activity, ArrowRight, ArrowLeft, User } from 'lucide-react';

const StudentAssessment: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [step, setStep] = useState<'SELECT_STUDENT' | 'QUESTIONS' | 'RESULT'>('SELECT_STUDENT');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C'>>({});
  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<ClassRoom | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!classId) return;
      try {
        const cls = await db.classes.get(classId);
        if (cls) setClassInfo(cls);
        
        const stds = await db.students.where('classId').equals(classId).toArray();
        setStudents(stds.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Failed to load students:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [classId]);

  const handleAnswer = (questionId: number, optionId: 'A' | 'B' | 'C') => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    if (currentQuestionIndex < VAK_QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 300);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStudent || !classId || !classInfo) return;

    const scores = { visual: 0, auditory: 0, kinesthetic: 0 };
    VAK_QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      const option = q.options.find(o => o.id === answer);
      if (option?.style === 'VISUAL') scores.visual++;
      if (option?.style === 'AUDITORI') scores.auditory++;
      if (option?.style === 'KINESTETIK') scores.kinesthetic++;
    });

    const dominantStyle = calculateDominantStyle(scores);

    await saveLearningStyleAssessment({
      studentId: selectedStudent.id,
      classId: classId,
      schoolNpsn: classInfo.schoolNpsn || '',
      userId: classInfo.homeroomTeacherId || '',
      visualScore: scores.visual,
      auditoryScore: scores.auditory,
      kinestheticScore: scores.kinesthetic,
      dominantStyle,
      date: new Date().toISOString(),
      method: 'DIGITAL'
    });

    setStep('RESULT');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Asesmen Gaya Belajar</h1>
          <p className="text-gray-500 mt-1">Kelas: {classInfo?.name || '...'}</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'SELECT_STUDENT' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Pilih Namamu
              </h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {students.map(student => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedStudent?.id === student.id
                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100'
                        : 'border-gray-100 hover:border-indigo-300'
                    }`}
                  >
                    <span className="font-medium text-gray-700">{student.name}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">NIS: {student.nis}</span>
                  </button>
                ))}
              </div>
              <button
                disabled={!selectedStudent}
                onClick={() => setStep('QUESTIONS')}
                className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Mulai Asesmen
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 'QUESTIONS' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Progress */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
                  <span>Pertanyaan {currentQuestionIndex + 1} dari {VAK_QUESTIONS.length}</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / VAK_QUESTIONS.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentQuestionIndex + 1) / VAK_QUESTIONS.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[300px] flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-8">
                  {VAK_QUESTIONS[currentQuestionIndex].text}
                </h3>
                <div className="space-y-3 mt-auto">
                  {VAK_QUESTIONS[currentQuestionIndex].options.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleAnswer(VAK_QUESTIONS[currentQuestionIndex].id, option.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                        answers[VAK_QUESTIONS[currentQuestionIndex].id] === option.id
                          ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-gray-100 hover:border-indigo-300 active:bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        answers[VAK_QUESTIONS[currentQuestionIndex].id] === option.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {option.id}
                      </div>
                      <span className="flex-1 text-gray-700 font-medium leading-tight">
                        {option.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={() => currentQuestionIndex > 0 && setCurrentQuestionIndex(prev => prev - 1)}
                  disabled={currentQuestionIndex === 0}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Sebelumnya
                </button>
                {currentQuestionIndex === VAK_QUESTIONS.length - 1 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!answers[VAK_QUESTIONS[currentQuestionIndex].id]}
                    className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    Selesai & Simpan
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    disabled={!answers[VAK_QUESTIONS[currentQuestionIndex].id]}
                    className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Selanjutnya
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 'RESULT' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Terima Kasih!</h2>
              <p className="text-gray-500 mb-8">
                Asesmenmu telah berhasil disimpan. Hasilnya akan digunakan oleh gurumu untuk membantumu belajar lebih baik.
              </p>
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-left mb-8">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Pesan untukmu:</p>
                <p className="text-indigo-900 font-medium italic">
                  "Setiap orang punya cara belajar yang unik. Teruslah semangat mengeksplorasi potensimu!"
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
              >
                Kembali ke Awal
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StudentAssessment;
