import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from './Icons';

interface BreadcrumbsProps {
  className?: string;
}

const routeNameMap: Record<string, string> = {
  'dashboard': 'Dashboard',
  'teachers': 'Manajemen Guru',
  'students': 'Data Siswa',
  'classes': 'Manajemen Kelas',
  'attendance': 'Daftar Hadir',
  'scope-material': 'Lingkup Materi',
  'journal': 'Jurnal Mengajar',
  'summative': 'Asesmen Sumatif',
  'profile': 'Profil & Akun',
  'site-settings': 'Pengaturan Situs',
  'settings': 'Konfigurasi Sistem',
  'system-logs': 'System Logs',
  'announcements': 'Live Announcements',
  'backup': 'Backup & Restore',
  'donation': 'Dukungan Aplikasi',
  'donations': 'Riwayat Donasi',
  'gen-quiz': 'AI Generator Soal',
  'rpp-generator': 'AI RPP Generator',
  'help-center': 'Pusat Bantuan',
  'guidance': 'Bimbingan Konseling',
  'broadcast': 'Broadcast WhatsApp',
  'sync': 'Sinkronisasi Data',
  'homeroom': 'Wali Kelas',
  'picket': 'Piket Harian'
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className = '' }) => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return null;

  return (
    <nav className={`flex items-center text-sm text-gray-500 ${className}`} aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        <li className="inline-flex items-center">
          <Link to="/" className="inline-flex items-center text-gray-700 hover:text-blue-600 transition-colors">
            <Home size={14} className="mr-1" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const name = routeNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

          return (
            <li key={to}>
              <div className="flex items-center">
                <ChevronRight size={14} className="text-gray-400 mx-1" />
                {isLast ? (
                  <span className="text-gray-500 font-medium truncate max-w-[150px] sm:max-w-none" title={name}>
                    {name}
                  </span>
                ) : (
                  <Link to={to} className="text-gray-700 hover:text-blue-600 transition-colors truncate max-w-[100px] sm:max-w-none" title={name}>
                    {name}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
