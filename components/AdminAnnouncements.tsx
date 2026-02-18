
import React, { useState, useEffect } from 'react';
import { Notification, UserRole } from '../types';
import { getActiveAnnouncements, createNotification, deleteNotification } from '../services/database';
import { Bell, Trash2, Megaphone, AlertCircle, CheckCircle, Info, Zap } from './Icons';

const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info' as Notification['type']
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const data = await getActiveAnnouncements();
    setAnnouncements(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.message) return;

    setIsSubmitting(true);
    await createNotification(
        form.title, 
        form.message, 
        form.type, 
        UserRole.GURU, 
        true // isPopup = true
    );
    setForm({ title: '', message: '', type: 'info' });
    setIsSubmitting(false);
    await fetchData();
    alert('Pengumuman Live berhasil diterbitkan!');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus pengumuman ini? Guru tidak akan melihatnya lagi.')) {
      await deleteNotification(id);
      await fetchData();
    }
  };

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'update': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'alert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'maintenance': return <AlertCircle size={16} />;
      case 'update': return <Zap size={16} />;
      case 'alert': return <AlertCircle size={16} />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full animate-pulse">
          <Megaphone size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Live Announcements</h2>
          <p className="text-sm text-gray-500">Kirim pemberitahuan Pop-up langsung ke layar Dashboard Guru.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form */}
        <div className="lg:col-span-1">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
              <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Buat Pengumuman Baru</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Judul Pop-up</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Contoh: Maintenance Sistem"
                      value={form.title}
                      onChange={e => setForm({...form, title: e.target.value})}
                      required
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['info', 'update', 'maintenance', 'alert'].map(type => (
                          <label 
                            key={type}
                            className={`flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-bold uppercase transition ${
                               form.type === type 
                               ? 'bg-gray-800 text-white border-gray-800' 
                               : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                             <input 
                               type="radio" 
                               name="type" 
                               className="hidden"
                               checked={form.type === type} 
                               onChange={() => setForm({...form, type: type as any})} 
                             />
                             {type}
                          </label>
                       ))}
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Isi Pesan</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm h-32 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      placeholder="Tulis pesan lengkap di sini..."
                      value={form.message}
                      onChange={e => setForm({...form, message: e.target.value})}
                      required
                    />
                 </div>

                 <button 
                   type="submit" 
                   disabled={isSubmitting}
                   className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                 >
                    <Megaphone size={16} />
                    {isSubmitting ? 'Mengirim...' : 'Terbitkan Sekarang'}
                 </button>
              </form>
           </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                 <h3 className="font-bold text-gray-700">Daftar Pengumuman Aktif</h3>
              </div>
              
              <div className="divide-y divide-gray-100">
                 {announcements.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">
                       <Megaphone size={48} className="mx-auto mb-3 opacity-20" />
                       <p>Belum ada pengumuman aktif.</p>
                    </div>
                 ) : (
                    announcements.map(item => (
                       <div key={item.id} className="p-6 hover:bg-gray-50 transition group">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${getTypeStyle(item.type)}`}>
                                   {getTypeIcon(item.type)} {item.type}
                                </span>
                                <h4 className="font-bold text-gray-800">{item.title}</h4>
                             </div>
                             <button 
                               onClick={() => handleDelete(item.id)}
                               className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition"
                               title="Hapus"
                             >
                                <Trash2 size={18} />
                             </button>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                             {item.message}
                          </p>
                          
                          <div className="flex justify-between items-center text-xs text-gray-400">
                             <span>Dibuat: {new Date(item.createdAt).toLocaleString('id-ID')}</span>
                             <span className="flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle size={12} /> Tayang di Guru
                             </span>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default AdminAnnouncements;
