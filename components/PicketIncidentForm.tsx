import React, { useState, useEffect } from 'react';
import { StudentIncident } from '../types';
import { getAvailableClassesForHomeroom, addStudentIncident, deleteStudentIncident, getStudentIncidents } from '../services/database';
import { Trash2, Plus, Clock, User, School } from './Icons';

interface PicketIncidentFormProps {
    picketId: string;
    schoolNpsn: string;
}

const PicketIncidentForm: React.FC<PicketIncidentFormProps> = ({ picketId, schoolNpsn }) => {
    const [incidents, setIncidents] = useState<StudentIncident[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [studentName, setStudentName] = useState('');
    const [className, setClassName] = useState('');
    const [time, setTime] = useState('');
    const [type, setType] = useState<'LATE' | 'PERMIT_EXIT' | 'EARLY_HOME'>('LATE');
    const [reason, setReason] = useState('');

    useEffect(() => {
        loadData();
    }, [picketId, schoolNpsn]);

    const loadData = async () => {
        setIsLoading(true);
        const [incidentsData, classesData] = await Promise.all([
            getStudentIncidents(picketId),
            getAvailableClassesForHomeroom(schoolNpsn)
        ]);
        setIncidents(incidentsData);
        setClasses(classesData);
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName || !className || !time) return;

        const newItem = await addStudentIncident(picketId, {
            studentName,
            className,
            time,
            type,
            reason
        });

        setIncidents([...incidents, newItem]);
        
        // Reset Form
        setStudentName('');
        setReason('');
        // Keep class and time for faster entry if needed
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Hapus data kejadian ini?')) {
            await deleteStudentIncident(id);
            setIncidents(incidents.filter(i => i.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            {/* Input Form */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Plus size={18} /> Tambah Kejadian Siswa
                </h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="lg:col-span-2">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Nama Siswa</label>
                        <input 
                            type="text" 
                            required
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="Nama Lengkap..."
                            value={studentName}
                            onChange={e => setStudentName(e.target.value)}
                        />
                    </div>
                    
                    <div className="lg:col-span-1">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Kelas</label>
                        <select 
                            required
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={className}
                            onChange={e => setClassName(e.target.value)}
                        >
                            <option value="">Pilih Kelas</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="lg:col-span-1">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Jam</label>
                        <input 
                            type="time" 
                            required
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                        />
                    </div>

                    <div className="lg:col-span-1">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Keterangan</label>
                        <select 
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={type}
                            onChange={e => setType(e.target.value as any)}
                        >
                            <option value="LATE">Terlambat</option>
                            <option value="PERMIT_EXIT">Izin Keluar</option>
                            <option value="EARLY_HOME">Pulang Cepat</option>
                        </select>
                    </div>

                    <div className="lg:col-span-1">
                        <button 
                            type="submit" 
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium"
                        >
                            Simpan
                        </button>
                    </div>
                </form>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center">No</th>
                            <th className="px-4 py-3">Nama Siswa</th>
                            <th className="px-4 py-3">Kelas</th>
                            <th className="px-4 py-3 w-24 text-center">Jam</th>
                            <th className="px-4 py-3 w-32 text-center">Status</th>
                            <th className="px-4 py-3 text-right w-20">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {incidents.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">
                                    Belum ada data kejadian hari ini.
                                </td>
                            </tr>
                        ) : (
                            incidents.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{item.studentName}</td>
                                    <td className="px-4 py-3 text-gray-600">{item.className}</td>
                                    <td className="px-4 py-3 text-center font-mono text-gray-600 bg-gray-50 rounded mx-2">{item.time}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            item.type === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
                                            item.type === 'PERMIT_EXIT' ? 'bg-blue-100 text-blue-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {item.type === 'LATE' ? 'Terlambat' : 
                                             item.type === 'PERMIT_EXIT' ? 'Izin Keluar' : 'Pulang Cepat'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                                            title="Hapus Data"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PicketIncidentForm;
