// src/pages/Summary.jsx
import { useMemo } from 'react';
import { Download, Filter, Search, X } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { stokAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import * as XLSX from 'xlsx';

export default function Summary() {
  // ============================================
  // CUSTOM HOOK - Replace all state & logic!
  // ============================================
  const {
    // Data
    data: paginatedData,
    allData,
    filteredData,
    loading,

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

    // Utilities
    refresh,
  } = useDataTable({
    // Config
    fetchData: stokAPI.getAll,
    filterKeys: ['status_stok', 'nama_kategori', 'nama_armada'],
    searchKeys: ['kode_barang', 'nama_barang', 'nama_kategori', 'nama_armada', 'satuan'],
    defaultSort: { key: 'nama_barang', direction: 'asc' },
    defaultRowsPerPage: 10,
    // Calculate statistics
    calculateStats: (filtered, all) => ({
      // Filtered stats
      total: filtered.length,
      tersedia: filtered.filter(i => i.status_stok === 'Tersedia').length,
      stokKurang: filtered.filter(i => i.status_stok === 'Stok Kurang').length,
      habis: filtered.filter(i => i.status_stok === 'Habis').length,
      stokLebih: filtered.filter(i => i.status_stok === 'Stok Lebih').length,
      totalNilai: filtered.reduce((sum, i) => sum + (parseFloat(i.nilai_stok) || 0), 0),

      // Global stats
      globalTotal: all.length,
      globalTersedia: all.filter(i => i.status_stok === 'Tersedia').length,
      globalStokKurang: all.filter(i => i.status_stok === 'Stok Kurang').length,
      globalHabis: all.filter(i => i.status_stok === 'Habis').length,
      globalStokLebih: all.filter(i => i.status_stok === 'Stok Lebih').length,
      globalTotalNilai: all.reduce((sum, i) => sum + (parseFloat(i.nilai_stok) || 0), 0),
    }),
  });

  // ============================================
  // DERIVED DATA (Extract unique values for dropdowns)
  // ============================================
  const kategoriList = [...new Set(allData.map(item => item.nama_kategori).filter(Boolean))].sort();
  const armadaList = [...new Set(allData.map(item => item.nama_armada).filter(Boolean))].sort();

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
      'Kode': item.kode_barang,
      'Nama Barang': item.nama_barang,
      'Kategori': item.nama_kategori || '',
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
  // RENDER
  // ============================================
  return (
    <MainLayout title="Summary">
      <div className="space-y-6">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Items */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            <p className="text-[10px] text-gray-400 mt-1 italic">dari {stats?.globalTotal || 0} total</p>
          </div>

          {/* Tersedia */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">Tersedia</p>
            <p className="text-2xl font-bold text-green-700">{stats?.tersedia || 0}</p>
            <p className="text-[10px] text-gray-400 mt-1 italic">Global: {stats?.globalTersedia || 0}</p>
          </div>

          {/* Stok Kurang */}
          <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-600">Stok Kurang</p>
            <p className="text-2xl font-bold text-yellow-700">{stats?.stokKurang || 0}</p>
            <p className="text-[10px] text-gray-400 mt-1 italic">Global: {stats?.globalStokKurang || 0}</p>
          </div>

          {/* Habis */}
          <div className="bg-red-50 p-6 rounded-lg border border-red-200">
            <p className="text-sm text-red-600">Habis</p>
            <p className="text-2xl font-bold text-red-700">{stats?.habis || 0}</p>
            <p className="text-[10px] text-gray-400 mt-1 italic">Global: {stats?.globalHabis || 0}</p>
          </div>

          {/* Stok Lebih */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">Stok Lebih</p>
            <p className="text-2xl font-bold text-green-700">{stats?.stokLebih || 0}</p>
            <p className="text-[10px] text-gray-400 mt-1 italic">Global: {stats?.globalStokLebih || 0}</p>
          </div>

          {/* Total Nilai */}
          <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-600">Total Nilai</p>
            <p className="text-xl font-bold text-indigo-700">
              Rp {((stats?.totalNilai || 0) / 1000000000).toFixed(1)} M
            </p>
            <p className="text-[10px] text-gray-400 mt-1 italic">
              Global: Rp {((stats?.globalTotalNilai || 0) / 1000000000).toFixed(1)} M
            </p>
          </div>
        </div>

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
                  placeholder="Cari kode barang, nama barangs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>

              {/* Filter Kategori */}
              <select
                value={filters.nama_kategori || 'all'}
                onChange={(e) => setFilter('nama_kategori', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Kategori</option>
                {kategoriList.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
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

              {/* Filter Status */}
              <select
                value={filters.status_stok}
                onChange={(e) => setFilter('status_stok', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
              >
                <option value="all">Semua Status</option>
                <option value="Tersedia">Tersedia</option>
                <option value="Stok Kurang">Stok Kurang</option>
                <option value="Habis">Habis</option>
                <option value="Stok Lebih">Stok Lebih</option>
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

                if (filter.key === 'nama_kategori') {
                  const kat = kategoriList.find(k => k.kode === filter.value);
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                    >
                      Kategori: {kat?.nama || filter.value}
                      <button
                        onClick={() => setFilter('nama_kategori', 'all')}
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

                if (filter.key === 'status_stok') {
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                    >
                      Status: {filter.value}
                      <button
                        onClick={() => setFilter('status_stok', 'all')}
                        className="hover:bg-green-200 rounded-full p-0.5"
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

        {/* Table Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th onClick={() => requestSort('kode_barang')} className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Kode {sortConfig.key === 'kode_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => requestSort('nama_barang')} className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Nama Barang {sortConfig.key === 'nama_barang' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Kategori</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Armada</th>
                  <th onClick={() => requestSort('stok_akhir')} className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Stok {sortConfig.key === 'stok_akhir' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => requestSort('nilai_stok')} className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors">
                    Nilai {sortConfig.key === 'nilai_stok' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
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
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">{item.kode_barang}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{item.nama_barang}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.nama_kategori || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.nama_armada || '-'}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-right font-bold text-gray-900">{item.stok_akhir.toLocaleString('id-ID')}</p>
                          <p className="text-xs text-right text-gray-500">{item.satuan}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-green-700">{formatCurrency(item.nilai_stok)}</td>
                      <td className="px-6 py-4 text-center">
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