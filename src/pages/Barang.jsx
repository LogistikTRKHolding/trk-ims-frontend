import React, { useState, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useDataTable } from '../hooks/useDataTable';
import { barangAPI, kategoriAPI, armadaAPI } from '../services/api';
import { cloudinaryService } from '../services/cloudinary';
import * as XLSX from 'xlsx';
import {
  Search,
  Filter,
  X,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Image as ImageIcon,
  Loader,
  ZoomIn,
  ExternalLink,
  Maximize2
} from 'lucide-react';

export default function Barang() {
  // Permissions (based on user role)
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const canCreate = ['Admin', 'Manager'].includes(currentUser?.role);
  const canEdit = ['Admin', 'Manager'].includes(currentUser?.role);
  const canDelete = currentUser?.role === 'Admin';

  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    kode_barang: '',
    nama_barang: '',
    satuan: '',
    harga_satuan: 0,
    min_stok: 0,
    max_stok: 0,
    kode_kategori: '',
    kode_armada: '',
    lokasi_gudang: '',
    supplier_utama: '',
    keterangan: '',
    is_stocked: true,
    gambar_url: '',
  });

  // Image Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Image Preview Modal States
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [previewImageName, setPreviewImageName] = useState('');

  // Master Data States
  const [kategoriList, setKategoriList] = useState([]);
  const [armadaList, setArmadaList] = useState([]);

  // Fetch Data
  const fetchBarangData = useCallback(async () => {
    const result = await barangAPI.getAll();

    // Load master data
    const [kategori, armada] = await Promise.all([
      kategoriAPI.getAll(),
      armadaAPI.getAll()
    ]);

    setKategoriList(kategori);
    setArmadaList(armada);

    return result;
  }, []);

  // useDataTable Hook
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
    sortConfig,
    requestSort,
    currentPage,
    setCurrentPage,
    totalPages,
    totalRows,
    rowsPerPage,
    setRowsPerPage,
    customRowsInput,
    setCustomRowsInput,
    handleCustomRowsApply,
    refresh,
  } = useDataTable({
    fetchData: fetchBarangData,
    filterKeys: ['kode_kategori', 'kode_armada', 'is_stocked'],
    searchKeys: ['kode_barang', 'nama_barang', 'nama_kategori', 'nama_armada', 'satuan', 'supplier_utama'],
    defaultSort: { key: 'nama_barang', direction: 'asc' },
    defaultRowsPerPage: 10,
  });

  // ============================================
  // Image Preview Handlers
  // ============================================

  const handleThumbnailClick = (item) => {
    if (!item.gambar_url) return;

    setPreviewImageUrl(item.gambar_url);
    setPreviewImageName(item.nama_barang);
    setShowImagePreview(true);
  };

  const handleCloseImagePreview = () => {
    setShowImagePreview(false);
    setPreviewImageUrl(null);
    setPreviewImageName('');
  };

  const handleOpenInNewTab = () => {
    if (previewImageUrl) {
      window.open(previewImageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadImage = async () => {
    if (!previewImageUrl) return;

    try {
      const response = await fetch(previewImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${previewImageName.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download image');
    }
  };

  // ============================================
  // Image Upload Handlers
  // ============================================

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!selectedFile) return null;

    try {
      setUploading(true);
      setUploadProgress(10);

      // Upload to Cloudinary
      const imageUrl = await cloudinaryService.uploadImage(selectedFile);

      setUploadProgress(100);
      return imageUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Failed to upload image: ' + error.message);
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData(prev => ({ ...prev, gambar_url: '' }));
  };

  // ============================================
  // CRUD Handlers
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.kode_barang || !formData.nama_barang) {
      alert('Kode Barang dan Nama Barang wajib diisi!');
      return;
    }

    if (!formData.kode_kategori || !formData.kode_armada) {
      alert('Kategori dan Armada wajib dipilih!');
      return;
    }

    try {
      let imageUrl = formData.gambar_url;

      // Upload image if new file selected
      if (selectedFile) {
        imageUrl = await handleImageUpload();
        if (!imageUrl) {
          alert('Failed to upload image. Please try again.');
          return;
        }
      }

      const token = localStorage.getItem('authToken');
      const userId = currentUser?.userId;

      const payload = {
        kode_barang: formData.kode_barang,
        nama_barang: formData.nama_barang,
        satuan: formData.satuan,
        harga_satuan: parseFloat(formData.harga_satuan) || 0,
        min_stok: parseInt(formData.min_stok) || 0,
        max_stok: parseInt(formData.max_stok) || 0,
        kode_kategori: formData.kode_kategori,
        kode_armada: formData.kode_armada,
        lokasi_gudang: formData.lokasi_gudang || null,
        supplier_utama: formData.supplier_utama || null,
        keterangan: formData.keterangan || null,
        is_stocked: formData.is_stocked,
        gambar_url: imageUrl || null,
        ...(editingItem ? { updated_by: userId } : { created_by: userId }),
      };

      const url = editingItem
        ? `${import.meta.env.VITE_API_URL}/data/barang/${editingItem.id}`
        : '${import.meta.env.VITE_API_URL}/data/barang';

      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Operation failed');
      }

      alert(editingItem ? 'Barang berhasil diupdate!' : 'Barang berhasil ditambah!');
      setShowModal(false);
      resetForm();
      await refresh();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Yakin ingin menghapus barang "${item.nama_barang}"?`)) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/data/barang/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Delete failed');
      }

      alert('Barang berhasil dihapus!');
      await refresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error: ' + error.message);
    }
  };

  // ============================================
  // Form Handlers
  // ============================================

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      kode_barang: item.kode_barang || '',
      nama_barang: item.nama_barang || '',
      satuan: item.satuan || '',
      harga_satuan: item.harga_satuan || 0,
      min_stok: item.min_stok || 0,
      max_stok: item.max_stok || 0,
      kode_kategori: item.kode_kategori || '',
      kode_armada: item.kode_armada || '',
      lokasi_gudang: item.lokasi_gudang || '',
      supplier_utama: item.supplier_utama || '',
      keterangan: item.keterangan || '',
      is_stocked: item.is_stocked ?? true,
      gambar_url: item.gambar_url || '',
    });

    // Set preview if image exists
    if (item.gambar_url) {
      setPreviewUrl(item.gambar_url);
    }

    setShowModal(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      kode_barang: '',
      nama_barang: '',
      satuan: '',
      harga_satuan: 0,
      min_stok: 0,
      max_stok: 0,
      kode_kategori: '',
      kode_armada: '',
      lokasi_gudang: '',
      supplier_utama: '',
      keterangan: '',
      is_stocked: true,
      gambar_url: '',
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploading(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ============================================
  // Export Handler
  // ============================================

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Kode': item.kode_barang,
      'Nama Barang': item.nama_barang,
      'Kategori': item.nama_kategori,
      'Armada': item.nama_armada,
      'Satuan': item.satuan,
      'Harga Satuan': item.harga_satuan,
      'Min Stok': item.min_stok,
      'Max Stok': item.max_stok,
      'Tipe Stok': item.is_stocked ? 'Di-Stok' : 'Non-Stok',
      'Lokasi': item.lokasi_gudang || '-',
      'Supplier': item.supplier_utama || '-',
      'Keterangan': item.keterangan || '-',
      'Gambar URL': item.gambar_url || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Barang');
    XLSX.writeFile(wb, `barang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ============================================
  // Render
  // ============================================
  return (
    <MainLayout title="Barang">
      <div className="space-y-6">
        {/* Toolbar: Search, Filters, Actions - All in one row */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">

            {/* Left side: Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full lg:w-auto">

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari kode barang, nama barang..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>

              {/* Filter Kategori */}
              <select
                value={filters.kode_kategori || 'all'}
                onChange={(e) => setFilter('kode_kategori', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Kategori</option>
                {kategoriList.map((kat) => (
                  <option key={kat.kode_kategori} value={kat.kode_kategori}>
                    {kat.nama_kategori}
                  </option>
                ))}
              </select>

              {/* Filter Armada */}
              <select
                value={filters.kode_armada || 'all'}
                onChange={(e) => setFilter('kode_armada', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Armada</option>
                {armadaList.map((arm) => (
                  <option key={arm.kode_armada} value={arm.kode_armada}>
                    {arm.nama_armada}
                  </option>
                ))}
              </select>

              {/* Filter Tipe Stok */}
              <select
                value={filters.is_stocked || 'all'}
                onChange={(e) => setFilter('is_stocked', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Tipe</option>
                <option value="true">Di-Stok</option>
                <option value="false">Non-Stok</option>
              </select>

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
                  onClick={() => { resetForm(); setShowModal(true); }}
                  className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">Filter aktif:</span>
              {activeFilters.map((filter, idx) => {
                if (filter.type === 'search') {
                  return (
                    <span key={`search-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      Cari: "{filter.value}"
                      <button onClick={() => setSearchQuery('')} className="hover:bg-blue-200 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.key === 'kode_kategori') {
                  const kat = kategoriList.find(k => k.kode_kategori === filter.value);
                  return (
                    <span key={`kat-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                      Kategori: {kat?.nama_kategori || filter.value}
                      <button onClick={() => setFilter('kode_kategori', 'all')} className="hover:bg-purple-200 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.key === 'kode_armada') {
                  const arm = armadaList.find(a => a.kode_armada === filter.value);
                  return (
                    <span key={`arm-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                      Armada: {arm?.nama_armada || filter.value}
                      <button onClick={() => setFilter('kode_armada', 'all')} className="hover:bg-orange-200 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.key === 'is_stocked') {
                  const label = filter.value === 'true' ? 'Di-Stok' : 'Non-Stok';
                  return (
                    <span key={`stock-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                      Tipe: {label}
                      <button onClick={() => setFilter('is_stocked', 'all')} className="hover:bg-green-200 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Gambar
                  </th>
                  <th
                    onClick={() => requestSort('kode_barang')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    Kode {sortConfig.key === 'kode_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    onClick={() => requestSort('nama_barang')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    Nama Barang {sortConfig.key === 'nama_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Armada</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min/Max</th>
                  {(canEdit || canDelete) && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tindakan</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit || canDelete ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                      {hasActiveFilters || searchQuery
                        ? 'Tidak ada data yang sesuai dengan filter'
                        : 'Belum ada data barang'}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      {/* Clickable Thumbnail */}
                      <td className="px-6 py-4">
                        {item.gambar_url ? (
                          <div className="relative group">
                            <button
                              onClick={() => handleThumbnailClick(item)}
                              className="relative overflow-hidden rounded border border-gray-200 hover:border-green-500 transition-all"
                              title="Klik untuk melihat gambar"
                            >
                              <img
                                src={cloudinaryService.getThumbnailUrl(item.gambar_url)}
                                alt={item.nama_barang}
                                className="w-12 h-12 object-cover transition-transform group-hover:scale-110"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect fill="%23f3f4f6" width="48" height="48"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="20"%3E?%3C/text%3E%3C/svg%3E';
                                }}
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono text-sm font-medium">{item.kode_barang}</td>
                      <td className="px-6 py-4 font-medium">{item.nama_barang}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.nama_kategori}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.nama_armada}</td>
                      <td className="px-6 py-4">
                        {item.is_stocked ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Di-Stok
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Non-Stok
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.min_stok || '-'}/{item.max_stok || '-'}</td>
                      {(canEdit || canDelete) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
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
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
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

          {/* Pagination */}
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

        {/* Image Preview Modal */}
        {showImagePreview && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={handleCloseImagePreview}
          >
            <div
              className="relative max-w-4xl w-full bg-white rounded-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">{previewImageName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadImage}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
                    title="Download Image"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleOpenInNewTab}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
                    title="Open in New Tab"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleCloseImagePreview}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Image Container */}
              <div className="flex items-center justify-center bg-gray-900 p-6" style={{ maxHeight: '70vh' }}>
                <img
                  src={cloudinaryService.getMediumUrl(previewImageUrl)}
                  alt={previewImageName}
                  className="max-w-full max-h-full object-contain rounded"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = previewImageUrl; // Fallback to original if optimized fails
                  }}
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 border-t">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Click outside or press ESC to close</span>
                  <a
                    href={previewImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 hover:underline"
                  >
                    View on Cloudinary
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                {/* Modal Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                  <h2 className="text-xl font-bold">
                    {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}
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
                  {/* Image Upload Section */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Gambar Barang
                    </label>

                    {previewUrl ? (
                      <div className="space-y-3">
                        <div className="relative inline-block">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-48 h-48 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {selectedFile && (
                          <p className="text-sm text-gray-600">
                            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="mx-auto w-12 h-12 text-gray-400 mb-3" />
                        <label className="cursor-pointer">
                          <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Pilih Gambar
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          JPG, PNG, GIF up to 5MB
                        </p>
                      </div>
                    )}

                    {uploading && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Loader className="w-4 h-4 animate-spin" />
                          Uploading... {uploadProgress}%
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kode Barang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="kode_barang"
                        value={formData.kode_barang}
                        onChange={handleInputChange}
                        disabled={!!editingItem}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Barang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama_barang"
                        value={formData.nama_barang}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kategori <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="kode_kategori"
                        value={formData.kode_kategori}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {kategoriList.map((kat) => (
                          <option key={kat.kode_kategori} value={kat.kode_kategori}>
                            {kat.nama_kategori}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {/* Armada <span className="text-red-500">*</span> */}
                        Armada 
                      </label>
                      <select
                        name="kode_armada"
                        value={formData.kode_armada}
                        onChange={handleInputChange}
                        // required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">-- Pilih Armada --</option>
                        {armadaList.map((arm) => (
                          <option key={arm.kode_armada} value={arm.kode_armada}>
                            {arm.nama_armada}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stock Type */}
                  <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="is_stocked"
                        name="is_stocked"
                        checked={formData.is_stocked}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 text-green-600"
                      />
                      <div className="flex-1">
                        <label htmlFor="is_stocked" className="font-medium text-gray-900 cursor-pointer">
                          Barang Di-Stok di Gudang
                        </label>
                        <p className="text-sm text-gray-600 mt-1">
                          Centang jika barang disimpan di gudang dengan tracking inventory
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Inventory */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Satuan
                      </label>
                      <input
                        type="text"
                        name="satuan"
                        value={formData.satuan}
                        onChange={handleInputChange}
                        placeholder="Pcs, Unit, Kg, dll"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Harga Satuan
                      </label>
                      <input
                        type="number"
                        name="harga_satuan"
                        value={formData.harga_satuan}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Supplier Utama
                      </label>
                      <input
                        type="text"
                        name="supplier_utama"
                        value={formData.supplier_utama}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {/* Stock Limits (only for stocked items) */}
                  {formData.is_stocked && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Min Stok
                        </label>
                        <input
                          type="number"
                          name="min_stok"
                          value={formData.min_stok}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Stok
                        </label>
                        <input
                          type="number"
                          name="max_stok"
                          value={formData.max_stok}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Lokasi Gudang
                        </label>
                        <input
                          type="text"
                          name="lokasi_gudang"
                          value={formData.lokasi_gudang}
                          onChange={handleInputChange}
                          placeholder="Rak A1, Bin 12, dll"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Keterangan
                    </label>
                    <textarea
                      name="keterangan"
                      value={formData.keterangan}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
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
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploading && <Loader className="w-4 h-4 animate-spin" />}
                    {editingItem ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
