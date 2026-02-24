// src/pages/Pembelian.jsx

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDataTable } from '../hooks/useDataTable';
import { pembelianAPI, barangAPI, vendorAPI, authAPI } from '../services/api';
import MainLayout from '../components/layout/MainLayout';
import {
    Search,
    Filter,
    X,
    Download,
    Plus,
    Edit,
    Trash2,
    Calendar,
    Package,
    Building2,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
} from 'lucide-react';

export default function Pembelian() {
    const currentUser = authAPI.getCurrentUser();

    // States untuk master data
    const [barangList, setBarangList] = useState([]);
    const [vendorList, setVendorList] = useState([]);
    const [kategoriList, setKategoriList] = useState([]);
    const [armadaList, setArmadaList] = useState([]);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        no_po: '',
        tanggal_po: new Date().toISOString().split('T')[0],
        kode_vendor: '',
        nama_vendor: '',
        kode_barang: '',
        nama_barang: '',
        qty_order: 0,
        harga_satuan: 0,
        total_harga: 0,
        tanggal_terima: '',
        status: 'Pending',
        keterangan: '',
    });
    const [loadingMaster, setLoadingMaster] = useState(false);

    // State baru untuk search di dalam modal
    const [vendorSearch, setVendorSearch] = useState('');
    const [barangSearch, setBarangSearch] = useState('');
    const [showVendorList, setShowVendorList] = useState(false);
    const [showBarangList, setShowBarangList] = useState(false);
    const vendorDropdownRef = useRef(null);
    const barangDropdownRef = useRef(null);

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target)) {
                setShowVendorList(false);
            }
            if (barangDropdownRef.current && !barangDropdownRef.current.contains(event.target)) {
                setShowBarangList(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch pembelian data dengan useCallback
    const fetchPembelianData = useCallback(async () => {
        const result = await pembelianAPI.getAll();
        return result;
    }, []);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // useDataTable hook dengan date filter
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
        rowsPerPage,
        setRowsPerPage,
        customRowsInput,
        setCustomRowsInput,
        handleCustomRowsApply,
        totalPages,
        totalRows,
        stats,
        refresh,

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
    } = useDataTable({
        fetchData: fetchPembelianData,
        filterKeys: ['kode_kategori', 'kode_armada', 'status'],
        searchKeys: ['no_po', 'kode_barang', 'nama_barang', 'nama_vendor', 'keterangan'],
        dateFilterKey: 'tanggal_po', // Filter berdasarkan tanggal PO
        defaultSort: { key: 'tanggal_po', direction: 'desc' },
        defaultRowsPerPage: 10,
        calculateStats: (filtered, all) => {
            const filteredStats = {
                totalPO: filtered.length,
                totalQty: filtered.reduce((sum, item) => sum + (parseFloat(item.qty_order) || 0), 0),
                totalValue: filtered.reduce((sum, item) => sum + (parseFloat(item.total_harga) || 0), 0),
                avgLeadTime: filtered.filter(i => i.lead_time_days).length > 0
                    ? filtered.reduce((sum, i) => sum + (parseFloat(i.lead_time_days) || 0), 0) /
                    filtered.filter(i => i.lead_time_days).length
                    : 0,
                pending: filtered.filter(i => i.status === 'Pending').length,
                completed: filtered.filter(i => i.status === 'Completed').length,
            };

            const globalStats = {
                totalPO: all.length,
                totalQty: all.reduce((sum, item) => sum + (parseFloat(item.qty_order) || 0), 0),
                totalValue: all.reduce((sum, item) => sum + (parseFloat(item.total_harga) || 0), 0),
                avgLeadTime: all.filter(i => i.lead_time_days).length > 0
                    ? all.reduce((sum, i) => sum + (parseFloat(i.lead_time_days) || 0), 0) /
                    all.filter(i => i.lead_time_days).length
                    : 0,
            };

            return { filtered: filteredStats, global: globalStats };
        },
    });

    // Extract kategori dan armada dari allData
    const kategoriOptions = useMemo(() => {
        const unique = new Map();
        allData.forEach(item => {
            if (item.kode_kategori && item.nama_kategori) {
                unique.set(item.kode_kategori, item.nama_kategori);
            }
        });
        return Array.from(unique, ([kode, nama]) => ({ kode, nama }));
    }, [allData]);

    const armadaOptions = useMemo(() => {
        const unique = new Map();
        allData.forEach(item => {
            if (item.kode_armada && item.nama_armada) {
                unique.set(item.kode_armada, item.nama_armada);
            }
        });
        return Array.from(unique, ([kode, nama]) => ({ kode, nama }));
    }, [allData]);

    // Permissions
    const canCreate = ['Admin', 'Manager', 'Staff_pembelian'].includes(currentUser?.role);
    const canEdit = ['Admin', 'Manager', 'Staff_pembelian'].includes(currentUser?.role);
    const canDelete = ['Admin', 'Manager'].includes(currentUser?.role);

    // Load master data untuk form
    const loadMasterData = async () => {
        setLoadingMaster(true);
        try {
            const [barang, vendor] = await Promise.all([
                barangAPI.getAll(),
                vendorAPI.getAll(),
            ]);

            setBarangList(barang.filter(b => b.is_active));
            setVendorList(vendor.filter(v => v.is_active));

            // Extract kategori dan armada dari barang
            const kategoriMap = new Map();
            const armadaMap = new Map();

            barang.forEach(item => {
                if (item.kode_kategori && item.nama_kategori) {
                    kategoriMap.set(item.kode_kategori, item.nama_kategori);
                }
                if (item.kode_armada && item.nama_armada) {
                    armadaMap.set(item.kode_armada, item.nama_armada);
                }
            });

            setKategoriList(Array.from(kategoriMap, ([kode, nama]) => ({ kode, nama })));
            setArmadaList(Array.from(armadaMap, ([kode, nama]) => ({ kode, nama })));

        } catch (error) {
            console.error('Error loading master data:', error);
            alert('Gagal memuat data master: ' + error.message);
        } finally {
            setLoadingMaster(false);
        }
    };

    // Form handlers
    const openCreateModal = () => {
        resetForm();
        setEditingItem(null);
        setShowModal(true);
        loadMasterData();
    };

    // Filter vendor berdasarkan search input
    const filteredVendors = useMemo(() => {
        if (!vendorSearch) return [];
        const term = vendorSearch.toLowerCase();
        return vendorList.filter(v =>
            v.nama_vendor.toLowerCase().includes(term) ||
            v.kode_vendor.toLowerCase().includes(term)
        ).slice(0, 10);
    }, [vendorList, vendorSearch]);

    // Filter barang berdasarkan search input
    const filteredBarang = useMemo(() => {
        if (!barangSearch) return [];
        const term = barangSearch.toLowerCase();
        return barangList.filter(b =>
            b.nama_barang.toLowerCase().includes(term) ||
            b.kode_barang.toLowerCase().includes(term)
        ).slice(0, 10);
    }, [barangList, barangSearch]);

    // Handler saat item dipilih
    const selectVendor = (vendor) => {
        setFormData(prev => ({
            ...prev,
            kode_vendor: vendor.kode_vendor,
            nama_vendor: vendor.nama_vendor,
        }));
        setVendorSearch('');
        setShowVendorList(false);
    };

    const selectBarang = (barang) => {
        setFormData(prev => ({
            ...prev,
            kode_barang: barang.kode_barang,
            nama_barang: barang.nama_barang,
            harga_satuan: barang.harga_satuan || 0,
            total_harga: prev.qty_order * (barang.harga_satuan || 0),
        }));
        setBarangSearch('');
        setShowBarangList(false);
    };

    // Update search input saat masuk mode Edit
    const openEditModal = (item) => {
        setFormData({
            no_po: item.no_po,
            tanggal_po: item.tanggal_po?.split('T')[0] || '',
            kode_vendor: item.kode_vendor,
            nama_vendor: item.nama_vendor,
            kode_barang: item.kode_barang,
            nama_barang: item.nama_barang,
            qty_order: item.qty_order,
            harga_satuan: item.harga_satuan,
            total_harga: item.total_harga,
            tanggal_terima: item.tanggal_terima?.split('T')[0] || '',
            status: item.status,
            keterangan: item.keterangan || '',
        });
        setVendorSearch('');
        setBarangSearch('');
        setEditingItem(item);
        setShowModal(true);
        loadMasterData();
    };

    const resetForm = () => {
        setFormData({
            no_po: '',
            tanggal_po: new Date().toISOString().split('T')[0],
            kode_vendor: '',
            nama_vendor: '',
            kode_barang: '',
            nama_barang: '',
            qty_order: 0,
            harga_satuan: 0,
            total_harga: 0,
            tanggal_terima: '',
            status: 'Pending',
            keterangan: '',
        });
        setEditingItem(null);
        setVendorSearch('');
        setBarangSearch('');
    };
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;

        setFormData(prev => {
            const updated = {
                ...prev,
                [name]: type === 'number' ? parseFloat(value) || 0 : value
            };

            // Auto-calculate total_harga
            if (name === 'qty_order' || name === 'harga_satuan') {
                updated.total_harga = updated.qty_order * updated.harga_satuan;
            }

            return updated;
        });
    };

    // JSX Bagian Modal Form (Ganti bagian Vendor dan Barang)
    const handleBarangSelect = (e) => {
        const kode = e.target.value;
        const selectedBarang = barangList.find(b => b.kode_barang === kode);

        if (selectedBarang) {
            setFormData(prev => ({
                ...prev,
                kode_barang: selectedBarang.kode_barang,
                nama_barang: selectedBarang.nama_barang,
                harga_satuan: selectedBarang.harga_satuan || 0,
                total_harga: prev.qty_order * (selectedBarang.harga_satuan || 0),
            }));
        }
    };

    // Handle vendor selection
    const handleVendorSelect = (e) => {
        const kode = e.target.value;
        const selectedVendor = vendorList.find(v => v.kode_vendor === kode);

        if (selectedVendor) {
            setFormData(prev => ({
                ...prev,
                kode_vendor: selectedVendor.kode_vendor,
                nama_vendor: selectedVendor.nama_vendor,
            }));
        }
    };

    // CRUD Operations
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.no_po || !formData.kode_vendor || !formData.kode_barang) {
            alert('No. PO, Vendor, dan Kode Barang wajib diisi!');
            return;
        }

        if (formData.qty_order <= 0) {
            alert('Quantity harus lebih dari 0!');
            return;
        }

        try {
            // Sanitize: ubah string kosong pada field tanggal menjadi null
            // agar tidak menyebabkan error validasi di database
            const sanitizedForm = {
                ...formData,
                tanggal_terima: formData.tanggal_terima || null,
            };

            let payload;
            if (editingItem) {
                // Saat update: jangan kirim created_by agar tidak
                // menimpa nilai asli di database
                const { created_by, ...updateFields } = sanitizedForm;
                payload = {
                    ...updateFields,
                    updated_by: currentUser?.userId,
                };
            } else {
                // Saat create: kirim created_by
                payload = {
                    ...sanitizedForm,
                    created_by: currentUser?.userId,
                    updated_by: currentUser?.userId,
                };
            }

            console.log('[Pembelian] Payload dikirim:', payload); // untuk debugging

            if (editingItem) {
                await pembelianAPI.update(editingItem.id, payload);
                alert('Purchase Order berhasil diupdate!');
            } else {
                await pembelianAPI.create(payload);
                alert('Purchase Order berhasil ditambah!');
            }

            setShowModal(false);
            resetForm();
            await refresh();

        } catch (error) {
            console.error('Submit error:', error);
            // Tampilkan detail error dari server jika tersedia
            const message = error?.response?.data?.message
                || error?.response?.data?.error
                || error?.message
                || 'Unknown error';
            alert('Error: ' + message);
        }
    };

    const handleDelete = async (item) => {
        if (!confirm(`Yakin ingin menghapus PO ${item.no_po}?`)) return;

        try {
            await pembelianAPI.delete(item.id);
            alert('Purchase Order berhasil dihapus!');
            await refresh();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error: ' + error.message);
        }
    };

    // Export to Excel
    const handleExport = () => {
        const exportData = filteredData.map(item => ({
            'No. PO': item.no_po,
            'Tanggal PO': item.tanggal_po?.split('T')[0] || '',
            'Vendor': item.nama_vendor,
            'Barang': item.nama_barang,
            'Kategori': item.nama_kategori || '',
            'Armada': item.nama_armada || '',
            'Qty Order': item.qty_order,
            'Harga Satuan': item.harga_satuan,
            'Total Harga': item.total_harga,
            'Tanggal Terima': item.tanggal_terima?.split('T')[0] || '-',
            'Lead Time (days)': item.lead_time_days || '-',
            'Status': item.status,
            'Keterangan': item.keterangan || '',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pembelian');
        XLSX.writeFile(wb, `pembelian_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Status badge helper
    const getStatusBadge = (status) => {
        const colors = {
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'Received': 'bg-blue-100 text-blue-800 border-blue-200',
            'Completed': 'bg-green-100 text-green-800 border-green-200',
            'Cancelled': 'bg-red-100 text-red-800 border-red-200',
        };
        const icons = {
            'Pending': Clock,
            'Received': Package,
            'Completed': CheckCircle2,
            'Cancelled': XCircle,
        };
        const Icon = icons[status] || Clock;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                <Icon className="w-3 h-3" />
                {status}
            </span>
        );
    };

    return (
        <MainLayout>
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
                                    placeholder="Cari PO, barang, vendor..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                />
                            </div>

                            {/* Filter Kategori */}
                            <select
                                value={filters.kode_kategori || 'all'}
                                onChange={(e) => setFilter('kode_kategori', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                            >
                                <option value="all">Semua Kategori</option>
                                {kategoriOptions.map(kat => (
                                    <option key={kat.kode} value={kat.kode}>{kat.nama}</option>
                                ))}
                            </select>

                            {/* Filter Armada */}
                            <select
                                value={filters.kode_armada || 'all'}
                                onChange={(e) => setFilter('kode_armada', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                            >
                                <option value="all">Semua Armada</option>
                                {armadaOptions.map(arm => (
                                    <option key={arm.kode} value={arm.kode}>{arm.nama}</option>
                                ))}
                            </select>

                            {/* Filter Status */}
                            <select
                                value={filters.status || 'all'}
                                onChange={(e) => setFilter('status', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                            >
                                <option value="all">Semua Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Received">Received</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
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
                                    ? kategoriOptions.find(k => k.kode === filter.value)?.nama || filter.value
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
                {dateFilterMode !== 'all' && (
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
                )}

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th
                                        onClick={() => requestSort('no_po')}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                    >
                                        No. PO {sortConfig.key === 'no_po' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th
                                        onClick={() => requestSort('tanggal_po')}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                    >
                                        Tanggal PO {sortConfig.key === 'tanggal_po' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barang</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Order</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Harga</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                    {(canEdit || canDelete) && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tindakan</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                                <span className="text-sm text-gray-500">Memuat data...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={canEdit || canDelete ? 10 : 9} className="px-6 py-12 text-center text-gray-500">
                                                <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                                                <p className="text-sm">
                                                    {hasActiveFilters
                                                        ? 'Tidak ada purchase order yang sesuai dengan filter'
                                                        : 'Belum ada purchase order. Klik tombol Tambah untuk membuat PO baru.'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedData.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-mono text-sm font-medium">{item.no_po}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(item.tanggal_po)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium">{item.nama_vendor}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-medium">{item.nama_barang}</p>
                                                        <p className="text-xs text-gray-500">{item.kode_barang}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.nama_kategori || '-'}</td>
                                                <td className="px-6 py-4 text-right font-semibold text-sm">{item.qty_order}</td>
                                                <td className="px-6 py-4 text-right font-semibold text-sm text-green-600">
                                                    Rp {(item.total_harga || 0).toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {getStatusBadge(item.status)}
                                                </td>
                                                {(canEdit || canDelete) && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => openEditModal(item)}
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDelete(item)}
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        )))
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
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        {/* Header Modal */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingItem ? 'Edit Purchase Order' : 'Tambah Purchase Order Baru'}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    resetForm();
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* No. PO */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        No. PO *
                                    </label>
                                    <input
                                        type="text"
                                        name="no_po"
                                        value={formData.no_po}
                                        onChange={handleInputChange}
                                        disabled={!!editingItem}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="PO-2025-001"
                                    />
                                </div>

                                {/* Tanggal PO */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tanggal PO *
                                    </label>
                                    <input
                                        type="date"
                                        name="tanggal_po"
                                        value={formData.tanggal_po}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Searchable Vendor */}
                                <div className="md:col-span-2 relative" ref={vendorDropdownRef}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cari Vendor *
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="Cari kode atau nama vendor..."
                                            value={vendorSearch}
                                            onChange={(e) => { setVendorSearch(e.target.value); setShowVendorList(true); }}
                                            onFocus={() => setShowVendorList(true)}
                                        />
                                    </div>

                                    {showVendorList && vendorSearch && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {filteredVendors.length > 0 ? (
                                                filteredVendors.map((v) => (
                                                    <div
                                                        key={v.kode_vendor}
                                                        onClick={() => selectVendor(v)}
                                                        className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0"
                                                    >
                                                        <div className="text-sm font-bold text-gray-800">{v.kode_vendor}</div>
                                                        <div className="text-xs text-gray-600">{v.nama_vendor}</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">Vendor tidak ditemukan</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Preview Vendor terpilih */}
                                    <div className="mt-2 grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Kode Vendor</span>
                                            <span className="text-sm font-mono font-semibold">{formData.kode_vendor || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Nama Vendor</span>
                                            <span className="text-sm">{formData.nama_vendor || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Searchable Barang */}
                                <div className="md:col-span-2 relative" ref={barangDropdownRef}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cari Barang *
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="Cari kode atau nama barang..."
                                            value={barangSearch}
                                            onChange={(e) => { setBarangSearch(e.target.value); setShowBarangList(true); }}
                                            onFocus={() => setShowBarangList(true)}
                                        />
                                    </div>

                                    {showBarangList && barangSearch && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {filteredBarang.length > 0 ? (
                                                filteredBarang.map((b) => (
                                                    <div
                                                        key={b.kode_barang}
                                                        onClick={() => selectBarang(b)}
                                                        className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0"
                                                    >
                                                        <div className="text-sm font-bold text-gray-800">{b.kode_barang}</div>
                                                        <div className="text-xs text-gray-600">{b.nama_barang} ({b.satuan})</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">Barang tidak ditemukan</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Preview Barang terpilih */}
                                    <div className="mt-2 grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Kode Barang</span>
                                            <span className="text-sm font-mono font-semibold">{formData.kode_barang || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Nama Barang</span>
                                            <span className="text-sm">{formData.nama_barang || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Qty Order */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Qty Order *
                                    </label>
                                    <input
                                        type="number"
                                        name="qty_order"
                                        value={formData.qty_order}
                                        onChange={handleInputChange}
                                        required
                                        min="1"
                                        step="1"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Harga Satuan */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Harga Satuan *
                                    </label>
                                    <input
                                        type="number"
                                        name="harga_satuan"
                                        value={formData.harga_satuan}
                                        onChange={handleInputChange}
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Total Harga (Auto-calculated) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Total Harga
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.total_harga}
                                        readOnly
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                    />
                                </div>

                                {/* Tanggal Terima */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tanggal Terima
                                    </label>
                                    <input
                                        type="date"
                                        name="tanggal_terima"
                                        value={formData.tanggal_terima}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Status */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Status *
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Received">Received</option>
                                        <option value="Cancelled">Cancelled</option>
                                        {/* 'Completed' dihapus — tidak ada di CHECK constraint database.
                                            Untuk menambahkan, jalankan SQL migration di bawah. */}
                                    </select>
                                </div>

                                {/* Keterangan */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Keterangan
                                    </label>
                                    <textarea
                                        name="keterangan"
                                        value={formData.keterangan}
                                        onChange={handleInputChange}
                                        rows="3"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="Catatan tambahan..."
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
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg"
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