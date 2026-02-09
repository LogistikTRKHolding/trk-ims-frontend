// src/pages/Stok.jsx

import { useCallback } from 'react';
import { Download, Filter, Search, TrendingUp, TrendingDown, X, Package } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { stokAPI, kategoriAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import * as XLSX from 'xlsx';

export default function Stok() {
  // Fetch data function with useCallback to prevent infinite loop
  const fetchStokData = useCallback(async () => {
    const result = await stokAPI.getAll();
    return result;
  }, []);

  // Kategori untuk filter dropdown
  const fetchKategoriList = useCallback(async () => {
    const result = await kategoriAPI.getAll();
    return result;
  }, []);

  // useDataTable hook
  const {
    data: paginatedData,
    allData,
    filteredData,
    loading,
    error,

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

    // Stats
    stats,
  } = useDataTable({
    fetchData: fetchStokData,
    filterKeys: ['kode_kategori', 'nama_armada'],
    searchKeys: ['kode_barang', 'nama_barang', 'nama_kategori', 'nama_armada', 'satuan'],
    defaultSort: { key: 'nama_barang', direction: 'asc' },
    defaultRowsPerPage: 10,

    // Calculate statistics
    calculateStats: (filtered, all) => {
      const filteredStats = {
        totalItems: filtered.length,
        totalMasuk: filtered.reduce((sum, item) => sum + (parseFloat(item.total_masuk) || 0), 0),
        totalKeluar: filtered.reduce((sum, item) => sum + (parseFloat(item.total_keluar) || 0), 0),
        totalStok: filtered.reduce((sum, item) => sum + (parseFloat(item.stok_akhir) || 0), 0),
        totalNilai: filtered.reduce((sum, item) => sum + (parseFloat(item.nilai_stok) || 0), 0),
      };

      const globalStats = {
        totalItems: all.length,
        totalMasuk: all.reduce((sum, item) => sum + (parseFloat(item.total_masuk) || 0), 0),
        totalKeluar: all.reduce((sum, item) => sum + (parseFloat(item.total_keluar) || 0), 0),
        totalStok: all.reduce((sum, item) => sum + (parseFloat(item.stok_akhir) || 0), 0),
        totalNilai: all.reduce((sum, item) => sum + (parseFloat(item.nilai_stok) || 0), 0),
      };

      return { filtered: filteredStats, global: globalStats };
    },
  });

  // Get unique kategori and armada for filter dropdowns
  const kategoriList = [...new Set(allData.map(item => ({
    kode: item.kode_kategori,
    nama: item.nama_kategori
  })).filter(k => k.kode).map(k => JSON.stringify(k)))].map(k => JSON.parse(k));

  const armadaList = [...new Set(allData.map(item => item.nama_armada).filter(Boolean))].sort();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Kode': item.kode_barang,
      'Nama Barang': item.nama_barang,
      'Kategori': item.nama_kategori || '',
      'Armada': item.nama_armada || '',
      'Satuan': item.satuan,
      'Total Masuk': item.total_masuk,
      'Total Keluar': item.total_keluar,
      'Stok Akhir': item.stok_akhir,
      'Stok Min': item.min_stok,
      'Stok Max': item.max_stok || '',
      'Nilai Stok': item.nilai_stok
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stok');
    XLSX.writeFile(wb, `stok_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (error) {
    return (
      <MainLayout title="Stok">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Stok">
      <div className="space-y-6">
        {/* Summary Stats */}
        {stats && (
          //<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 flex items-center">
                <Package className="w-4 h-4 mr-1" />
                Total Barang
              </p>
              <p className="text-2xl font-bold text-gray-900">{stats.filtered.totalItems}</p>
              <p className="text-[10px] text-gray-400 mt-1 italic">
                dari {stats.global.totalItems} total data
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Total Masuk
              </p>
              <p className="text-2xl font-bold text-green-700">
                {stats.filtered.totalMasuk.toLocaleString('id-ID')}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 italic">
                Total global: {stats.global.totalMasuk.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-600 flex items-center">
                <TrendingDown className="w-4 h-4 mr-1" />
                Total Keluar
              </p>
              <p className="text-2xl font-bold text-red-700">
                {stats.filtered.totalKeluar.toLocaleString('id-ID')}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 italic">
                Total global: {stats.global.totalKeluar.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600">Stok Akhir</p>
              <p className="text-2xl font-bold text-green-700">
                {stats.filtered.totalStok.toLocaleString('id-ID')}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 italic">
                Total global: {stats.global.totalStok.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        )}

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
                  placeholder="Cari koode barang, nama barang..."
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
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">Filter aktif:</span>
              {activeFilters.map((filter, idx) => {
                if (filter.type === 'search') {
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      Search: "{filter.value}"
                      <button
                        onClick={() => setSearchQuery('')}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.key === 'kode_kategori') {
                  const kat = kategoriList.find(k => k.kode === filter.value);
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                    >
                      Kategori: {kat?.nama || filter.value}
                      <button
                        onClick={() => setFilter('kode_kategori', 'all')}
                        className="hover:bg-purple-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                }

                if (filter.key === 'nama_armada') {
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-sm rounded-full"
                    >
                      Armada: {filter.value}
                      <button
                        onClick={() => setFilter('nama_armada', 'all')}
                        className="hover:bg-orange-200 rounded-full p-0.5"
                      >
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('kode_barang')}
                  >
                    Kode {sortConfig.key === 'kode_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('nama_barang')}
                  >
                    Nama Barang {sortConfig.key === 'nama_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('nama_kategori')}
                  >
                    Kategori {sortConfig.key === 'nama_kategori' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Armada</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Satuan</th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('total_masuk')}
                  >
                    <div className="flex items-center justify-end">
                      <TrendingUp className="w-4 h-4 mr-1 text-green-600" />
                      Masuk {sortConfig.key === 'total_masuk' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('total_keluar')}
                  >
                    <div className="flex items-center justify-end">
                      <TrendingDown className="w-4 h-4 mr-1 text-red-600" />
                      Keluar {sortConfig.key === 'total_keluar' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('stok_akhir')}
                  >
                    Stok Akhir {sortConfig.key === 'stok_akhir' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min/Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        <span className="ml-2">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <p className="text-lg font-medium">No data found</p>
                        {hasActiveFilters && (
                          <p className="text-sm mt-2">Try adjusting your filters or search term</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {item.kode_barang}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{item.nama_barang}</span>
                          <p className="text-xs text-gray-500">{formatCurrency(item.nilai_stok)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{item.nama_kategori || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{item.nama_armada || '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-600">{item.satuan}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-green-600 font-medium">
                          {item.total_masuk.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-red-600 font-medium">
                          {item.total_keluar.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-gray-900">
                          {item.stok_akhir.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs text-gray-500">
                          {item.min_stok} / {item.max_stok || '-'}
                        </span>
                      </td>
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
      </div>
    </MainLayout>
  );
}