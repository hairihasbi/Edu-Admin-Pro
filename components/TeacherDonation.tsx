
import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { Heart, Wallet, Copy, Check, Coffee, Zap, BrainCircuit, MessageCircle, CreditCard, Loader2 } from './Icons';
import { getSystemSettings } from '../services/database';

interface TeacherDonationProps {
  user: User;
}

declare global {
  interface Window {
    loadJokulCheckout: (url: string) => void;
  }
}

const TeacherDonation: React.FC<TeacherDonationProps> = ({ user }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dokuSettings, setDokuSettings] = useState<{ isProduction: boolean } | null>(null);

  useEffect(() => {
      const loadSettings = async () => {
          const settings = await getSystemSettings();
          if (settings) {
              setDokuSettings({ isProduction: !!settings.dokuIsProduction });
          }
      };
      loadSettings();
  }, []);

  const donationMethods = [
    {
      id: 1,
      name: 'DANA',
      number: '085248481527',
      color: 'bg-[#118EEA]',
      textColor: 'text-white',
      icon: <Wallet size={24} className="text-white" />
    },
    {
      id: 2,
      name: 'ShopeePay',
      number: '085248481527',
      color: 'bg-[#EE4D2D]',
      textColor: 'text-white',
      icon: <Wallet size={24} className="text-white" />
    }
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleConfirmation = () => {
    const phoneNumber = '6285248481527';
    const message = `Halo Admin, saya ${user.fullName} (${user.schoolName || 'Guru'}) ingin konfirmasi telah mengirim donasi sukarela untuk dukungan aplikasi EduAdmin Pro. Mohon dicek ya. Terima kasih.`;
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const loadDokuScript = (isProduction: boolean): Promise<void> => {
      return new Promise((resolve, reject) => {
          if (document.getElementById('doku-script')) {
              resolve();
              return;
          }
          const script = document.createElement('script');
          script.id = 'doku-script';
          script.src = isProduction 
              ? 'https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js'
              : 'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Gagal memuat DOKU JS"));
          document.body.appendChild(script);
      });
  };

  const handleDokuPayment = async () => {
      if (!dokuSettings) return;
      
      const finalAmount = isCustom ? parseInt(customAmount.replace(/\D/g, '')) : selectedAmount;
      if (!finalAmount || finalAmount < 10000) {
          alert("Minimal donasi Rp 10.000");
          return;
      }

      setIsProcessing(true);
      try {
          // 1. Load Script
          await loadDokuScript(dokuSettings.isProduction);

          // 2. Generate Payment URL
          const res = await fetch('/api/doku', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  action: 'generate-payment', 
                  amount: finalAmount, 
                  userId: user.id 
              })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Gagal membuat pembayaran");

          // 3. Show Popup
          if (window.loadJokulCheckout) {
              window.loadJokulCheckout(data.paymentUrl);
          } else {
              alert("Gagal memuat popup pembayaran. Silakan coba lagi.");
          }

      } catch (e: any) {
          console.error(e);
          alert(e.message || "Terjadi kesalahan saat memproses pembayaran.");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <Heart size={32} className="text-white animate-pulse" fill="currentColor" />
            </div>
            <h2 className="text-3xl font-bold">Dukungan Aplikasi</h2>
          </div>
          <p className="text-pink-50 text-lg max-w-2xl leading-relaxed">
            Halo, {user.fullName}. EduAdmin Pro dibuat dengan semangat untuk memajukan pendidikan Indonesia secara <strong>GRATIS</strong>. 
            Jika aplikasi ini membantu pekerjaan Anda, Anda dapat memberikan dukungan sukarela untuk biaya server dan pengembangan fitur baru.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment Methods */}
        <div className="space-y-8">
          
          {/* DOKU PAYMENT SECTION */}
          <div className="bg-white border border-indigo-100 rounded-xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Otomatis
              </div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <CreditCard className="text-indigo-600" />
                  Donasi Instan
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                  Pilih nominal donasi dan bayar langsung menggunakan QRIS, E-Wallet (OVO, GoPay, ShopeePay), atau Virtual Account.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                  {[50000, 100000, 150000].map((amt) => (
                      <button
                          key={amt}
                          onClick={() => { setSelectedAmount(amt); setIsCustom(false); }}
                          className={`py-2 px-1 rounded-lg text-sm font-bold border transition ${
                              !isCustom && selectedAmount === amt 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' 
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                      >
                          {amt / 1000}k
                      </button>
                  ))}
              </div>

              <div className="mb-6">
                  <button
                      onClick={() => setIsCustom(true)}
                      className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isCustom ? 'text-indigo-600' : 'text-gray-500'}`}
                  >
                      Atau input manual:
                  </button>
                  <div className={`relative transition-all ${isCustom ? 'opacity-100' : 'opacity-60'}`}>
                      <span className="absolute left-3 top-2.5 text-gray-500 font-bold">Rp</span>
                      <input 
                          type="text" 
                          className={`w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700 ${
                              isCustom ? 'border-indigo-300 bg-white' : 'border-gray-200 bg-gray-50'
                          }`}
                          placeholder="0"
                          value={customAmount}
                          onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setCustomAmount(new Intl.NumberFormat('id-ID').format(parseInt(val) || 0));
                              if (!isCustom) setIsCustom(true);
                          }}
                          onClick={() => setIsCustom(true)}
                      />
                  </div>
              </div>

              <button 
                  onClick={handleDokuPayment}
                  disabled={isProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-indigo-200 transition active:scale-95 flex items-center justify-center gap-2"
              >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Heart size={20} fill="currentColor" />}
                  {isProcessing ? 'Memproses...' : `Donasi Rp ${isCustom ? (customAmount || '0') : new Intl.NumberFormat('id-ID').format(selectedAmount)}`}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">Powered by DOKU Payment Gateway</p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-2">
              <Coffee className="text-gray-600" />
              Transfer Manual
            </h3>
            <p className="text-sm text-gray-500 mb-4">Atau kirim manual ke e-wallet pribadi admin:</p>
            
            <div className="space-y-4">
              {donationMethods.map((method, idx) => (
                <div 
                  key={method.id} 
                  className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${method.color}`}>
                      {method.icon}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{method.name}</p>
                      <p className="text-lg font-bold text-gray-800 tracking-wide font-mono">{method.number}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleCopy(method.number, idx)}
                    className="p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition active:scale-95"
                    title="Salin Nomor"
                  >
                    {copiedIndex === idx ? (
                      <Check size={20} className="text-green-500" />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
             <h4 className="text-green-800 font-bold mb-2 flex items-center gap-2">
                <Check size={18} /> Konfirmasi Manual
             </h4>
             <p className="text-sm text-green-700 mb-4">
                Jika melakukan transfer manual, silakan konfirmasi ke Admin. (Untuk donasi otomatis DOKU tidak perlu konfirmasi).
             </p>
             <button 
                onClick={handleConfirmation}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-sm transition flex items-center justify-center gap-2"
             >
                <MessageCircle size={20} />
                Konfirmasi via WhatsApp
             </button>
          </div>
        </div>

        {/* Impact Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Penggunaan Dana Donasi</h3>
          <ul className="space-y-4">
            <li className="flex gap-3 items-start">
              <div className="bg-green-100 p-1.5 rounded-full text-green-600 mt-0.5">
                <Zap size={16} fill="currentColor" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-sm">Biaya Server & Database</h4>
                <p className="text-xs text-gray-500">Menjaga aplikasi tetap online, cepat, dan data tersimpan aman.</p>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <div className="bg-purple-100 p-1.5 rounded-full text-purple-600 mt-0.5">
                <BrainCircuit size={16} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-sm">API Kecerdasan Buatan (AI)</h4>
                <p className="text-xs text-gray-500">Membayar token penggunaan Google Gemini AI untuk fitur Generator RPP.</p>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <div className="bg-orange-100 p-1.5 rounded-full text-orange-600 mt-0.5">
                <Coffee size={16} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-sm">Pengembangan Fitur Baru</h4>
                <p className="text-xs text-gray-500">Mendukung programmer untuk terus mengupdate fitur sesuai Kurikulum Merdeka.</p>
              </div>
            </li>
          </ul>
          
          <div className="mt-6 pt-6 border-t border-gray-100">
             <p className="text-sm text-center text-gray-500 italic">
               "Setiap rupiah donasi Anda membantu ratusan guru lain menikmati aplikasi ini secara gratis."
             </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TeacherDonation;
