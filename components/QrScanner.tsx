import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { QrCode, X, RefreshCcw, Smartphone, Camera } from './Icons';

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader";

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(scannerId);
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // Prioritize back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            // Success
            onScan(decodedText);
            stopScanner();
          },
          (errorMessage: string) => {
            // parse error, ignore it
          }
        );
        setIsScanning(true);
      } catch (err: any) {
        console.error("Camera error:", err);
        setError("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Stop error:", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-6">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90"
      >
        <X size={24} />
      </button>

      <div className="max-w-md w-full text-center space-y-8">
        <div className="relative aspect-square w-full max-w-[340px] mx-auto overflow-hidden rounded-[40px] border-4 border-white/10 bg-black shadow-2xl">
          {/* QR Scanner Container */}
          <div id={scannerId} className="w-full h-full overflow-hidden"></div>
          
          {/* Custom Overlay */}
          {!error && (
            <div className="absolute inset-x-0 h-1 bg-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,1)] animate-scan-line z-20"></div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/80 text-white z-30">
              <Camera size={48} className="text-red-500 mb-4" />
              <p className="text-sm font-bold">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 px-4 py-2 bg-white text-black text-xs font-black rounded-lg"
              >
                REFRESH HALAMAN
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4 text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 rounded-full text-[10px] font-black tracking-widest animate-pulse">
            <RefreshCcw size={12} className="animate-spin" />
            SCANNING ACTIVE
          </div>
          <h2 className="text-3xl font-black tracking-tighter uppercase">SCAN KODE QR</h2>
          <p className="text-sm opacity-60 max-w-xs mx-auto">
            Arahkan kamera ke Kode QR siswa. Pastikan kode berada di tengah kotak.
          </p>
        </div>

        <div className="pt-4">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-colors shadow-xl"
          >
            BATALKAN
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0% { top: 10%; }
          100% { top: 90%; }
        }
        .animate-scan-line {
          animation: scan-line 2.5s ease-in-out infinite;
        }
        #qr-reader { border: none !important; }
        #qr-reader video { 
          object-fit: cover !important; 
          width: 100% !important; 
          height: 100% !important;
          border-radius: 36px;
        }
        #qr-reader__scan_region { background: transparent !important; }
        #qr-reader__dashboard { display: none !important; }
      `}} />
    </div>
  );
};

export default QrScanner;
