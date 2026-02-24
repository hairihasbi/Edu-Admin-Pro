
import React, { useState, useEffect } from 'react';
import { Settings, Save, Mail, AlertCircle, CheckCircle, Server, Key, BookOpen, Plus, Trash2, Smartphone, Zap, RefreshCcw, Activity, FileText, Database } from './Icons';
import { saveEmailConfig, getEmailConfig, getMasterSubjects, addMasterSubject, deleteMasterSubject, getBackupApiKeys, addBackupApiKey, deleteBackupApiKey, clearBackupApiKeys, getSystemSettings, saveSystemSettings } from '../services/database';
import { testConnectionConfig, initializeDatabaseRemote, checkConnection } from '../services/tursoService';
import { EmailConfig, MasterSubject, User, ApiKeyStats, ApiKey, SystemSettings } from '../types';
import WhatsAppSettings from './WhatsAppSettings';

const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'master' | 'wa' | 'keys' | 'system' | 'db'>('system');
  const [config, setConfig] = useState<EmailConfig>({
    provider: 'MAILERSEND',
    method: 'API',
    apiKey: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    fromEmail: 'noreply@sekolah.id',
    fromName: 'Admin Sekolah',
    isActive: false
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // System Settings State
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
      id: 'global-settings',
      featureRppEnabled: true,
      maintenanceMessage: 'Fitur sedang dalam pemeliharaan.',
      rppMonthlyLimit: 0 // Default unlimited
  });

  // ... (Keep existing states for DB Config, Master Data, Keys) ...
  // DB Config State
  const [dbTestUrl, setDbTestUrl] = useState('');
  const [dbTestToken, setDbTestToken] = useState('');
  const [dbStatusMsg, setDbStatusMsg] = useState('');
  const [dbStatusType, setDbStatusType] = useState<'success' | 'error' | 'idle'>('idle');
  const [currentDbStatus, setCurrentDbStatus] = useState<boolean>(false);

  // Master Data State
  const [subjects, setSubjects] = useState<MasterSubject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCategory, setNewSubjectCategory] = useState<MasterSubject['category']>('UMUM');
  const [newSubjectLevel, setNewSubjectLevel] = useState<MasterSubject['level']>('SEMUA');

  // Key Stats State
  const [keyStats, setKeyStats] = useState<ApiKeyStats[]>([]);
  const [refreshingKeys, setRefreshingKeys] = useState(false);
  
  // Backup Keys State
  const [backupKeys, setBackupKeys] = useState<ApiKey[]>([]);
  const [newBackupKey, setNewBackupKey] = useState('');
  const [bulkKeys, setBulkKeys] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    const userStr = localStorage.getItem('eduadmin_user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (activeTab === 'email') {
      const saved = await getEmailConfig();
      if (saved) setConfig(saved);
    } else if (activeTab === 'master') {
      const data = await getMasterSubjects();
      setSubjects(data);
    } else if (activeTab === 'keys') {
        fetchKeyStats();
        fetchBackupKeys();
    } else if (activeTab === 'system') {
        const settings = await getSystemSettings();
        // Fix: spread fallback if undefined
        if (settings) {
            setSystemSettings(prev => ({ ...prev, ...settings }));
        }
    } else if (activeTab === 'db') {
        const isConn = await checkConnection();
        setCurrentDbStatus(isConn);
    }
  };

  // ... (Keep existing handlers: handleTestConnection, handleInitializeDb, handleSaveSystemSettings, etc.) ...
  // DB Handlers
  const handleTestConnection = async () => {
      setIsLoading(true);
      setDbStatusMsg('Menguji koneksi...');
      setDbStatusType('idle');
      
      const result = await testConnectionConfig(dbTestUrl, dbTestToken);
      setIsLoading(false);
      setDbStatusMsg(result.message);
      setDbStatusType(result.success ? 'success' : 'error');
  };

  const handleInitializeDb = async () => {
      if(!confirm("Proses ini akan membuat tabel database jika belum ada dan mereset user Admin default jika hilang. Lanjutkan?")) return;
      
      setIsLoading(true);
      setDbStatusMsg('Menginisialisasi...');
      
      // Pass manual credentials if user filled them out, otherwise it uses ENV
      const result = await initializeDatabaseRemote(
          dbTestUrl || undefined, 
          dbTestToken || undefined
      );
      
      setIsLoading(false);
      
      setDbStatusMsg(result.message);
      setDbStatusType(result.success ? 'success' : 'error');
      
      if (result.success) {
          const isConn = await checkConnection();
          setCurrentDbStatus(isConn);
      }
  };

  // System Settings Handler
  const handleSaveSystemSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          await saveSystemSettings(systemSettings);
          setStatus({ type: 'success', message: 'Pengaturan sistem berhasil disimpan.' });
      } catch (e) {
          setStatus({ type: 'error', message: 'Gagal menyimpan pengaturan.' });
      } finally {
          setIsLoading(false);
      }
  };

  const fetchKeyStats = async () => {
      setRefreshingKeys(true);
      try {
          const res = await fetch('/api/admin/keys');
          if (res.ok) {
              const data = await res.json();
              setKeyStats(data.keys);
          }
      } catch (e) {
          console.error("Failed to fetch keys", e);
      } finally {
          setRefreshingKeys(false);
      }
  };

  const fetchBackupKeys = async () => {
      try {
          const keys = await getBackupApiKeys();
          setBackupKeys(keys);
      } catch (e) {
          console.error("Failed to load backup keys", e);
      }
  };

  const handleKeyAction = async (keyName: string, action: 'reset_status' | 'reset_usage' | 'reset_errors') => {
      try {
          const res = await fetch('/api/admin/keys', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, keyName })
          });
          if (res.ok) {
              fetchKeyStats(); // Refresh UI
          } else {
              alert("Gagal melakukan aksi.");
          }
      } catch (e) {
          alert("Error koneksi.");
      }
  };

  const handleAddBackupKey = async () => {
      if (!newBackupKey.trim()) return;
      setIsLoading(true);
      try {
          await addBackupApiKey(newBackupKey.trim());
          await fetchBackupKeys(); // Wait for fetch
          setNewBackupKey('');
          alert('Key berhasil ditambahkan.');
      } catch (e: any) {
          alert(e.message || 'Gagal menambahkan key.');
      } finally {
          setIsLoading(false);
      }
  };

  const handleBulkUpload = async () => {
      if (!bulkKeys) return;
      setIsLoading(true);
      try {
          const lines = bulkKeys.split('\n').map(k => k.trim()).filter(k => k.length > 10);
          let count = 0;
          for (const k of lines) {
              try {
                  await addBackupApiKey(k);
                  count++;
              } catch(e) {
                  // Ignore duplicates silently
              }
          }
          await fetchBackupKeys(); // Refresh list after all done
          setBulkKeys('');
          alert(`Berhasil mengimpor ${count} keys.`);
      } catch (e) {
          alert("Gagal melakukan bulk upload.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteBackupKey = async (id: string) => {
      if (confirm('Hapus key ini?')) {
          await deleteBackupApiKey(id);
          fetchBackupKeys();
      }
  };

  const handleClearAllKeys = async () => {
      if (confirm("PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA Database API Keys?")) {
          await clearBackupApiKeys();
          fetchBackupKeys();
      }
  };

  const handleChange = (field: keyof EmailConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const success = await saveEmailConfig(config);
      if (success) {
        setStatus({ type: 'success', message: 'Konfigurasi email berhasil disimpan!' });
      } else {
        setStatus({ type: 'error', message: 'Gagal menyimpan konfigurasi.' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName) return;
    try {
      const newSub = await addMasterSubject(newSubjectName, newSubjectCategory, newSubjectLevel);
      setSubjects(prev => [...prev, newSub].sort((a,b) => a.name.localeCompare(b.name)));
      setNewSubjectName('');
      alert('Mata pelajaran berhasil ditambahkan.');
    } catch (e: any) {
      alert(e.message || "Gagal menambah mapel.");
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (window.confirm("Hapus mata pelajaran ini?")) {
      await deleteMasterSubject(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* ... (Keep existing UI for Header, Tabs) ... */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
        <div className="p-3 bg-gray-100 text-gray-600 rounded-full">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pengaturan Sistem</h2>
          <p className="text-gray-500">Konfigurasi aplikasi, integrasi, dan manajemen data.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'system' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Activity size={16} /> Fitur & Sistem
        </button>
        <button
          onClick={() => setActiveTab('db')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'db' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Database size={16} /> Database
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Mail size={16} /> Email Config
        </button>
        <button
          onClick={() => setActiveTab('wa')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'wa' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Smartphone size={16} /> WhatsApp Gateway
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'keys' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Zap size={16} /> Gemini AI Keys
        </button>
        <button
          onClick={() => setActiveTab('master')}
          className={`px-6 py-2.5 rounded-md text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'master' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <BookOpen size={16} /> Data Mapel
        </button>
      </div>

      {/* SYSTEM SETTINGS TAB */}
      {activeTab === 'system' && (
          <div className="animate-in fade-in zoom-in duration-200">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  {/* ... (Keep existing UI for System Settings) ... */}
                  <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                      <Activity className="text-indigo-600" />
                      <h3 className="font-bold text-gray-800">Manajemen Fitur Global</h3>
                  </div>

                  {status.message && (
                    <div className={`p-4 mb-4 rounded-lg flex items-center gap-2 ${
                        status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span>{status.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveSystemSettings} className="space-y-6">
                      {/* RPP Quota Limit */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <h4 className="font-bold text-blue-800 mb-2">Batas Kuota AI RPP Generator</h4>
                          <p className="text-sm text-gray-600 mb-3">
                              Atur berapa kali seorang Guru dapat menggunakan fitur generate RPP dalam satu bulan.
                              Ini berguna untuk menjaga penggunaan API agar tidak melampaui batas biaya/kuota.
                          </p>
                          <div className="flex items-center gap-3">
                              <label className="text-sm font-semibold text-gray-700">Limit per Bulan:</label>
                              <input 
                                  type="number" 
                                  min="0"
                                  className="w-24 border border-blue-300 rounded-lg p-2 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                  value={systemSettings.rppMonthlyLimit}
                                  onChange={(e) => setSystemSettings({...systemSettings, rppMonthlyLimit: parseInt(e.target.value) || 0})}
                              />
                              <span className="text-sm text-gray-500">(0 = Tidak Terbatas)</span>
                          </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start">
                              <div className="flex-1">
                                  <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                      <Zap className="text-purple-500" size={20} /> AI RPP Generator (Master Switch)
                                  </h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                      Matikan fitur ini jika sedang dalam proses <i>maintenance</i>, perbaikan bug, atau jika kuota API habis. 
                                      Guru akan melihat pesan pemeliharaan saat mengakses fitur ini.
                                  </p>
                              </div>
                              <div className="ml-4">
                                  <label className="flex items-center cursor-pointer">
                                      <div className="relative">
                                          <input 
                                            type="checkbox" 
                                            className="sr-only"
                                            checked={systemSettings.featureRppEnabled}
                                            onChange={(e) => setSystemSettings({...systemSettings, featureRppEnabled: e.target.checked})}
                                          />
                                          <div className={`block w-14 h-8 rounded-full transition ${
                                              systemSettings.featureRppEnabled ? 'bg-green-500' : 'bg-gray-300'
                                          }`}></div>
                                          <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${
                                              systemSettings.featureRppEnabled ? 'translate-x-6' : 'translate-x-0'
                                          }`}></div>
                                      </div>
                                      <div className="ml-3 text-sm font-medium text-gray-700">
                                          {systemSettings.featureRppEnabled ? 'AKTIF' : 'NON-AKTIF'}
                                      </div>
                                  </label>
                              </div>
                          </div>

                          {!systemSettings.featureRppEnabled && (
                              <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Pesan Maintenance</label>
                                  <input 
                                    type="text" 
                                    className="w-full border border-red-300 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                    placeholder="Contoh: Fitur sedang dalam perbaikan tim teknis."
                                    value={systemSettings.maintenanceMessage}
                                    onChange={(e) => setSystemSettings({...systemSettings, maintenanceMessage: e.target.value})}
                                  />
                                  <p className="text-xs text-red-500 mt-1">*Pesan ini akan muncul di layar guru.</p>
                              </div>
                          )}
                      </div>

                      <div className="flex justify-end">
                          <button 
                            type="submit" 
                            disabled={isLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition shadow-sm flex items-center gap-2"
                          >
                              <Save size={18} />
                              {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* ... (Other Tabs remain the same) ... */}
      {/* DATABASE TAB */}
      {activeTab === 'db' && (
          <div className="animate-in fade-in zoom-in duration-200 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  {/* ... (DB Tab Content same as original file) ... */}
                  <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                      <Database className="text-orange-600" />
                      <h3 className="font-bold text-gray-800">Status & Inisialisasi Database</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Connection Status */}
                      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                          <h4 className="font-bold text-gray-700 mb-4">Status Koneksi Saat Ini</h4>
                          <div className={`p-4 rounded-lg flex items-center gap-3 ${
                              currentDbStatus ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                              {currentDbStatus ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                              <div>
                                  <p className="font-bold">{currentDbStatus ? 'Terhubung ke Turso Cloud' : 'Gagal Terhubung / Mode Lokal'}</p>
                                  <p className="text-xs mt-1">
                                      {currentDbStatus 
                                        ? 'Aplikasi menggunakan database cloud dengan env variables yang terpasang.' 
                                        : 'Pastikan TURSO_DB_URL dan TURSO_AUTH_TOKEN sudah diset di Vercel.'}
                                  </p>
                              </div>
                          </div>
                          
                          <div className="mt-6 pt-6 border-t border-gray-200">
                              <h4 className="font-bold text-gray-700 mb-2">Inisialisasi Tabel</h4>
                              <p className="text-xs text-gray-500 mb-4">
                                  Jika status koneksi "Gagal" atau Anda baru saja deploy, klik tombol ini untuk memaksa pembuatan tabel dan user admin default.
                              </p>
                              <button 
                                  onClick={handleInitializeDb}
                                  disabled={isLoading}
                                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                              >
                                  {isLoading ? <RefreshCcw className="animate-spin" /> : <Database size={18} />}
                                  Inisialisasi Database (Fix Missing Tables)
                              </button>
                          </div>
                      </div>

                      {/* Connection Tester */}
                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-4">Uji Koneksi Manual</h4>
                          <p className="text-xs text-gray-500 mb-4">
                              Gunakan form ini untuk mengetes URL dan Token Turso secara langsung tanpa mengubah Env Variables server. (Hanya untuk debugging).
                          </p>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Turso Database URL</label>
                                  <input 
                                      type="text" 
                                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                                      placeholder="libsql://db-name.turso.io"
                                      value={dbTestUrl}
                                      onChange={(e) => setDbTestUrl(e.target.value)}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Turso Auth Token</label>
                                  <input 
                                      type="password" 
                                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                                      placeholder="eyJh..."
                                      value={dbTestToken}
                                      onChange={(e) => setDbTestToken(e.target.value)}
                                  />
                              </div>
                              <button 
                                  onClick={handleTestConnection}
                                  disabled={isLoading || !dbTestUrl || !dbTestToken}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-sm transition"
                              >
                                  {isLoading ? 'Menguji...' : 'Test Koneksi'}
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Status Message Area */}
                  {dbStatusMsg && (
                      <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                          dbStatusType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                          {dbStatusType === 'success' ? <CheckCircle className="shrink-0 mt-0.5" /> : <AlertCircle className="shrink-0 mt-0.5" />}
                          <div>
                              <p className="font-bold">{dbStatusType === 'success' ? 'Berhasil' : 'Gagal'}</p>
                              <p className="text-sm mt-1">{dbStatusMsg}</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* EMAIL TAB */}
      {activeTab === 'email' && (
        <form onSubmit={handleSaveEmail} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
          {/* ... (Keep existing UI) ... */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Mail size={18} className="text-blue-600" /> Konfigurasi Email Notifikasi
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Status Aktif:</span>
              <button
                type="button"
                onClick={() => handleChange('isActive', !config.isActive)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${config.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {status.message && (
              <div className={`p-4 rounded-lg flex items-center gap-2 ${
                status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span>{status.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Provider</label>
                <div className="flex gap-4">
                  <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition ${config.provider === 'MAILERSEND' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                    <input type="radio" className="hidden" checked={config.provider === 'MAILERSEND'} onChange={() => handleChange('provider', 'MAILERSEND')} />
                    <div className="font-bold text-blue-900">MailerSend</div>
                    <div className="text-xs text-gray-500">Reliable transactional email</div>
                  </label>
                  <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition ${config.provider === 'BREVO' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'hover:bg-gray-50'}`}>
                    <input type="radio" className="hidden" checked={config.provider === 'BREVO'} onChange={() => handleChange('provider', 'BREVO')} />
                    <div className="font-bold text-green-900">Brevo</div>
                    <div className="text-xs text-gray-500">Ex. Sendinblue</div>
                  </label>
                </div>
              </div>

              {/* Method Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Pengiriman</label>
                <div className="flex gap-4">
                  <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition ${config.method === 'API' ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'hover:bg-gray-50'}`}>
                    <input type="radio" className="hidden" checked={config.method === 'API'} onChange={() => handleChange('method', 'API')} />
                    <div className="flex items-center gap-2 font-bold text-purple-900"><Server size={16}/> API (Serverless)</div>
                    <div className="text-xs text-gray-500">Vercel Function</div>
                  </label>
                  <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition ${config.method === 'SMTP' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'hover:bg-gray-50'}`}>
                    <input type="radio" className="hidden" checked={config.method === 'SMTP'} onChange={() => handleChange('method', 'SMTP')} />
                    <div className="flex items-center gap-2 font-bold text-orange-900"><Mail size={16}/> SMTP</div>
                    <div className="text-xs text-gray-500">Direct Connection</div>
                  </label>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Configuration Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {config.method === 'API' ? (
                  <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-1">API Key ({config.provider})</label>
                     <div className="relative">
                        <Key className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                          type="password"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                          placeholder={`Masukkan API Key ${config.provider}`}
                          value={config.apiKey}
                          onChange={(e) => handleChange('apiKey', e.target.value)}
                        />
                     </div>
                     <p className="text-xs text-gray-500 mt-1">
                        API Key ini akan digunakan oleh Vercel Serverless Function.
                     </p>
                  </div>
               ) : (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="smtp.mailersend.net / smtp-relay.brevo.com"
                        value={config.smtpHost}
                        onChange={(e) => handleChange('smtpHost', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="587"
                        value={config.smtpPort}
                        onChange={(e) => handleChange('smtpPort', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP User</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={config.smtpUser}
                        onChange={(e) => handleChange('smtpUser', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                      <input 
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={config.smtpPass}
                        onChange={(e) => handleChange('smtpPass', e.target.value)}
                      />
                    </div>
                  </>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email (From)</label>
                  <input 
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="noreply@sekolah.id"
                    value={config.fromEmail}
                    onChange={(e) => handleChange('fromEmail', e.target.value)}
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name (From)</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Admin Sekolah"
                    value={config.fromName}
                    onChange={(e) => handleChange('fromName', e.target.value)}
                  />
               </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 flex justify-end">
             <button 
               type="submit" 
               disabled={isLoading}
               className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-70"
             >
               <Save size={18} />
               {isLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
             </button>
          </div>
        </form>
      )}

      {/* API KEYS TAB */}
      {activeTab === 'keys' && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-200">
              {/* Stats Section */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">
                              <Zap size={18} className="text-purple-600" /> Environment API Keys
                          </h3>
                          <p className="text-sm text-gray-500">Monitoring penggunaan environment variables (Vercel).</p>
                      </div>
                      <button 
                          onClick={fetchKeyStats}
                          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                          <RefreshCcw size={16} className={refreshingKeys ? "animate-spin" : ""} /> Refresh
                      </button>
                  </div>

                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-600 font-medium">
                              <tr>
                                  <th className="p-4">Key Name (Env)</th>
                                  <th className="p-4">Status</th>
                                  <th className="p-4 text-center">Usage Count</th>
                                  <th className="p-4 text-center">Errors</th>
                                  <th className="p-4 text-right">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {keyStats.length === 0 ? (
                                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">Tidak ada data key environment.</td></tr>
                              ) : (
                                  keyStats.map((key) => (
                                      <tr key={key.keyName} className="hover:bg-gray-50">
                                          <td className="p-4 font-mono font-medium text-gray-700">
                                              {key.keyName}
                                              <span className="block text-xs text-gray-400 font-normal">{key.maskedKey}</span>
                                          </td>
                                          <td className="p-4">
                                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                  key.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                                                  key.status === 'RATE_LIMITED' ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-red-100 text-red-700'
                                              }`}>
                                                  {key.status}
                                              </span>
                                          </td>
                                          <td className="p-4 text-center">
                                              <span className="bg-gray-100 px-2 py-1 rounded font-mono">{key.usageCount}</span>
                                          </td>
                                          <td className="p-4 text-center">
                                              {key.errorCount > 0 ? (
                                                  <div className="flex items-center justify-center gap-1">
                                                      <span className="text-red-500 font-bold">{key.errorCount}</span>
                                                      <button 
                                                          onClick={() => handleKeyAction(key.keyName, 'reset_errors')}
                                                          className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition"
                                                          title="Reset Errors"
                                                      >
                                                          <Trash2 size={12} />
                                                      </button>
                                                  </div>
                                              ) : (
                                                  <span className="text-gray-400">-</span>
                                              )}
                                          </td>
                                          <td className="p-4 text-right">
                                              <div className="flex justify-end gap-2">
                                                  {(key.status === 'DEAD' || key.status === 'RATE_LIMITED') && (
                                                      <button 
                                                          onClick={() => handleKeyAction(key.keyName, 'reset_status')}
                                                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100"
                                                          title="Aktifkan kembali"
                                                      >
                                                          Reactivate
                                                      </button>
                                                  )}
                                                  <button 
                                                      onClick={() => handleKeyAction(key.keyName, 'reset_usage')}
                                                      className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-100"
                                                      title="Reset usage"
                                                  >
                                                      Reset
                                                  </button>
                                              </div>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Database Keys Section */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6">
                  {/* Left: Forms */}
                  <div className="flex-1 space-y-6">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                          <Key size={18} className="text-orange-600" /> Database API Keys (Active Pool)
                      </h3>
                      <p className="text-sm text-gray-500 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                          <AlertCircle size={14} className="inline mr-1" />
                          Key yang ditambahkan di sini akan digunakan <strong>bersamaan</strong> dengan Environment Variables secara acak (Random Load Balancing).
                      </p>

                      <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Tambah Satu Key</label>
                              <div className="flex gap-2">
                                  <input 
                                      type="text" 
                                      className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                      placeholder="Paste Gemini API Key..."
                                      value={newBackupKey}
                                      onChange={(e) => setNewBackupKey(e.target.value)}
                                  />
                                  <button 
                                      onClick={handleAddBackupKey}
                                      disabled={!newBackupKey || isLoading}
                                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
                                  >
                                      {isLoading ? '...' : 'Tambah'}
                                  </button>
                              </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Bulk Upload (Banyak Key)</label>
                              <textarea 
                                  className="w-full border border-gray-300 rounded-lg p-2 text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                  placeholder="Paste daftar API Key (satu key per baris)..."
                                  value={bulkKeys}
                                  onChange={(e) => setBulkKeys(e.target.value)}
                              />
                              <div className="flex justify-end mt-2">
                                  <button 
                                      onClick={handleBulkUpload}
                                      disabled={!bulkKeys || isLoading}
                                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                  >
                                      <FileText size={14} /> Upload Bulk
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right: List */}
                  <div className="flex-1 border-l border-gray-100 pl-0 md:pl-6">
                      <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-gray-700 flex items-center gap-2">
                              Daftar Key Database
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{backupKeys.length}</span>
                          </h4>
                          {backupKeys.length > 0 && (
                              <button 
                                  onClick={handleClearAllKeys}
                                  className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold border border-red-100 transition"
                              >
                                  Hapus Semua
                              </button>
                          )}
                      </div>
                      
                      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                          {backupKeys.length === 0 ? (
                              <div className="text-center text-gray-400 py-8 text-sm">Belum ada key di database.</div>
                          ) : (
                              backupKeys.map(key => (
                                  <div key={key.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-200 transition group">
                                      <div>
                                          <div className="font-mono text-sm text-gray-700">
                                              {key.key.length > 8 ? key.key.substring(0, 8) + '...' + key.key.substring(key.key.length - 6) : 'Invalid Key'}
                                          </div>
                                          <div className="text-[10px] text-gray-400">
                                              Added: {new Date(key.addedAt).toLocaleDateString()}
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => handleDeleteBackupKey(key.id)}
                                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition"
                                          title="Hapus Key"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* WHATSAPP TAB */}
      {activeTab === 'wa' && currentUser && (
         <div className="animate-in fade-in zoom-in duration-200">
            <WhatsAppSettings user={currentUser} />
         </div>
      )}

      {/* MASTER DATA TAB */}
      {activeTab === 'master' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-200">
           {/* Form Tambah */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <Plus size={18} className="text-blue-600" /> Tambah Mata Pelajaran Baru
              </h3>
              <form onSubmit={handleAddSubject} className="flex flex-col md:flex-row gap-4 items-end">
                 <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Mata Pelajaran</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                      placeholder="Contoh: Matematika Lanjut"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                    />
                 </div>
                 <div className="w-full md:w-40">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Kategori</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                      value={newSubjectCategory}
                      onChange={(e) => setNewSubjectCategory(e.target.value as any)}
                    >
                       <option value="UMUM">Umum</option>
                       <option value="KEJURUAN">Kejuruan</option>
                       <option value="MULOK">Mulok</option>
                       <option value="PILIHAN">Pilihan</option>
                    </select>
                 </div>
                 <div className="w-full md:w-32">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Jenjang</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                      value={newSubjectLevel}
                      onChange={(e) => setNewSubjectLevel(e.target.value as any)}
                    >
                       <option value="SEMUA">Semua</option>
                       <option value="SD">SD</option>
                       <option value="SMP">SMP</option>
                       <option value="SMA">SMA</option>
                       <option value="SMK">SMK</option>
                    </select>
                 </div>
                 <button 
                   type="submit" 
                   className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 w-full md:w-auto"
                 >
                    Tambah
                 </button>
              </form>
           </div>

           {/* List */}
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                 <h4 className="font-bold text-gray-700">Daftar Mata Pelajaran ({subjects.length})</h4>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
                 {subjects.map(sub => (
                    <div key={sub.id} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50 transition group">
                       <div>
                          <div className="font-semibold text-gray-800">{sub.name}</div>
                          <div className="text-xs text-gray-500 flex gap-2">
                             <span className="bg-gray-100 px-1.5 rounded">{sub.category}</span>
                             <span className="bg-blue-50 text-blue-600 px-1.5 rounded">{sub.level}</span>
                          </div>
                       </div>
                       <button 
                          onClick={() => handleDeleteSubject(sub.id)}
                          className="text-gray-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition"
                       >
                          <Trash2 size={16} />
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
