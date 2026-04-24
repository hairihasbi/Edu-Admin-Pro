import React, { useEffect, useRef, useState } from 'react';
import { QrCode, X, RefreshCcw, Smartphone } from './Icons';

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Note: Using a dedicated QR library like jsQR or html5-qrcode is recommended
  // For this implementation, we assume the user might use a camera-based scanner
  // But often in kiosk mode, they use specialized hardware USB scanners that act as Keyboards.
  // If they want Camera Scanning, we typically need a library. 
  // Let's provide a UI placeholder that explains how to use it with the current Keyboard logic
  // or how to integrate with a camera library.

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-6">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
      >
        <X size={24} />
      </button>

      <div className="max-w-md w-full text-center space-y-8">
        <div className="relative aspect-square w-full max-w-[320px] mx-auto overflow-hidden rounded-3xl border-4 border-white/20">
          {/* Scanner UI Overlay */}
          <div className="absolute inset-0 z-10 border-[40px] border-black/40">
            <div className="w-full h-full border-4 border-blue-500 rounded-xl relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-8 border-l-8 border-blue-400 -m-2"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-8 border-r-8 border-blue-400 -m-2"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-8 border-l-8 border-blue-400 -m-2"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-8 border-r-8 border-blue-400 -m-2"></div>
              
              <div className="absolute inset-x-0 h-1 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line"></div>
            </div>
          </div>

          <div className="bg-gray-800 w-full h-full flex flex-col items-center justify-center text-white/50 p-8">
            <QrCode size={80} className="mb-4 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest text-center">
              Gunakan Scanner Hardware Kiosk<br/>
              atau<br/>
              Kamera Perangkat
            </p>
          </div>
        </div>

        <div className="space-y-4 text-white">
          <h2 className="text-2xl font-black tracking-tighter uppercase">SCAN KODE QR</h2>
          <p className="text-sm opacity-70">
            Posisikan Kode QR siswa di dalam kotak scanner.<br/>
            Pastikan pencahayaan cukup terang.
          </p>
        </div>

        <div className="pt-8 flex flex-col gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 text-left">
            <Smartphone className="text-blue-400" size={24} />
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Status Device</p>
              <p className="text-xs font-bold text-gray-200">Menunggu Input Keyboard (HID) atau Serial</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition"
          >
            KEMBALI KE TERMINAL
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}} />
    </div>
  );
};

export default QrScanner;
