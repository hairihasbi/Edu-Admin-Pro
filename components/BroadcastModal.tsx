
import React, { useState, useEffect } from 'react';
import { User, Student } from '../types';
import { getWhatsAppConfig, sendWhatsAppBroadcast } from '../services/database';
import { Send, Smartphone, X, AlertTriangle, CheckCircle, WifiOff } from './Icons';

interface BroadcastModalProps {
  user: User;
  recipients: Student[];
  onClose: () => void;
}

const BroadcastModal: React.FC<BroadcastModalProps> = ({ user, recipients, onClose }) => {
  const [message, setMessage] = useState('Halo {{name}},\n\nBerikut informasi dari sekolah:\n...');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{success: number, failed: number, errors?: string[]} | null>(null);
  const [configMissing, setConfigMissing] = useState(false);

  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    const config = await getWhatsAppConfig(user.id);
    if (!config || !config.isActive || !config.apiKey) {
        setConfigMissing(true);
    }
  };

  const handleSend = async () => {
    setStatus('sending');
    try {
        const config = await getWhatsAppConfig(user.id);
        if (!config) throw new Error("Config missing");

        // Map students to recipient format
        const targetList = recipients.map(s => ({
            phone: s.phone || '', // Needs to be handled if phone is missing
            name: s.name
        })).filter(r => r.phone.length > 5);

        if (targetList.length === 0) {
            alert("Tidak ada nomor telepon valid pada daftar penerima.");
            setStatus('idle');
            return;
        }

        const res = await sendWhatsAppBroadcast(config, targetList, message);
        setResult(res);
        setStatus('success');
    } catch (e) {
        console.error(e);
        setStatus('error');
    }
  };

  if (configMissing) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                        <Smartphone className="text-yellow-600" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">WhatsApp Belum Dikonfigurasi</h3>
                    <p className="text-gray-600 text-sm mb-6">
                        Fitur Broadcast memerlukan konfigurasi API Gateway (FlowKirim/Fonnte). 
                        Silakan atur API Token dan Device ID terlebih dahulu.
                    </p>
                    <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-6 rounded-lg transition">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Smartphone className="text-green-600" size={20} />
                Broadcast WhatsApp
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            {status === 'success' && result ? (
                <div className="text-center py-2">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="text-green-600" size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Pesan Terkirim!</h4>
                    <p className="text-gray-600 mb-4">
                        Sukses: <strong className="text-green-600">{result.success}</strong> | 
                        Gagal: <strong className="text-red-600">{result.failed}</strong>
                    </p>
                    
                    {result.errors && result.errors.length > 0 && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-left text-xs text-red-700 mb-6 max-h-32 overflow-y-auto">
                            <strong>Detail Kegagalan:</strong>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                {result.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button onClick={onClose} className="bg-blue-600 text-white font-bold py-2.5 px-8 rounded-lg hover:bg-blue-700">
                        Selesai
                    </button>
                </div>
            ) : status === 'error' ? (
                <div className="text-center py-6">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <WifiOff className="text-red-600" size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Gagal Mengirim</h4>
                    <p className="text-gray-600 mb-6">Terjadi kesalahan saat menghubungi server WhatsApp Gateway.</p>
                    <button onClick={() => setStatus('idle')} className="bg-gray-100 text-gray-700 font-bold py-2.5 px-8 rounded-lg hover:bg-gray-200">
                        Coba Lagi
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center justify-between text-sm">
                        <span className="text-blue-800 font-medium">Penerima Terpilih:</span>
                        <span className="bg-white px-2 py-1 rounded text-blue-600 font-bold border border-blue-200">{recipients.length} Orang</span>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Pesan Broadcast</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none h-40 resize-none"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ketik pesan di sini..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Gunakan <code>{`{{name}}`}</code> untuk menyebut nama siswa secara otomatis.
                        </p>
                    </div>

                    {status === 'sending' ? (
                        <button disabled className="w-full bg-gray-100 text-gray-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            Sedang Mengirim...
                        </button>
                    ) : (
                        <button onClick={handleSend} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-sm">
                            <Send size={18} /> Kirim Pesan WA
                        </button>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastModal;
