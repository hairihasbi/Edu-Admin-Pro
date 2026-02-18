
import React, { useState, useEffect } from 'react';
import { User, Student, ClassRoom, StudentViolation, StudentAchievement, CounselingSession, StudentPointReduction } from '../types';
import { 
  getClasses, getStudents, 
  getStudentViolations, addStudentViolation, deleteStudentViolation,
  getStudentAchievements, addStudentAchievement, deleteStudentAchievement,
  getCounselingSessions, addCounselingSession, deleteCounselingSession,
  getStudentPointReductions, addStudentPointReduction, deleteStudentPointReduction
} from '../services/database';
import { 
  ShieldAlert, Trophy, MessageSquareHeart, Search, Plus, Trash2, 
  CalendarDays, FileWarning, User as UserIcon, AlertTriangle, Printer, FileSpreadsheet, FileText,
  Heart, RefreshCcw 
} from './Icons';
import * as XLSX from 'xlsx';

interface TeacherGuidanceProps {
  user: User;
}

const TeacherGuidance: React.FC<TeacherGuidanceProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'violations' | 'reductions' | 'achievements' | 'counseling' | 'print'>('violations');
  
  // Data State
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]); // For Dropdown (Filtered)
  const [studentMap, setStudentMap] = useState<Record<string, {name: string, className: string}>>({}); // For Display (All Owned Students)
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  // Feature Data
  const [violations, setViolations] = useState<StudentViolation[]>([]);
  const [reductions, setReductions] = useState<StudentPointReduction[]>([]);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [sessions, setSessions] = useState<CounselingSession[]>([]);

  // Forms
  const [violationForm, setViolationForm] = useState({ name: '', points: 5, description: '', date: new Date().toISOString().split('T')[0] });
  const [reductionForm, setReductionForm] = useState({ activityName: '', pointsRemoved: 5, description: '', date: new Date().toISOString().split('T')[0] });
  const [achievementForm, setAchievementForm] = useState({ title: '', level: 'Sekolah', description: '', date: new Date().toISOString().split('T')[0] });
  const [counselingForm, setCounselingForm] = useState({ issue: '', notes: '', followUp: '', date: new Date().toISOString().split('T')[0] });

  // Init
  useEffect(() => {
    const init = async () => {
      // 1. Load Classes SPECIFIC to this User (Guru BK yang bersangkutan)
      const cls = await getClasses(user.id); 
      setClasses(cls);
      if (cls.length > 0) setSelectedClassId(cls[0].id);

      // 2. Load Students ONLY from these classes to populate the display map
      const map: Record<string, {name: string, className: string}> = {};
      
      // Fetch students for each class owned by the teacher
      const studentPromises = cls.map(c => getStudents(c.id));
      const studentsPerClass = await Promise.all(studentPromises);

      studentsPerClass.flat().forEach(s => {
        // Cari nama kelas dari state cls yang sudah diambil
        const className = cls.find(c => c.id === s.classId)?.name || 'Unknown';
        map[s.id] = { name: s.name, className: className };
      });
      
      setStudentMap(map);
    };
    init();
  }, [user.id]);

  // Load Students when Class Changes (For Dropdown Input)
  useEffect(() => {
    if (selectedClassId) {
      const loadStudents = async () => {
        const sts = await getStudents(selectedClassId);
        setStudents(sts);
        setSelectedStudentId(''); // Reset selected student when class changes
      };
      loadStudents();
    }
  }, [selectedClassId]);

  // Load Feature Data based on Tab
  useEffect(() => {
    loadFeatureData();
  }, [activeTab]); 

  const loadFeatureData = async () => {
    if (activeTab === 'print') {
       const [v, r, a, s] = await Promise.all([
          getStudentViolations(),
          getStudentPointReductions(),
          getStudentAchievements(),
          getCounselingSessions()
       ]);
       setViolations(v);
       setReductions(r);
       setAchievements(a);
       setSessions(s);
    } else if (activeTab === 'violations') {
      const data = await getStudentViolations();
      setViolations(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else if (activeTab === 'reductions') {
      const data = await getStudentPointReductions();
      setReductions(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else if (activeTab === 'achievements') {
      const data = await getStudentAchievements();
      setAchievements(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else {
      const data = await getCounselingSessions();
      setSessions(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  };

  const getStudentDisplay = (id: string) => {
    const info = studentMap[id];
    if (info) return { name: info.name, className: info.className };
    return null; 
  };

  // --- HANDLERS ---

  const handleAddViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addStudentViolation({
      studentId: selectedStudentId,
      date: violationForm.date,
      violationName: violationForm.name,
      points: Number(violationForm.points),
      description: violationForm.description,
      reportedBy: user.fullName
    });
    setViolationForm({ name: '', points: 5, description: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Pelanggaran dicatat.');
  };

  const handleAddReduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addStudentPointReduction({
      studentId: selectedStudentId,
      date: reductionForm.date,
      activityName: reductionForm.activityName,
      pointsRemoved: Number(reductionForm.pointsRemoved),
      description: reductionForm.description
    });
    setReductionForm({ activityName: '', pointsRemoved: 5, description: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Pengurangan poin dicatat.');
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addStudentAchievement({
      studentId: selectedStudentId,
      date: achievementForm.date,
      title: achievementForm.title,
      level: achievementForm.level as any,
      description: achievementForm.description
    });
    setAchievementForm({ title: '', level: 'Sekolah', description: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Prestasi dicatat.');
  };

  const handleAddCounseling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    await addCounselingSession({
      studentId: selectedStudentId,
      date: counselingForm.date,
      issue: counselingForm.issue,
      notes: counselingForm.notes,
      followUp: counselingForm.followUp,
      status: 'OPEN'
    });
    setCounselingForm({ issue: '', notes: '', followUp: '', date: new Date().toISOString().split('T')[0] });
    loadFeatureData();
    alert('Sesi konseling dicatat.');
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Hapus data ini?")) return;
    
    if (activeTab === 'violations') await deleteStudentViolation(id);
    else if (activeTab === 'reductions') await deleteStudentPointReduction(id);
    else if (activeTab === 'achievements') await deleteStudentAchievement(id);
    else await deleteCounselingSession(id);
    
    loadFeatureData();
  };

  // --- EXPORT HANDLERS ---

  const getStudentDataForReport = () => {
    if (!selectedStudentId) return null;
    const info = getStudentDisplay(selectedStudentId);
    if (!info) return null;
    
    const vList = violations.filter(v => v.studentId === selectedStudentId);
    const rList = reductions.filter(r => r.studentId === selectedStudentId);
    
    const totalV = vList.reduce((acc, v) => acc + v.points, 0);
    const totalR = rList.reduce((acc, r) => acc + r.pointsRemoved, 0);
    const netPoints = Math.max(0, totalV - totalR);

    return {
      info,
      violations: vList,
      reductions: rList,
      achievements: achievements.filter(a => a.studentId === selectedStudentId),
      sessions: sessions.filter(s => s.studentId === selectedStudentId),
      summary: { totalV, totalR, netPoints }
    };
  };

  const generateHTMLReport = (data: any) => {
    const violationRows = data.violations.length > 0 
      ? data.violations.map((v: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${v.date}</td>
          <td>${v.violationName}</td>
          <td>${v.description || '-'}</td>
          <td style="text-align:center">${v.points}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada data pelanggaran</td></tr>';

    const reductionRows = data.reductions.length > 0 
      ? data.reductions.map((r: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${r.date}</td>
          <td>${r.activityName}</td>
          <td>${r.description || '-'}</td>
          <td style="text-align:center">-${r.pointsRemoved}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada data pemulihan poin</td></tr>';

    const achievementRows = data.achievements.length > 0
      ? data.achievements.map((a: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${a.date}</td>
          <td>${a.title}</td>
          <td>${a.level}</td>
          <td>${a.description || '-'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada data prestasi</td></tr>';

    const sessionRows = data.sessions.length > 0
      ? data.sessions.map((s: any, i: number) => `
        <tr>
          <td style="text-align:center">${i+1}</td>
          <td>${s.date}</td>
          <td>${s.issue}</td>
          <td>${s.notes}</td>
          <td>${s.followUp || '-'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center; font-style: italic;">Tidak ada catatan konseling</td></tr>';

    return `
      <html>
        <head>
          <title>Laporan BK - ${data.info.name}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 12pt; }
            h2, h3 { text-align: center; margin: 5px 0; }
            .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .student-info { margin-bottom: 20px; }
            .student-info table { width: auto; border: none; }
            .student-info td { border: none; padding: 2px 10px 2px 0; font-weight: bold; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 14pt; font-weight: bold; background-color: #f0f0f0; padding: 5px; border: 1px solid #000; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: top; }
            th { background-color: #e0e0e0; text-align: center; font-weight: bold; }
            .summary-box { border: 2px solid #333; padding: 10px; width: 300px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>LAPORAN REKAM JEJAK SISWA</h2>
            <h3>BIMBINGAN KONSELING & KEDISIPLINAN</h3>
          </div>

          <div class="student-info">
            <table>
              <tr><td>Nama Siswa</td><td>: ${data.info.name}</td></tr>
              <tr><td>Kelas</td><td>: ${data.info.className}</td></tr>
              <tr><td>Tanggal Cetak</td><td>: ${new Date().toLocaleDateString('id-ID')}</td></tr>
            </table>
          </div>

          <div class="summary-box">
             <strong>Ringkasan Poin Kedisiplinan:</strong><br/>
             Total Poin Pelanggaran: ${data.summary.totalV}<br/>
             Total Poin Dikurangi: ${data.summary.totalR}<br/>
             -----------------------------------<br/>
             <strong>SISA POIN AKTIF: ${data.summary.netPoints}</strong>
          </div>

          <div class="section">
            <div class="section-title">A. PELANGGARAN & KEDISIPLINAN</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="25%">Jenis Pelanggaran</th>
                  <th width="45%">Keterangan</th>
                  <th width="10%">Poin</th>
                </tr>
              </thead>
              <tbody>${violationRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">B. PEMULIHAN POIN (PENGURANGAN)</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="25%">Aktivitas</th>
                  <th width="45%">Keterangan</th>
                  <th width="10%">Poin (-)</th>
                </tr>
              </thead>
              <tbody>${reductionRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">C. PRESTASI NON-AKADEMIK</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="25%">Nama Prestasi</th>
                  <th width="15%">Tingkat</th>
                  <th width="40%">Keterangan</th>
                </tr>
              </thead>
              <tbody>${achievementRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">D. CATATAN KONSELING</div>
            <table>
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="15%">Tanggal</th>
                  <th width="20%">Permasalahan</th>
                  <th width="30%">Catatan / Proses</th>
                  <th width="30%">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>${sessionRows}</tbody>
            </table>
          </div>

          <div style="margin-top: 40px; float: right; text-align: center; width: 250px;">
             <p>Banjarbaru, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
             <p>Guru Bimbingan Konseling,</p>
             <br/><br/><br/>
             <p style="font-weight: bold; text-decoration: underline;">${user.fullName}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const data = getStudentDataForReport();
    if (!data) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;

    printWindow.document.write(generateHTMLReport(data));
    printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
    printWindow.document.close();
  };

  const handleDocExport = () => {
    const data = getStudentDataForReport();
    if (!data) return;

    const htmlContent = generateHTMLReport(data);
    
    // Create a Blob with Word-compatible HTML
    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });
    
    // Trigger Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_BK_${data.info.name.replace(/\s+/g, '_')}.doc`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelExport = () => {
    const data = getStudentDataForReport();
    if (!data) return;

    // Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Pelanggaran
    const vRows = data.violations.map((v, i) => ({
      No: i + 1,
      Tanggal: v.date,
      Pelanggaran: v.violationName,
      Poin: v.points,
      Keterangan: v.description || '-',
      Pelapor: v.reportedBy
    }));
    const ws1 = XLSX.utils.json_to_sheet(vRows.length ? vRows : [{Info: "Tidak ada data pelanggaran"}]);
    XLSX.utils.book_append_sheet(wb, ws1, "Pelanggaran");

    // Sheet 2: Pengurangan
    const rRows = data.reductions.map((r, i) => ({
      No: i + 1,
      Tanggal: r.date,
      Aktivitas: r.activityName,
      PoinDikurangi: r.pointsRemoved,
      Keterangan: r.description || '-'
    }));
    const ws2 = XLSX.utils.json_to_sheet(rRows.length ? rRows : [{Info: "Tidak ada data pengurangan"}]);
    XLSX.utils.book_append_sheet(wb, ws2, "Pemulihan Poin");

    // Sheet 3: Prestasi
    const aRows = data.achievements.map((a, i) => ({
      No: i + 1,
      Tanggal: a.date,
      Prestasi: a.title,
      Tingkat: a.level,
      Deskripsi: a.description || '-'
    }));
    const ws3 = XLSX.utils.json_to_sheet(aRows.length ? aRows : [{Info: "Tidak ada data prestasi"}]);
    XLSX.utils.book_append_sheet(wb, ws3, "Prestasi");

    // Sheet 4: Konseling
    const sRows = data.sessions.map((s, i) => ({
      No: i + 1,
      Tanggal: s.date,
      Masalah: s.issue,
      Catatan: s.notes,
      TindakLanjut: s.followUp || '-',
      Status: s.status
    }));
    const ws4 = XLSX.utils.json_to_sheet(sRows.length ? sRows : [{Info: "Tidak ada data konseling"}]);
    XLSX.utils.book_append_sheet(wb, ws4, "Konseling");

    XLSX.writeFile(wb, `Laporan_BK_${data.info.name.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
           <ShieldAlert className="text-purple-600" /> Bimbingan Konseling & Kedisiplinan
        </h2>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('violations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'violations' ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileWarning size={16} /> Pelanggaran
          </button>
          <button
            onClick={() => setActiveTab('reductions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'reductions' ? 'bg-green-50 text-green-600 ring-1 ring-green-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <RefreshCcw size={16} /> Pemulihan Poin
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'achievements' ? 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Trophy size={16} /> Prestasi
          </button>
          <button
            onClick={() => setActiveTab('counseling')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'counseling' ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquareHeart size={16} /> Konseling
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'print' ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Printer size={16} /> Cetak
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* INPUT FORM / SELECTOR (Left Column) */}
        <div className="lg:col-span-1">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-6">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">
                 {activeTab === 'violations' ? 'Input Pelanggaran' : 
                  activeTab === 'reductions' ? 'Input Pengurangan Poin' :
                  activeTab === 'achievements' ? 'Input Prestasi' : 
                  activeTab === 'counseling' ? 'Log Konseling' : 
                  'Filter Data Laporan'}
              </h3>
              
              {/* Student Selector */}
              <div className="mb-4 space-y-3">
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Pilih Kelas Saya</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                       {classes.length === 0 && <option value="">Belum ada kelas yang Anda buat</option>}
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Pilih Siswa</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      disabled={classes.length === 0}
                    >
                       <option value="">-- Pilih Siswa --</option>
                       {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                 </div>
              </div>

              {/* Dynamic Forms - Hidden on Print Tab */}
              {activeTab === 'violations' && (
                 <form onSubmit={handleAddViolation} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={violationForm.date} onChange={e => setViolationForm({...violationForm, date: e.target.value})} />
                    <input type="text" placeholder="Jenis Pelanggaran (mis: Terlambat)" required className="w-full border rounded-lg p-2 text-sm" value={violationForm.name} onChange={e => setViolationForm({...violationForm, name: e.target.value})} />
                    <input type="number" placeholder="Poin Sanksi" required className="w-full border rounded-lg p-2 text-sm" value={violationForm.points} onChange={e => setViolationForm({...violationForm, points: parseInt(e.target.value)})} />
                    <textarea placeholder="Keterangan / Kronologi" className="w-full border rounded-lg p-2 text-sm h-20" value={violationForm.description} onChange={e => setViolationForm({...violationForm, description: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50">Simpan Pelanggaran</button>
                 </form>
              )}

              {activeTab === 'reductions' && (
                 <form onSubmit={handleAddReduction} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={reductionForm.date} onChange={e => setReductionForm({...reductionForm, date: e.target.value})} />
                    <input type="text" placeholder="Aktivitas (mis: Membersihkan Mushola)" required className="w-full border rounded-lg p-2 text-sm" value={reductionForm.activityName} onChange={e => setReductionForm({...reductionForm, activityName: e.target.value})} />
                    <input type="number" placeholder="Poin Dikurangi (mis: 10)" required className="w-full border rounded-lg p-2 text-sm" value={reductionForm.pointsRemoved} onChange={e => setReductionForm({...reductionForm, pointsRemoved: parseInt(e.target.value)})} />
                    <textarea placeholder="Keterangan tambahan" className="w-full border rounded-lg p-2 text-sm h-20" value={reductionForm.description} onChange={e => setReductionForm({...reductionForm, description: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50">Simpan Pengurangan</button>
                 </form>
              )}

              {activeTab === 'achievements' && (
                 <form onSubmit={handleAddAchievement} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={achievementForm.date} onChange={e => setAchievementForm({...achievementForm, date: e.target.value})} />
                    <input type="text" placeholder="Nama Prestasi / Lomba" required className="w-full border rounded-lg p-2 text-sm" value={achievementForm.title} onChange={e => setAchievementForm({...achievementForm, title: e.target.value})} />
                    <select className="w-full border rounded-lg p-2 text-sm" value={achievementForm.level} onChange={e => setAchievementForm({...achievementForm, level: e.target.value})}>
                       <option value="Sekolah">Tingkat Sekolah</option>
                       <option value="Kecamatan">Tingkat Kecamatan</option>
                       <option value="Kabupaten">Tingkat Kabupaten</option>
                       <option value="Provinsi">Tingkat Provinsi</option>
                       <option value="Nasional">Tingkat Nasional</option>
                    </select>
                    <textarea placeholder="Deskripsi (Juara 1, dll)" className="w-full border rounded-lg p-2 text-sm h-20" value={achievementForm.description} onChange={e => setAchievementForm({...achievementForm, description: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-yellow-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-yellow-600 disabled:opacity-50">Simpan Prestasi</button>
                 </form>
              )}

              {activeTab === 'counseling' && (
                 <form onSubmit={handleAddCounseling} className="space-y-3">
                    <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={counselingForm.date} onChange={e => setCounselingForm({...counselingForm, date: e.target.value})} />
                    <input type="text" placeholder="Permasalahan Utama" required className="w-full border rounded-lg p-2 text-sm" value={counselingForm.issue} onChange={e => setCounselingForm({...counselingForm, issue: e.target.value})} />
                    <textarea placeholder="Catatan Proses Konseling" required className="w-full border rounded-lg p-2 text-sm h-24" value={counselingForm.notes} onChange={e => setCounselingForm({...counselingForm, notes: e.target.value})} />
                    <textarea placeholder="Rencana Tindak Lanjut" className="w-full border rounded-lg p-2 text-sm h-16" value={counselingForm.followUp} onChange={e => setCounselingForm({...counselingForm, followUp: e.target.value})} />
                    <button type="submit" disabled={!selectedStudentId} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">Simpan Log Konseling</button>
                 </form>
              )}

              {activeTab === 'print' && (
                 <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-800">
                       Silakan pilih kelas dan nama siswa terlebih dahulu untuk menampilkan data rekam jejak lengkap.
                    </div>
                    <button 
                       onClick={handlePrint}
                       disabled={!selectedStudentId}
                       className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <Printer size={18} /> Unduh / Cetak PDF
                    </button>
                    <button 
                       onClick={handleDocExport}
                       disabled={!selectedStudentId}
                       className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <FileText size={18} /> Unduh Docx (.doc)
                    </button>
                    <button 
                       onClick={handleExcelExport}
                       disabled={!selectedStudentId}
                       className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <FileSpreadsheet size={18} /> Unduh Excel (.xlsx)
                    </button>
                 </div>
              )}
           </div>
        </div>

        {/* LIST DATA / PREVIEW (Right Column) */}
        <div className="lg:col-span-2">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">
                    {activeTab === 'print' ? 'Preview Laporan Siswa' : `Riwayat Data (${activeTab})`}
                 </h3>
                 {selectedStudentId && getStudentDisplay(selectedStudentId) && <span className="text-xs bg-white px-2 py-1 rounded border text-blue-600 font-medium">Filter: {getStudentDisplay(selectedStudentId)?.name}</span>}
              </div>
              
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                 
                 {/* PRINT PREVIEW TAB */}
                 {activeTab === 'print' && (
                    selectedStudentId && getStudentDisplay(selectedStudentId) ? (
                       <div className="p-6 space-y-6">
                          <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                             <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl">
                                {getStudentDisplay(selectedStudentId)?.name.charAt(0)}
                             </div>
                             <div>
                                <h2 className="text-xl font-bold text-gray-800">{getStudentDisplay(selectedStudentId)?.name}</h2>
                                <p className="text-gray-500">Kelas {getStudentDisplay(selectedStudentId)?.className} • NIS: {students.find(s => s.id === selectedStudentId)?.nis || '-'}</p>
                             </div>
                          </div>

                          {/* Summary Points Calculation */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex gap-6 text-sm">
                             <div>
                                <span className="text-gray-500 block text-xs">Total Pelanggaran</span>
                                <span className="font-bold text-red-600">{violations.filter(v => v.studentId === selectedStudentId).reduce((a,b)=>a+b.points,0)} Poin</span>
                             </div>
                             <div>
                                <span className="text-gray-500 block text-xs">Total Dikurangi</span>
                                <span className="font-bold text-green-600">{reductions.filter(r => r.studentId === selectedStudentId).reduce((a,b)=>a+b.pointsRemoved,0)} Poin</span>
                             </div>
                             <div className="border-l pl-6">
                                <span className="text-gray-500 block text-xs">Sisa Poin Aktif</span>
                                <span className="font-bold text-gray-800 text-lg">
                                   {Math.max(0, violations.filter(v => v.studentId === selectedStudentId).reduce((a,b)=>a+b.points,0) - reductions.filter(r => r.studentId === selectedStudentId).reduce((a,b)=>a+b.pointsRemoved,0))}
                                </span>
                             </div>
                          </div>

                          {/* Preview Sections */}
                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-red-500 pl-2">A. Pelanggaran</h4>
                             {violations.filter(v => v.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {violations.filter(v => v.studentId === selectedStudentId).map(v => (
                                      <li key={v.id}>{v.date} - {v.violationName} ({v.points} poin)</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan pelanggaran.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-green-500 pl-2">B. Pemulihan Poin</h4>
                             {reductions.filter(r => r.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {reductions.filter(r => r.studentId === selectedStudentId).map(r => (
                                      <li key={r.id}>{r.date} - {r.activityName} (-{r.pointsRemoved} poin)</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan pemulihan poin.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-yellow-500 pl-2">C. Prestasi</h4>
                             {achievements.filter(a => a.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {achievements.filter(a => a.studentId === selectedStudentId).map(a => (
                                      <li key={a.id}>{a.date} - {a.title} ({a.level})</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan prestasi.</p>}
                          </div>

                          <div>
                             <h4 className="font-bold text-gray-800 mb-2 border-l-4 border-blue-500 pl-2">D. Konseling</h4>
                             {sessions.filter(s => s.studentId === selectedStudentId).length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                   {sessions.filter(s => s.studentId === selectedStudentId).map(s => (
                                      <li key={s.id}>{s.date} - {s.issue}</li>
                                   ))}
                                </ul>
                             ) : <p className="text-sm text-gray-400 italic">Tidak ada catatan konseling.</p>}
                          </div>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                          <Search size={48} className="mb-4 opacity-20" />
                          <p>Pilih siswa di menu sebelah kiri untuk melihat preview laporan.</p>
                       </div>
                    )
                 )}

                 {/* LIST VIOLATIONS */}
                 {activeTab === 'violations' && (
                    violations.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data pelanggaran di kelas Anda.</p> :
                    violations.map(v => {
                       const stInfo = getStudentDisplay(v.studentId);
                       if (!stInfo) return null; // Skip if student not in teacher's classes
                       if (selectedStudentId && v.studentId !== selectedStudentId) return null;

                       return (
                        <div key={v.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full">{v.points} Poin</span>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium mt-1">{v.violationName}</p>
                                    <p className="text-xs text-gray-500 mt-1">{v.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-2">Pelapor: {v.reportedBy} • {v.date}</p>
                                </div>
                                <button onClick={() => handleDelete(v.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}

                 {/* LIST REDUCTIONS */}
                 {activeTab === 'reductions' && (
                    reductions.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data pengurangan poin di kelas Anda.</p> :
                    reductions.map(r => {
                       const stInfo = getStudentDisplay(r.studentId);
                       if (!stInfo) return null;
                       if (selectedStudentId && r.studentId !== selectedStudentId) return null;

                       return (
                        <div key={r.id} className="p-4 hover:bg-gray-50 border-l-4 border-green-400">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">-{r.pointsRemoved} Poin</span>
                                    </div>
                                    <p className="text-sm text-green-700 font-bold mt-1 flex items-center gap-1"><RefreshCcw size={14}/> {r.activityName}</p>
                                    <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-2">{r.date}</p>
                                </div>
                                <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}

                 {/* LIST ACHIEVEMENTS */}
                 {activeTab === 'achievements' && (
                    achievements.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada data prestasi di kelas Anda.</p> :
                    achievements.map(a => {
                       const stInfo = getStudentDisplay(a.studentId);
                       if (!stInfo) return null; // Skip if student not in teacher's classes
                       if (selectedStudentId && a.studentId !== selectedStudentId) return null;

                       return (
                        <div key={a.id} className="p-4 hover:bg-gray-50 border-l-4 border-yellow-400">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                    </div>
                                    <p className="text-sm text-yellow-700 font-bold mt-1 flex items-center gap-1"><Trophy size={14}/> {a.title}</p>
                                    <span className="inline-block bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded mt-1">{a.level}</span>
                                    <p className="text-xs text-gray-500 mt-2">{a.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{a.date}</p>
                                </div>
                                <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}

                 {/* LIST COUNSELING */}
                 {activeTab === 'counseling' && (
                    sessions.length === 0 ? <p className="p-8 text-center text-gray-400 text-sm">Belum ada sesi konseling di kelas Anda.</p> :
                    sessions.map(s => {
                       const stInfo = getStudentDisplay(s.studentId);
                       if (!stInfo) return null; // Skip if student not in teacher's classes
                       if (selectedStudentId && s.studentId !== selectedStudentId) return null;

                       return (
                        <div key={s.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stInfo.className}</span>
                                        <div className="font-bold text-gray-800">{stInfo.name}</div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Masalah</span>
                                        <p className="text-sm text-gray-700 font-medium">{s.issue}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded mt-2 border border-gray-100">
                                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{s.notes}</p>
                                    </div>
                                    {s.followUp && (
                                        <p className="text-xs text-purple-600 mt-2 font-medium">TL: {s.followUp}</p>
                                    )}
                                    <p className="text-[10px] text-gray-400 mt-2">{s.date}</p>
                                </div>
                                <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                       );
                    })
                 )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default TeacherGuidance;
