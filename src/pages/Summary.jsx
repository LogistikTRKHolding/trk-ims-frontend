// src/pages/Summary.jsx

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { stokAPI, kategoriAPI, subKategoriAPI, armadaAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import { cloudinaryService } from '../services/cloudinary';
import * as XLSX from 'xlsx';
import {
  Download, Upload, Filter, Search, X, Image as ImageIcon, ZoomIn, ExternalLink, 
  Package, PackageCheck, PackageMinus, PackagePlus, PackageOpen, RefreshCw,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Summary() {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ============================================
  // CUSTOM HOOK - Replace all state & logic!
  // ============================================
  const {
    // Data
    data: paginatedData,
    filteredData,
    loading,
    refresh,

    // Search
    searchQuery,
    setSearchQuery,

    // Filters
    filters,
    setFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilters,

    // Sorting
    sortConfig,
    requestSort,

    // Pagination
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    customRowsInput,
    setCustomRowsInput,
    handleCustomRowsApply,
    totalPages,
    totalRows,

    // Statistics
    stats,
  } = useDataTable({
    // Config
    fetchData: stokAPI.getAll,
    filterKeys: ['status_stok', 'kode_kategori', 'kode_sub_kategori', 'nama_armada',],
    searchKeys: ['kode_barang', 'part_number', 'nama_barang', 'alias', 'nama_kategori', 'nama_armada', 'status_stok'],
    defaultSort: { key: 'nama_barang', direction: 'asc' },
    defaultRowsPerPage: 10,
    customFilterKeys: ['status_stok'], // ← TAMBAH: status_stok dihandle oleh customFilterFn
    customFilterFn: (item, filters) => { // ← TAMBAH BLOK INI
      const s = filters.status_stok;
      if (!s || s === 'all') return true;
      if (s === 'Kritis') return ['Stok Kurang', 'Habis'].includes(item.status_stok);
      return item.status_stok === s;
    },

    // Calculate statistics
    calculateStats: (filtered, all) => ({
      // Filtered stats
      total: filtered.length,
      tersedia: filtered.filter(i => i.status_stok === 'Tersedia').length,
      stokKurang: filtered.filter(i => i.status_stok === 'Stok Kurang').length,
      habis: filtered.filter(i => i.status_stok === 'Habis').length,
      stokLebih: filtered.filter(i => i.status_stok === 'Stok Lebih').length,
      kritis: filtered.filter(i => ['Stok Kurang', 'Habis'].includes(i.status_stok)).length, // ← TAMBAH
      totalNilai: filtered.reduce((sum, i) => sum + (parseFloat(i.nilai_stok) || 0), 0),

      // Global stats
      globalTotal: all.length,
      globalTersedia: all.filter(i => i.status_stok === 'Tersedia').length,
      globalStokKurang: all.filter(i => i.status_stok === 'Stok Kurang').length,
      globalHabis: all.filter(i => i.status_stok === 'Habis').length,
      globalStokLebih: all.filter(i => i.status_stok === 'Stok Lebih').length,
      globalKritis: all.filter(i => ['Stok Kurang', 'Habis'].includes(i.status_stok)).length, // ← TAMBAH
      globalTotalNilai: all.reduce((sum, i) => sum + (parseFloat(i.nilai_stok) || 0), 0),
    }),
  });

  // ============================================
  // Read URL param ?status_stok= from other page navigation
  // ============================================
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const statusFromUrl = searchParams.get('status_stok');
    if (statusFromUrl) {
      setFilter('status_stok', statusFromUrl);
    }
  }, [searchParams]);

  // Dropdown states — dari API masing-masing
  const [kategoriList, setKategoriList] = useState([]);
  const [subKategoriList, setSubKategoriList] = useState([]);
  const [armadaList, setArmadaList] = useState([]);

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [kategoriResult, armadaResult] = await Promise.all([
          kategoriAPI.getAll(),
          armadaAPI.getAll(),
        ]);
        setKategoriList(kategoriResult);
        setArmadaList(armadaResult);
      } catch (error) {
        console.error('Error loading dropdown data:', error);
      }
    };
    loadDropdownData();
  }, []);

  const loadSubKategoriByKategori = async (kode_kategori) => {
    if (!kode_kategori || kode_kategori === 'all') {
      setSubKategoriList([]);
      return;
    }
    try {
      const result = await subKategoriAPI.getByKategori(kode_kategori);
      setSubKategoriList(result);
    } catch (error) {
      console.error('Error loading sub kategori:', error);
      setSubKategoriList([]);
    }
  };

  // ============================================
  // HELPERS
  // ============================================
  const getStatusColor = (status) => {
    switch (status) {
      case 'Tersedia': return 'bg-green-100 text-green-800';
      case 'Stok Kurang': return 'bg-yellow-100 text-yellow-800';
      case 'Habis': return 'bg-red-100 text-red-800';
      case 'Stok Lebih': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Nama Barang': item.nama_barang,
      'Alias': item.alias || '',
      'Kode Barang': item.kode_barang,
      'Part Number': item.part_number || '',
      'Kategori': item.nama_kategori || '',
      'Sub Kategori': item.nama_sub_kategori || '',
      'Armada': item.nama_armada || '',
      'Satuan': item.satuan || '',
      'Stok Akhir': item.stok_akhir,
      'Nilai Stok': item.nilai_stok,
      'Status Stok': item.status_stok
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    XLSX.writeFile(wb, `summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ============================================
  // Image Preview Handlers
  // ============================================
  // Image Preview Modal States
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [previewImageName, setPreviewImageName] = useState('');

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refresh(); } finally { setIsRefreshing(false); }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <MainLayout title="Summary">
      <div className="space-y-6">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

          {/* Total Items */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 flex items-center">
              <Package className="w-4 h-4 mr-1" />
              Barang
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
          </div>

          {/* Tersedia */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-600 flex items-center">
              <PackageCheck className="w-4 h-4 mr-1" />
              Tersedia
            </p>
            <p className="text-2xl font-bold text-green-700">{stats?.tersedia || 0}</p>
          </div>

          {/* Stok Kurang */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-600 flex items-center">
              <PackageMinus className="w-4 h-4 mr-1" />
              Stok kurang
            </p>
            <p className="text-2xl font-bold text-yellow-700">{stats?.stokKurang || 0}</p>
          </div>

          {/* Habis */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-600 flex items-center">
              <PackageOpen className="w-4 h-4 mr-1" />
              Habis</p>
            <p className="text-2xl font-bold text-red-700">{stats?.habis || 0}</p>
          </div>

          {/* Kritis = Stok Kurang + Habis */}
          <div
            className="bg-orange-50 p-4 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
            onClick={() => setFilter('status_stok', 'Kritis')}
            title="Klik untuk filter Kritis"
          >
            <p className="text-sm text-orange-600 flex items-center">
              <PackageMinus className="w-4 h-4 mr-1" />
              Kritis (Kurang + Habis)
            </p>
            <p className="text-2xl font-bold text-orange-700">{stats?.kritis || 0}</p>
          </div>

          {/* Stok Lebih */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <p className="text-sm text-green-600 flex items-center">
              <PackagePlus className="w-4 h-4 mr-1" />
              Stok lebih</p>
            <p className="text-2xl font-bold text-green-700">{stats?.stokLebih || 0}</p>
          </div>
        </div>

        {/* Toolbar: Two-row layout */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col gap-3">

            {/* ── Row 1: Search ── */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari kode barang, nama barang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>

            {/* ── Row 2: Filters + Actions ── */}
            <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between">

              {/* Left: Filter Controls */}
              <div className="flex flex-wrap gap-2 flex-1">

                {/* Filter Kategori */}
                <select
                  value={filters.kode_kategori || 'all'}
                  onChange={(e) => {
                    setFilter('kode_kategori', e.target.value);
                    setFilter('kode_sub_kategori', 'all');
                    loadSubKategoriByKategori(e.target.value);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                >
                  <option value="all">Semua Kategori</option>
                  {kategoriList.map((kat) => (
                    <option key={kat.kode_kategori} value={kat.kode_kategori}>
                      {kat.nama_kategori}
                    </option>
                  ))}
                </select>

                {/* Filter Sub Kategori (cascading) */}
                <select
                  value={filters.kode_sub_kategori || 'all'}
                  onChange={(e) => setFilter('kode_sub_kategori', e.target.value)}
                  disabled={!filters.kode_kategori || filters.kode_kategori === 'all' || subKategoriList.length === 0}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[150px] disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="all">Semua Sub Kategori</option>
                  {subKategoriList.map((sub) => (
                    <option key={sub.kode_sub_kategori} value={sub.kode_sub_kategori}>
                      {sub.nama_sub_kategori}
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
                    <option key={armada.kode_armada || armada.nama_armada} value={armada.nama_armada}>
                      {armada.nama_armada}
                    </option>
                  ))}
                </select>

                {/* Filter Status Stok */}
                <select
                  value={filters.status_stok || 'all'}
                  onChange={(e) => setFilter('status_stok', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                >
                  <option value="all">Semua Status</option>
                  <option value="Kritis">⚠ Kritis (Kurang + Habis)</option>  {/* ← TAMBAH */}
                  <option value="Tersedia">Tersedia</option>
                  <option value="Stok Kurang">Stok Kurang</option>
                  <option value="Habis">Habis</option>
                  <option value="Stok Lebih">Stok Lebih</option>
                </select>

                {/* Clear All Filters */}
                {hasActiveFilters && (
                  <button onClick={clearAllFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                    <X className="w-4 h-4" /> Reset
                  </button>
                )}
              </div>

              <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1 shrink-0" />

              {/* Right: Action Buttons */}
              <div className="flex gap-2 w-full lg:w-auto shrink-0">
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
              </div>
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

                const label =
                  filter.key === 'kode_kategori' ? `Kategori: ${kategoriList.find(k => k.kode_kategori === filter.value)?.nama_kategori || filter.value}` :
                    filter.key === 'kode_sub_kategori' ? `Sub Kategori: ${subKategoriList.find(s => s.kode_sub_kategori === filter.value)?.nama_sub_kategori || filter.value}` :
                      filter.key === 'nama_armada' ? `Armada: ${filter.value}` :
                        filter.key === 'status_stok' ? `Status: ${filter.value}` :
                          filter.value;

                return (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                    <Filter className="w-3 h-3" />
                    {label}
                    <button onClick={() => setFilter(filter.key, 'all')} className="hover:bg-green-100 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Gambar
                  </th>
                  <th onClick={() => requestSort('nama_barang')} className="px-6 py-4 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Nama Barang {sortConfig.key === 'nama_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => requestSort('part_number')} className="px-6 py-4 text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Kode Barang,<br />Part Number {sortConfig.key === 'part_number' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">Kategori,<br />Sub Kategori</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">Armada</th>
                  <th onClick={() => requestSort('stok_akhir')} className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Stok {sortConfig.key === 'stok_akhir' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => requestSort('nilai_stok')} className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Harga {sortConfig.key === 'nilai_stok' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
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
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500 font-medium">
                      Data tidak ditemukan
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
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
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-xs font-medium text-gray-900">{item.nama_barang}</p>
                          <p className="text-xs text-green-800">{item.alias}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/barang?kode=${encodeURIComponent(item.kode_barang)}`, '_blank')}
                          className="text-xs text-green-700 hover:text-green-900 hover:underline underline-offset-2 cursor-pointer transition-colors"
                          title={`Lihat di halaman Barang`}
                        >
                          {item.kode_barang}
                        </button>
                        <p className="text-xs text-blue-800">{item.part_number}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-xs">{item.nama_kategori}</p>
                          <p className="text-xs">{item.nama_sub_kategori}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">{item.nama_armada || '-'}</td>
                      <td className="px-6 py-4 text-xs">{item.stok_akhir.toLocaleString('id-ID')} {item.satuan}</td>
                      <td className="px-6 py-4 text-xs text-right font-medium text-green-700">{formatCurrency(item.nilai_stok)}</td>
                      <td className="px-6 py-4 text-xs text-center">
                        <span className={`inline-flex px-3 py-1 text-[11px] font-bold uppercase rounded-full shadow-sm ${getStatusColor(item.status_stok)}`}>
                          {item.status_stok}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Section */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
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
                    e.target.src = previewImageUrl;
                  }}
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 border-t">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Klik di luar atau tekan ESC untuk menutup</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}