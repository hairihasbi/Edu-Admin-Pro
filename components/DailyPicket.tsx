import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getDailyPicket, saveDailyPicket, getTeachersBySchool } from '../services/database';
import PicketAttendanceTable from './PicketAttendanceTable';
import PicketIncidentForm from './PicketIncidentForm';
import { Calendar, User as UserIcon, Save, RefreshCw } from 'lucide-react';

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
                    
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <label className="text-sm font-medium text-gray-600">Tanggal:</label>
                        <input 
                            type="date" 
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                        />
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
        </div>
    );
};

export default DailyPicket;
