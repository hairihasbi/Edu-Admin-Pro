import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getDailyPicket, saveDailyPicket, getTeachersBySchool, getSchoolAttendanceSummary, getStudentIncidents, getAttendanceSummaryByRange, getIncidentsByDateRange } from '../services/database';
import PicketAttendanceTable from './PicketAttendanceTable';
import PicketIncidentForm from './PicketIncidentForm';
import { Calendar, User as UserIcon, Save, RefreshCw, Printer, FileText } from 'lucide-react';

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
            const year = printSemester === 'GANJIL' ? printYear : printYear + 1; 
            
            startDate = new Date(year, startMonth, 1).toISOString().split('T')[0];
            endDate = new Date(year, endMonth + 1, 0).toISOString().split('T')[0];
            
            title = `Laporan Semester ${printSemester} Piket - Tahun Ajaran ${printYear}/${printYear+1}`;
        } else {
            title = `Laporan Harian Piket - ${new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
        }

        // Fetch Data based on Tab
        if (activeTab === 'ATTENDANCE') {
            subtitle = 'Rekapitulasi Absensi Siswa';
            
            let summary;
            if (printPeriod === 'DAILY') {
                summary = await getSchoolAttendanceSummary(date, currentUser.schoolNpsn || '');
            } else {
                summary = await getAttendanceSummaryByRange(startDate, endDate, currentUser.schoolNpsn || '');
            }

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
                total: s.studentCount, // Note: In range summary, totalRecords might be more relevant, but keeping studentCount for consistency
                ket: s.absentDetails.map((d: any) => `${d.name} (${d.status})`).join(', ') || '-'
            }));

        } else {
            subtitle = 'Laporan Kejadian Siswa (Terlambat/Pulang)';
            
            let incidents;
            if (printPeriod === 'DAILY') {
                if (!picketId) {
                    alert('Belum ada data piket untuk tanggal ini.');
                    return;
                }
                incidents = await getStudentIncidents(picketId);
            } else {
                incidents = await getIncidentsByDateRange(startDate, endDate, currentUser.schoolNpsn || '');
            }

            columns = [
                { header: 'No', dataKey: 'no' },
                { header: 'Tanggal', dataKey: 'date' },
                { header: 'Nama Siswa', dataKey: 'name' },
                { header: 'Kelas', dataKey: 'class' },
                { header: 'Jam', dataKey: 'time' },
                { header: 'Jenis', dataKey: 'type' },
                { header: 'Alasan', dataKey: 'reason' },
            ];
            
            dataToPrint = incidents.map((inc, i) => ({
                no: i + 1,
                date: (inc as any).date ? new Date((inc as any).date).toLocaleDateString('id-ID') : new Date(date).toLocaleDateString('id-ID'),
                name: inc.studentName,
                class: inc.className,
                time: inc.time,
                type: inc.type === 'LATE' ? 'Terlambat' : inc.type === 'PERMIT_EXIT' ? 'Izin Keluar' : 'Pulang Cepat',
                reason: inc.reason || '-'
            }));
        }

        // Generate HTML for Print
        const printWindow = window.open('', '', 'height=600,width=900');
        if (!printWindow) return;

        const tableHeaders = columns.map(c => `<th>${c.header}</th>`).join('');
        const tableRows = dataToPrint.map(row => `
            <tr>
                ${columns.map(c => `<td class="${['no','sakit','izin','alfa','hadir','total','date','time'].includes(c.dataKey) ? 'text-center' : ''}">${row[c.dataKey]}</td>`).join('')}
            </tr>
        `).join('');

        const officerList = activeTab === 'ATTENDANCE' && printPeriod === 'DAILY' ? `<p><strong>Petugas:</strong> ${officers.join(', ')}</p>` : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: sans-serif; font-size: 12px; color: #333; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                        h3 { margin: 5px 0; font-size: 14px; font-weight: normal; }
                        h4 { margin: 5px 0; font-size: 12px; font-weight: normal; font-style: italic; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #444; padding: 6px 8px; text-align: left; }
                        th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
                        .text-center { text-align: center; }
                        .footer { margin-top: 30px; font-size: 10px; text-align: right; color: #666; }
                        @media print {
                            body { margin: 0; padding: 10px; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>${schoolName}</h2>
                        <h3>${title}</h3>
                        <h4>${subtitle}</h4>
                    </div>
                    
                    ${officerList}

                    <table>
                        <thead>
                            <tr>${tableHeaders}</tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>

                    <div class="footer">
                        Dicetak pada: ${new Date().toLocaleString('id-ID')}
                    </div>

                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
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
