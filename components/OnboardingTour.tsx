import React, { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { User, UserRole } from '../types';

interface OnboardingTourProps {
  user: User;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ user }) => {
  const driverRef = useRef<any>(null);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (hasSeenTour) return;

    // Define steps based on user role
    const steps = [
      { 
        element: 'body', 
        popover: { 
          title: 'Selamat Datang di EduAdmin!', 
          description: 'Aplikasi manajemen sekolah yang lengkap dan mudah digunakan. Mari kita lihat fitur-fiturnya.',
          side: "left" as const, 
          align: 'start' as const 
        } 
      },
      { 
        element: 'aside nav', 
        popover: { 
          title: 'Navigasi Utama', 
          description: 'Akses semua fitur utama di sini, seperti Dashboard, Kelas, Siswa, dan lainnya.',
          side: "right" as const, 
          align: 'start' as const 
        } 
      }
    ];

    if (user.role === UserRole.GURU) {
      steps.push(
        { 
          element: 'a[href="#/classes"]', 
          popover: { 
            title: 'Manajemen Kelas', 
            description: 'Kelola data kelas, jadwal, dan perangkat ajar Anda di sini.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        },
        { 
          element: 'a[href="#/journal"]', 
          popover: { 
            title: 'Jurnal Mengajar', 
            description: 'Catat aktivitas mengajar harian Anda dengan mudah.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        },
        { 
          element: 'a[href="#/summative"]', 
          popover: { 
            title: 'Asesmen Sumatif', 
            description: 'Input dan kelola nilai asesmen sumatif siswa.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        }
      );
    } else if (user.role === UserRole.TENDIK) {
      steps.push(
        { 
          element: 'a[href="#/picket"]', 
          popover: { 
            title: 'Piket Harian', 
            description: 'Catat kejadian siswa, perizinan, dan keterlambatan.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        },
        { 
          element: 'a[href="#/backup"]', 
          popover: { 
            title: 'Backup & Restore', 
            description: 'Amankan data sekolah secara berkala.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        }
      );
    } else {
      steps.push(
        { 
          element: 'a[href="#/teachers"]', 
          popover: { 
            title: 'Manajemen Guru', 
            description: 'Kelola data guru, akun, dan penugasan.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        },
        { 
          element: 'a[href="#/students"]', 
          popover: { 
            title: 'Data Siswa', 
            description: 'Kelola data induk siswa, prestasi, dan pelanggaran.',
            side: "right" as const, 
            align: 'start' as const 
          } 
        }
      );
    }

    steps.push(
      { 
        element: 'button[title="Mode Terang"], button[title="Mode Gelap"]', 
        popover: { 
          title: 'Mode Gelap', 
          description: 'Ubah tampilan aplikasi ke mode gelap untuk kenyamanan mata Anda.',
          side: "left" as const, 
          align: 'start' as const 
        } 
      },
      { 
        element: 'div[title*="Status Database"]', 
        popover: { 
          title: 'Status Sinkronisasi', 
          description: 'Pantau status koneksi database dan sinkronisasi data Anda.',
          side: "left" as const, 
          align: 'start' as const 
        } 
      }
    );

    const driverObj = driver({
      showProgress: true,
      steps: steps,
      onDestroyStarted: () => {
        if (!driverObj.hasNextStep() || confirm("Apakah Anda yakin ingin melewati panduan ini?")) {
          driverObj.destroy();
          localStorage.setItem('hasSeenTour', 'true');
        }
      },
    });

    driverRef.current = driverObj;
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        driverObj.drive();
    }, 1000);

    return () => {
        if (driverRef.current) {
            driverRef.current.destroy();
        }
    };
  }, [user]);

  return null;
};

export default OnboardingTour;
