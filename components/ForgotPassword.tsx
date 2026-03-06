import React, { useState } from 'react';
import { requestPasswordReset } from '../services/database';
import { Mail, ChevronLeft, Send } from './Icons';
import { Link } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      const result = await requestPasswordReset(email);
      if (result.success) {
        setStatus('success');
        setMessage(result.message || 'Email reset password telah dikirim.');
      } else {
        setStatus('error');
        setMessage(result.message || 'Gagal mengirim email.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Terjadi kesalahan sistem.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-blue-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Lupa Password?</h2>
          <p className="text-gray-500 mt-2">Masukkan email Anda untuk menerima link reset password.</p>
        </div>

        {status === 'success' ? (
          <div className="text-center space-y-6">
            <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">
              {message}
            </div>
            <p className="text-sm text-gray-500">
              Silakan periksa kotak masuk atau folder spam email Anda.
            </p>
            <Link to="/login" className="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {status === 'error' && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Terdaftar</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="nama@sekolah.id"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                'Mengirim...'
              ) : (
                <>
                  <Send size={18} /> Kirim Link Reset
                </>
              )}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-gray-500 hover:text-blue-600 text-sm font-medium flex items-center justify-center gap-1 transition">
                <ChevronLeft size={16} /> Kembali ke Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
