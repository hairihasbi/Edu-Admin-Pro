
import React, { useState, useEffect, useRef } from 'react';
import { User, Ticket, UserRole } from '../types';
import { createTicket, getTickets, replyTicket, closeTicket, deleteTicket } from '../services/database';
import { LifeBuoy, Send, Plus, Search, CheckCircle, X, MessageCircle, User as UserIcon, RefreshCcw, Trash2 } from './Icons';

interface HelpCenterProps {
  user: User;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ user }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  
  // New Ticket State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');

  // Scroll Ref for Chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();

    // LISTEN TO SYNC EVENTS: Auto-refresh data when Admin pulls from cloud
    const handleSyncStatus = (e: any) => {
        if (e.detail === 'success') {
            fetchTickets();
        }
    };
    window.addEventListener('sync-status', handleSyncStatus);
    
    return () => {
        window.removeEventListener('sync-status', handleSyncStatus);
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedTicket]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await getTickets(user);
      // Sort by last updated (newest first)
      const sorted = data.sort((a, b) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA;
      });
      setTickets(sorted);
      
      // Refresh selected ticket if it exists (to show new messages)
      if (selectedTicket) {
        const updated = sorted.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (e) {
      console.error("Failed to load tickets", e);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject || !newMessage) return;

    const newTicket = await createTicket(user, newSubject, newMessage);
    setTickets([newTicket, ...tickets]);
    setIsModalOpen(false);
    setNewSubject('');
    setNewMessage('');
    setSelectedTicket(newTicket);
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    const success = await replyTicket(selectedTicket.id, user, replyText);
    if (success) {
      setReplyText('');
      await fetchTickets(); // Refresh data to get new message
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (window.confirm("Apakah Anda yakin masalah ini sudah selesai? Tiket akan ditutup.")) {
      const success = await closeTicket(selectedTicket.id);
      if (success) {
        // Optimistic UI Update
        const updatedTicket = { ...selectedTicket, status: 'CLOSED' as const };
        setSelectedTicket(updatedTicket);
        
        // Refresh List
        await fetchTickets();
      } else {
        alert("Gagal menutup tiket.");
      }
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicket) return;
    if (window.confirm("PERINGATAN: Apakah Anda yakin ingin menghapus riwayat pesan ini secara permanen? Data yang dihapus tidak dapat dikembalikan.")) {
      const success = await deleteTicket(selectedTicket.id);
      if (success) {
        setSelectedTicket(null);
        await fetchTickets();
        alert("Riwayat pesan berhasil dihapus.");
      } else {
        alert("Gagal menghapus riwayat pesan.");
      }
    }
  };

  // Helper: Format Time
  const formatTime = (isoString: string) => {
    try {
        return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
  };

  const getLastMessage = (ticket: Ticket) => {
      if (ticket.messages && Array.isArray(ticket.messages) && ticket.messages.length > 0) {
          return ticket.messages[ticket.messages.length - 1]?.message || 'Pesan kosong';
      }
      return 'Belum ada pesan';
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      
      {/* LEFT SIDE: TICKET LIST */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col md:w-1/3 ${selectedTicket ? 'hidden md:flex' : 'flex h-full'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <LifeBuoy className="text-blue-600" /> Pusat Bantuan
            </h2>
            <div className="flex gap-2">
                <button onClick={fetchTickets} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition" title="Refresh">
                    <RefreshCcw size={18} />
                </button>
                {user.role === UserRole.GURU && (
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow-sm transition"
                    title="Buat Tiket Baru"
                >
                    <Plus size={20} />
                </button>
                )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari tiket..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && tickets.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Memuat tiket...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Belum ada tiket bantuan.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 cursor-pointer transition hover:bg-gray-50 ${
                    selectedTicket?.id === ticket.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`font-semibold text-sm line-clamp-1 ${selectedTicket?.id === ticket.id ? 'text-blue-700' : 'text-gray-800'}`}>
                      {ticket.subject}
                    </h4>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                      {ticket.lastUpdated ? new Date(ticket.lastUpdated).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                    {getLastMessage(ticket)}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ticket.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {ticket.status}
                    </span>
                    {user.role === UserRole.ADMIN && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <UserIcon size={10} /> {ticket.teacherName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: CHAT AREA */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 ${!selectedTicket ? 'hidden md:flex' : 'flex h-full'}`}>
        {selectedTicket ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button className="md:hidden text-gray-500" onClick={() => setSelectedTicket(null)}>
                  <X size={20} />
                </button>
                <div>
                  <h3 className="font-bold text-gray-800">{selectedTicket.subject}</h3>
                  <p className="text-xs text-gray-500">
                    Tiket #{selectedTicket.id.slice(-4)} • {user.role === UserRole.ADMIN ? `Dari: ${selectedTicket.teacherName}` : selectedTicket.status === 'OPEN' ? 'Sedang Diproses' : 'Selesai'}
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              {selectedTicket.status === 'OPEN' && user.role === UserRole.ADMIN && (
                <button 
                  onClick={handleCloseTicket}
                  className="text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <CheckCircle size={14} /> Tandai Selesai
                </button>
              )}
              {selectedTicket.status === 'CLOSED' && (
                 <div className="flex items-center gap-2">
                     <span className="bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={14} /> Ditutup
                     </span>
                     <button 
                        onClick={handleDeleteTicket}
                        className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        title="Hapus Riwayat Pesan Secara Permanen"
                     >
                        <Trash2 size={14} /> Hapus Riwayat
                     </button>
                 </div>
              )}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {(selectedTicket.messages || []).map((msg) => {
                const isMe = msg.senderRole === user.role;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      isMe 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {isMe ? 'Saya' : msg.senderName}
                      </span>
                      <span className="text-[10px] text-gray-300">•</span>
                      <span className="text-[10px] text-gray-400">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl">
              {selectedTicket.status === 'OPEN' ? (
                <div className="flex gap-2">
                  <textarea 
                    rows={1}
                    placeholder="Tulis balasan..." 
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <button 
                    onClick={handleReply}
                    disabled={!replyText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl shadow-sm transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Send size={20} />
                  </button>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 bg-gray-50 py-3 rounded-lg border border-gray-200">
                  Tiket ini telah ditutup. Anda tidak dapat membalas pesan ini lagi.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle size={64} className="mb-4 opacity-20" />
            <p className="font-medium">Pilih tiket untuk melihat percakapan</p>
          </div>
        )}
      </div>

      {/* CREATE TICKET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Buat Tiket Bantuan</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subjek Masalah</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Contoh: Tidak bisa input nilai"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pesan / Detail Masalah</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  placeholder="Jelaskan masalah yang Anda alami..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition"
              >
                Kirim Tiket
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default HelpCenter;
