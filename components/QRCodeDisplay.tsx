
import React from 'react';

interface QRCodeDisplayProps {
  url: string;
  size?: number;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ url, size = 200 }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <img 
        src={qrUrl} 
        alt="QR Code Asesmen" 
        className="rounded-lg"
        referrerPolicy="no-referrer"
      />
      <p className="mt-3 text-xs text-gray-500 font-medium text-center">
        Scan QR ini untuk memulai asesmen mandiri
      </p>
    </div>
  );
};

export default QRCodeDisplay;
