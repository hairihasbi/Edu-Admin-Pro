import React, { useState, useEffect } from 'react';
import { User, TeacherCalendarEvent } from '../types';
import { getCalendarEvents, addCalendarEvent, deleteCalendarEvent } from '../services/database';
import { Calendar, Plus, Trash2, AlertCircle } from 'lucide-react';

interface TeacherCalendarManagerProps {
    user: User;
}

const TeacherCalendarManager: React.FC<TeacherCalendarManagerProps> = ({ user }) => {
    const [events, setEvents] = useState<TeacherCalendarEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [eventType, setEventType] = useState<'HOLIDAY' | 'LEAVE' | 'SCHOOL_EVENT' | 'OTHER'>('HOLIDAY');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadEvents();
    }, [user.id, selectedDate]);

    const loadEvents = async () => {
        // Load events for the current month/year context or just all relevant ones
        // For simplicity, let's load events for the current month +/- 1 month
        // Or just load all for now if the list is small, but better to be specific.
        // Actually, the UI might be a list or a calendar view.
        // Let's implement a simple list view for the selected month first.
        
        const start = new Date(selectedDate);
        start.setDate(1); // First day of month
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0); // Last day of month

        const data = await getCalendarEvents(user.id, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        setEvents(data);
    };

    const handleAddEvent = async () => {
        if (!description) return;
        setIsLoading(true);
        try {
            await addCalendarEvent(user.id, selectedDate, eventType, description);
            setDescription('');
            loadEvents();
        } catch (error) {
            console.error("Failed to add event", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm('Hapus event ini?')) return;
        try {
            await deleteCalendarEvent(id);
            loadEvents();
        } catch (error) {
            console.error("Failed to delete event", error);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kalender Guru</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Kelola hari libur dan agenda khusus</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form Input */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Event</label>
                        <select 
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="HOLIDAY">Libur Nasional / Sekolah</option>
                            <option value="LEAVE">Cuti / Izin</option>
                            <option value="SCHOOL_EVENT">Kegiatan Sekolah</option>
                            <option value="OTHER">Lainnya</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan</label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Contoh: Libur Idul Fitri"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                        />
                    </div>
                    <button 
                        onClick={handleAddEvent}
                        disabled={isLoading || !description}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Event</span>
                    </button>
                </div>

                {/* Event List */}
                <div className="md:col-span-2 space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Daftar Event Bulan {new Date(selectedDate).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                    </h3>
                    
                    {events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">Belum ada event di bulan ini</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {events.map(event => (
                                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className={`
                                            w-2 h-2 mt-2 rounded-full flex-shrink-0
                                            ${event.type === 'HOLIDAY' ? 'bg-red-500' : 
                                              event.type === 'LEAVE' ? 'bg-orange-500' : 
                                              event.type === 'SCHOOL_EVENT' ? 'bg-blue-500' : 'bg-gray-500'}
                                        `} />
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">{event.description}</p>
                                            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                                                {event.type === 'HOLIDAY' ? 'Libur' : 
                                                 event.type === 'LEAVE' ? 'Cuti/Izin' : 
                                                 event.type === 'SCHOOL_EVENT' ? 'Kegiatan' : 'Lainnya'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteEvent(event.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherCalendarManager;
