// src/pages/Pembelian.jsx

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useDataTable } from '../hooks/useDataTable';
import { pembelianAPI, barangAPI, vendorAPI, authAPI, kategoriAPI, subKategoriAPI, armadaAPI } from '../services/api';
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

    // State untuk search di dalam modal
    const [vendorSearch, setVendorSearch] = useState('');
    const [barangSearch, setBarangSearch] = useState('');
    const [showVendorList, setShowVendorList] = useState(false);
    const [showBarangList, setShowBarangList] = useState(false);
    const vendorDropdownRef = useRef(null);
    const barangDropdownRef = useRef(null);

    // State untuk preview info barang terpilih (part_number & satuan — tidak dikirim ke payload)
    const [selectedBarangPreview, setSelectedBarangPreview] = useState({ part_number: '', satuan: '' });

    // ── State untuk Nested Modal: Tambah Barang Baru ──
    const [showAddBarangModal, setShowAddBarangModal] = useState(false);
    const [subKategoriListModal, setSubKategoriListModal] = useState([]);

    // ── State Sub Kategori untuk filter toolbar (cascading dari filter Kategori) ──
    const [subKategoriList, setSubKategoriList] = useState([]);
    const [newBarangData, setNewBarangData] = useState({
        kode_barang: '',
        part_number: '',
        nama_barang: '',
        satuan: '',
        kode_kategori: '',
        kode_sub_kategori: '',
        kode_armada: '',
        nama_armada: '',
    });

    // ── State untuk Nested Modal: Tambah Vendor Baru ──
    const [showAddVendorModal, setShowAddVendorModal] = useState(false);
    const [newVendorData, setNewVendorData] = useState({
        kode_vendor: '',
        nama_vendor: '',
        alamat: '',
        telepon: '',
        email: '',
        contact_person: '',
    });

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
        filterKeys: ['kode_kategori', 'kode_sub_kategori', 'kode_armada', 'status'],
        searchKeys: ['no_po', 'kode_barang', 'nama_barang', 'nama_vendor', 'keterangan'],
        dateFilterKey: 'tanggal_po',
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

    // Extract kategori dan armada dari allData (untuk filter toolbar)
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

    // Load master data untuk form — sekarang menggunakan API dedicated
    const loadMasterData = async () => {
        setLoadingMaster(true);
        try {
            const [barang, vendor, kategori, armada] = await Promise.all([
                barangAPI.getAll(),
                vendorAPI.getAll(),
                kategoriAPI.getAll(),
                armadaAPI.getAll(),
            ]);

            setBarangList(barang.filter(b => b.is_active));
            setVendorList(vendor.filter(v => v.is_active));
            setKategoriList(kategori);
            setArmadaList(armada);

        } catch (error) {
            console.error('Error loading master data:', error);
            alert('Gagal memuat data master: ' + error.message);
        } finally {
            setLoadingMaster(false);
        }
    };

    // Load sub kategori berdasarkan kategori — target: 'modal' | 'filter'
    const loadSubKategoriByKategori = async (kode_kategori, target = 'modal') => {
        if (!kode_kategori || kode_kategori === 'all') {
            if (target === 'modal') setSubKategoriListModal([]);
            else setSubKategoriList([]);
            return;
        }
        try {
            const result = await subKategoriAPI.getByKategori(kode_kategori);
            if (target === 'modal') setSubKategoriListModal(result);
            else setSubKategoriList(result);
        } catch (error) {
            console.error('Error loading sub kategori:', error);
            if (target === 'modal') setSubKategoriListModal([]);
            else setSubKategoriList([]);
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
            b.kode_barang.toLowerCase().includes(term) ||
            (b.part_number && b.part_number.toLowerCase().includes(term))
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
        setSelectedBarangPreview({ part_number: barang.part_number || '', satuan: barang.satuan || '' });
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
        setSelectedBarangPreview({ part_number: item.part_number || '', satuan: item.satuan || '' });
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
        setSelectedBarangPreview({ part_number: '', satuan: '' });
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

    // ── Handler: Nested Modal Tambah Barang Baru ──
    const handleNewBarangChange = (e) => {
        const { name, value, type } = e.target;
        let finalValue = type === 'number' ? parseFloat(value) || 0 : value;

        if (name === 'nama_barang') {
            finalValue = value.toUpperCase();
        }

        if (name === 'nama_armada') {
            const kodeArmada = e.target.selectedOptions[0]?.dataset.kode || '';
            setNewBarangData(prev => ({
                ...prev,
                nama_armada: finalValue,
                kode_armada: kodeArmada,
            }));
            return;
        }

        setNewBarangData(prev => ({
            ...prev,
            [name]: finalValue,
            ...(name === 'kode_kategori' ? { kode_sub_kategori: '' } : {}),
        }));

        if (name === 'kode_kategori') {
            loadSubKategoriByKategori(finalValue, 'modal');
        }
    };

    const resetNewBarangData = () => {
        setNewBarangData({
            kode_barang: '',
            part_number: '',
            nama_barang: '',
            satuan: '',
            kode_kategori: '',
            kode_sub_kategori: '',
            kode_armada: '',
            nama_armada: '',
        });
        setSubKategoriListModal([]);
    };

    const openAddBarangModal = () => {
        // Pre-fill nama barang dari search term jika ada (kode_barang di-generate otomatis oleh database)
        setNewBarangData(prev => ({
            ...prev,
            nama_barang: barangSearch.toUpperCase(),
        }));
        setShowAddBarangModal(true);
    };

    const handleAddNewBarang = async (e) => {
        e.preventDefault();

        if (newBarangData.kode_kategori === 'KAT001' && !newBarangData.nama_armada) {
            alert('Armada wajib diisi untuk kategori Suku Cadang!');
            return;
        }

        try {
            const savedBarang = await barangAPI.create(newBarangData);

            // Reload barang list dan auto-select barang baru
            const updatedBarang = await barangAPI.getAll();
            setBarangList(updatedBarang.filter(b => b.is_active));

            setFormData(prev => ({
                ...prev,
                kode_barang: savedBarang.kode_barang,
                nama_barang: savedBarang.nama_barang,
                harga_satuan: savedBarang.harga_satuan || 0,
                total_harga: prev.qty_order * (savedBarang.harga_satuan || 0),
            }));

            resetNewBarangData();
            setShowAddBarangModal(false);
            setBarangSearch('');
            setShowBarangList(false);
            alert('Barang berhasil ditambahkan!');
        } catch (error) {
            console.error('Error adding barang:', error);
            alert('Gagal menambahkan barang: ' + (error.message || 'Unknown error'));
        }
    };

    // ── Handler: Nested Modal Tambah Vendor Baru ──
    const handleNewVendorChange = (e) => {
        const { name, value } = e.target;
        setNewVendorData(prev => ({ ...prev, [name]: value }));
    };

    const resetNewVendorData = () => {
        setNewVendorData({
            kode_vendor: '',
            nama_vendor: '',
            alamat: '',
            telepon: '',
            email: '',
            contact_person: '',
        });
    };

    const openAddVendorModal = () => {
        // Pre-fill nama vendor dari search term jika ada
        setNewVendorData(prev => ({
            ...prev,
            nama_vendor: vendorSearch,
        }));
        setShowAddVendorModal(true);
    };

    const handleAddNewVendor = async (e) => {
        e.preventDefault();

        try {
            const savedVendor = await vendorAPI.create({
                ...newVendorData,
                is_active: true,
            });

            // Reload vendor list dan auto-select vendor baru
            const updatedVendor = await vendorAPI.getAll();
            setVendorList(updatedVendor.filter(v => v.is_active));

            setFormData(prev => ({
                ...prev,
                kode_vendor: savedVendor.kode_vendor,
                nama_vendor: savedVendor.nama_vendor,
            }));

            resetNewVendorData();
            setShowAddVendorModal(false);
            setVendorSearch('');
            setShowVendorList(false);
            alert('Vendor berhasil ditambahkan!');
        } catch (error) {
            console.error('Error adding vendor:', error);
            alert('Gagal menambahkan vendor: ' + (error.message || 'Unknown error'));
        }
    };

    // CRUD Operations
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.no_po || !formData.kode_vendor || !formData.kode_barang) {
            alert('No. PO, Vendor, dan Kode Barang wajib diisi!');
            return;
        }

        if (formData.qty_order <= 0) {
            alert('Quantity harus lebih dari 0!');
            return;
        }

        try {
            const sanitizedForm = {
                ...formData,
                tanggal_terima: formData.tanggal_terima || null,
            };

            let payload;
            if (editingItem) {
                const { created_by, ...updateFields } = sanitizedForm;
                payload = {
                    ...updateFields,
                    updated_by: currentUser?.userId,
                };
            } else {
                payload = {
                    ...sanitizedForm,
                    created_by: currentUser?.userId,
                    updated_by: currentUser?.userId,
                };
            }

            console.log('[Pembelian] Payload dikirim:', payload);

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

                {/* ── Toolbar: Two-row layout — Row 1: Search | Row 2: Filters + Actions ── */}
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex flex-col gap-3">

                        {/* ── Row 1: Search ── */}
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Cari PO, barang, vendor..."
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
                                        loadSubKategoriByKategori(e.target.value, 'filter');
                                    }}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                                >
                                    <option value="all">Semua Kategori</option>
                                    {kategoriOptions.map(kat => (
                                        <option key={kat.kode} value={kat.kode}>{kat.nama}</option>
                                    ))}
                                </select>

                                {/* Filter Sub Kategori (cascading dari Kategori) */}
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

                            {/* Right: Action Buttons */}
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
                            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
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
                                        : filter.key === 'kode_sub_kategori'
                                            ? subKategoriList.find(s => s.kode_sub_kategori === filter.value)?.nama_sub_kategori || filter.value
                                            : filter.key === 'kode_armada'
                                                ? armadaOptions.find(a => a.kode === filter.value)?.nama || filter.value
                                                : filter.value;

                                    return (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                                            <Filter className="w-3 h-3" />
                                            {filter.key === 'kode_kategori' && 'Kategori: '}
                                            {filter.key === 'kode_sub_kategori' && 'Sub Kategori: '}
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
                </div>

                {/* Quick Date Filters (if date mode active) */}
                {dateFilterMode !== 'all' && (
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="flex flex-wrap gap-2">
                            <span className="text-sm text-gray-600 font-medium mr-2">Quick Filters:</span>
                            <button onClick={() => setQuickDateFilter('today')} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Hari Ini</button>
                            <button onClick={() => setQuickDateFilter('yesterday')} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Kemarin</button>
                            <button onClick={() => setQuickDateFilter('this-week')} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Minggu Ini</button>
                            <button onClick={() => setQuickDateFilter('this-month')} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Bulan Ini</button>
                            <button onClick={() => setQuickDateFilter('last-month')} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Bulan Lalu</button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th onClick={() => requestSort('no_po')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">
                                        No. PO {sortConfig.key === 'no_po' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th onClick={() => requestSort('tanggal_po')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">
                                        Tanggal PO {sortConfig.key === 'tanggal_po' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Vendor</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Nama Barang,<br />Kode Barang,<br />Part Number</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Kategori,<br />Sub Kategori</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase">jumlah</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase">Harga Satuan</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase">Total Harga</th>
                                    <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase">Status</th>
                                    {(canEdit || canDelete) && (
                                        <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase">Tindakan</th>
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
                                                        <span className="text-sm font-medium">{item.nama_vendor}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-medium">{item.nama_barang}</p>
                                                        <p className="text-xs text-gray-500">{item.kode_barang}</p>
                                                        <p className="text-xs text-blue-500">{item.part_number}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500">{item.nama_kategori}</p>
                                                        <p className="text-xs text-gray-500">{item.nama_sub_kategori}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    {item.qty_order} {item.satuan}
                                                </td>                                                
                                                <td className="px-6 py-4 text-right text-sm text-green-600">
                                                    Rp {(item.harga_satuan || 0).toLocaleString('id-ID')}
                                                </td>
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
                                        ))
                                    )
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
                                    <span className="font-medium">{Math.min(currentPage * rowsPerPage, totalRows)}</span> of{' '}
                                    <span className="font-medium">{totalRows}</span> results
                                </p>
                            </div>

                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">First</button>
                                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Prev</button>
                                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-green-50 text-sm font-medium text-green-600">Page {currentPage} of {totalPages || 1}</span>
                                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Next</button>
                                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Last</button>
                                </nav>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                Modal Form: Tambah / Edit Purchase Order
            ══════════════════════════════════════════════════════ */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        {/* Header Modal */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingItem ? 'Edit Purchase Order' : 'Tambah Purchase Order Baru'}
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* No. PO */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">No. PO *</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal PO *</label>
                                    <input
                                        type="date"
                                        name="tanggal_po"
                                        value={formData.tanggal_po}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* ── Searchable Vendor ── */}
                                <div className="md:col-span-2 relative" ref={vendorDropdownRef}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cari Vendor *</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-gray-800">{v.nama_vendor}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            {v.kode_vendor && (
                                                                <span className="text-xs text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">
                                                                    KODE: {v.kode_vendor}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    Vendor tidak ditemukan —{' '}
                                                    <button type="button" onClick={openAddVendorModal} className="text-green-600 font-medium hover:underline">
                                                        Tambah baru
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Preview Vendor terpilih */}
                                    <div className="mt-2 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border">
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Nama Vendor</span>
                                            <span className="text-sm font-mono font-semibold">{formData.nama_vendor || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Kode Vendor</span>
                                            <span className="text-sm font-mono">{formData.kode_vendor || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Searchable Barang ── */}
                                <div className="md:col-span-2 relative" ref={barangDropdownRef}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cari Barang *</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="Cari kode, nama barang atau part number..."
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-gray-800">{b.nama_barang} ({b.satuan})</span>
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            {b.kode_barang && (
                                                                <span className="text-xs text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">
                                                                    KODE: {b.kode_barang}
                                                                </span>
                                                            )}
                                                            {b.part_number && (
                                                                <span className="text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                                                                    PN: {b.part_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    Barang tidak ditemukan —{' '}
                                                    <button type="button" onClick={openAddBarangModal} className="text-green-600 font-medium hover:underline">
                                                        Tambah baru
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Preview Barang terpilih */}
                                    <div className="mt-2 grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border">
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Nama Barang</span>
                                            <span className="text-sm font-mono font-semibold">{formData.nama_barang || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Kode Barang</span>
                                            <span className="text-sm">{formData.kode_barang || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Part Number</span>
                                            <span className="text-sm font-mono text-blue-600">{selectedBarangPreview.part_number || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase text-gray-400 font-bold">Satuan</span>
                                            <span className="text-sm">{selectedBarangPreview.satuan || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Qty Order */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Qty Order *</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Harga Satuan *</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Harga</label>
                                    <input
                                        type="number"
                                        value={formData.total_harga}
                                        readOnly
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                    />
                                </div>

                                {/* Tanggal Terima */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Terima</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
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
                                        {/* 'Completed' tidak ada di CHECK constraint database */}
                                    </select>
                                </div>

                                {/* Keterangan */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Keterangan</label>
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
                            <div className="px-0 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); resetForm(); }}
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

            {/* ══════════════════════════════════════════════════════
                Nested Modal: Tambah Barang Baru
            ══════════════════════════════════════════════════════ */}
            {showAddBarangModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                        <form onSubmit={handleAddNewBarang}>
                            {/* Header */}
                            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold">Tambah Barang Baru</h2>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddBarangModal(false); resetNewBarangData(); }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-4 space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-sm text-green-800">
                                        <strong>Info:</strong> Barang yang ditambahkan akan otomatis dipilih untuk transaksi pembelian.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Kode Barang</label>
                                        <input
                                            type="text"
                                            name="kode_barang"
                                            value={newBarangData.kode_barang}
                                            readOnly
                                            className="w-full px-3 py-2 border rounded-lg outline-none bg-gray-100 text-gray-500 cursor-not-allowed"
                                            placeholder="Digenerate otomatis"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                                        <input
                                            type="text"
                                            name="part_number"
                                            value={newBarangData.part_number}
                                            onChange={handleNewBarangChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="Contoh: PN-12345"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Barang *</label>
                                    <input
                                        type="text"
                                        name="nama_barang"
                                        value={newBarangData.nama_barang}
                                        onChange={handleNewBarangChange}
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none uppercase"
                                        placeholder="Contoh: OLI MESIN"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                                        <select
                                            name="kode_kategori"
                                            value={newBarangData.kode_kategori}
                                            onChange={handleNewBarangChange}
                                            required
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        >
                                            <option value="">Pilih Kategori</option>
                                            {kategoriList.map((kategori) => (
                                                <option key={kategori.kode_kategori} value={kategori.kode_kategori}>
                                                    {kategori.nama_kategori}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Sub Kategori</label>
                                        <select
                                            name="kode_sub_kategori"
                                            value={newBarangData.kode_sub_kategori}
                                            onChange={handleNewBarangChange}
                                            disabled={!newBarangData.kode_kategori || subKategoriListModal.length === 0}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Pilih Sub Kategori</option>
                                            {subKategoriListModal.map((sub) => (
                                                <option key={sub.kode_sub_kategori} value={sub.kode_sub_kategori}>
                                                    {sub.nama_sub_kategori}
                                                </option>
                                            ))}
                                        </select>
                                        {!newBarangData.kode_kategori && (
                                            <p className="mt-1 text-xs text-gray-400">Pilih Kategori terlebih dahulu</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Armada {newBarangData.kode_kategori === 'KAT001' && <span className="text-red-500">*</span>}
                                        </label>
                                        <select
                                            name="nama_armada"
                                            value={newBarangData.nama_armada}
                                            onChange={handleNewBarangChange}
                                            required={newBarangData.kode_kategori === 'KAT001'}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        >
                                            <option value="">Pilih Armada</option>
                                            {armadaList.map((armada) => (
                                                <option
                                                    key={armada.kode_armada || armada.nama_armada}
                                                    value={armada.nama_armada}
                                                    data-kode={armada.kode_armada || ''}
                                                >
                                                    {armada.nama_armada}
                                                </option>
                                            ))}
                                        </select>
                                        {newBarangData.kode_kategori === 'KAT001' && (
                                            <p className="mt-1 text-xs text-red-500">Armada wajib diisi untuk kategori Suku Cadang</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Satuan *</label>
                                        <select
                                            name="satuan"
                                            value={newBarangData.satuan}
                                            onChange={handleNewBarangChange}
                                            required
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        >
                                            <option value="">Pilih Satuan</option>
                                            <option value="Pcs">PCS</option>
                                            <option value="Unit">UNIT</option>
                                            <option value="Box">BOX</option>
                                            <option value="Liter">LITER</option>
                                            <option value="Kg">KG</option>
                                            <option value="Meter">METER</option>
                                            <option value="Set">SET</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddBarangModal(false); resetNewBarangData(); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg"
                                >
                                    Simpan Barang
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                Nested Modal: Tambah Vendor Baru
            ══════════════════════════════════════════════════════ */}
            {showAddVendorModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                        <form onSubmit={handleAddNewVendor}>
                            {/* Header */}
                            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold">Tambah Vendor Baru</h2>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddVendorModal(false); resetNewVendorData(); }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-4 space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-sm text-green-800">
                                        <strong>Info:</strong> Vendor yang ditambahkan akan otomatis dipilih untuk transaksi pembelian.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Kode Vendor *</label>
                                        <input
                                            type="text"
                                            name="kode_vendor"
                                            value={newVendorData.kode_vendor}
                                            onChange={handleNewVendorChange}
                                            required
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                            placeholder="Contoh: VND001"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Vendor *</label>
                                        <input
                                            type="text"
                                            name="nama_vendor"
                                            value={newVendorData.nama_vendor}
                                            onChange={handleNewVendorChange}
                                            required
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Contoh: PT. Maju Jaya"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                                    <textarea
                                        name="alamat"
                                        value={newVendorData.alamat}
                                        onChange={handleNewVendorChange}
                                        rows="2"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Jl. Contoh No. 123, Kota"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                                        <input
                                            type="text"
                                            name="telepon"
                                            value={newVendorData.telepon}
                                            onChange={handleNewVendorChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="08xxxxxxxxxx"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={newVendorData.email}
                                            onChange={handleNewVendorChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="vendor@email.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        name="contact_person"
                                        value={newVendorData.contact_person}
                                        onChange={handleNewVendorChange}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nama PIC"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddVendorModal(false); resetNewVendorData(); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg"
                                >
                                    Simpan Vendor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
