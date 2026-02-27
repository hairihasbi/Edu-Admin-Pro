import React, { useState, useEffect } from 'react';
import { 
  Trash2, Search, CreditCard, CheckCircle, XCircle, Clock, 
  AlertTriangle, ChevronLeft, ChevronRight, Download
} from './Icons';
import { getDonations, deleteDonation, getAllUsers } from '../services/database';
import { Donation, User } from '../types';
import { Link } from 'react-router-dom';

const DonationHistory: React.FC = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [donationsData, usersData] = await Promise.all([
        getDonations(),
        getAllUsers()
      ]);
      
      const userMap: Record<string, User> = {};
      usersData.forEach(u => userMap[u.id] = u);
      
      setDonations(donationsData);
      setUsers(userMap);
    } catch (error) {
      console.error("Failed to load donations", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data donasi ini secara permanen?')) {
      await deleteDonation(id);
      loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle size={12}/> LUNAS</span>;
      case 'PENDING': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock size={12}/> MENUNGGU</span>;
      case 'FAILED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><XCircle size={12}/> GAGAL</span>;
      default: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const filteredDonations = donations.filter(d => 
    d.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (users[d.userId]?.fullName || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredDonations.length / itemsPerPage);
  const paginatedDonations = filteredDonations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <CreditCard className="text-blue-600" /> Riwayat Donasi
           </h1>
           <p className="text-gray-500 text-sm">Daftar transaksi pembayaran via DOKU</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50">
           <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari Invoice / Nama Donatur..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="text-sm text-gray-500">
              Total: <span className="font-bold text-gray-800">{filteredDonations.length}</span> Transaksi
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold border-b">Invoice ID</th>
                <th className="p-4 font-semibold border-b">Tanggal</th>
                <th className="p-4 font-semibold border-b">Donatur</th>
                <th className="p-4 font-semibold border-b">Jumlah</th>
                <th className="p-4 font-semibold border-b">Metode</th>
                <th className="p-4 font-semibold border-b">Status</th>
                <th className="p-4 font-semibold border-b text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                 <tr><td colSpan={7} className="p-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : paginatedDonations.length === 0 ? (
                 <tr><td colSpan={7} className="p-8 text-center text-gray-500">Tidak ada data donasi ditemukan.</td></tr>
              ) : (
                paginatedDonations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-mono text-xs font-medium text-gray-600">{donation.invoiceNumber}</td>
                    <td className="p-4 text-gray-600">
                      {new Date(donation.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">{users[donation.userId]?.fullName || 'Unknown User'}</div>
                      <div className="text-xs text-gray-400">{users[donation.userId]?.email || '-'}</div>
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      Rp {donation.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="p-4 text-gray-600">{donation.paymentMethod}</td>
                    <td className="p-4">{getStatusBadge(donation.status)}</td>
                    <td className="p-4 text-right">
                       <button 
                         onClick={() => handleDelete(donation.id)}
                         className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                         title="Hapus Permanen"
                       >
                         <Trash2 size={18} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
             <button 
               disabled={currentPage === 1}
               onClick={() => setCurrentPage(p => p - 1)}
               className="px-3 py-1 rounded border bg-white disabled:opacity-50 text-sm"
             >
               Prev
             </button>
             <span className="text-sm text-gray-600">Halaman {currentPage} dari {totalPages}</span>
             <button 
               disabled={currentPage === totalPages}
               onClick={() => setCurrentPage(p => p + 1)}
               className="px-3 py-1 rounded border bg-white disabled:opacity-50 text-sm"
             >
               Next
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationHistory;
