import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

export interface CameraCaptureRef {
  capturePhoto: () => string | null;
}

interface CameraCaptureProps {
  className?: string;
  hidden?: boolean;
}

const CameraCapture = forwardRef<CameraCaptureRef, CameraCaptureProps>(({ className = '', hidden = true }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Front camera by default, or 'environment' for back
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        if (isActive && videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.warn("Camera permission denied or camera not available", err);
        setHasPermission(false);
      }
    };

    startCamera();

    return () => {
      isActive = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    capturePhoto: () => {
      if (!videoRef.current || !hasPermission) {
        return null;
      }

      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        return null;
      }

      const canvas = document.createElement('canvas');
      const MAX_SIZE = 320;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, width, height);

      // Compress deeply for local storage constraints
      return canvas.toDataURL('image/jpeg', 0.5); 
    }
  }));

  return (
    <div className={`${hidden ? 'hidden' : ''} ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
    </div>
  );
});

CameraCapture.displayName = 'CameraCapture';

export default CameraCapture;
