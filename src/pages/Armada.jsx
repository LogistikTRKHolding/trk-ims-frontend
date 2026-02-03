// src/pages/Armada.jsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Download, Search, X, Save } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { authAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import * as XLSX from 'xlsx';

export default function Armada() {
  // ============================================
  // STEP 1: Define fetchData with useCallback
  // ============================================
  const fetchArmadaData = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/data/armada`, {
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

    refresh, // ✅ Important for CRUD operations
  } = useDataTable({
    fetchData: fetchArmadaData,
    filterKeys: ['is_active'],
    searchKeys: ['kode_armada', 'nama_armada'],
    defaultSort: { key: 'nama_armada', direction: 'asc' },
    defaultRowsPerPage: 10,
  });

  // ============================================
  // STEP 3: CRUD State Management
  // ============================================
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    // CUSTOMIZE: Initial form state
    kode_armada: '',
    nama_armada: '',
    deskripsi: '',
    is_active: true,
  });

  // Get current user for permissions
  const currentUser = authAPI.getCurrentUser();
  const canEdit = ['Admin', 'Manager'].includes(currentUser?.role);
  const canDelete = currentUser?.role === 'Admin';

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
      // CUSTOMIZE: Reset to initial values
      kode_armada: '',
      nama_armada: '',
      deskripsi: '',
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
      kode_armada: item.kode_armada || '',
      nama_armada: item.nama_armada || '',
      deskripsi: item.deskripsi || '',
      is_active: item.is_active || true,
    });
    setShowModal(true);
  };

  // ============================================
  // STEP 5: CRUD Operations
  // ============================================

  // CREATE & UPDATE
  const handleSubmit = async (e) => {
    e.preventDefault();

    // CUSTOMIZE: Validation
    if (!formData.code || !formData.name) {
      alert('Code and Name are required!');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      // Determine endpoint and method
      const url = editingItem
        ? `${import.meta.env.VITE_API_URL}/data/armada/${editingItem.id}`
        : '${import.meta.env.VITE_API_URL}/data/armada';

      const method = editingItem ? 'PUT' : 'POST';

      // CUSTOMIZE: Prepare payload
      const payload = editingItem ? {
        // UPDATE: Only send changed fields
        nama_armada: formData.nama_armada,
        deskripsi: formData.deskripsi,
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

      alert(editingItem ? 'Updated successfully!' : 'Created successfully!');
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
    if (!confirm(`Delete "${item.name}"? This action cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/data/armada/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete');
      }

      alert('Deleted successfully!');

      // ✅ Refresh data after delete
      await refresh();

    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // ============================================
  // STEP 6: Export Function
  // ============================================
  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      // CUSTOMIZE: Export columns
      'Kode': item.kode_armada,
      'Nama Armada': item.nama_armada,
      'Deskripsi': item.deskripsi,
      'Aktif': item.is_active,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Armada');
    XLSX.writeFile(wb, `export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <MainLayout title="Armada">
      <div className="space-y-6">

        {/* Control Panel */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search..." // CUSTOMIZE
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
              <button
                onClick={clearAllFilters}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1" />

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

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {/* Table headers */}
                <th
                  onClick={() => requestSort('code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Kode {sortConfig.key === 'kode' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => requestSort('nama')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Nama {sortConfig.key === 'nama' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {(canEdit || canDelete) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tindakan</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="ml-2">Memuat Data...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    {hasActiveFilters ? 'No data matches your filters' : 'No data available'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {/* CUSTOMIZE: Table cells */}
                    <td className="px-6 py-4 font-mono text-sm">{item.kode_armada}</td>
                    <td className="px-6 py-4 font-medium">{item.nama_armada}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.deskripsi}</td>
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

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit Armada' : 'Tambah Armada'} {/* CUSTOMIZE */}
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

              {/* CUSTOMIZE: Add your form fields */}

              {/* Kode Armada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kode Armada *
                </label>
                <input
                  type="text"
                  name="kode_armada"
                  value={formData.kode_armada}
                  onChange={handleInputChange}
                  disabled={!!editingItem} // Disable on edit
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Nama Armada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Armada *
                </label>
                <input
                  type="text"
                  name="nama_armada"
                  value={formData.nama_armada}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
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
                  name="status"
                  value={formData.status}
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
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
