
import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, ClassRoom } from '../types';
import { 
  getWhatsAppConfig, sendWhatsAppBroadcast, 
  getClasses, getStudents, getAllStudentsWithDetails, getTeachers 
} from '../services/database';
import { 
  Smartphone, Send, Users, Search, Filter, 
  CheckCircle, AlertCircle, X, Check, RefreshCcw, UserPlus, Trash2 
} from './Icons';

interface BroadcastPageProps {
  user: User;
}

type TargetType = 'TEACHERS' | 'STUDENTS_CLASS' | 'ALL_STUDENTS' | 'MANUAL';

interface Recipient {
  id: string;
  name: string;
  phone: string;
  label: string; // Class name or Role
  selected: boolean;
}

const BroadcastPage: React.FC<BroadcastPageProps> = ({ user }) => {
  // --- STATE ---
  const [configReady, setConfigReady] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // Data State
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  
  // UI State
  const [targetType, setTargetType] = useState<TargetType>('STUDENTS_CLASS');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Manual Input State
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  
  // Composer State
  const [message, setMessage] = useState('Halo {{name}},\n\nBerikut informasi dari sekolah:\n...');
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'completed'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // --- INIT ---
  useEffect(() => {
    checkConfig();
    fetchClasses();
  }, [user]);

  // Load recipients when filters change
  useEffect(() => {
    if (configReady) {
      if (targetType === 'MANUAL') {
        // Do not clear recipients automatically if adding manually, 
        // unless switching TO manual from another tab (handled in tab click)
        if (recipients.length > 0 && recipients[0].label !== 'Manual') {
            setRecipients([]);
        }
      } else {
        fetchRecipients();
      }
    }
  }, [targetType, selectedClassId, configReady]);

  const checkConfig = async () => {
    setLoadingConfig(true);
    const config = await getWhatsAppConfig(user.id);
    if (config && config.isActive && config.apiKey) {
      setConfigReady(true);
    }
    setLoadingConfig(false);
  };

  const fetchClasses = async () => {
    if (user.role === UserRole.ADMIN) {
        const { getAllClasses } = await import('../services/database'); 
        const all = await getAllClasses();
        setClasses(all);
        if (all.length > 0) setSelectedClassId(all[0].id);
    } else {
        const cls = await getClasses(user.id);
        setClasses(cls);
        if (cls.length > 0) setSelectedClassId(cls[0].id);
    }
  };

  const fetchRecipients = async () => {
    setIsLoadingData(true);
    let rawData: Recipient[] = [];

    try {
      if (targetType === 'TEACHERS' && user.role === UserRole.ADMIN) {
        const teachers = await getTeachers();
        rawData = teachers.map(t => ({
          id: t.id,
          name: t.fullName,
          phone: t.phone || '',
          label: 'Guru',
          selected: true
        }));
      } else if (targetType === 'ALL_STUDENTS' && user.role === UserRole.ADMIN) {
        const students = await getAllStudentsWithDetails();
        rawData = students.map(s => ({
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          label: s.className,
          selected: true
        }));
      } else if (targetType === 'STUDENTS_CLASS') {
        if (selectedClassId) {
          const students = await getStudents(selectedClassId);
          const clsName = classes.find(c => c.id === selectedClassId)?.name || 'Kelas';
          rawData = students.map(s => ({
            id: s.id,
            name: s.name,
            phone: s.phone || '',
            label: clsName,
            selected: true
          }));
        }
      }
    } catch (e) {
      console.error("Error fetching recipients", e);
    }

    setRecipients(rawData);
    setIsLoadingData(false);
  };

  // --- HANDLERS ---

  const handleToggleSelect = (id: string) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleSelectAll = (select: boolean) => {
    const filteredIds = new Set(filteredRecipients.map(r => r.id));
    setRecipients(prev => prev.map(r => filteredIds.has(r.id) ? { ...r, selected: select } : r));
  };

  const handleAddManualRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualPhone) return;

    const newRecipient: Recipient = {
      id: `manual-${Date.now()}`,
      name: manualName,
      phone: manualPhone,
      label: 'Manual',
      selected: true
    };

    setRecipients(prev => [newRecipient, ...prev]);
    setManualName('');
    setManualPhone('');
  };

  const handleDeleteManual = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const handleSendBroadcast = async () => {
    const selectedTargets = recipients.filter(r => r.selected && r.phone.length > 5);
    
    if (selectedTargets.length === 0) {
      alert("Pilih minimal satu penerima dengan nomor valid.");
      return;
    }

    if (!window.confirm(`Kirim pesan ke ${selectedTargets.length} orang?`)) return;

    setSendingStatus('sending');
    setProgress({ current: 0, total: selectedTargets.length, success: 0, failed: 0 });

    const config = await getWhatsAppConfig(user.id);
    if (!config) return;

    let successCount = 0;
    let failCount = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < selectedTargets.length; i += BATCH_SIZE) {
        const batch = selectedTargets.slice(i, i + BATCH_SIZE);
        
        try {
            const res = await sendWhatsAppBroadcast(config, batch, message);
            successCount += res.success;
            failCount += res.failed;
        } catch (e) {
            failCount += batch.length;
        }

        setProgress(prev => ({
            ...prev,
            current: Math.min(i + BATCH_SIZE, selectedTargets.length),
            success: successCount,
            failed: failCount
        }));
    }

    setSendingStatus('completed');
  };

  const filteredRecipients = recipients.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = filteredRecipients.filter(r => r.selected).length;

  if (loadingConfig) return <div className="p-10 text-center">Memuat konfigurasi...</div>;

  if (!configReady) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone size={32} className="text-yellow-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">WhatsApp Belum Terhubung</h2>
        <p className="text-gray-500 mb-6">
          Fitur Broadcast memerlukan konfigurasi API Gateway (FlowKirim/Fonnte). 
          Silakan atur API Token dan Device ID terlebih dahulu.
        </p>
        <button 
          onClick={() => window.location.hash = user.role === UserRole.ADMIN ? '#/settings' : '#/profile'}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
        >
          Buka Pengaturan
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-4">
      
      {/* LEFT COL: AUDIENCE SELECTOR */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Users className="text-blue-600" /> Target Penerima
          </h2>
          
          {/* Target Tabs */}
          <div className="flex bg-gray-200 p-1 rounded-lg mb-4 overflow-x-auto">
            {user.role === UserRole.ADMIN && (
              <button 
                onClick={() => setTargetType('TEACHERS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${targetType === 'TEACHERS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
              >
                Guru
              </button>
            )}
            <button 
              onClick={() => setTargetType('STUDENTS_CLASS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${targetType === 'STUDENTS_CLASS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              Per Kelas
            </button>
            {user.role === UserRole.ADMIN && (
              <button 
                onClick={() => setTargetType('ALL_STUDENTS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${targetType === 'ALL_STUDENTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
              >
                Semua Siswa
              </button>
            )}
            <button 
              onClick={() => { setTargetType('MANUAL'); setRecipients([]); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition flex items-center gap-1 ${targetType === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              Input Manual
            </button>
          </div>

          {/* Manual Input Form */}
          {targetType === 'MANUAL' && (
            <form onSubmit={handleAddManualRecipient} className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
               <div className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1">
                  <UserPlus size={14} /> Tambah Kontak Manual
               </div>
               <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    placeholder="Nama Lengkap" 
                    className="w-full border border-blue-200 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    required
                  />
                  <div className="flex gap-2">
                     <input 
                        type="tel" 
                        placeholder="No. WhatsApp (08...)" 
                        className="flex-1 border border-blue-200 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        required
                     />
                     <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-blue-700">
                        <UserPlus size={16} />
                     </button>
                  </div>
               </div>
            </form>
          )}

          {/* Class Filter Dropdown */}
          {targetType === 'STUDENTS_CLASS' && (
            <div className="mb-3">
              <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {classes.length === 0 && <option value="">Tidak ada kelas</option>}
              </select>
            </div>
          )}

          {/* Search & Select All */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari nama..." 
                className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => handleSelectAll(selectedCount < filteredRecipients.length)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200"
            >
              {selectedCount < filteredRecipients.length ? 'Pilih Semua' : 'Batal Pilih'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingData ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat data...</div>
          ) : filteredRecipients.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
               {targetType === 'MANUAL' ? 'Belum ada kontak ditambahkan.' : 'Tidak ada data ditemukan.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredRecipients.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => handleToggleSelect(r.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition ${
                    r.selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${r.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                      {r.selected && <Check size={10} className="text-white" />}
                    </div>
                    <div className="truncate">
                      <p className={`text-sm font-medium truncate ${r.selected ? 'text-blue-900' : 'text-gray-700'}`}>{r.name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{r.label}</span>
                        <span className={r.phone ? 'text-green-600' : 'text-red-400'}>
                          {r.phone || 'No HP'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {targetType === 'MANUAL' && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteManual(r.id); }} 
                        className="text-gray-400 hover:text-red-500 p-1"
                     >
                        <Trash2 size={14} />
                     </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
           <span>Total: {filteredRecipients.length}</span>
           <span className="font-bold text-blue-600">Terpilih: {selectedCount}</span>
        </div>
      </div>

      {/* RIGHT COL: COMPOSER */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Smartphone className="text-green-600" /> Tulis Pesan
          </h2>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-4">
           {/* Variable Helpers */}
           <div className="flex gap-2 overflow-x-auto">
              <button onClick={() => setMessage(prev => prev + ' {{name}}')} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200 transition border border-gray-200">
                 + {'{{name}}'}
              </button>
              <button onClick={() => setMessage(prev => prev + ' *tebal*')} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200 transition border border-gray-200">
                 B (Bold)
              </button>
              <button onClick={() => setMessage(prev => prev + ' _miring_')} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200 transition border border-gray-200">
                 I (Italic)
              </button>
           </div>

           <textarea 
             className="flex-1 w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none font-sans leading-relaxed"
             placeholder="Tulis pesan broadcast di sini..."
             value={message}
             onChange={(e) => setMessage(e.target.value)}
           />

           {/* Status & Action */}
           {sendingStatus === 'idle' ? (
             <button 
               onClick={handleSendBroadcast}
               disabled={selectedCount === 0 || !message}
               className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Send size={18} />
               Kirim ke {selectedCount} Penerima
             </button>
           ) : sendingStatus === 'sending' ? (
             <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-gray-600">
                   <span>Mengirim...</span>
                   <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                   <div className="bg-green-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                </div>
                <p className="text-center text-xs text-gray-400">Jangan tutup halaman ini.</p>
             </div>
           ) : (
             <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100 animate-in fade-in zoom-in">
                <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
                <h3 className="font-bold text-gray-800">Broadcast Selesai!</h3>
                <div className="flex justify-center gap-4 text-sm mt-2">
                   <span className="text-green-700">Sukses: {progress.success}</span>
                   <span className="text-red-600">Gagal: {progress.failed}</span>
                </div>
                <button onClick={() => setSendingStatus('idle')} className="mt-4 text-sm text-gray-500 underline hover:text-gray-800">
                   Kirim Lagi
                </button>
             </div>
           )}
        </div>
      </div>

    </div>
  );
};

export default BroadcastPage;
