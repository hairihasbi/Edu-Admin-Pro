
import React, { useState, useEffect } from 'react';
import { User, ClassRoom, ScopeMaterial } from '../types';
import { getClasses, addScopeMaterial, getScopeMaterials, deleteScopeMaterial, bulkDeleteScopeMaterials, copyScopeMaterials } from '../services/database';
import { Plus, Trash2, List, Copy, Save, Filter, X, FileText, ChevronLeft, ChevronRight, AlertCircle, ArrowRight } from './Icons';
import { Link } from 'react-router-dom';

interface TeacherScopeMaterialProps {
  user: User;
}

const SEMESTERS = ['Ganjil', 'Genap'];

const TeacherScopeMaterial: React.FC<TeacherScopeMaterialProps> = ({ user }) => {
  // Data States
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [materials, setMaterials] = useState<ScopeMaterial[]>([]);
  
  // Selection States
  const [filterClassId, setFilterClassId] = useState<string>(''); // Default Empty = All Classes
  const [filterSemester, setFilterSemester] = useState<string>('Ganjil');
  
  // Form State
  const [formData, setFormData] = useState({
    classId: '', // Specific Class ID for Input
    code: '',
    phase: '',
    content: ''
  });
  
  // Sub-Scopes Input State
  const [subScopeInput, setSubScopeInput] = useState('');
  const [subScopes, setSubScopes] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // UI States
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  
  // Copy Modal State
  const [copySourceClassId, setCopySourceClassId] = useState('');
  const [copySourceSemester, setCopySourceSemester] = useState('Ganjil');

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cls = await getClasses(user.id);
      setClasses(cls);
      
      // Default Form Class to First Available
      if (cls.length > 0) {
        setFormData(prev => ({ ...prev, classId: cls[0].id }));
      }
      
      setLoading(false);
    };
    init();
  }, [user]);

  // Fetch Materials when Filter Class or Semester changes
  useEffect(() => {
    fetchMaterials();
  }, [filterClassId, filterSemester]);

  // Sync Form Class with Filter Class if user selects a specific class
  useEffect(() => {
      if (filterClassId) {
          setFormData(prev => ({ ...prev, classId: filterClassId }));
      }
  }, [filterClassId]);

  const fetchMaterials = async () => {
    setLoading(true);
    // Fetch materials (supports empty classId for ALL)
    const data = await getScopeMaterials(filterClassId, filterSemester, user.id);
    setMaterials(data);
    setSelectedIds(new Set()); // Reset selection
    setCurrentPage(1); // Reset page
    setLoading(false);
  };

  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubScopeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = subScopeInput.trim();
        if (val && !subScopes.includes(val)) {
            setSubScopes([...subScopes, val]);
            setSubScopeInput('');
        }
    }
  };

  const removeSubScope = (index: number) => {
      setSubScopes(subScopes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.classId || !formData.code || !formData.content) return;

    // PASS userId and subject
    const newItem = await addScopeMaterial({
      classId: formData.classId,
      userId: user.id,
      subject: user.subject || 'Umum',
      semester: filterSemester, // Use currently viewed semester for simplicity, or add semester to form if needed
      code: formData.code,
      phase: formData.phase,
      content: formData.content,
      subScopes: subScopes 
    });

    if (newItem) {
      // Optimistic Update: If current view includes this class, add to list
      if (!filterClassId || filterClassId === formData.classId) {
          setMaterials([...materials, newItem]);
      }
      
      setFormData(prev => ({ ...prev, code: '', phase: '', content: '' })); // Reset form content
      setSubScopes([]); // Reset subscopes
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus Lingkup Materi ini?')) {
      await deleteScopeMaterial(id);
      setMaterials(materials.filter(m => m.id !== id));
    }
  };

  // Bulk Selection
  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(materials.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Hapus ${selectedIds.size} data terpilih?`)) {
      await bulkDeleteScopeMaterials(Array.from(selectedIds));
      setMaterials(materials.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
    }
  };

  // Copy Feature
  const handleCopy = async () => {
    // Determine Target Class
    // If filter is specific, use it. If not, maybe use form data or require selection.
    // For now, let's use formData.classId as target if filter is ALL.
    const targetClassId = filterClassId || formData.classId;

    if (!copySourceClassId || !targetClassId) {
        alert("Pilih kelas tujuan terlebih dahulu.");
        return;
    }

    if (copySourceClassId === targetClassId && copySourceSemester === filterSemester) {
        alert("Sumber dan Tujuan tidak boleh sama.");
        return;
    }

    const success = await copyScopeMaterials(
        copySourceClassId, 
        targetClassId, 
        copySourceSemester, 
        filterSemester, 
        user.id, 
        user.subject || 'Umum'
    );
    
    if (success) {
      fetchMaterials(); // Refresh list
      setIsCopyModalOpen(false);
      alert('Data berhasil disalin!');
    } else {
      alert('Gagal menyalin atau data sumber kosong.');
    }
  };

  // --- PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = materials.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(materials.length / itemsPerPage);

  // Helper to get class name
  const getClassName = (clsId: string) => {
      return classes.find(c => c.id === clsId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <List className="text-blue-600" />
            Lingkup Materi
          </h2>
          <p className="text-sm text-gray-500 mt-1">Kelola capaian pembelajaran dan sub-kolom penilaian.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Class Filter */}
          <div className="relative">
             <select 
               value={filterClassId}
               onChange={(e) => setFilterClassId(e.target.value)}
               className="w-full sm:w-64 pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
             >
               <option value="">Semua Kelas</option>
               {classes.map(c => (
                 <option key={c.id} value={c.id}>{c.name}</option>
               ))}
             </select>
             <Filter size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Semester Filter */}
          <div className="relative">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full sm:w-36 pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
            >
              {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Filter size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>

          <button 
            onClick={() => setIsCopyModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <Copy size={16} /> Salin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Input Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-20">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-green-600" /> Input Materi Baru
            </h3>
            
            {classes.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-center space-y-2">
                    <AlertCircle className="mx-auto text-yellow-600" size={24} />
                    <p className="text-sm text-yellow-800 font-medium">Data Kelas Tidak Ditemukan</p>
                    <p className="text-xs text-yellow-700">Data kelas diambil dari menu Manajemen Kelas. Silakan input kelas terlebih dahulu.</p>
                    <Link to="/classes" className="inline-flex items-center gap-1 text-xs text-blue-600 font-bold hover:underline mt-2">
                        Ke Manajemen Kelas <ArrowRight size={12} />
                    </Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Class Selector for Input */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Pilih Kelas Tujuan</label>
                    <select
                        name="classId"
                        value={formData.classId}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        required
                    >
                        <option value="" disabled>-- Pilih Kelas --</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Kode / BAB Materi</label>
                    <input
                    type="text"
                    name="code"
                    placeholder="Contoh: LM-01"
                    required
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.code}
                    onChange={handleInputChange}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Isian Lingkup Materi</label>
                    <textarea
                    name="content"
                    rows={3}
                    placeholder="Deskripsi materi..."
                    required
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    value={formData.content}
                    onChange={handleInputChange}
                    />
                </div>
                
                {/* SUB SCOPES INPUT (NEW) */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase flex justify-between">
                        Sub-Elemen Penilaian
                        <span className="text-[10px] text-gray-400 font-normal">Opsional</span>
                    </label>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                        {subScopes.map((scope, idx) => (
                            <span key={idx} className="bg-white border border-blue-200 text-blue-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                                {scope}
                                <button type="button" onClick={() => removeSubScope(idx)} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                            </span>
                        ))}
                    </div>

                    <input 
                        type="text"
                        placeholder="Ketik & Enter (Misal: Tugas 1, Praktik)"
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={subScopeInput}
                        onChange={e => setSubScopeInput(e.target.value)}
                        onKeyDown={handleSubScopeKeyDown}
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                        *Jika diisi, input nilai akan menjadi bertingkat (Nilai LM = Rata-rata Sub).
                    </p>
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
                >
                    <Save size={16} /> Simpan
                </button>
                </form>
            )}
          </div>
        </div>

        {/* Data List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col">
            {/* List Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  onChange={handleSelectAll}
                  checked={materials.length > 0 && selectedIds.size === materials.length}
                />
                <span className="text-sm font-semibold text-gray-700">Daftar Lingkup Materi</span>
                <span className="text-xs bg-white border px-2 py-0.5 rounded-full text-gray-500">{materials.length}</span>
              </div>
              {selectedIds.size > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-800 text-xs font-medium flex items-center gap-1 bg-red-50 px-3 py-1 rounded-lg transition"
                >
                  <Trash2 size={14} /> Hapus ({selectedIds.size})
                </button>
              )}
            </div>

            {/* List Body */}
            <div className="flex-1">
              {loading ? (
                <div className="p-10 text-center text-gray-400">Memuat data...</div>
              ) : materials.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                  <FileText size={48} className="mb-3 opacity-20" />
                  <p>Belum ada data materi untuk filter ini.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {currentItems.map(item => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 transition group flex gap-4 items-start">
                      <div className="pt-1">
                        <input 
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds.has(item.id)}
                          onChange={() => handleToggleSelect(item.id)}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                            {item.code}
                          </span>
                          
                          {/* Class Badge if Filtering All */}
                          {!filterClassId && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded border border-gray-200">
                                  {getClassName(item.classId)}
                              </span>
                          )}

                          {item.subScopes && item.subScopes.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                  {item.subScopes.map((ss, i) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded border border-purple-100">
                                          {ss}
                                      </span>
                                  ))}
                              </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{item.content}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && !loading && (
                <div className="flex items-center justify-between border-t border-gray-100 p-4 bg-gray-50">
                    <div className="text-sm text-gray-500">
                        Halaman {currentPage} dari {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        
                        {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                            let p = i + 1;
                            if (totalPages > 5 && currentPage > 3) p = currentPage - 2 + i;
                            if (p > totalPages) return null;
                            
                            return (
                                <button 
                                    key={p}
                                    onClick={() => setCurrentPage(p)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                                        currentPage === p 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        })}

                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>

      </div>

      {/* Copy Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Copy size={20} className="text-indigo-600" /> Salin Lingkup Materi
              </h3>
              <button onClick={() => setIsCopyModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-200">
                Data akan disalin ke: <strong>{filterClassId ? getClassName(filterClassId) : 'Pilih Kelas Tujuan'}</strong> (Semester {filterSemester}).
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dari Kelas (Sumber)</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={copySourceClassId}
                  onChange={(e) => setCopySourceClassId(e.target.value)}
                >
                  <option value="">-- Pilih Kelas Sumber --</option>
                  {classes.filter(c => c.id !== filterClassId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dari Semester (Sumber)</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={copySourceSemester}
                  onChange={(e) => setCopySourceSemester(e.target.value)}
                >
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {!filterClassId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ke Kelas (Tujuan)</label>
                    <select 
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.classId}
                        onChange={(e) => setFormData(prev => ({...prev, classId: e.target.value}))}
                    >
                        <option value="">-- Pilih Kelas Tujuan --</option>
                        {classes.filter(c => c.id !== copySourceClassId).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
              )}

              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => setIsCopyModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Batal
                </button>
                <button 
                  onClick={handleCopy}
                  disabled={!copySourceClassId}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:bg-gray-300"
                >
                  Salin Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherScopeMaterial;
