import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getDailyPicket, saveDailyPicket, getTeachersBySchool, getSchoolAttendanceSummary, getStudentIncidents } from '../services/database';
import PicketAttendanceTable from './PicketAttendanceTable';
import PicketIncidentForm from './PicketIncidentForm';
import { Calendar, User as UserIcon, Save, RefreshCw, Printer, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyPicketProps {
    currentUser: User;
}

const DailyPicket: React.FC<DailyPicketProps> = ({ currentUser }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'INCIDENTS'>('ATTENDANCE');
    const [officers, setOfficers] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [teachers, setTeachers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [picketId, setPicketId] = useState<string | null>(null);

    // PDF Filter State
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printPeriod, setPrintPeriod] = useState<'DAILY' | 'MONTHLY' | 'SEMESTER'>('DAILY');
    const [printMonth, setPrintMonth] = useState(new Date().getMonth());
    const [printYear, setPrintYear] = useState(new Date().getFullYear());
    const [printSemester, setPrintSemester] = useState<'GANJIL' | 'GENAP'>('GANJIL');

    useEffect(() => {
        loadTeachers();
    }, [currentUser.schoolNpsn]);

    useEffect(() => {
        loadPicketData();
    }, [date, currentUser.schoolNpsn]);

    const loadTeachers = async () => {
        if (currentUser.schoolNpsn) {
            const data = await getTeachersBySchool(currentUser.schoolNpsn);
            setTeachers(data);
        }
    };

    const loadPicketData = async () => {
        setIsLoading(true);
        const data = await getDailyPicket(date, currentUser.schoolNpsn || '');
        if (data) {
            setPicketId(data.id);
            setOfficers(data.officers || []);
            setNotes(data.notes || '');
        } else {
            setPicketId(null);
            // Auto-select current user if no data exists yet
            setOfficers([currentUser.fullName]);
            setNotes('');
        }
        setIsLoading(false);
    };

    const handleSavePicketInfo = async () => {
        if (!currentUser.schoolNpsn) return;
        setIsSaving(true);
        try {
            const saved = await saveDailyPicket(date, currentUser.schoolNpsn, officers, notes);
            setPicketId(saved.id);
            alert('Data Piket Berhasil Disimpan!');
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan data piket.');
        }
        setIsSaving(false);
    };

    const toggleOfficer = (teacherName: string) => {
        if (officers.includes(teacherName)) {
            setOfficers(officers.filter(o => o !== teacherName));
        } else {
            setOfficers([...officers, teacherName]);
        }
    };

    const handlePrint = async () => {
        setShowPrintModal(false);
        const doc = new jsPDF();
        const schoolName = currentUser.schoolName || 'Sekolah';
        
        let title = '';
        let subtitle = '';
        let dataToPrint: any[] = [];
        let columns: any[] = [];

        // Determine Date Range
        let startDate = date;
        let endDate = date;

        if (printPeriod === 'MONTHLY') {
            const firstDay = new Date(printYear, printMonth, 1);
            const lastDay = new Date(printYear, printMonth + 1, 0);
            startDate = firstDay.toISOString().split('T')[0];
            endDate = lastDay.toISOString().split('T')[0];
            title = `Laporan Bulanan Piket - ${new Date(printYear, printMonth).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
        } else if (printPeriod === 'SEMESTER') {
            const startMonth = printSemester === 'GANJIL' ? 6 : 0; // July or Jan
            const endMonth = printSemester === 'GANJIL' ? 11 : 5; // Dec or June
            const year = printSemester === 'GANJIL' ? printYear : printYear + 1; // Adjust year logic if needed
            startDate = new Date(year, startMonth, 1).toISOString().split('T')[0];
            endDate = new Date(year, endMonth + 1, 0).toISOString().split('T')[0];
            title = `Laporan Semester ${printSemester} Piket - Tahun Ajaran ${printYear}/${printYear+1}`;
        } else {
            title = `Laporan Harian Piket - ${new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
        }

        // Fetch Data based on Tab
        if (activeTab === 'ATTENDANCE') {
            subtitle = 'Rekapitulasi Absensi Siswa';
            // For daily, we use existing logic. For monthly/semester, we need aggregation (simplified here to fetch daily for now)
            // NOTE: Aggregating monthly attendance is complex. For now, we print the CURRENT DAY summary if DAILY is selected.
            // If MONTHLY/SEMESTER, we should ideally loop through dates, but that's heavy.
            // Let's implement DAILY print first for Attendance as it's the most common use case.
            
            if (printPeriod !== 'DAILY') {
                alert('Saat ini cetak rekap absensi hanya tersedia untuk Harian.');
                return;
            }

            const summary = await getSchoolAttendanceSummary(date, currentUser.schoolNpsn || '');
            columns = [
                { header: 'No', dataKey: 'no' },
                { header: 'Kelas', dataKey: 'className' },
                { header: 'Sakit', dataKey: 'sakit' },
                { header: 'Izin', dataKey: 'izin' },
                { header: 'Alfa', dataKey: 'alfa' },
                { header: 'Hadir', dataKey: 'hadir' },
                { header: 'Total', dataKey: 'total' },
                { header: 'Ket. Tidak Hadir', dataKey: 'ket' },
            ];
            dataToPrint = summary.map((s, i) => ({
                no: i + 1,
                className: s.className,
                sakit: s.sakit,
                izin: s.izin,
                alfa: s.alfa,
                hadir: s.hadir,
                total: s.studentCount,
                ket: s.absentDetails.map((d: any) => `${d.name} (${d.status})`).join(', ') || '-'
            }));

        } else {
            subtitle = 'Laporan Kejadian Siswa (Terlambat/Pulang)';
            // For incidents, we can fetch range easily
            // We need a range query for incidents. Currently we only have getStudentIncidents by picketId.
            // We need to fetch pickets in range first, then their incidents.
            
            // 1. Get Pickets in Range
            // This requires a new DB query: getPicketsByDateRange. 
            // For now, let's implement DAILY.
             if (printPeriod !== 'DAILY') {
                alert('Saat ini cetak kejadian siswa hanya tersedia untuk Harian.');
                return;
            }

            if (!picketId) {
                alert('Belum ada data piket untuk tanggal ini.');
                return;
            }

            const incidents = await getStudentIncidents(picketId);
            columns = [
                { header: 'No', dataKey: 'no' },
                { header: 'Nama Siswa', dataKey: 'name' },
                { header: 'Kelas', dataKey: 'class' },
                { header: 'Jam', dataKey: 'time' },
                { header: 'Jenis', dataKey: 'type' },
                { header: 'Alasan', dataKey: 'reason' },
            ];
            dataToPrint = incidents.map((inc, i) => ({
                no: i + 1,
                name: inc.studentName,
                class: inc.className,
                time: inc.time,
                type: inc.type === 'LATE' ? 'Terlambat' : inc.type === 'PERMIT_EXIT' ? 'Izin Keluar' : 'Pulang Cepat',
                reason: inc.reason || '-'
            }));
        }

        // Generate PDF
        doc.setFontSize(14);
        doc.text(schoolName, 14, 15);
        doc.setFontSize(12);
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(subtitle, 14, 28);
        
        if (activeTab === 'ATTENDANCE') {
             doc.text(`Petugas: ${officers.join(', ')}`, 14, 34);
        }

        autoTable(doc, {
            startY: 40,
            head: [columns.map(c => c.header)],
            body: dataToPrint.map(row => columns.map(c => row[c.dataKey])),
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 2 },
        });

        // Footer
        const finalY = (doc as any).lastAutoTable.finalY || 40;
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, finalY + 10);
        
        doc.save(`Laporan_Piket_${activeTab}_${date}.pdf`);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-blue-600" />
                            Piket Harian
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Pencatatan kondisi harian sekolah & rekapitulasi siswa.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         {/* Print Button */}
                        <button 
                            onClick={() => setShowPrintModal(true)}
                            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                        >
                            <Printer size={16} /> Cetak Laporan
                        </button>

                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                            <label className="text-sm font-medium text-gray-600">Tanggal:</label>
                            <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                            />
                        </div>
                    </div>
                </div>

                {/* Petugas Piket Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2"><UserIcon size={16} /> Petugas Piket Hari Ini</span>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            Data ini terlihat oleh semua guru di sekolah Anda
                        </span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                        {teachers.map(teacher => (
                            <div 
                                key={teacher.id}
                                onClick={() => toggleOfficer(teacher.fullName)}
                                className={`cursor-pointer px-3 py-2 rounded-md text-sm border transition-all ${
                                    officers.includes(teacher.fullName)
                                    ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {teacher.fullName}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Catatan Harian */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Harian / Kejadian Penting</label>
                    <textarea 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                        placeholder="Tulis catatan umum mengenai kondisi sekolah hari ini..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleSavePicketInfo}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                        Simpan Data Piket
                    </button>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('ATTENDANCE')}
                        className={`${
                            activeTab === 'ATTENDANCE'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        Rekap Absensi Siswa
                    </button>
                    <button
                        onClick={() => setActiveTab('INCIDENTS')}
                        className={`${
                            activeTab === 'INCIDENTS'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        Kejadian Siswa (Terlambat/Pulang)
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
                {activeTab === 'ATTENDANCE' ? (
                    <PicketAttendanceTable date={date} schoolNpsn={currentUser.schoolNpsn || ''} />
                ) : (
                    picketId ? (
                        <PicketIncidentForm picketId={picketId} schoolNpsn={currentUser.schoolNpsn || ''} />
                    ) : (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="mb-2">Data Piket Belum Disimpan.</p>
                            <p className="text-sm">Silakan simpan data petugas piket terlebih dahulu di bagian atas untuk mulai mencatat kejadian siswa.</p>
                        </div>
                    )
                )}
            </div>

            {/* Print Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Printer size={20} /> Cetak Laporan Piket
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Periode Laporan</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                        onClick={() => setPrintPeriod('DAILY')}
                                        className={`px-3 py-2 text-sm rounded-lg border ${printPeriod === 'DAILY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        Harian
                                    </button>
                                    <button 
                                        onClick={() => setPrintPeriod('MONTHLY')}
                                        className={`px-3 py-2 text-sm rounded-lg border ${printPeriod === 'MONTHLY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        Bulanan
                                    </button>
                                    <button 
                                        onClick={() => setPrintPeriod('SEMESTER')}
                                        className={`px-3 py-2 text-sm rounded-lg border ${printPeriod === 'SEMESTER' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        Semester
                                    </button>
                                </div>
                            </div>

                            {printPeriod === 'DAILY' && (
                                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                                    Laporan akan dicetak untuk tanggal: <strong>{new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                                </div>
                            )}

                            {printPeriod === 'MONTHLY' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Bulan</label>
                                        <select 
                                            value={printMonth} 
                                            onChange={(e) => setPrintMonth(parseInt(e.target.value))}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        >
                                            {Array.from({length: 12}, (_, i) => (
                                                <option key={i} value={i}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tahun</label>
                                        <input 
                                            type="number" 
                                            value={printYear} 
                                            onChange={(e) => setPrintYear(parseInt(e.target.value))}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {printPeriod === 'SEMESTER' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Semester</label>
                                        <select 
                                            value={printSemester} 
                                            onChange={(e) => setPrintSemester(e.target.value as any)}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        >
                                            <option value="GANJIL">Ganjil (Juli - Des)</option>
                                            <option value="GENAP">Genap (Jan - Juni)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tahun Ajaran Awal</label>
                                        <input 
                                            type="number" 
                                            value={printYear} 
                                            onChange={(e) => setPrintYear(parseInt(e.target.value))}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setShowPrintModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={handlePrint}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <FileText size={16} /> Download PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyPicket;
