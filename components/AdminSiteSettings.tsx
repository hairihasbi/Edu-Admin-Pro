
import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { getSystemSettings, saveSystemSettings } from '../services/database';
import { Save, Globe, Image, Clock, CheckCircle, AlertCircle, LayoutTemplate, BrainCircuit } from './Icons';

const AdminSiteSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'seo' | 'appearance' | 'ai'>('general');
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
    footerText: `© ${new Date().getFullYear()} EduAdmin Pro. All rights reserved.`,
    aiProvider: 'GOOGLE',
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: ''
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
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'ai' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <BrainCircuit size={16} /> AI Config
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

        {/* TAB: AI CONFIG */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
             <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg mb-6">
                <div className="flex items-start gap-3">
                   <div className="bg-purple-100 p-2 rounded-full text-purple-700 mt-1">
                      <BrainCircuit size={20} />
                   </div>
                   <div>
                      <h4 className="text-purple-900 font-bold text-lg mb-1">AI Provider Configuration</h4>
                      <p className="text-sm text-purple-700">
                         Pilih penyedia layanan AI. Gunakan <strong>Google Direct</strong> untuk setup mudah (gratis) atau <strong>Custom Gateway</strong> (LiteLLM, Proxy) untuk performa tinggi dan manajemen kuota terpusat.
                      </p>
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Provider Type</label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className={`border rounded-lg p-4 cursor-pointer transition flex items-center gap-3 ${settings.aiProvider !== 'CUSTOM' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                         <input type="radio" className="hidden" checked={settings.aiProvider !== 'CUSTOM'} onChange={() => handleChange('aiProvider', 'GOOGLE')} />
                         <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center">
                            {settings.aiProvider !== 'CUSTOM' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                         </div>
                         <div>
                            <div className="font-bold text-gray-800">Direct Google Gemini</div>
                            <div className="text-xs text-gray-500">Menggunakan API Key di Environment Variables (Vercel).</div>
                         </div>
                      </label>

                      <label className={`border rounded-lg p-4 cursor-pointer transition flex items-center gap-3 ${settings.aiProvider === 'CUSTOM' ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'hover:bg-gray-50'}`}>
                         <input type="radio" className="hidden" checked={settings.aiProvider === 'CUSTOM'} onChange={() => handleChange('aiProvider', 'CUSTOM')} />
                         <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center">
                            {settings.aiProvider === 'CUSTOM' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                         </div>
                         <div>
                            <div className="font-bold text-gray-800">Custom Gateway / LiteLLM</div>
                            <div className="text-xs text-gray-500">Gunakan Base URL & Key sendiri (OpenAI Compatible).</div>
                         </div>
                      </label>
                   </div>
                </div>

                {settings.aiProvider === 'CUSTOM' && (
                   <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Base URL</label>
                         <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="https://your-litellm-proxy.com/v1"
                            value={settings.aiBaseUrl || ''}
                            onChange={(e) => handleChange('aiBaseUrl', e.target.value)}
                         />
                         <p className="text-xs text-gray-500 mt-1">Endpoint API (OpenAI Compatible). Contoh: <code>http://localhost:4000/v1</code></p>
                      </div>

                      <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">API Key (Custom)</label>
                         <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="sk-..."
                            value={settings.aiApiKey || ''}
                            onChange={(e) => handleChange('aiApiKey', e.target.value)}
                         />
                      </div>

                      <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Model Name (Optional)</label>
                         <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="gemini-pro"
                            value={settings.aiModel || ''}
                            onChange={(e) => handleChange('aiModel', e.target.value)}
                         />
                         <p className="text-xs text-gray-500 mt-1">Nama model yang akan dipanggil di Gateway (Default: <code>gemini-pro</code> atau sesuai mapping LiteLLM Anda).</p>
                      </div>
                   </div>
                )}
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
