// src/pages/MutasiGudang.jsx

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  X,
  Download,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import MainLayout from '../components/layout/MainLayout';
import { useDataTable } from '../hooks/useDataTable';
import { mutasiAPI, barangAPI, authAPI } from '../services/api';

export default function MutasiGudang() {
  // Current user & permissions
  const currentUser = authAPI.getCurrentUser();
  const canCreate = ['Admin', 'Manager', 'Staff'].includes(currentUser?.role);
  const canEdit = ['Admin', 'Manager', 'Staff'].includes(currentUser?.role);
  const canDelete = ['Admin', 'Manager'].includes(currentUser?.role);

  // Modal & Form states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [barangList, setBarangList] = useState([]);
  const [formData, setFormData] = useState({
    no_transaksi: '',
    tanggal: new Date().toISOString().split('T')[0],
    jenis_transaksi: 'Masuk',
    kode_barang: '',
    nama_barang: '',
    qty: 0,
    satuan: '',
    keterangan: '',
    referensi: '',
  });

  // State untuk Pencarian Barang di Modal
  const [searchTermBarang, setSearchTermBarang] = useState('');
  const [showBarangDropdown, setShowBarangDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Load barang list untuk dropdown
  useEffect(() => {
    loadBarangList();
  }, []);

  const loadBarangList = async () => {
    try {
      const result = await barangAPI.getAll();
      setBarangList(result);
    } catch (error) {
      console.error('Error loading barang:', error);
    }
  };

  // Filter barang berdasarkan input search di modal
  const filteredBarangSearch = useMemo(() => {
    if (!searchTermBarang) return [];
    const term = searchTermBarang.toLowerCase();
    return barangList.filter(b =>
      b.kode_barang.toLowerCase().includes(term) ||
      b.nama_barang.toLowerCase().includes(term)
    ).slice(0, 10); // Batasi 10 hasil untuk kenyamanan visual
  }, [searchTermBarang, barangList]);

  // Handle klik di luar untuk menutup dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowBarangDropdown(false);
      }
    };
    if (showBarangDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBarangDropdown]);

  // Fetch mutasi data
  const fetchMutasiData = useCallback(async () => {
    try {
      const result = await mutasiAPI.getAll();
      return result;
    } catch (error) {
      console.error('Error fetching mutasi:', error);
      throw error;
    }
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Custom hook untuk table management
  const {
    data: paginatedData,
    allData,
    filteredData,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilters,
    dateFilterMode,
    setDateFilterMode,
    singleDate,
    setSingleDate,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    setQuickDateFilter,
    clearDateFilter,
    sortConfig,
    requestSort,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    customRowsInput,
    setCustomRowsInput,
    handleCustomRowsApply,
    totalPages,
    totalRows,
    stats,
    refresh,
  } = useDataTable({
    fetchData: fetchMutasiData,
    filterKeys: ['jenis_transaksi', 'kode_kategori', 'nama_armada'],
    searchKeys: ['kode_barang', 'nama_barang', 'keterangan', 'referensi'],
    dateFilterKey: 'tanggal',
    defaultSort: { key: 'tanggal', direction: 'desc' },
    defaultRowsPerPage: 10
  });

  // Extract kategori & armada list dari data
  const kategoriList = useMemo(() => {
    const unique = new Set();
    allData.forEach(item => {
      if (item.kode_kategori && item.nama_kategori) {
        unique.add(JSON.stringify({
          kode: item.kode_kategori,
          nama: item.nama_kategori
        }));
      }
    });
    return Array.from(unique).map(str => JSON.parse(str));
  }, [allData]);

  const armadaList = useMemo(() => {
    const unique = new Set();
    allData.forEach(item => {
      if (item.nama_armada) {
        unique.add(item.nama_armada);
      }
    });
    return Array.from(unique).sort();
  }, [allData]);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;

    if (name === 'kode_barang') {
      const selectedBarang = barangList.find(b => b.kode_barang === value);
      if (selectedBarang) {
        setFormData(prev => ({
          ...prev,
          kode_barang: value,
          nama_barang: selectedBarang.nama_barang,
          satuan: selectedBarang.satuan,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value,
        }));
      }
    } else if (name === 'jenis_transaksi') {
      // Clear referensi jika jenis transaksi berubah ke Keluar
      setFormData(prev => ({
        ...prev,
        jenis_transaksi: value,
        referensi: value === 'Keluar' ? '' : prev.referensi,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value,
      }));
    }
  };

  const handleSelectBarang = (barang) => {
    setFormData(prev => ({
      ...prev,
      kode_barang: barang.kode_barang,
      nama_barang: barang.nama_barang,
      satuan: barang.satuan,
    }));
    setSearchTermBarang('');
    setShowBarangDropdown(false);
  };

  const resetForm = () => {
    setFormData({
      no_transaksi: '',
      tanggal: new Date().toISOString().split('T')[0],
      jenis_transaksi: 'Masuk',
      kode_barang: '',
      nama_barang: '',
      qty: 0,
      satuan: '',
      keterangan: '',
      referensi: '',
    });
    setSearchTermBarang('');
    setEditingItem(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setFormData({
      no_transaksi: item.no_transaksi || '',
      tanggal: item.tanggal || new Date().toISOString().split('T')[0],
      jenis_transaksi: item.jenis_transaksi || 'Masuk',
      kode_barang: item.kode_barang || '',
      nama_barang: item.nama_barang || '',
      qty: item.qty || 0,
      satuan: item.satuan || '',
      keterangan: item.keterangan || '',
      referensi: item.referensi || '',
    });
    setSearchTermBarang('');
    setEditingItem(item);
    setShowModal(true);
  };

  // CRUD Operations
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.tanggal || !formData.kode_barang || !formData.qty) {
      alert('Mohon lengkapi semua field yang wajib diisi!');
      return;
    }

    if (formData.qty <= 0) {
      alert('Qty harus lebih dari 0!');
      return;
    }

    try {
      const payload = {
        ...formData,
        created_by: editingItem ? undefined : currentUser.userId,
        updated_by: editingItem ? currentUser.userId : undefined,
      };

      if (editingItem) {
        await mutasiAPI.update(editingItem.id, payload);
        alert('Data mutasi berhasil diupdate!');
      } else {
        await mutasiAPI.create(payload);
        alert('Data mutasi berhasil ditambahkan!');
      }

      setShowModal(false);
      resetForm();
      await refresh();
    } catch (error) {
      console.error('Error saving mutasi:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Yakin ingin menghapus transaksi ${item.no_transaksi}?`)) {
      return;
    }

    try {
      await mutasiAPI.delete(item.id);
      alert('Data mutasi berhasil dihapus!');
      await refresh();
    } catch (error) {
      console.error('Error deleting mutasi:', error);
      alert('Error: ' + error.message);
    }
  };

  // Export to Excel
  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Tanggal': item.tanggal,
      'No Transaksi': item.no_transaksi,
      'Jenis': item.jenis_transaksi,
      'Kode Barang': item.kode_barang,
      'Nama Barang': item.nama_barang,
      'Qty': item.qty,
      'Satuan': item.satuan,
      'Kategori': item.nama_kategori || '',
      'Armada': item.nama_armada || '',
      'Referensi': item.referensi || '',
      'Keterangan': item.keterangan || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mutasi Gudang');

    const fileName = `mutasi_gudang_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading && allData.length === 0) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Toolbar: Search, Filters, Actions - All in one row */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">

            {/* Left side: Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full lg:w-auto">

              {/* Search */}
              <div className="relative flex-grow min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari transaksi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Filter Jenis Transaksi */}
              <select
                value={filters.jenis_transaksi || 'all'}
                onChange={(e) => setFilter('jenis_transaksi', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Jenis</option>
                <option value="Masuk">Masuk</option>
                <option value="Keluar">Keluar</option>
              </select>

              {/* Filter Kategori */}
              <select
                value={filters.kode_kategori || 'all'}
                onChange={(e) => setFilter('kode_kategori', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Kategori</option>
                {kategoriList.map((kat) => (
                  <option key={kat.kode} value={kat.kode}>
                    {kat.nama}
                  </option>
                ))}
              </select>

              {/* Filter Armada */}
              <select
                value={filters.nama_armada || 'all'}
                onChange={(e) => setFilter('nama_armada', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Armada</option>
                {armadaList.map((armada) => (
                  <option key={armada} value={armada}>
                    {armada}
                  </option>
                ))}
              </select>

              {/* Date Filter Mode */}
              <select
                value={dateFilterMode}
                onChange={(e) => {
                  setDateFilterMode(e.target.value);
                  if (e.target.value === 'all') {
                    clearDateFilter();
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Tanggal</option>
                <option value="single">Tanggal Spesifik</option>
                <option value="range">Rentang Tanggal</option>
              </select>

              {/* Single Date Input */}
              {dateFilterMode === 'single' && (
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              )}

              {/* Date Range Inputs */}
              {dateFilterMode === 'range' && (
                <>
                  <input

                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    placeholder="Start"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    placeholder="End"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </>
              )}

              {/* Clear All Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear all filters"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1" />

            {/* Right side: Action Buttons */}
            <div className="flex gap-2 w-full lg:w-auto">
              <button
                onClick={handleExport}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>

              {canCreate && (
                <button
                  onClick={openCreateModal}
                  className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
              {activeFilters.map((filter, idx) => {
                if (filter.type === 'search') {
                  return (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200">
                      <Search className="w-3 h-3" />
                      Search: "{filter.value}"
                      <button onClick={() => setSearchQuery('')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.type === 'date-single') {
                  return (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
                      <Calendar className="w-3 h-3" />
                      Date: {filter.value}
                      <button onClick={clearDateFilter} className="hover:bg-purple-100 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.type === 'date-range') {
                  return (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
                      <Calendar className="w-3 h-3" />
                      Range: {filter.value}
                      <button onClick={clearDateFilter} className="hover:bg-purple-100 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                const displayValue = filter.key === 'kode_kategori'
                  ? kategoriList.find(k => k.kode === filter.value)?.nama || filter.value
                  : filter.key === 'kode_armada'
                    ? armadaOptions.find(a => a.kode === filter.value)?.nama || filter.value
                    : filter.value;

                return (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                    <Filter className="w-3 h-3" />
                    {filter.key === 'kode_kategori' && 'Kategori: '}
                    {filter.key === 'kode_armada' && 'Armada: '}
                    {filter.key === 'status' && 'Status: '}
                    {displayValue}
                    <button onClick={() => setFilter(filter.key, 'all')} className="hover:bg-green-100 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Date Filters (if date mode active) */}
        {
          dateFilterMode !== 'all' && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 font-medium mr-2">Quick Filters:</span>
                <button
                  onClick={() => setQuickDateFilter('today')}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setQuickDateFilter('yesterday')}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Kemarin
                </button>
                <button
                  onClick={() => setQuickDateFilter('this-week')}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Minggu Ini
                </button>
                <button
                  onClick={() => setQuickDateFilter('this-month')}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Bulan Ini
                </button>
                <button
                  onClick={() => setQuickDateFilter('last-month')}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Bulan Lalu
                </button>
              </div>
            </div>
          )
        }

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => requestSort('tanggal')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Tanggal {sortConfig.key === 'tanggal' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jenis
                  </th>
                  <th
                    onClick={() => requestSort('kode_barang')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Kode {sortConfig.key === 'kode_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Barang
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referensi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  {(canEdit || canDelete) && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                      {hasActiveFilters
                        ? 'Tidak ada data yang sesuai dengan filter'
                        : 'Belum ada data mutasi gudang'}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(item.tanggal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${item.jenis_transaksi === 'Masuk'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {item.jenis_transaksi === 'Masuk' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {item.jenis_transaksi}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                        {item.kode_barang}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.nama_barang}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        {item.qty} {item.satuan}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.referensi || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.keterangan || '-'}
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit && (
                              <button
                                onClick={() => openEditModal(item)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(item)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>

            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {/* Rows Per Page Selector */}
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span>Show</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 focus:ring-green-500 outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={rowsPerPage} hidden={[10, 20, 30, 50].includes(rowsPerPage)}>
                      {rowsPerPage}
                    </option>
                  </select>

                  {/* Custom Rows Input */}
                  <div className="flex items-center border border-gray-300 rounded ml-1">
                    <input
                      type="number"
                      placeholder="Custom"
                      value={customRowsInput}
                      onChange={(e) => setCustomRowsInput(e.target.value)}
                      className="w-16 px-2 py-1 text-sm outline-none rounded-l"
                    />
                    <button
                      onClick={handleCustomRowsApply}
                      className="bg-gray-100 px-2 py-1 text-xs border-l hover:bg-gray-200 rounded-r"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * rowsPerPage, totalRows)}
                  </span> of{' '}
                  <span className="font-medium">{totalRows}</span> results
                </p>
              </div>

              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Prev
                  </button>

                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-green-50 text-sm font-medium text-green-600">
                    Page {currentPage} of {totalPages || 1}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Last
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                {/* Modal Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                  <h2 className="text-xl font-bold">
                    {editingItem ? 'Edit Mutasi Gudang' : 'Tambah Mutasi Gudang'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-4 space-y-6">
                  {/* Tanggal & Jenis Transaksi*/}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tanggal *
                      </label>
                      <input
                        type="date"
                        name="tanggal"
                        value={formData.tanggal}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Jenis Transaksi *
                      </label>
                      <select
                        name="jenis_transaksi"
                        value={formData.jenis_transaksi}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="Masuk">Masuk</option>
                        <option value="Keluar">Keluar</option>
                      </select>
                    </div>
                  </div>

                  {/* Search Bar Barang */}
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cari Barang *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Ketik kode atau nama barang..."
                        value={searchTermBarang}
                        onChange={(e) => { setSearchTermBarang(e.target.value); setShowBarangDropdown(true); }}
                        onFocus={() => setShowBarangDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>

                    {showBarangDropdown && searchTermBarang && (
                      <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredBarangSearch.length > 0 ? (
                          filteredBarangSearch.map((barang) => (
                            <div
                              key={barang.kode_barang}
                              onClick={() => handleSelectBarang(barang)}
                              className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0"
                            >
                              <div className="text-sm font-bold text-gray-800">{barang.kode_barang}</div>
                              <div className="text-xs text-gray-600">{barang.nama_barang} ({barang.satuan})</div>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center italic">Barang tidak ditemukan</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Preview Auto-fill */}
                  <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
                    <div>
                      <span className="block text-[10px] uppercase text-gray-400 font-bold">Kode Barang</span>
                      <span className="text-sm font-mono font-semibold">{formData.kode_barang || '-'}</span>
                    </div>
                    <div className="col-span-1">
                      <span className="block text-[10px] uppercase text-gray-400 font-bold">Nama Barang</span>
                      <span className="text-sm">{formData.nama_barang || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-gray-400 font-bold">Satuan</span>
                      <span className="text-sm">{formData.satuan || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qty *</label>
                      <input type="number" name="qty" value={formData.qty} onChange={handleInputChange} required min="0.01" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Referensi</label>
                      <input
                        type="text"
                        name="referensi"
                        value={formData.referensi}
                        onChange={handleInputChange}
                        placeholder="PO/DO Number"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                    <textarea name="keterangan" value={formData.keterangan} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="Catatan..."></textarea>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.kode_barang}
                    className={`px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'}`}
                  >
                    {editingItem ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </MainLayout>
  );
}