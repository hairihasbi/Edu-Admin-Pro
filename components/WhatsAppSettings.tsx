
import React, { useState, useEffect } from 'react';
import { User, WhatsAppConfig } from '../types';
import { getWhatsAppConfig, saveWhatsAppConfig } from '../services/database';
import { Smartphone, Save, Key, Globe, CheckCircle, AlertCircle, HelpCircle } from './Icons';

interface WhatsAppSettingsProps {
  user: User;
}

const WhatsAppSettings: React.FC<WhatsAppSettingsProps> = ({ user }) => {
  const [config, setConfig] = useState<WhatsAppConfig>({
    userId: user.id,
    provider: 'FONNTE',
    baseUrl: 'https://api.fonnte.com/send',
    apiKey: '',
    deviceId: '',
    isActive: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    const load = async () => {
      const saved = await getWhatsAppConfig(user.id);
      if (saved) setConfig(saved);
    };
    load();
  }, [user.id]);

  const handleProviderChange = (provider: 'FLOWKIRIM' | 'FONNTE' | 'OTHER') => {
      let newUrl = config.baseUrl;
      if (provider === 'FONNTE') newUrl = 'https://api.fonnte.com/send';
      if (provider === 'FLOWKIRIM') newUrl = 'https://scan.flowkirim.com/api/whatsapp/messages/text';
      
      setConfig({ ...config, provider, baseUrl: newUrl });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });
    try {
      // Ensure clean data for Fonnte
      const configToSave = { ...config };
      if (config.provider === 'FONNTE') {
          configToSave.deviceId = ''; // Clear device ID for Fonnte
      }

      await saveWhatsAppConfig(configToSave);
      setStatus({ type: 'success', message: 'Konfigurasi WhatsApp berhasil disimpan!' });
    } catch (e) {
      setStatus({ type: 'error', message: 'Gagal menyimpan konfigurasi.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Smartphone size={20} className="text-green-600" /> Konfigurasi WhatsApp Gateway
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <button
            type="button"
            onClick={() => setConfig({ ...config, isActive: !config.isActive })}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${config.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {status.message && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {status.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider API</label>
              <select 
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value as any)}
              >
                 <option value="FONNTE">Fonnte (Gratis & Mudah)</option>
                 <option value="FLOWKIRIM">FlowKirim</option>
                 <option value="OTHER">Lainnya (Custom)</option>
              </select>
           </div>
           
           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL / Endpoint</label>
              <div className="relative">
                 <Globe size={16} className="absolute left-3 top-3 text-gray-400" />
                 <input 
                   type="text"
                   className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                   value={config.baseUrl}
                   onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                   placeholder="https://api.fonnte.com/send"
                 />
              </div>
           </div>
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Token</label>
           <div className="relative">
              <Key size={16} className="absolute left-3 top-3 text-gray-400" />
              <input 
                type="password"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                value={config.apiKey}
                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                placeholder="Paste API Key / Token di sini"
              />
           </div>
        </div>

        {/* Device ID HIDDEN for Fonnte */}
        {config.provider !== 'FONNTE' && (
            <div>
            <div className="flex items-center gap-1 mb-1">
                <label className="block text-sm font-medium text-gray-700">
                    Device ID / Session ID
                </label>
                <span className="text-gray-400 text-xs">(Wajib untuk FlowKirim)</span>
            </div>
            <input 
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                value={config.deviceId}
                onChange={(e) => setConfig({...config, deviceId: e.target.value})}
                placeholder="Contoh: device-xxxx"
            />
            </div>
        )}

        <div className="bg-blue-50 p-3 rounded-lg flex gap-2 items-start text-xs text-blue-700 border border-blue-100">
           <HelpCircle size={16} className="shrink-0 mt-0.5" />
           {config.provider === 'FONNTE' ? (
               <p>
                   <strong>Panduan Fonnte:</strong><br/>
                   1. Daftar & Login di <a href="https://fonnte.com" target="_blank" className="underline font-bold">fonnte.com</a><br/>
                   2. Hubungkan WhatsApp (Scan QR) di dashboard Fonnte.<br/>
                   3. Salin <strong>API Token</strong> dan tempel di kolom API Key di atas.<br/>
                   4. <strong>Device ID tidak diperlukan</strong> untuk Fonnte.
               </p>
           ) : (
               <p>
                   <strong>Panduan FlowKirim / Lainnya:</strong><br/>
                   Pastikan URL mengarah ke endpoint pengiriman pesan (POST).<br/>
                   Masukkan Token Authorization ke API Key.<br/>
                   Masukkan Device ID / Session ID jika provider mewajibkan.
               </p>
           )}
        </div>

        <div className="flex justify-end">
           <button 
             type="submit"
             disabled={isLoading}
             className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg transition flex items-center gap-2"
           >
              <Save size={18} /> Simpan Konfigurasi
           </button>
        </div>
      </form>
    </div>
  );
};

export default WhatsAppSettings;
