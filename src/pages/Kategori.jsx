// src/pages/Kategori.jsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { authAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import * as XLSX from 'xlsx';
import { Plus, Edit, Trash2, Download, Upload, Search, X, Save, RefreshCw,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Kategori() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // ============================================
  // Define fetchData with useCallback
  // ============================================
  const fetchKategoriData = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/data/kategori`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load data');
    return await response.json();
  }, []);

  // ============================================
  // Configure useDataTable Hook
  // ============================================
  const {
    data: paginatedData,
    filteredData,
    loading,
    error,
    
    searchQuery,
    setSearchQuery,

    filters,
    setFilter,
    clearAllFilters,
    hasActiveFilters,

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

    refresh, // ✅ Important for CRUD operations
  } = useDataTable({
    fetchData: fetchKategoriData,
    filterKeys: ['is_active'],
    searchKeys: ['kode_kategori', 'nama_kategori'],
    defaultSort: { key: 'nama_kategori', direction: 'asc' },
    defaultRowsPerPage: 10,
  });

  // ============================================
  // CRUD State Management
  // ============================================
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    // CUSTOMIZE: Initial form state
    kode_kategori: '',
    nama_kategori: '',
    abbr: '',
    deskripsi: '',
    is_active: true,
  });

  // Get current user for permissions
  const currentUser = authAPI.getCurrentUser();
  const canEdit = ['Admin', 'Manager'].includes(currentUser?.role);
  const canDelete = currentUser?.role === 'Admin';

  // ============================================
  // Form Handlers
  // ============================================
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      // CUSTOMIZE: Reset to initial values
      kode_kategori: '',
      nama_kategori: '',
      deskripsi: '',
      abbr: '',
      is_active: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      // CUSTOMIZE: Map item to form state
      kode_kategori: item.kode_kategori || '',
      nama_kategori: item.nama_kategori || '',
      deskripsi: item.deskripsi || '',
      abbr: item.abbr || '',
      is_active: item.is_active || true,
    });
    setShowModal(true);
  };

  // ============================================
  // CRUD Operations
  // ============================================
  // CREATE & UPDATE
  const handleSubmit = async (e) => {
    e.preventDefault();

    // CUSTOMIZE: Validation
    if (!formData.kode_kategori || !formData.nama_kategori) {
      alert('Kode Kategori and Nama Kategori wajib diisi!');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      // Determine endpoint and method
      const url = editingItem
        ? `${import.meta.env.VITE_API_URL}/data/kategori/${editingItem.id}`
        : `${import.meta.env.VITE_API_URL}/data/kategori`;

      const method = editingItem ? 'PUT' : 'POST';

      // CUSTOMIZE: Prepare payload
      const payload = editingItem ? {
        // UPDATE: Only send changed fields
        nama_kategori: formData.nama_kategori,
        deskripsi: formData.deskripsi,
        abbr: formData.abbr,
        is_active: formData.is_active,
      } : {
        // CREATE: Send all fields
        ...formData,
        is_active: true,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Operation failed');
      }

      alert(editingItem ? 'Berhasil di-update!' : 'Berhasil dibuat!');
      setShowModal(false);
      resetForm();

      // ✅ Refresh data after CRUD
      await refresh();

    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // DELETE
  const handleDelete = async (item) => {
    // CUSTOMIZE: Confirmation message
    if (!confirm(`Yakin ingin mengahapus "${item.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/data/kategori/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Gagal dihapus');
      }

      alert('Berhasil dihapus!');

      // ✅ Refresh data after delete
      await refresh();

    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // ============================================
  // Export Function
  // ============================================
  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      // CUSTOMIZE: Export columns
      'Kode Kategori': item.kode_kategori,
      'Nama Kategori': item.nama_kategori,
      'Deskripsi': item.deskripsi,
      'Akronim': item.abbr,
      'Aktif': item.is_active,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kategori');
    XLSX.writeFile(wb, `export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refresh(); } finally { setIsRefreshing(false); }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <MainLayout title="Kategori">
      <div className="space-y-6">
        {/* Control Panel */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Filter */}
            <select
              value={filters.is_active}
              onChange={(e) => setFilter('is_active', e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">Semua Status</option>
              <option value='true'>Aktif</option>
              <option value="false">Non-aktif</option>
            </select>

            {hasActiveFilters && (
              <button onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                <X className="w-4 h-4" /> Reset
              </button>
            )}

            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1" />

            {/* Action Buttons */}
            <div className="flex gap-2 w-full lg:w-auto">
            <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="Segarkan Data"
                  className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed">
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              <button
                onClick={handleExport}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                <span>Export</span>
              </button>

              {canEdit && (
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
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {/* Table headers */}
                <th
                  onClick={() => requestSort('kode_kategori')}
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Kode Kategori{sortConfig.key === 'kode_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => requestSort('nama_kategori')}
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Nama Kategori{sortConfig.key === 'nama_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Akronim</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Deskripsi</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                {(canEdit || canDelete) && (
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="text-sm text-gray-500">Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    {hasActiveFilters ? 'Tidak ada data yang sesuai dengan filter' : 'Data tidak tersedia'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {/* Table cells */}
                    <td className="px-6 py-4 text-xs">{item.kode_kategori}</td>
                    <td className="px-6 py-4 text-xs font-medium">{item.nama_kategori}</td>
                    <td className="px-6 py-4 text-xs font-medium">{item.abbr}</td>
                    <td className="px-6 py-4 text-xs">{item.deskripsi}</td>
                    <td className="px-6 py-4">
                      {item.is_active ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Non-Aktif
                        </span>
                      )}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
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

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  
                  {/* Rows Per Page Selector */}
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>Tampilkan</span>
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
                        placeholder="Sesuaikan"
                        value={customRowsInput}
                        onChange={(e) => setCustomRowsInput(e.target.value)}
                        className="w-16 px-2 py-1 text-sm outline-none rounded-l"
                      />
                      <button
                        onClick={handleCustomRowsApply}
                        className="bg-gray-100 px-2 py-1 text-sm font-medium border-l hover:bg-gray-200 rounded-r"
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700">
                    Menampilkan <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> -{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * rowsPerPage, totalRows)}
                    </span> dari{' '}
                    <span className="font-medium">{totalRows}</span> hasil
                  </p>
                </div>

                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronFirst className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-green-50 text-sm  text-green-600">
                      Halaman {currentPage} dari {totalPages || 1}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLast className="w-5 h-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit Kategori' : 'Tambah Kategori'} {/* CUSTOMIZE */}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Kode Kategori */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kode Kategori *
                </label>
                <input
                  type="text"
                  name="kode_kategori"
                  value={formData.kode_kategori}
                  onChange={handleInputChange}
                  disabled={!!editingItem} // Disable on edit
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Nama Kategori */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Kategori *
                  </label>
                  <input
                    type="text"
                    name="nama_kategori"
                    value={formData.nama_kategori}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                {/* Akronim */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Akronim *
                  </label>
                  <input
                    type="text"
                    name="abbr"
                    value={formData.abbr}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  name="deskripsi"
                  value={formData.deskripsi}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  name="is_active"
                  value={formData.is_active}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="true">Aktif</option>
                  <option value="false">Non-Aaktif</option>
                </select>
              </div>

              {/* Form Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg"
                >Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg">
                  {editingItem ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
