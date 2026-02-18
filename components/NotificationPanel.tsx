import React from 'react';
import { Bell, Check, Trash2, X, AlertCircle, CheckCircle } from './Icons';
import { Notification } from '../types';

interface NotificationPanelProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  notifications, 
  isOpen, 
  onClose, 
  onMarkAsRead,
  onClearAll 
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 w-full max-w-sm bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-top-5 duration-200">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Bell size={18} className="text-blue-600" />
          Notifikasi
        </h3>
        <div className="flex gap-2">
           {notifications.length > 0 && (
            <button 
              onClick={onClearAll}
              className="text-gray-500 hover:text-red-500 p-1 rounded transition"
              title="Hapus semua"
            >
              <Trash2 size={16} />
            </button>
           )}
           <button 
             onClick={onClose}
             className="text-gray-500 hover:text-gray-800 p-1 rounded transition"
           >
             <X size={18} />
           </button>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Bell size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Tidak ada notifikasi baru</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-3 rounded-lg border transition cursor-pointer hover:bg-gray-50 ${
                notif.isRead 
                  ? 'bg-white border-gray-100' 
                  : 'bg-blue-50/50 border-blue-100 shadow-sm'
              }`}
              onClick={() => onMarkAsRead(notif.id)}
            >
              <div className="flex justify-between items-start gap-3">
                <div className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${
                  notif.type === 'alert' ? 'bg-red-100 text-red-600' :
                  notif.type === 'success' ? 'bg-green-100 text-green-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {notif.type === 'alert' ? <AlertCircle size={14} /> : 
                   notif.type === 'success' ? <CheckCircle size={14} /> : 
                   <Bell size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-sm font-medium ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                      {notif.title}
                    </h4>
                    {!notif.isRead && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {new Date(notif.createdAt).toLocaleString('id-ID', { 
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;