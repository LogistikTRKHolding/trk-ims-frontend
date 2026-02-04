// src/pages/KartuStok.jsx

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Package, TrendingUp, TrendingDown, Calendar, RefreshCw,
    Filter, X, ChevronLeft, Menu,
    // NEW: Icons for Image Modal
    ZoomIn, Download, ExternalLink, Image as ImageIcon, Maximize2
} from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { mutasiAPI, stokAPI } from '../services/api';
import { useDataTable } from '../hooks/useDataTable';
import { cloudinaryService } from '../services/cloudinary'; // Import cloudinary service

const useDesktopMediaQuery = () => {
    const [isDesktop, setDesktop] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const media = window.matchMedia('(min-width: 1024px)');
        const listener = () => setDesktop(media.matches);
        listener();
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, []);
    return isDesktop;
};

export default function KartuStok() {
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSidebar, setShowSidebar] = useState(true);
    const isDesktop = useDesktopMediaQuery();

    // Filter Kategori (untuk sidebar)
    const [filterKategori, setFilterKategori] = useState('all');

    // ============================================
    // NEW: Image Modal States
    // ============================================
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState(null);
    const [previewImageName, setPreviewImageName] = useState('');

    const sidebarVariants = {
        hidden: {
            x: '-100%',
            opacity: 0.5,
            transition: { type: 'tween', ease: 'easeInOut', duration: 0.3 }
        },
        visible: {
            x: '0%',
            opacity: 1,
            transition: { type: 'spring', damping: 25, stiffness: 200 }
        },
        exit: {
            x: '-100%',
            opacity: 0,
            transition: { type: 'tween', ease: 'easeInOut', duration: 0.2 }
        }
    };

    // Load items list on mount
    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        setLoading(true);
        try {
            const result = await stokAPI.getAll();
            setItems(result);
        } catch (error) {
            console.error('Error loading items:', error);
            alert('Failed to load items: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch mutasi data for selected item
    const fetchMutasiData = useCallback(async () => {
        if (!selectedItem) return [];
        const result = await mutasiAPI.getByBarang(selectedItem.kode_barang);

        // Calculate running balance
        let saldo = 0;
        const withBalance = result
            .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
            .map(item => {
                if (item.jenis_transaksi === 'Masuk') {
                    saldo += item.qty;
                } else if (item.jenis_transaksi === 'Keluar') {
                    saldo -= item.qty;
                }
                return { ...item, saldo };
            });

        return withBalance;
    }, [selectedItem]);

    // useDataTable hook for mutasi history
    const {
        data: paginatedHistory,
        filteredData: filteredHistory,
        allData: stockHistory,
        loading: loadingHistory,

        // Date filters
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

        // Transaction type filter
        filters,
        setFilter,
        clearAllFilters,
        hasActiveFilters,

        // Refresh
        refresh,

        // Stats
        stats,
    } = useDataTable({
        fetchData: fetchMutasiData,
        filterKeys: ['jenis_transaksi'],
        dateFilterKey: 'tanggal',
        defaultSort: { key: 'tanggal', direction: 'desc' },
        defaultRowsPerPage: 50,

        calculateStats: (filtered) => ({
            totalIn: filtered.filter(r => r.jenis_transaksi === 'Masuk').reduce((sum, r) => sum + r.qty, 0),
            totalOut: filtered.filter(r => r.jenis_transaksi === 'Keluar').reduce((sum, r) => sum + r.qty, 0),
        }),
    });

    const handleItemSelect = (item) => {
        console.log("Data Barang Terpilih:", item);
        setSelectedItem(item);
        setShowSidebar(false); // Tutup sidebar di mobile
    };

    // Trigger refresh when selectedItem changes
    useEffect(() => {
        if (selectedItem) {
            refresh();
        }
    }, [selectedItem, refresh]);

    // Filter items berdasarkan pencarian dan kategori
    const filteredItems = items.filter(item => {
        const searchMatch = item.nama_barang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.kode_barang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.nama_kategori?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!searchMatch) return false;

        if (filterKategori !== 'all' && item.nama_kategori !== filterKategori) {
            return false;
        }

        return true;
    });

    // Get unique categories for sidebar filter
    const kategoriList = [...new Set(items.map(item => item.nama_kategori).filter(Boolean))].sort();

    const hasItemFilter = filterKategori !== 'all' || searchTerm !== '';

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // ============================================
    // NEW: Image Modal Handlers
    // ============================================
    const handleImageClick = () => {
        if (!selectedItem?.gambar_url) return;
        setPreviewImageUrl(selectedItem.gambar_url);
        setPreviewImageName(selectedItem.nama_barang);
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

    if (loading && items.length === 0) {
        return (
            <MainLayout title="Kartu Stok">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        {/* <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
                        <p className="text-gray-600">Memuat data...</p> */}
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        <span className="text-sm text-gray-500">Memuat data...</span>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Kartu Stok">
            <div className="space-y-6 relative">
                {/* Toggle Sidebar Button - Hanya di Mobile */}
                {!isDesktop && !showSidebar && (
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="fixed bottom-6 left-6 z-40 lg:hidden bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
                    >
                        <Menu className="w-6 h-6" /> <span className="font-medium">Daftar Barang</span>
                    </button>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
                    {/* Sidebar - Daftar Barang */}
                    <AnimatePresence mode="wait">
                        {(isDesktop || showSidebar) && (
                            <motion.div
                                key="sidebar"
                                variants={sidebarVariants}
                                initial={isDesktop ? 'visible' : 'hidden'}
                                animate="visible"
                                exit="exit"
                                className={`
                                    lg:col-span-1 bg-white rounded-lg shadow-md
                                    ${!isDesktop ? 'fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm' : ''}
                                `}
                            >
                                <div className="flex flex-col h-full max-h-screen lg:max-h-[calc(100vh-8rem)]">
                                    {/* Header Sidebar */}
                                    <div className="p-4 border-b space-y-3 flex-shrink-0">
                                        <div className="flex items-center justify-between">
                                            <h2 className="font-semibold text-gray-800">Daftar Barang</h2>
                                            {!isDesktop && (
                                                <button onClick={() => setShowSidebar(false)} className="text-gray-500 hover:text-gray-700">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Search Box */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Cari barang..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>

                                        {/* Filter Kategori */}
                                        <div className="relative">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <select
                                                value={filterKategori}
                                                onChange={(e) => setFilterKategori(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                            >
                                                <option value="all">Semua Kategori</option>
                                                {kategoriList.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {hasItemFilter && (
                                            <button onClick={() => setFilterKategori('all') || setSearchTerm('')} className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                                                <X className="w-4 h-4" /> Clear Filter
                                            </button>
                                        )}
                                    </div>

                                    {/* List Barang - Scrollable */}
                                    <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
                                        {filteredItems.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500">
                                                {hasItemFilter ? 'Tidak ada barang yang sesuai' : 'Tidak ada barang'}
                                            </div>
                                        ) : (
                                            filteredItems.map((item) => (
                                                <button
                                                    key={item.id || item.kode_barang}
                                                    onClick={() => handleItemSelect(item)}
                                                    className={`w-full text-left p-4 transition-all ${selectedItem?.kode_barang === item.kode_barang
                                                        ? 'bg-green-50 border-l-4 border-green-500'
                                                        : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                                <span className="font-semibold text-gray-800 truncate text-sm">{item.nama_barang}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mb-1">{item.kode_barang}</p>
                                                            <div className="flex gap-1 flex-wrap">
                                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{item.nama_kategori}</span>
                                                                {item.nama_armada && (
                                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{item.nama_armada}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <div className={`text-base font-bold ${parseInt(item.stok_akhir) <= parseInt(item.min_stok || 0) ? 'text-red-600' : 'text-green-600'}`}>
                                                                {item.stok_akhir || 0}
                                                            </div>
                                                            <div className="text-xs text-gray-500">{item.satuan}</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Overlay untuk Mobile Sidebar */}
                    {!isDesktop && showSidebar && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSidebar(false)}
                            className="fixed inset-0 bg-black bg-opacity-30 z-40 lg:hidden"
                        />
                    )}

                    {/* Main Content - Kartu Stok */}
                    <div className="lg:col-span-3">
                        {selectedItem ? (
                            <div className="bg-white rounded-lg shadow-md">
                                {/* Item Info Header - Updated dengan Image Box */}
                                <div className="p-4 lg:p-6 border-b">
                                    {/* Product Image Box + Product Info */}
                                    <div className="flex flex-col sm:flex-row gap-4 lg:gap-6 mb-4 lg:mb-6">
                                        {/* Product Image Box (Clickable) */}
                                        <div className="flex-shrink-0">
                                            {selectedItem.gambar_url ? (
                                                <div className="relative group">
                                                    <button
                                                        onClick={handleImageClick}
                                                        className="relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-green-500 transition-all shadow-sm hover:shadow-md"
                                                        title="Klik untuk melihat gambar"
                                                    >
                                                        <img
                                                            src={cloudinaryService.getThumbnailUrl(selectedItem.gambar_url, 200, 200)}
                                                            alt={selectedItem.nama_barang}
                                                            className="w-32 h-32 lg:w-40 lg:h-40 object-cover transition-transform group-hover:scale-110"
                                                        />
                                                        {/* Hover Overlay */}
                                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                                                                <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                                                                <span className="text-white text-xs font-medium drop-shadow">
                                                                    Klik untuk zoom
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-32 h-32 lg:w-40 lg:h-40 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                                        <p className="text-xs text-gray-400">No Image</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-2">{selectedItem.nama_barang}</h2>
                                            <div className="space-y-1 text-sm text-gray-600">
                                                <p>Kode: <span className="font-medium font-mono">{selectedItem.kode_barang}</span></p>
                                                <p>Kategori: <span className="font-medium">{selectedItem.nama_kategori}</span></p>
                                                {selectedItem.nama_armada && (
                                                    <p>Armada: <span className="font-medium">{selectedItem.nama_armada}</span></p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-3 gap-2 lg:gap-4">
                                        {/* Card Stok */}
                                        <div className="bg-blue-50 rounded-lg p-3 lg:p-4">
                                            <div className="flex items-center gap-1 mb-1 lg:mb-2">
                                                <Package className="text-blue-600 w-4 h-4 lg:w-5 lg:h-5 hidden lg:block" />
                                                <span className="text-xs lg:text-sm text-gray-600">Stok Saat Ini</span>
                                            </div>
                                            <div className="text-lg lg:text-2xl font-bold text-blue-600">{selectedItem.stok_akhir || 0}</div>
                                            <div className="text-xs text-gray-500 mt-1 hidden lg:block">Min: {selectedItem.min_stok || 0}</div>
                                        </div>
                                        {/* Card Masuk */}
                                        <div className="bg-green-50 rounded-lg p-3 lg:p-4">
                                            <div className="flex items-center gap-1 mb-1 lg:mb-2">
                                                <TrendingUp className="text-green-600 w-4 h-4 lg:w-5 lg:h-5 hidden lg:block" />
                                                <span className="text-xs lg:text-sm text-gray-600">Total Masuk</span>
                                            </div>
                                            <div className="text-lg lg:text-2xl font-bold text-green-600">{stats?.totalIn || 0}</div>
                                        </div>
                                        {/* Card Keluar */}
                                        <div className="bg-red-50 rounded-lg p-3 lg:p-4">
                                            <div className="flex items-center gap-1 mb-1 lg:mb-2">
                                                <TrendingDown className="text-red-600 w-4 h-4 lg:w-5 lg:h-5 hidden lg:block" />
                                                <span className="text-xs lg:text-sm text-gray-600">Total Keluar</span>
                                            </div>
                                            <div className="text-lg lg:text-2xl font-bold text-red-600">{stats?.totalOut || 0}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Section - Scrollable Horizontal di Mobile */}
                                <div className="p-4 border-b overflow-x-auto scrollbar-hide">
                                    <div className="flex gap-2 items-center min-w-max">
                                        <Filter className="w-4 h-4 text-gray-600" />
                                        <select
                                            value={filters.jenis_transaksi || 'all'}
                                            onChange={(e) => setFilter('jenis_transaksi', e.target.value)}
                                            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                        >
                                            <option value="all">Semua Transaksi</option>
                                            <option value="Masuk">Masuk</option>
                                            <option value="Keluar">Keluar</option>
                                        </select>

                                        <div className="h-6 w-px bg-gray-300 mx-2"></div>

                                        <Calendar className="w-4 h-4 text-gray-600" />
                                        <select
                                            value={dateFilterMode}
                                            onChange={(e) => {
                                                setDateFilterMode(e.target.value);
                                                if (e.target.value === 'all') clearDateFilter();
                                            }}
                                            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                        >
                                            <option value="all">Semua Tanggal</option>
                                            <option value="single">Tanggal Spesifik</option>
                                            <option value="range">Rentang Tanggal</option>
                                        </select>

                                        {dateFilterMode === 'single' && (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="date"
                                                    value={singleDate}
                                                    onChange={(e) => setSingleDate(e.target.value)}
                                                    className="px-3 py-1.5 border rounded-lg text-sm focus:ring-green-500"
                                                />
                                                {singleDate && (
                                                    <button onClick={() => setSingleDate('')} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        )}

                                        {dateFilterMode === 'range' && (
                                            <div className="flex items-center gap-1">
                                                <input type="date" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} className="px-2 py-1.5 border rounded-lg text-sm w-32" placeholder="Mulai" />
                                                <span className="text-gray-500">-</span>
                                                <input type="date" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} className="px-2 py-1.5 border rounded-lg text-sm w-32" placeholder="Selesai" />
                                                {(dateRangeStart || dateRangeEnd) && (
                                                    <button onClick={clearDateFilter} className="text-gray-400 hover:text-gray-600 ml-1"><X className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        )}

                                        {hasActiveFilters && (
                                            <button
                                                onClick={clearAllFilters}
                                                className="flex items-center gap-1 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg ml-2"
                                            >
                                                <X className="w-4 h-4" />Clear Filter
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Tabel Riwayat - Responsif */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500">Tanggal</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500">Transaksi</th>
                                                <th className="px-4 py-3 text-right font-medium text-gray-500">Qty</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">Keterangan</th>
                                                <th className="px-4 py-3 text-right font-medium text-gray-500">Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loadingHistory ? (
                                                <tr>
                                                    <td colSpan="8" className="px-6 py-12 text-center">
                                                        <div className="flex flex-col items-center justify-center space-y-2">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredHistory.length === 0 ? (
                                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Tidak ada data transaksi</td></tr>
                                            ) : (
                                                paginatedHistory.map((record, index) => (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(record.tanggal)}</td>
                                                        <td className="px-4 py-3">
                                                            {record.jenis_transaksi === 'Masuk' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                                    <TrendingUp className="w-3 h-3" /> Masuk
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                                    <TrendingDown className="w-3 h-3" /> Keluar
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-bold ${record.jenis_transaksi === 'Masuk' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {record.jenis_transaksi === 'Masuk' ? '+' : '-'}{record.qty}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500 truncate max-w-[150px] hidden lg:table-cell">{record.keterangan || '-'}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-800">{record.saldo}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            // Placeholder saat belum pilih barang (Hanya tampil di desktop)
                            <div className="bg-white rounded-lg shadow p-12 text-center hidden lg:flex flex-col items-center justify-center h-full min-h-[400px]">
                                <Package className="w-16 h-16 text-gray-300 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">Pilih Barang</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">Silakan pilih barang dari daftar di sebelah kiri untuk melihat detail kartu stok.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================
                NEW: Image Preview Modal
                ============================================ */}
            {
                showImagePreview && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                        onClick={handleCloseImagePreview}
                    >
                        <div
                            className="relative max-w-4xl w-full bg-white rounded-lg shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <ImageIcon className="w-5 h-5 text-gray-600" />
                                    <h3 className="font-semibold text-gray-900">{previewImageName}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Download Button */}
                                    <button
                                        onClick={handleDownloadImage}
                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                        title="Download gambar"
                                    >
                                        <Download className="w-5 h-5 text-gray-700" />
                                    </button>

                                    {/* Open in New Tab Button */}
                                    <button
                                        onClick={handleOpenInNewTab}
                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                        title="Buka di tab baru"
                                    >
                                        <ExternalLink className="w-5 h-5 text-gray-700" />
                                    </button>

                                    {/* Close Button */}
                                    <button
                                        onClick={handleCloseImagePreview}
                                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                        title="Tutup"
                                    >
                                        <X className="w-5 h-5 text-gray-700" />
                                    </button>
                                </div>
                            </div>

                            {/* Image Container */}
                            <div className="flex items-center justify-center bg-gray-900 p-6" style={{ maxHeight: '70vh' }}>
                                <img
                                    src={cloudinaryService.getMediumUrl(previewImageUrl, 1200, 900)}
                                    alt={previewImageName}
                                    className="max-w-full max-h-full object-contain rounded"
                                    onError={(e) => {
                                        // Fallback to original URL if optimized fails
                                        e.target.src = previewImageUrl;
                                    }}
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-3 bg-gray-50 border-t">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                    <span>Klik di luar atau tekan ESC untuk menutup</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </MainLayout >
    );
}