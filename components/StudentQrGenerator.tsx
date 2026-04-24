import React, { useState } from 'react';
import { Student, ClassRoom } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Printer, Info, Search, Filter } from './Icons';

interface StudentQrGeneratorProps {
  students: Student[];
  classes: ClassRoom[];
}

const StudentQrGenerator: React.FC<StudentQrGeneratorProps> = ({ students, classes }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClassId === 'ALL' || s.classId === selectedClassId;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         s.nis.includes(searchQuery);
    return matchesClass && matchesSearch;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <QrCode size={20} className="text-blue-600" />
              Generator Kode QR Siswa
            </h3>
            <p className="text-xs text-gray-500">
              Cetak kode QR sebagai identitas digital siswa.
            </p>
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition shadow-md"
          >
            <Printer size={16} /> Cetak Kartu QR
          </button>
        </div>

        {/* Filters - Hidden on Print */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-4 print:hidden">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Cari nama atau NIS..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              <Filter size={16} className="text-gray-400 shrink-0" />
              <button
                onClick={() => setSelectedClassId('ALL')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition ${selectedClassId === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
              >
                SEMUA KELAS
              </button>
              {classes.sort((a,b) => a.name.localeCompare(b.name)).map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition ${selectedClassId === cls.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
                >
                  {cls.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200 print:hidden">
              Data siswa tidak ditemukan.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 print:grid-cols-4 print:gap-4">
              {filteredStudents.map((student) => {
                const className = classes.find(c => c.id === student.classId)?.name || '-';
                return (
                  <div key={student.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center text-center group transition-all hover:shadow-md print:shadow-none print:border print:border-gray-200">
                    <div className="mb-3 p-2 bg-white rounded-lg">
                      <QRCodeSVG 
                        value={student.rfidTag || student.nis} 
                        size={100}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-900 text-[11px] leading-tight line-clamp-2 uppercase h-8 flex items-center justify-center">
                        {student.name}
                      </h4>
                      <p className="text-[9px] font-black text-blue-600">{className}</p>
                      <p className="text-[9px] text-gray-400 font-mono">NIS: {student.nis}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 bg-blue-50 border-t border-blue-100 flex gap-3 text-blue-800 text-xs print:hidden">
          <Info size={18} className="shrink-0" />
          <div>
            <p className="font-bold mb-1 uppercase tracking-tighter">Petunjuk Pencetakan:</p>
            <ul className="list-disc ml-4 space-y-1 opacity-80 text-[10px]">
              <li>Gunakan kertas sticker atau kertas kartu untuk hasil terbaik.</li>
              <li>Kode QR ini kompatibel dengan semua jenis Barcode/QR Scanner HID.</li>
              <li>Siswa dapat membawa versi cetak atau menunjukkan di HP untuk absensi.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQrGenerator;
