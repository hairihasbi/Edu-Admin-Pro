import React, { useState, useEffect } from 'react';
import { getSchoolAttendanceSummary } from '../services/database';

interface PicketAttendanceTableProps {
    date: string;
    schoolNpsn: string;
}

const PicketAttendanceTable: React.FC<PicketAttendanceTableProps> = ({ date, schoolNpsn }) => {
    const [summary, setSummary] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (date && schoolNpsn) {
            loadData();
        }
    }, [date, schoolNpsn]);

    const loadData = async () => {
        setIsLoading(true);
        const data = await getSchoolAttendanceSummary(date, schoolNpsn);
        setSummary(data);
        setIsLoading(false);
    };

    if (isLoading) return <div className="p-4 text-center text-gray-500">Memuat data absensi...</div>;

    if (summary.length === 0) {
        return (
            <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500">Belum ada data kelas atau absensi untuk tanggal ini.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border border-gray-300 px-3 py-2 text-center w-12">No</th>
                        <th className="border border-gray-300 px-3 py-2 text-left">Kelas</th>
                        <th className="border border-gray-300 px-3 py-2 text-center w-16 bg-red-50 text-red-700">Sakit</th>
                        <th className="border border-gray-300 px-3 py-2 text-center w-16 bg-yellow-50 text-yellow-700">Izin</th>
                        <th className="border border-gray-300 px-3 py-2 text-center w-16 bg-gray-50 text-gray-700">Alfa</th>
                        <th className="border border-gray-300 px-3 py-2 text-center w-16 bg-green-50 text-green-700">Hadir</th>
                        <th className="border border-gray-300 px-3 py-2 text-center w-16 font-bold">Total</th>
                        <th className="border border-gray-300 px-3 py-2 text-left">Siswa Tidak Hadir</th>
                    </tr>
                </thead>
                <tbody>
                    {summary.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 font-medium">{row.className}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-red-600">{row.sakit}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-yellow-600">{row.izin}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-600">{row.alfa}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-green-600">{row.hadir}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold">{row.studentCount}</td>
                            <td className="border border-gray-300 px-3 py-2 text-xs text-gray-600">
                                {row.absentDetails.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                        {row.absentDetails.map((s: any, i: number) => (
                                            <li key={i}>
                                                <span className="font-medium">{s.name}</span> 
                                                <span className={`ml-1 text-[10px] px-1 rounded ${
                                                    s.status === 'S' ? 'bg-red-100 text-red-700' :
                                                    s.status === 'I' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-200 text-gray-700'
                                                }`}>
                                                    ({s.status})
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <span className="text-gray-400 italic">- Nihil -</span>}
                            </td>
                        </tr>
                    ))}
                    {/* Grand Total Row */}
                    <tr className="bg-gray-100 font-bold">
                        <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right">TOTAL KESELURUHAN</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{summary.reduce((a, b) => a + b.sakit, 0)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{summary.reduce((a, b) => a + b.izin, 0)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{summary.reduce((a, b) => a + b.alfa, 0)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{summary.reduce((a, b) => a + b.hadir, 0)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{summary.reduce((a, b) => a + b.studentCount, 0)}</td>
                        <td className="border border-gray-300 px-3 py-2 bg-gray-200"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default PicketAttendanceTable;
