// src/pages/SubKategori.jsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, Download, Search, X } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { authAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import * as XLSX from 'xlsx';

export default function SubKategori() {
  // ============================================
  // STEP 1: Define fetchData with useCallback
  // ============================================
  const fetchSubKategoriData = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/views/v_sub_kategori`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load data');
    return await response.json();
  }, []);

  // ============================================
  // STEP 2: Configure useDataTable Hook
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

    refresh,
  } = useDataTable({
    fetchData: fetchSubKategoriData,
    filterKeys: ['is_active', 'kode_kategori', 'kode_sub_kategori'],
    searchKeys: ['kode_sub_kategori', 'nama_sub_kategori', 'kode_kategori', 'nama_kategori'],
    defaultSort: { key: 'kode_sub_kategori', direction: 'asc' },
    defaultRowsPerPage: 10,
  });

  // ============================================
  // STEP 3: CRUD State & Kategori Dropdown
  // ============================================
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [kategoriList, setKategoriList] = useState([]);
  const [allSubKategoriList, setAllSubKategoriList] = useState([]);
  const [formData, setFormData] = useState({
    kode_kategori: '',
    kode_sub_kategori: '',
    nama_sub_kategori: '',
    is_active: true,
  });

  const currentUser = authAPI.getCurrentUser();
  const canEdit = ['Admin', 'Manager'].includes(currentUser?.role);
  const canDelete = currentUser?.role === 'Admin';

  // Opsi Sub-Kategori untuk filter — ter-filter berdasarkan pilihan Kategori
  const subKategoriOptions = useMemo(() => {
    if (!filters.kode_kategori || filters.kode_kategori === 'all') {
      return allSubKategoriList;
    }
    return allSubKategoriList.filter(sk => sk.kode_kategori === filters.kode_kategori);
  }, [allSubKategoriList, filters.kode_kategori]);

  // Handler filter Kategori: reset filter Sub-Kategori saat Kategori berubah
  const handleKategoriFilterChange = (e) => {
    setFilter('kode_kategori', e.target.value);
    setFilter('kode_sub_kategori', 'all'); // reset sub-kategori
    setCurrentPage(1);
  };

  const handleSubKategoriFilterChange = (e) => {
    setFilter('kode_sub_kategori', e.target.value);
    setCurrentPage(1);
  };

  // Fetch kategori list & full sub-kategori list untuk dropdown filter
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers = { 'Authorization': `Bearer ${token}` };

        const [katRes, subKatRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/data/kategori?is_active=true`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/views/v_sub_kategori`, { headers }),
        ]);

        if (katRes.ok) setKategoriList(await katRes.json());
        if (subKatRes.ok) setAllSubKategoriList(await subKatRes.json());
      } catch (err) {
        console.error('Failed to load dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, []);

  // ============================================
  // STEP 4: Form Handlers
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
      kode_kategori: '',
      kode_sub_kategori: '',
      nama_sub_kategori: '',
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
      kode_kategori: item.kode_kategori || '',
      kode_sub_kategori: item.kode_sub_kategori || '',
      nama_sub_kategori: item.nama_sub_kategori || '',
      is_active: item.is_active ?? true,
    });
    setShowModal(true);
  };

  // ============================================
  // STEP 5: CRUD Operations
  // ============================================

  // CREATE & UPDATE
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.kode_kategori) {
      alert('Kategori wajib dipilih!');
      return;
    }
    if (!formData.kode_sub_kategori || !formData.nama_sub_kategori) {
      alert('Kode dan Nama Sub-Kategori wajib diisi!');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      const url = editingItem
        ? `${import.meta.env.VITE_API_URL}/data/sub_kategori/${editingItem.id}`
        : `${import.meta.env.VITE_API_URL}/data/sub_kategori`;

      const method = editingItem ? 'PUT' : 'POST';

      const payload = editingItem
        ? {
            nama_sub_kategori: formData.nama_sub_kategori,
            is_active: formData.is_active === 'true' || formData.is_active === true,
          }
        : {
            kode_kategori: formData.kode_kategori,
            kode_sub_kategori: formData.kode_sub_kategori,
            nama_sub_kategori: formData.nama_sub_kategori,
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
        throw new Error(result.error || 'Operasi gagal');
      }

      alert(editingItem ? 'Data berhasil diperbarui!' : 'Data berhasil ditambahkan!');
      setShowModal(false);
      resetForm();
      await refresh();

    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // DELETE (soft delete: set is_active = false)
  const handleDelete = async (item) => {
    if (!confirm(`Hapus sub-kategori "${item.nama_sub_kategori}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/data/sub_kategori/${item.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Gagal menghapus data');
      }

      alert('Data berhasil dihapus!');
      await refresh();

    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ============================================
  // STEP 6: Export Function
  // ============================================
  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Kode Kategori': item.kode_kategori,
      'Nama Kategori': item.nama_kategori,
      'Kode Sub-Kategori': item.kode_sub_kategori,
      'Nama Sub-Kategori': item.nama_sub_kategori,
      'Aktif': item.is_active ? 'Ya' : 'Tidak',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SubKategori');
    XLSX.writeFile(wb, `export_sub_kategori_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <MainLayout title="Sub-Kategori">
      <div className="space-y-6">

        {/* Control Panel */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode atau nama sub-kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>

            {/* Filter Kategori */}
            <select
              value={filters.kode_kategori ?? 'all'}
              onChange={handleKategoriFilterChange}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="all">Semua Kategori</option>
              {kategoriList.map((kat) => (
                <option key={kat.kode_kategori} value={kat.kode_kategori}>
                  {kat.nama_kategori}
                </option>
              ))}
            </select>

            {/* Filter Sub-Kategori — opsi mengikuti pilihan Kategori */}
            <select
              value={filters.kode_sub_kategori ?? 'all'}
              onChange={handleSubKategoriFilterChange}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="all">Semua Sub-Kategori</option>
              {subKategoriOptions.map((sk) => (
                <option key={sk.kode_sub_kategori} value={sk.kode_sub_kategori}>
                  {sk.nama_sub_kategori}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={filters.is_active ?? 'all'}
              onChange={(e) => setFilter('is_active', e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Non-Aktif</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
                title="Hapus semua filter"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1 self-center" />

            {/* Action Buttons */}
            <div className="flex gap-2 w-full lg:w-auto">
              <button
                onClick={handleExport}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
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

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            Gagal memuat data: {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  onClick={() => requestSort('kode_kategori')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  Kode Kategori{' '}
                  {sortConfig.key === 'kode_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => requestSort('nama_kategori')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  Nama Kategori{' '}
                  {sortConfig.key === 'nama_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => requestSort('kode_sub_kategori')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  Kode Sub-Kategori{' '}
                  {sortConfig.key === 'kode_sub_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => requestSort('nama_sub_kategori')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                >
                  Nama Sub-Kategori{' '}
                  {sortConfig.key === 'nama_sub_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                {(canEdit || canDelete) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Tindakan
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="text-sm text-gray-500">Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    {hasActiveFilters || searchQuery
                      ? 'Tidak ada data yang sesuai dengan pencarian / filter'
                      : 'Data tidak tersedia'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">{item.kode_kategori}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.nama_kategori}</td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">{item.kode_sub_kategori}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.nama_sub_kategori}</td>
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
                              title="Hapus"
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
            {/* Mobile */}
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

            {/* Desktop */}
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {/* Rows Per Page */}
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
                  Showing{' '}
                  <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * rowsPerPage, totalRows)}</span> of{' '}
                  <span className="font-medium">{totalRows}</span> results
                </p>
              </div>

              {/* Page Navigation */}
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

      {/* ============================================
          MODAL FORM (Create / Edit)
          ============================================ */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit Sub-Kategori' : 'Tambah Sub-Kategori'}
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

              {/* Pilihan Kategori — dropdown kode + nama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <select
                  name="kode_kategori"
                  value={formData.kode_kategori}
                  onChange={handleInputChange}
                  disabled={!!editingItem} // Kode kategori tidak boleh diubah saat edit
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {kategoriList.map((kat) => (
                    <option key={kat.kode_kategori} value={kat.kode_kategori}>
                      {kat.kode_kategori} — {kat.nama_kategori}
                    </option>
                  ))}
                </select>
                {editingItem && (
                  <p className="text-xs text-gray-400 mt-1">
                    Kategori tidak dapat diubah setelah disimpan.
                  </p>
                )}
              </div>

              {/* Kode Sub-Kategori */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kode Sub-Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="kode_sub_kategori"
                  value={formData.kode_sub_kategori}
                  onChange={handleInputChange}
                  disabled={!!editingItem} // Kode tidak boleh diubah saat edit
                  required
                  placeholder="Contoh: SUBKAT001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed font-mono"
                />
                {editingItem && (
                  <p className="text-xs text-gray-400 mt-1">
                    Kode tidak dapat diubah setelah disimpan.
                  </p>
                )}
              </div>

              {/* Nama Sub-Kategori */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Sub-Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nama_sub_kategori"
                  value={formData.nama_sub_kategori}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: Oli Mesin"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              {/* Status — hanya tampil saat Edit */}
              {editingItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="is_active"
                    value={String(formData.is_active)}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Non-Aktif</option>
                  </select>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
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
