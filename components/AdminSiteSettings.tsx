
import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { getSystemSettings, saveSystemSettings } from '../services/database';
import { Save, Globe, Image, Clock, CheckCircle, AlertCircle, LayoutTemplate } from './Icons';

const AdminSiteSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'seo' | 'appearance'>('general');
  const [settings, setSettings] = useState<SystemSettings>({
    id: 'global-settings',
    featureRppEnabled: true,
    maintenanceMessage: '',
    appName: 'EduAdmin Pro',
    schoolName: 'Sekolah Indonesia',
    appDescription: 'Sistem Administrasi Sekolah Terpadu',
    appKeywords: 'sekolah, administrasi, guru, siswa, rpp, kurikulum merdeka',
    logoUrl: '',
    faviconUrl: '',
    timezone: 'Asia/Jakarta',
    footerText: `© ${new Date().getFullYear()} EduAdmin Pro. All rights reserved.`
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await getSystemSettings();
      // Merge with default values to ensure all fields exist
      setSettings(prev => ({ ...prev, ...saved }));
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  const handleChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      await saveSystemSettings(settings);
      setStatus({ type: 'success', message: 'Pengaturan situs berhasil disimpan! Refresh halaman untuk melihat perubahan.' });
      
      // Update document instantly where possible
      if (settings.appName) document.title = settings.appName;
      
    } catch (e) {
      setStatus({ type: 'error', message: 'Gagal menyimpan pengaturan.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
          <Globe size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pengaturan Situs & SEO</h2>
          <p className="text-gray-500">Ubah identitas aplikasi, meta data SEO, dan tampilan dasar.</p>
        </div>
      </div>

      {status.message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{status.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'general' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <LayoutTemplate size={16} /> Identitas
        </button>
        <button
          onClick={() => setActiveTab('seo')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'seo' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Globe size={16} /> SEO Meta
        </button>
        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'appearance' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Image size={16} /> Icon & Tampilan
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in zoom-in duration-200">
        
        {/* TAB: GENERAL */}
        {activeTab === 'general' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aplikasi</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="EduAdmin Pro"
                value={settings.appName || ''}
                onChange={(e) => handleChange('appName', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Muncul di Tab Browser dan Header Aplikasi.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah Default</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="SMA Negeri 1 Indonesia"
                value={settings.schoolName || ''}
                onChange={(e) => handleChange('schoolName', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zona Waktu (Timezone)</label>
              <div className="relative">
                 <Clock size={16} className="absolute left-3 top-3 text-gray-400" />
                 <select 
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={settings.timezone || 'Asia/Jakarta'}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                 >
                    <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                    <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                    <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                 </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teks Footer</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={settings.footerText || ''}
                onChange={(e) => handleChange('footerText', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* TAB: SEO */}
        {activeTab === 'seo' && (
          <div className="space-y-5">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
               <p className="font-bold mb-1">Preview di Google:</p>
               <div className="bg-white p-3 rounded border border-gray-200 shadow-sm max-w-lg">
                  <div className="text-blue-700 text-lg hover:underline cursor-pointer truncate">
                     {settings.appName || 'Judul Aplikasi'} - {settings.schoolName || 'Sistem Sekolah'}
                  </div>
                  <div className="text-green-700 text-xs mb-1">https://sekolah-anda.com</div>
                  <div className="text-gray-600 text-sm line-clamp-2">
                     {settings.appDescription || 'Deskripsi aplikasi akan muncul di sini...'}
                  </div>
               </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
              <textarea 
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Deskripsi singkat aplikasi untuk mesin pencari..."
                value={settings.appDescription || ''}
                onChange={(e) => handleChange('appDescription', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Disarankan 150-160 karakter.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keywords</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="sekolah, administrasi, rpp, guru, siswa"
                value={settings.appKeywords || ''}
                onChange={(e) => handleChange('appKeywords', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Pisahkan dengan koma.</p>
            </div>
          </div>
        )}

        {/* TAB: APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-5">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">URL Logo Aplikasi (Header)</label>
                   <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="https://example.com/logo.png"
                      value={settings.logoUrl || ''}
                      onChange={(e) => handleChange('logoUrl', e.target.value)}
                   />
                   <div className="mt-2 h-16 w-full bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                      {settings.logoUrl ? (
                         <img src={settings.logoUrl} alt="Logo Preview" className="h-10 object-contain" />
                      ) : (
                         <span className="text-xs text-gray-400">Preview Logo</span>
                      )}
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">URL Favicon (Tab Browser)</label>
                   <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="https://example.com/favicon.ico"
                      value={settings.faviconUrl || ''}
                      onChange={(e) => handleChange('faviconUrl', e.target.value)}
                   />
                   <div className="mt-2 h-16 w-full bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                      {settings.faviconUrl ? (
                         <img src={settings.faviconUrl} alt="Favicon Preview" className="w-8 h-8 object-contain" />
                      ) : (
                         <span className="text-xs text-gray-400">Preview Favicon</span>
                      )}
                   </div>
                </div>
             </div>
             
             <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <p>
                   Catatan: Gunakan URL gambar yang dapat diakses publik (Direct Link). 
                   Perubahan icon mungkin memerlukan refresh browser (F5) untuk terlihat.
                </p>
             </div>
          </div>
        )}

        <div className="mt-8 flex justify-end pt-4 border-t border-gray-100">
           <button 
             type="submit"
             disabled={isLoading}
             className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-70"
           >
              <Save size={18} />
              {isLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
           </button>
        </div>

      </form>
    </div>
  );
};

export default AdminSiteSettings;
