import React, { useState, useRef } from 'react';
import { Student, ClassRoom, User } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Printer, Info, Search, Filter, Download, Image as ImageIcon, Loader2 } from './Icons';
import { toJpeg, toPng } from 'html-to-image';
import { saveAs } from 'file-saver';

interface StudentQrGeneratorProps {
  students: Student[];
  classes: ClassRoom[];
  user: User;
}

const StudentQrGenerator: React.FC<StudentQrGeneratorProps> = ({ students, classes, user }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClassId === 'ALL' || s.classId === selectedClassId;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         s.nis.includes(searchQuery);
    return matchesClass && matchesSearch;
  });

  const handlePrint = () => {
    window.print();
  };

  const downloadCard = async (student: Student, format: 'png' | 'jpg') => {
    const cardElement = cardRefs.current[student.id];
    if (!cardElement) return;

    try {
      setIsDownloading(student.id);
      
      const options = {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      };

      let dataUrl;
      if (format === 'png') {
        dataUrl = await toPng(cardElement, options);
      } else {
        dataUrl = await toJpeg(cardElement, options);
      }

      saveAs(dataUrl, `QR_${student.name.replace(/\s+/g, '_')}_${student.nis}.${format}`);
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Gagal mengunduh gambar. Silakan coba lagi.');
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <QrCode size={20} className="text-blue-600" />
              Generator Kode QR Siswa
            </h3>
            <p className="text-xs text-gray-500">
              Cetak atau unduh kode QR sebagai identitas digital siswa.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={handlePrint}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition shadow-lg hover:shadow-blue-200"
            >
              <Printer size={18} /> CETAK KARTU QR
            </button>
          </div>
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

        <div id="print-area" className="p-6 print:p-0 print:absolute print:top-0 print:left-0 print:w-full print:flex print:flex-col print:items-center">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200 print:hidden">
              Data siswa tidak ditemukan.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:flex print:flex-wrap print:justify-center print:gap-4 print:max-w-[190mm]">
              {filteredStudents.map((student) => {
                const className = classes.find(c => c.id === student.classId)?.name || '-';
                return (
                  <div key={student.id} className="relative group">
                    <div 
                      ref={el => cardRefs.current[student.id] = el}
                      className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-row items-center transition-all group-hover:shadow-md print:shadow-none print:border print:border-gray-300 print:rounded-none print:w-[8.5cm] print:h-[5.5cm] print:flex print:flex-row print:items-center print:m-0 print:break-inside-avoid print:p-6 print:text-left print:relative overflow-hidden w-full max-w-[400px] mx-auto sm:mx-0"
                    >
                      {/* Brand Header for Download/Print */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 print:hidden hidden"></div>

                      {/* QR Code Container */}
                      <div className="shrink-0 flex items-center justify-center mr-6">
                        <QRCodeSVG 
                          value={student.rfidTag || student.nis} 
                          size={120}
                          level="H"
                          includeMargin={false}
                          className="print:w-[3.5cm] print:h-[3.5cm]"
                        />
                      </div>
                      
                      {/* Name and Info Container */}
                      <div className="flex-1 text-left min-w-0">
                        {/* School Info */}
                        <div className="mb-3 border-b border-gray-100 pb-1">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-tight truncate">{user.schoolName}</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">KARTU IDENTITAS DIGITAL</p>
                        </div>
                        
                        {/* Student Details */}
                        <div className="space-y-0.5">
                          <h4 className="font-black text-gray-900 text-sm leading-tight uppercase truncate">
                            {student.name}
                          </h4>
                          <p className="text-xs font-black text-blue-600 uppercase tracking-tighter">{className}</p>
                          <p className="text-[10px] text-gray-500 font-medium">NIS: <span className="font-mono">{student.nis}</span></p>
                        </div>
                        
                        {/* Bottom Instruction */}
                        <div className="mt-4 pt-2 border-t border-gray-50">
                          <p className="text-[7px] text-gray-400 italic leading-tight">Scan QR ini untuk absensi kehadiran di terminal sekolah.</p>
                        </div>
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl print:hidden">
                      {isDownloading === student.id ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="animate-spin text-blue-600" size={24} />
                          <p className="text-[10px] font-bold text-blue-600">MENGUNDUH...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 p-4 w-full">
                          <p className="text-[10px] font-black text-gray-800 mb-2 border-b pb-1 text-center">UNDUH GAMBAR</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => downloadCard(student, 'png')}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-700 transition"
                            >
                              <Download size={14} /> PNG
                            </button>
                            <button 
                              onClick={() => downloadCard(student, 'jpg')}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-lg text-[10px] font-black hover:bg-orange-700 transition"
                            >
                              <ImageIcon size={14} /> JPG
                            </button>
                          </div>
                        </div>
                      )}
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
              <li>Kode QR ini kompatibel dengan semua jenis Barcode/QR Scanner HID atau Kamera.</li>
              <li>Pastikan pengaturan "Background Graphics" dicentang saat mencetak jika menggunakan warna.</li>
            </ul>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          /* Hide app chrome */
          nav, aside, header, footer, [role="navigation"], .sidebar, button {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
};

export default StudentQrGenerator;
