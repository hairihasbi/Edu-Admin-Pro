import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { QrCode, X, RefreshCcw, Smartphone, Camera, CheckCircle } from './Icons';

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentScanData, setCurrentScanData] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScanDataRef = useRef<string | null>(null);
  const scannerId = "qr-reader";

  const getAvailableCameras = async () => {
    try {
      // Prompt for camera permission first if not granted, which helps getting labels on mobile iOS/Android
      try {
         const stream = await navigator.mediaDevices.getUserMedia({ video: true });
         stream.getTracks().forEach(track => track.stop());
      } catch (e) {
         console.warn("Could not pre-request camera permissions:", e);
      }

      const devices = await (Html5Qrcode as any).getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Default to back camera
        const backCamera = devices.find((device: any) => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        return backCamera ? backCamera.id : devices[0].id;
      }
      return null;
    } catch (err) {
      console.error("Error getting cameras:", err);
      return null;
    }
  };

  const startScanner = async (cameraId: string | { facingMode: string }) => {
    if (!scannerRef.current) return;
    
    // Stop current scanner if active
    if (scannerRef.current.isScanning) {
      await scannerRef.current.stop();
    }

    try {
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * 0.7);
          return {
            width: qrboxSize,
            height: qrboxSize
          };
        },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      };

      await scannerRef.current.start(
        cameraId,
        config,
        (decodedText: string) => {
          const now = Date.now();
          if (decodedText === lastScanDataRef.current && now - lastScanTimeRef.current < 3000) {
            return;
          }

          onScan(decodedText);
          lastScanDataRef.current = decodedText;
          lastScanTimeRef.current = now;
          setCurrentScanData(decodedText);
          
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        },
        () => {} // Ignore parse errors
      );
      
      setIsScanning(true);
      if (typeof cameraId === 'string') {
        setCurrentCameraId(cameraId);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
    }
  };

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(scannerId);
    scannerRef.current = html5QrCode;

    const init = async () => {
      const initialId = await getAvailableCameras();
      if (initialId) {
        await startScanner(initialId);
      } else {
        // Fallback to environment facing mode if getCameras fails
        await startScanner({ facingMode: "environment" });
      }
    };

    init();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => console.error("Stoppage error", e));
      }
    };
  }, []);

  const switchCamera = async () => {
    if (cameras.length < 2 || !currentCameraId) return;
    
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    
    await startScanner(nextCameraId);
  };

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
        className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90 z-[210]"
      >
        <X size={24} />
      </button>

      {cameras.length > 1 && (
        <button 
          onClick={switchCamera}
          className="absolute top-6 left-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[210] flex items-center gap-2"
          title="Switch Camera"
        >
          <Smartphone size={24} />
          <span className="text-[10px] font-bold uppercase hidden md:inline">Switch</span>
        </button>
      )}

      <div className="max-w-md w-full text-center space-y-8">
        <div className="relative aspect-square w-full max-w-[340px] mx-auto overflow-hidden rounded-[40px] border-4 border-white/10 bg-black shadow-2xl">
          {/* QR Scanner Container */}
          <div id={scannerId} className="w-full h-full overflow-hidden"></div>
          
          {/* Custom Overlay */}
          {!error && (
            <div className="absolute inset-x-0 h-1 bg-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,1)] animate-scan-line z-20"></div>
          )}

          {showSuccess && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-green-500/90 text-white z-40 animate-in zoom-in duration-300">
               <div className="bg-white rounded-full p-4 mb-4 shadow-xl">
                 <CheckCircle size={48} className="text-green-500" />
               </div>
               <p className="text-xl font-black uppercase tracking-tighter">SCAN BERHASIL</p>
               <p className="text-[10px] mt-1 font-bold opacity-80 uppercase tracking-widest">{currentScanData}</p>
            </div>
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
            Arahkan kamera ke Kode QR siswa. Fitur ini akan terus aktif sampai Anda menutupnya secara manual.
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
