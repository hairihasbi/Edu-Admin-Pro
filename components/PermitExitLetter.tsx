import React, { useState, useEffect } from 'react';
import { StudentIncident, User } from '../types';
import { getStudentIncidents } from '../services/database';
import { Printer } from 'lucide-react';

interface PermitExitLetterProps {
    picketId: string;
    currentUser: User;
    date: string;
}

const PermitExitLetter: React.FC<PermitExitLetterProps> = ({ picketId, currentUser, date }) => {
    const [incidents, setIncidents] = useState<StudentIncident[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [picketId]);

    const loadData = async () => {
        setIsLoading(true);
        const data = await getStudentIncidents(picketId);
        setIncidents(data.filter(i => i.type === 'PERMIT_EXIT'));
        setIsLoading(false);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'height=600,width=900');
        if (!printWindow) return;

        const schoolName = currentUser.schoolName || 'Sekolah';
        const npsn = currentUser.schoolNpsn || '-';
        
        // Format date to Indonesian format
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const tableRows = incidents.map((inc, i) => `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td>${inc.studentName}</td>
                <td>${inc.className}</td>
                <td>${inc.reason || '-'}</td>
                <td class="text-center">${inc.time}</td>
                <td class="text-center">${inc.returnTime || '-'}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Surat Izin Keluar</title>
                    <style>
                        body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; line-height: 1.5; padding: 40px; }
                        .header-text { margin-bottom: 20px; text-align: justify; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
                        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                        th { font-weight: bold; text-align: center; }
                        .text-center { text-align: center; }
                        .footer-text { margin-bottom: 40px; text-align: justify; }
                        .signature-container { display: flex; justify-content: flex-end; margin-top: 40px; }
                        .signature-box { text-align: center; width: 250px; }
                        .signature-space { height: 80px; }
                        @media print {
                            body { margin: 0; padding: 20px; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header-text">
                        Yang bertanda tangan di bawah ini guru piket harian ${schoolName} (NPSN: ${npsn}), dengan ini memberikan izin keluar kepada:
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%">No</th>
                                <th style="width: 25%">Nama Siswa</th>
                                <th style="width: 15%">Kelas</th>
                                <th style="width: 30%">Alasan Izin Keluar</th>
                                <th style="width: 12.5%">Jam Keluar</th>
                                <th style="width: 12.5%">Jam Kembali</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows || '<tr><td colspan="6" class="text-center">Tidak ada data izin keluar</td></tr>'}
                        </tbody>
                    </table>

                    <div class="footer-text">
                        Demikian surat izin ini diberikan untuk dapat dipergunakan sebagaimana mestinya.
                    </div>

                    <div class="signature-container">
                        <div class="signature-box">
                            <p>Banjarbaru, ${formattedDate}</p>
                            <p>Guru Piket</p>
                            <div class="signature-space"></div>
                            <p>(.............................................)</p>
                        </div>
                    </div>

                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (isLoading) {
        return <div className="text-center py-8 text-gray-500">Memuat data...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">Surat Izin Keluar</h3>
                <button 
                    onClick={handlePrint}
                    disabled={incidents.length === 0}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Printer size={16} /> Cetak Surat Izin
                </button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center">No</th>
                            <th className="px-4 py-3">Nama Siswa</th>
                            <th className="px-4 py-3">Kelas</th>
                            <th className="px-4 py-3">Alasan Izin Keluar</th>
                            <th className="px-4 py-3 w-24 text-center">Jam Keluar</th>
                            <th className="px-4 py-3 w-24 text-center">Jam Kembali</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {incidents.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">
                                    Belum ada data izin keluar hari ini.
                                </td>
                            </tr>
                        ) : (
                            incidents.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{item.studentName}</td>
                                    <td className="px-4 py-3 text-gray-600">{item.className}</td>
                                    <td className="px-4 py-3 text-gray-600">{item.reason || '-'}</td>
                                    <td className="px-4 py-3 text-center font-mono text-gray-600 bg-gray-50 rounded mx-2">{item.time}</td>
                                    <td className="px-4 py-3 text-center font-mono text-gray-600 bg-gray-50 rounded mx-2">{item.returnTime || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PermitExitLetter;
