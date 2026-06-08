// src/pages/PermintaanBarang.jsx

// Permintaan Barang — Purchase Requisition
//
// Status flow:
//   Stok TERSEDIA:
//     Draft → Submitted → Approved ──→ Diserahkan  (Mutasi Keluar)
//                        └→ Rejected → Draft (Revisi)
//
//   Stok KOSONG:
//     Draft → Submitted → Approved → Diproses (via Pembelian/PO)
//                        └→ Rejected → Draft (Revisi)
//                                   └→ Diterima (Mutasi Masuk, barang datang)
//                                            └→ Diserahkan (Mutasi Keluar)
//
// Stok Fisik    = total masuk − total keluar (mutasi_gudang)
// Stok Tersedia = Stok Fisik − Σ qty PR berstatus 'Approved' yang belum diambil

// Hapus semua karakter selain huruf dan angka untuk normalisasi pencarian
const normalizeSearch = (str) => String(str).replace(/[^a-z0-9]/gi, '').toLowerCase();

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useDataTable } from '../hooks/useDataTable';
import {
    permintaanBarangAPI,
    barangAPI,
    authAPI,
    kategoriAPI,
    subKategoriAPI,
    armadaAPI,
} from '../services/api';
import MainLayout from '../components/layout/MainLayout';
import {
    Search, Filter, X, Download, Plus, Edit, Trash2,
    Calendar, Package, RefreshCw, CheckCircle2, XCircle,
    Clock, AlertTriangle, ShoppingCart, Send, ArrowRight,
    FileCheck, FileX, FileText, RotateCcw, Warehouse,
    TrendingDown, PackageCheck,
} from 'lucide-react';

// ─── Status / Prioritas metadata ─────────────────────────────────────────────
const STATUS_META = {
    Draft: { color: 'bg-gray-100   text-gray-700   border-gray-200', icon: FileText },
    Submitted: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    Approved: { color: 'bg-green-100  text-green-800  border-green-200', icon: CheckCircle2 },
    Rejected: { color: 'bg-red-100    text-red-800    border-red-200', icon: XCircle },
    Diproses: { color: 'bg-blue-100   text-blue-800   border-blue-200', icon: ShoppingCart },
    Diterima: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: PackageCheck },
    Diserahkan: { color: 'bg-teal-100   text-teal-800   border-teal-200', icon: Warehouse },
};
const PRIORITAS_META = {
    Normal: { cls: 'bg-gray-100   text-gray-700' },
    High: { cls: 'bg-orange-100 text-orange-800' },
    Critical: { cls: 'bg-red-100    text-red-800' },
};

// ─── Stat card data ───────────────────────────────────────────────────────────
const STAT_DEFS = [
    { key: 'total', label: 'Total PR', icon: FileText, statuses: null, border: 'border-gray-200', iconCls: 'bg-gray-50   text-gray-600' },
    { key: 'submitted', label: 'Menunggu Review', icon: Clock, statuses: ['Submitted'], border: 'border-yellow-200', iconCls: 'bg-yellow-50 text-yellow-600' },
    { key: 'approved', label: 'Disetujui', icon: CheckCircle2, statuses: ['Approved'], border: 'border-green-200', iconCls: 'bg-green-50  text-green-600' },
    { key: 'diproses', label: 'Diproses', icon: ShoppingCart, statuses: ['Diproses', 'Diterima'], border: 'border-blue-200', iconCls: 'bg-blue-50   text-blue-600' },
    { key: 'selesai', label: 'Selesai', icon: Warehouse, statuses: ['Diserahkan'], border: 'border-teal-200', iconCls: 'bg-teal-50   text-teal-600' },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const fmtQty = (n) => Number(n ?? 0).toLocaleString('id-ID');

const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || STATUS_META.Draft;
    const Icon = m.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${m.color}`}>
            <Icon className="w-3 h-3" />
            {status}
        </span>
    );
};

const PriorityBadge = ({ prioritas }) => {
    const m = PRIORITAS_META[prioritas] || PRIORITAS_META.Normal;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${m.cls}`}>
            {prioritas === 'Critical' && <AlertTriangle className="w-3 h-3" />}
            {prioritas}
        </span>
    );
};

// Indikator stok: apakah qty_request bisa dipenuhi dari stok tersedia?
const FulfillmentBadge = ({ stokTersedia, qtyRequest }) => {
    const cukup = Number(stokTersedia ?? 0) >= Number(qtyRequest ?? 0);
    return cukup
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">
            <Warehouse className="w-3 h-3" /> Stok cukup
        </span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <ShoppingCart className="w-3 h-3" /> Perlu beli
        </span>;
};

// ─── Komponen utama ───────────────────────────────────────────────────────────
export default function PermintaanBarang() {
    const navigate = useNavigate();
    const currentUser = authAPI.getCurrentUser();
    const userName = currentUser?.fullName || currentUser?.full_name || currentUser?.email || '';

    // ── Role permissions ──────────────────────────────────────────────────────
    // Pembuat: staff lapangan / mekanik
    const canCreate = ['Admin', 'Manager', 'Staff', 'Staff_gudang'].includes(currentUser?.role);
    // Approver: manager atau admin
    const canApprove = ['Admin', 'Manager'].includes(currentUser?.role);
    // Serahkan barang dari gudang (mutasi keluar)
    const canSerahkan = ['Admin', 'Staff_gudang'].includes(currentUser?.role);
    // Proses pembelian jika stok kosong
    const canProses = ['Admin', 'Staff_pembelian'].includes(currentUser?.role);
    // Terima barang dari PO (mutasi masuk) — sebelum diserahkan ke peminta
    const canTerima = ['Admin', 'Staff_gudang'].includes(currentUser?.role);
    // Hapus: hanya Draft/Rejected, oleh Manager/Admin
    const canDelete = ['Admin', 'Manager'].includes(currentUser?.role);

    // ── Master data ───────────────────────────────────────────────────────────
    const [barangList, setBarangList] = useState([]);
    const [kategoriList, setKategoriList] = useState([]);
    const [armadaList, setArmadaList] = useState([]);
    const [subKategoriList, setSubKategoriList] = useState([]);  // toolbar
    const [subKatModalList, setSubKatModalList] = useState([]);  // nested modal

    // ── Modal states ──────────────────────────────────────────────────────────
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState('');   // 'approve'|'reject'
    const [actionTarget, setActionTarget] = useState(null);
    const [actionCatatan, setActionCatatan] = useState('');
    const [showAddBarangModal, setShowAddBarangModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ── Form ──────────────────────────────────────────────────────────────────
    const EMPTY_FORM = {
        no_pr: '', tanggal_pr: new Date().toISOString().split('T')[0],
        kode_barang: '', qty_request: 1, prioritas: 'Normal',
        keterangan: '', status: 'Draft',
    };
    const [formData, setFormData] = useState(EMPTY_FORM);

    // Info barang yang sedang dipilih di modal (untuk preview stok)
    const [selectedBarang, setSelectedBarang] = useState(null);

    // Search dropdown barang
    const [barangSearch, setBarangSearch] = useState('');
    const [showBarangList, setShowBarangList] = useState(false);
    const barangDropRef = useRef(null);

    // Nested modal: tambah barang baru
    const [newBarangData, setNewBarangData] = useState({
        kode_barang: '', part_number: '', nama_barang: '', alias: '',
        satuan: '', kode_kategori: '', kode_sub_kategori: '', kode_armada: '', nama_armada: '',
    });

    // Tutup barang dropdown saat klik luar
    useEffect(() => {
        const handle = (e) => {
            if (barangDropRef.current && !barangDropRef.current.contains(e.target)) {
                setShowBarangList(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // ── Load master data ──────────────────────────────────────────────────────
    useEffect(() => { loadMasterData(); }, []);

    const loadMasterData = async () => {
        try {
            const [barang, kategori, armada] = await Promise.all([
                barangAPI.getAll(),   // v_barang_complete → sudah ada stok_akhir, stok_tersedia
                kategoriAPI.getAll(),
                armadaAPI.getAll(),
            ]);
            setBarangList(Array.isArray(barang) ? barang.filter(b => b.is_active !== false) : []);
            setKategoriList(Array.isArray(kategori) ? kategori : []);
            setArmadaList(Array.isArray(armada) ? armada : []);
        } catch (err) {
            console.error('loadMasterData error:', err);
        }
    };

    const loadSubKategori = async (kodeKategori, target = 'filter') => {
        const setter = target === 'filter' ? setSubKategoriList : setSubKatModalList;
        if (!kodeKategori) { setter([]); return; }
        try {
            const res = await subKategoriAPI.getByKategori(kodeKategori);
            setter(Array.isArray(res) ? res : []);
        } catch { setter([]); }
    };

    // ── useDataTable ──────────────────────────────────────────────────────────
    const fetchData = useCallback(() => permintaanBarangAPI.getAll(), []);
    // v_permintaan_barang sudah membawa stok_fisik & stok_tersedia dari v_stok_summary

    const {
        data: paginatedData, allData, filteredData,
        loading, error,
        searchQuery, setSearchQuery,
        filters, setFilter, clearAllFilters, hasActiveFilters, activeFilters,
        sortConfig, requestSort,
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage,
        customRowsInput, setCustomRowsInput, handleCustomRowsApply,
        totalPages, totalRows,
        setQuickDateFilter, clearDateFilter,
        refresh,
    } = useDataTable({
        fetchData,
        filterKeys: ['status', 'prioritas', 'kode_kategori', 'kode_sub_kategori', 'nama_armada'],
        searchKeys: ['no_pr', 'nama_barang', 'part_number', 'keterangan', 'requested_by'],
        dateFilterKey: 'tanggal_pr',
        defaultSort: { key: 'tanggal_pr', direction: 'desc' },
        defaultRowsPerPage: 10,
    });

    // ── Stat cards (dari allData, bukan filteredData) ─────────────────────────
    const stats = useMemo(() => ({
        total: allData.length,
        submitted: allData.filter(r => r.status === 'Submitted').length,
        approved: allData.filter(r => r.status === 'Approved').length,
        diproses: allData.filter(r => ['Diproses', 'Diterima'].includes(r.status)).length,
        selesai: allData.filter(r => r.status === 'Diserahkan').length,
    }), [allData]);

    // ── Live search barang di dropdown modal ──────────────────────────────────
    const filteredBarangSearch = useMemo(() => {
        if (!barangSearch) return [];
        const q = normalizeSearch(barangSearch);
        if (!q) return [];
        return barangList
            .filter(b =>
                normalizeSearch(b.nama_barang).includes(q) ||
                normalizeSearch(b.part_number).includes(q) ||
                normalizeSearch(b.kode_barang).includes(q)
            )
            .slice(0, 30);
    }, [barangSearch, barangList]);

    // ─── Helpers form ─────────────────────────────────────────────────────────
    const resetForm = () => {
        setFormData(EMPTY_FORM);
        setEditingItem(null);
        setBarangSearch('');
        setSelectedBarang(null);
    };

    const selectBarang = (barang) => {
        setFormData(prev => ({ ...prev, kode_barang: barang.kode_barang }));
        setSelectedBarang(barang);      // simpan full object → untuk tampilkan stok
        setBarangSearch('');
        setShowBarangList(false);
    };

    const clearBarangSelection = () => {
        setFormData(prev => ({ ...prev, kode_barang: '' }));
        setSelectedBarang(null);
        setBarangSearch('');
    };

    const openEditModal = (item) => {
        setFormData({
            no_pr: item.no_pr,
            tanggal_pr: item.tanggal_pr?.split('T')[0] || '',
            kode_barang: item.kode_barang,
            qty_request: item.qty_request,
            prioritas: item.prioritas || 'Normal',
            keterangan: item.keterangan || '',
            status: item.status,
        });
        // Cari barang di list untuk mendapatkan stok real-time
        const barang = barangList.find(b => b.kode_barang === item.kode_barang) || {
            nama_barang: item.nama_barang,
            part_number: item.part_number,
            satuan: item.satuan,
            stok_akhir: item.stok_fisik,
            stok_tersedia: item.stok_tersedia,
            kode_barang: item.kode_barang,
        };
        setSelectedBarang(barang);
        setBarangSearch('');
        setEditingItem(item);
        setShowModal(true);
        loadMasterData();
    };

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };

    // ── Prediksi fulfillment di modal (live, berubah seiring qty_request) ─────
    // Menggunakan stok_tersedia dari barangList (v_barang_complete → v_stok_summary)
    // Ini sudah mengurangi PR yang sedang Approved, sehingga prediksi akurat.
    const stokFisik = Number(selectedBarang?.stok_akhir ?? selectedBarang?.stok_fisik ?? 0);
    const stokTersedia = Number(selectedBarang?.stok_tersedia ?? 0);
    const stokCukup = stokTersedia >= Number(formData.qty_request || 0);

    // ── CRUD ──────────────────────────────────────────────────────────────────
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.kode_barang) { alert('Barang wajib dipilih!'); return; }
        if (Number(formData.qty_request) <= 0) { alert('Jumlah request harus > 0!'); return; }

        try {
            const payload = {
                tanggal_pr: formData.tanggal_pr,
                kode_barang: formData.kode_barang,
                qty_request: formData.qty_request,
                prioritas: formData.prioritas,
                keterangan: formData.keterangan,
                status: 'Draft',
                requested_by: userName,
            };
            if (editingItem) {
                await permintaanBarangAPI.update(editingItem.id, payload);
                alert('Permintaan berhasil diperbarui!');
            } else {
                await permintaanBarangAPI.create(payload);
                alert('Permintaan berhasil dibuat!');
            }
            setShowModal(false);
            resetForm();
            await refresh();
        } catch (err) {
            alert('Error: ' + (err?.response?.data?.message || err.message || 'Unknown error'));
        }
    };

    const handleDelete = async (item) => {
        if (!confirm(`Hapus permintaan ${item.no_pr}?`)) return;
        try {
            await permintaanBarangAPI.delete(item.id);
            alert('Permintaan dihapus!');
            await refresh();
        } catch (err) { alert('Error: ' + err.message); }
    };

    // Draft → Submitted
    const handleSubmitPR = async (item) => {
        if (!confirm(`Submit ${item.no_pr} untuk direview?`)) return;
        try {
            await permintaanBarangAPI.submit(item.id, userName);
            alert(`${item.no_pr} berhasil disubmit!`);
            await refresh();
        } catch (err) { alert('Error: ' + err.message); }
    };

    // Rejected → Draft (revisi)
    const handleRevisi = async (item) => {
        if (!confirm(`Reset ${item.no_pr} ke Draft untuk direvisi?`)) return;
        try {
            await permintaanBarangAPI.resetToDraft(item.id);
            alert(`${item.no_pr} dikembalikan ke Draft.`);
            await refresh();
        } catch (err) { alert('Error: ' + err.message); }
    };

    // Buka modal approve / reject
    const openActionModal = (item, type) => {
        setActionTarget(item);
        setActionType(type);
        setActionCatatan('');
        setShowActionModal(true);
    };

    // Konfirmasi approve/reject
    const handleConfirmAction = async () => {
        if (!actionTarget) return;
        try {
            if (actionType === 'approve') {
                await permintaanBarangAPI.approve(actionTarget.id, userName, actionCatatan);
                alert(`${actionTarget.no_pr} disetujui!`);
            } else {
                if (!actionCatatan.trim()) { alert('Alasan penolakan wajib diisi!'); return; }
                await permintaanBarangAPI.reject(actionTarget.id, userName, actionCatatan);
                alert(`${actionTarget.no_pr} ditolak.`);
            }
            setShowActionModal(false);
            await refresh();
        } catch (err) { alert('Error: ' + err.message); }
    };

    // Approved → Diserahkan (stok tersedia, ambil dari gudang)
    // Navigasi ke Mutasi Gudang dengan params agar modal Tambah Mutasi (Keluar) ter-prefill otomatis
    const handleSerahkan = async (item) => {
        const cukup = Number(item.stok_tersedia ?? 0) >= Number(item.qty_request ?? 0);
        const msg = cukup
            ? `Serahkan ${item.no_pr} dari stok gudang?\n\nStok Tersedia: ${fmtQty(item.stok_tersedia)} ${item.satuan || ''}\nQty Request : ${fmtQty(item.qty_request)} ${item.satuan || ''}\n\nSetelah konfirmasi, Anda akan diarahkan ke Mutasi Gudang untuk membuat mutasi Keluar.`
            : `⚠️ Stok Tersedia (${fmtQty(item.stok_tersedia)}) KURANG dari Qty Request (${fmtQty(item.qty_request)}).\n\nAnda yakin tetap ingin menyerahkan secara parsial?`;
        if (!confirm(msg)) return;
        try {
            await permintaanBarangAPI.serahkan(item.id, userName);
            alert(`${item.no_pr} berhasil ditandai Diserahkan.\nBuat Mutasi Keluar di halaman Mutasi Gudang.`);
            await refresh();
            // Bawa kode_barang, qty, dan pr_no sebagai query params
            const params = new URLSearchParams({
                action: 'tambah_keluar',
                kode_barang: item.kode_barang,
                qty: item.qty_request,
                pr_no: item.no_pr,
            });
            navigate(`/mutasi_gudang?${params.toString()}`);
        } catch (err) { alert('Error: ' + err.message); }
    };

    // Approved → Diproses (stok kosong, perlu beli)
    // Navigasi ke Pembelian dengan params agar modal Tambah PO ter-prefill otomatis
    const handleProsesPembelian = async (item) => {
        if (!confirm(`Proses ${item.no_pr} ke Pembelian?\n\nStok tidak tersedia → modal PO baru akan terbuka otomatis.\nData Vendor & Harga perlu dilengkapi di halaman Pembelian.`)) return;
        try {
            await permintaanBarangAPI.proses(item.id, ''); // no_po dikosongkan dulu, diisi setelah PO dibuat
            alert(`PR ${item.no_pr} → Diproses.\n\nLengkapi dan simpan PO di halaman Pembelian.`);
            await refresh();
            // Bawa kode_barang dan qty sebagai query params
            const params = new URLSearchParams({
                action: 'tambah_po',
                kode_barang: item.kode_barang,
                qty: item.qty_request,
                pr_no: item.no_pr,
            });
            navigate(`/pembelian?${params.toString()}`);
        } catch (err) { alert('Error: ' + err.message); }
    };

    // Diproses → Diterima: barang dari PO sudah datang, dibuat Mutasi Masuk di gudang.
    // Navigasi ke Mutasi Gudang dengan params agar modal Tambah Mutasi (Masuk) ter-prefill otomatis.
    const handleTerima = async (item) => {
        if (!confirm(
            `Tandai ${item.no_pr} sebagai "Diterima"?\n\n` +
            `Barang dari PO ${item.no_po || '-'} sudah tiba di gudang.\n` +
            `Setelah konfirmasi, Anda akan diarahkan ke Mutasi Gudang untuk membuat mutasi Masuk.\n\n` +
            `Langkah berikutnya: Diserahkan (Mutasi Keluar) ke peminta.`
        )) return;
        try {
            await permintaanBarangAPI.terima(item.id, userName);
            // Fetch ulang data PR untuk memastikan no_po yang dipakai adalah nilai terkini di DB
            const fresh = await permintaanBarangAPI.getById(item.id);
            const noPO = fresh?.no_po || item.no_po || '';
            alert(`${item.no_pr} → Diterima.\nBuat Mutasi Masuk di halaman Mutasi Gudang.`);
            await refresh();
            const params = new URLSearchParams({
                action: 'tambah_masuk',
                kode_barang: item.kode_barang,
                qty: item.qty_request,
                ref_no: noPO || item.no_pr, // No PO sebagai referensi; fallback ke No PR jika benar-benar kosong
            });
            navigate(`/mutasi_gudang?${params.toString()}`);
        } catch (err) { alert('Error: ' + err.message); }
    };
    const handleNewBarangChange = (e) => {
        const { name, value } = e.target;
        if (name === 'nama_barang') { setNewBarangData(p => ({ ...p, nama_barang: value.toUpperCase() })); return; }
        if (name === 'nama_armada') {
            const kode = e.target.selectedOptions[0]?.dataset.kode || '';
            setNewBarangData(p => ({ ...p, nama_armada: value, kode_armada: kode }));
            return;
        }
        setNewBarangData(p => ({
            ...p, [name]: value,
            ...(name === 'kode_kategori' ? { kode_sub_kategori: '' } : {}),
        }));
        if (name === 'kode_kategori') loadSubKategori(value, 'modal');
    };

    const handleAddNewBarang = async (e) => {
        e.preventDefault();
        try {
            const saved = await barangAPI.create(newBarangData);
            const updated = await barangAPI.getAll();
            setBarangList(updated.filter(b => b.is_active !== false));
            selectBarang(saved);
            setShowAddBarangModal(false);
            setNewBarangData({ kode_barang: '', part_number: '', nama_barang: '', alias: '', satuan: '', kode_kategori: '', kode_sub_kategori: '', kode_armada: '', nama_armada: '' });
            setSubKatModalList([]);
            alert('Barang berhasil ditambahkan!');
        } catch (err) { alert('Gagal: ' + err.message); }
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = () => {
        const rows = filteredData.map(r => ({
            'No. PR': r.no_pr,
            'Tanggal': r.tanggal_pr?.split('T')[0] || '',
            'Kode Barang': r.kode_barang,
            'Nama Barang': r.nama_barang,
            'Part Number': r.part_number || '',
            'Satuan': r.satuan || '',
            'Qty Request': r.qty_request,
            'Stok Fisik': r.stok_fisik ?? 0,
            'Stok Tersedia': r.stok_tersedia ?? 0,
            'Prioritas': r.prioritas,
            'Status': r.status,
            'Kategori': r.nama_kategori || '',
            'Sub Kategori': r.nama_sub_kategori || '',
            'Armada': r.nama_armada || '',
            'Diminta Oleh': r.requested_by || '',
            'Direview Oleh': r.approved_by || '',
            'Tgl Review': r.tanggal_approve ? fmtDate(r.tanggal_approve) : '',
            'Catatan Review': r.catatan_approve || '',
            'No. PO': r.no_po || '',
            'Keterangan': r.keterangan || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Permintaan Barang');
        XLSX.writeFile(wb, `permintaan_barang_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try { await refresh(); } finally { setIsRefreshing(false); }
    };

    const SortIcon = ({ col }) => {
        if (sortConfig.key !== col) return <span className="text-gray-300 ml-1">↕</span>;
        return <span className="text-green-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <MainLayout>
            <div className="space-y-6">

                {/* ── Stat cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {STAT_DEFS.map(({ key, label, icon: Icon, border, iconCls }) => {
                        const [bgCls, textCls] = iconCls.split(' ');
                        return (
                            <div key={key} className={`${bgCls} p-6 rounded-lg border ${border}`}>
                                <p className={`text-sm ${textCls} flex items-center`}>
                                    <Icon className="w-4 h-4 mr-1" />
                                    {label}
                                </p>
                                <p className={`text-2xl font-bold ${textCls}`}>{stats[key]}</p>
                            </div>
                        );
                    })}
                </div>

                {/* ── Toolbar ────────────────────────────────────────────── */}
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex flex-col gap-3">

                        {/* Row 1: Search */}
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Cari no. PR, nama barang, part number, pemohon..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        {/* Row 2: Filters + Actions */}
                        <div className="flex flex-wrap items-center gap-2">

                            {/* Status */}
                            <select value={filters.status || 'all'} onChange={e => setFilter('status', e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="all">Semua Status</option>
                                {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            {/* Prioritas */}
                            <select value={filters.prioritas || 'all'} onChange={e => setFilter('prioritas', e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="all">Semua Prioritas</option>
                                {Object.keys(PRIORITAS_META).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>

                            {/* Kategori (cascading) */}
                            <select value={filters.kode_kategori || 'all'}
                                onChange={e => {
                                    setFilter('kode_kategori', e.target.value);
                                    setFilter('kode_sub_kategori', 'all');
                                    loadSubKategori(e.target.value === 'all' ? '' : e.target.value, 'filter');
                                }}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="all">Semua Kategori</option>
                                {kategoriList.map(k => <option key={k.kode_kategori} value={k.kode_kategori}>{k.nama_kategori}</option>)}
                            </select>

                            {subKategoriList.length > 0 && (
                                <select value={filters.kode_sub_kategori || 'all'} onChange={e => setFilter('kode_sub_kategori', e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="all">Semua Sub Kat.</option>
                                    {subKategoriList.map(sk => <option key={sk.kode_sub_kategori} value={sk.kode_sub_kategori}>{sk.nama_sub_kategori}</option>)}
                                </select>
                            )}

                            {/* Armada */}
                            <select value={filters.nama_armada || 'all'} onChange={e => setFilter('nama_armada', e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="all">Semua Armada</option>
                                {armadaList.map(a => <option key={a.kode_armada} value={a.nama_armada}>{a.nama_armada}</option>)}
                            </select>

                            {/* Quick date */}
                            <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg overflow-hidden">
                                {[['Hari ini', 'today'], ['Minggu ini', 'this-week'], ['Bulan ini', 'this-month']].map(([label, type]) => (
                                    <button key={type} onClick={() => setQuickDateFilter(type)}
                                        className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-green-700 border-r border-gray-200 last:border-r-0 transition-colors">
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {hasActiveFilters && (
                                <button onClick={() => { clearAllFilters(); setSubKategoriList([]); clearDateFilter(); }}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                                    <X className="w-3.5 h-3.5" /> Reset
                                </button>
                            )}

                            <div className="flex-1" />

                            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1 shrink-0" />

                            <div className="flex gap-2 w-full lg:w-auto shrink-0">
                                <button
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    title="Segarkan Data"
                                    className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed">
                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    <span>Refresh</span>
                                </button>
                                <button onClick={handleExport}
                                    className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium">
                                    <Download className="w-4 h-4" /> Export
                                </button>
                                {canCreate && (
                                    <button onClick={() => { resetForm(); setShowModal(true); loadMasterData(); }}
                                        className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium">
                                        <Plus className="w-4 h-4" /> Buat Permintaan
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active filter badges */}
                        {hasActiveFilters && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {activeFilters.map((f, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                                        <Filter className="w-3 h-3" /> {f.key}: {f.value}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Table ──────────────────────────────────────────────── */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        No. PR
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Tanggal
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Barang
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Jumlah
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Stok
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Prioritas
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Pemohon
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                                <span className="text-sm text-gray-500">Memuat data...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : !error && paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                                            Tidak ada data permintaan
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-8 text-center text-red-500">{error}</td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item) => {
                                        const stokFisikRow = Number(item.stok_fisik ?? 0);
                                        const stokTersediaRow = Number(item.stok_tersedia ?? 0);
                                        const cukup = stokTersediaRow >= Number(item.qty_request ?? 0);

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">

                                                {/* No. PR */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="font-mono text-xs font-semibold text-gray-800">{item.no_pr}</span>
                                                    {item.no_po && (
                                                        <div className="text-xs text-blue-600 mt-0.5 font-mono">→ {item.no_po}</div>
                                                    )}
                                                </td>

                                                {/* Tanggal */}
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                        {fmtDate(item.tanggal_pr)}
                                                    </div>
                                                </td>

                                                {/* Barang */}
                                                <td className="px-6 py-4 max-w-[200px]">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-800 leading-snug truncate" title={item.nama_barang}>{item.nama_barang}</p>
                                                        <p className="text-xs text-gray-400">{item.kode_barang}{item.part_number && ` · ${item.part_number}`}</p>
                                                        {item.nama_armada && <p className="text-xs text-gray-400">{item.nama_armada}</p>}
                                                    </div>
                                                </td>

                                                {/* Qty */}
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700">
                                                    <span className="font-semibold">{fmtQty(item.qty_request)}</span>
                                                    {item.satuan && <span className="text-xs text-gray-400 ml-1">{item.satuan}</span>}
                                                </td>

                                                {/* Stok Fisik & Tersedia */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-xs space-y-0.5">
                                                        <div className="text-gray-500">
                                                            <span className="text-gray-400">Fisik: </span>
                                                            <span className="font-medium text-gray-700">{fmtQty(stokFisikRow)}</span>
                                                        </div>
                                                        <div className={stokTersediaRow < 0 ? 'text-red-600' : 'text-gray-500'}>
                                                            <span className="text-gray-400">Tersedia: </span>
                                                            <span className={`font-medium ${stokTersediaRow < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                                                {fmtQty(stokTersediaRow)}
                                                            </span>
                                                        </div>
                                                        {['Submitted', 'Approved'].includes(item.status) && (
                                                            <FulfillmentBadge stokTersedia={stokTersediaRow} qtyRequest={item.qty_request} />
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Prioritas */}
                                                <td className="px-6 py-4"><PriorityBadge prioritas={item.prioritas} /></td>

                                                {/* Status */}
                                                <td className="px-6 py-4">
                                                    <StatusBadge status={item.status} />
                                                    {item.catatan_approve && (
                                                        <div className="text-xs text-gray-400 mt-1 max-w-[140px] truncate" title={item.catatan_approve}>
                                                            {item.catatan_approve}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Pemohon */}
                                                <td className="px-6 py-4 text-xs text-gray-600">
                                                    <div>{item.requested_by || '-'}</div>
                                                    {item.approved_by && (
                                                        <div className="text-gray-400">✓ {item.approved_by}</div>
                                                    )}
                                                </td>

                                                {/* Aksi */}
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                    <div className="flex items-center justify-end gap-1 flex-wrap">

                                                        {/* Draft: Edit + Submit + Delete */}
                                                        {item.status === 'Draft' && (
                                                            <>
                                                                {canCreate && (
                                                                    <button onClick={() => openEditModal(item)} title="Edit"
                                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                                                        <Edit className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                {/* Submit: hanya pemohon PR itu sendiri (atau Admin) */}
                                                                {(item.requested_by === userName || currentUser?.role === 'Admin') && (
                                                                    <button onClick={() => handleSubmitPR(item)}
                                                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                                                                        <Send className="w-3 h-3" /> Submit
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button onClick={() => handleDelete(item)} title="Hapus"
                                                                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Submitted: Approve / Reject */}
                                                        {item.status === 'Submitted' && canApprove && (
                                                            <>
                                                                <button onClick={() => openActionModal(item, 'approve')}
                                                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                                                    <CheckCircle2 className="w-3 h-3" /> Setuju
                                                                </button>
                                                                <button onClick={() => openActionModal(item, 'reject')}
                                                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                                                    <XCircle className="w-3 h-3" /> Tolak
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Approved: Serahkan + Proses Pembelian */}
                                                        {item.status === 'Approved' && (
                                                            <>
                                                                {cukup && canSerahkan && (
                                                                    <button onClick={() => handleSerahkan(item)}
                                                                        title={cukup ? 'Serahkan dari stok gudang' : 'Stok kurang — serahkan parsial?'}
                                                                        className={`flex items-center gap-1 px-2 py-1 text-xs text-white rounded-lg transition-colors ${cukup ? 'bg-teal-600 hover:bg-teal-700' : 'bg-teal-400 hover:bg-teal-500'}`}>
                                                                        <Warehouse className="w-3 h-3" /> Serahkan
                                                                    </button>
                                                                )}
                                                                {!cukup && canProses && (
                                                                    <button onClick={() => handleProsesPembelian(item)}
                                                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                                                        <ShoppingCart className="w-3 h-3" /> Proses Beli
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Diproses: Terima Barang (barang dari PO sudah datang → Mutasi Masuk) */}
                                                        {item.status === 'Diproses' && canTerima && (
                                                            <button onClick={() => handleTerima(item)}
                                                                title={`Barang dari PO ${item.no_po || '-'} sudah tiba di gudang`}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                                                <PackageCheck className="w-3 h-3" /> Terima Barang
                                                            </button>
                                                        )}

                                                        {/* Diterima: Serahkan ke peminta (Mutasi Keluar) */}
                                                        {item.status === 'Diterima' && canSerahkan && (
                                                            <button onClick={() => handleSerahkan(item)}
                                                                title="Serahkan barang ke peminta (Mutasi Keluar)"
                                                                className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                                                                <Warehouse className="w-3 h-3" /> Serahkan
                                                            </button>
                                                        )}

                                                        {/* Rejected: Revisi (kembali ke Draft) + Delete */}
                                                        {item.status === 'Rejected' && (
                                                            <>
                                                                {/* Revisi: hanya pemohon PR itu sendiri (atau Admin) */}
                                                                {(item.requested_by === userName || currentUser?.role === 'Admin') && (
                                                                    <button onClick={() => handleRevisi(item)}
                                                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                                                                        <RotateCcw className="w-3 h-3" /> Revisi
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button onClick={() => handleDelete(item)} title="Hapus"
                                                                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

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
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={rowsPerPage} hidden={[10, 25, 50].includes(rowsPerPage)}>
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
                                            onKeyDown={e => e.key === 'Enter' && handleCustomRowsApply()}
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
                                    Menampilkan{' '}
                                    <span className="font-medium">
                                        {(currentPage - 1) * rowsPerPage + 1}
                                    </span>–
                                    <span className="font-medium">
                                        {Math.min(currentPage * rowsPerPage, totalRows)}
                                    </span>{' '}
                                    dari{' '}
                                    <span className="font-medium">{totalRows}</span> permintaan
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
                                        Page {currentPage} of {totalPages}
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

            {/* ==============================================================
                MODAL: Buat / Edit Permintaan
                ============================================================== */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        {/* Header Modal */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingItem ? `Edit: ${editingItem.no_pr}` : 'Buat Permintaan Barang'}
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* No. PR */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">No. PR *</label>
                                    <input
                                        type="text"
                                        name="no_pr"
                                        value={formData.no_pr || '(dibuat otomatis)'}
                                        readOnly
                                        className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                                    />
                                </div>

                                {/* Tanggal PR */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal PR *</label>
                                    <input
                                        type="date"
                                        name="tanggal_pr"
                                        value={formData.tanggal_pr}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Pilih Barang */}
                                <div className="md:col-span-2 relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Barang <span className="text-red-500">*</span>
                                    </label>
                                    <div ref={barangDropRef} className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                            <input
                                                type="text"
                                                placeholder="Cari nama / part number / kode..."
                                                value={barangSearch}
                                                onChange={e => {
                                                    setBarangSearch(e.target.value);
                                                    setShowBarangList(true);
                                                    // Jika user mengetik ulang, hapus pilihan sebelumnya
                                                    if (selectedBarang && e.target.value !== selectedBarang.nama_barang) {
                                                        clearBarangSelection();
                                                    }
                                                }}
                                                onFocus={() => barangSearch && setShowBarangList(true)}
                                                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            />
                                            {(barangSearch || selectedBarang) && (
                                                <button type="button" onClick={clearBarangSelection}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown hasil search */}
                                        {showBarangList && filteredBarangSearch.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                                {filteredBarangSearch.map(b => (
                                                    <div key={b.kode_barang} onClick={() => selectBarang(b)}
                                                        className="px-3 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0">
                                                        <div className="text-sm font-semibold text-gray-800">{b.nama_barang}</div>
                                                        <div className="text-xs text-gray-400">
                                                            {b.kode_barang}
                                                            {b.part_number && ` · ${b.part_number}`}
                                                            {b.satuan && ` (${b.satuan})`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {showBarangList && barangSearch && filteredBarangSearch.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                Barang tidak ditemukan —{' '}
                                                <button type="button" onClick={() => { setShowAddBarangModal(true); setShowBarangList(false); }}
                                                    className="text-green-600 font-medium hover:underline">
                                                    Tambah baru
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Info Stok Real-time (selalu tampil) ── */}
                                    <div className="mt-3 p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-2">
                                        {selectedBarang ? (
                                            <>
                                                {/* Nama barang terpilih */}
                                                <div className="flex items-start gap-2">
                                                    <Package className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800">{selectedBarang.nama_barang}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {selectedBarang.kode_barang}
                                                            {selectedBarang.part_number && ` · ${selectedBarang.part_number}`}
                                                            {selectedBarang.satuan && ` · ${selectedBarang.satuan}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Stok real-time */}
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="bg-white rounded p-2 border border-gray-200">
                                                        <p className="text-gray-400 mb-0.5">Stok Fisik (On-Hand)</p>
                                                        <p className="font-bold text-lg text-gray-800">{fmtQty(stokFisik)}</p>
                                                        <p className="text-gray-400">{selectedBarang.satuan || ''}</p>
                                                    </div>
                                                    <div className={`rounded p-2 border ${stokTersedia <= 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                                        <p className="text-gray-400 mb-0.5">Stok Tersedia</p>
                                                        <p className={`font-bold text-lg ${stokTersedia <= 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmtQty(stokTersedia)}</p>
                                                        <p className="text-gray-400 text-xs">setelah reserved PR</p>
                                                    </div>
                                                </div>

                                                {/* Prediksi berdasarkan qty_request yang diisi */}
                                                {Number(formData.qty_request) > 0 && (
                                                    <div className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium ${stokCukup ? 'bg-green-50 border-green-200 text-green-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                                                        {stokCukup
                                                            ? <><Warehouse className="w-3.5 h-3.5" /> Stok cukup → akan <strong>Diserahkan</strong> dari gudang</>
                                                            : <><ShoppingCart className="w-3.5 h-3.5" /> Stok tidak cukup → akan <strong>Diproses Pembelian</strong></>
                                                        }
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* Placeholder saat belum ada barang dipilih */
                                            <div className="flex flex-col items-center justify-center py-3 gap-1.5 text-center">
                                                <Package className="w-7 h-7 text-gray-300" />
                                                <p className="text-xs font-medium text-gray-400">Info Stok Real-time</p>
                                                <p className="text-xs text-gray-300">Cari dan pilih barang di atas untuk melihat stok tersedia</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Qty Request */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Jumlah Permintaan <span className="text-red-500">*</span>
                                        {selectedBarang?.satuan && <span className="text-gray-400 font-normal ml-1">({selectedBarang.satuan})</span>}
                                    </label>
                                    <input type="number" name="qty_request" min="1" step="any" required
                                        value={formData.qty_request} onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                                </div>

                                {/* Prioritas */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(PRIORITAS_META).map(([val, m]) => (
                                            <label key={val} className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all
                                ${formData.prioritas === val
                                                    ? `${m.cls} border-current`
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                                <input type="radio" name="prioritas" value={val}
                                                    checked={formData.prioritas === val} onChange={handleInputChange}
                                                    className="sr-only" />
                                                {val === 'Critical' && <AlertTriangle className="w-3.5 h-3.5" />}
                                                {val}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Keterangan */}
                                <div className="md:col-span-2 relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Alasan</label>
                                    <textarea
                                        name="keterangan"
                                        rows="3"
                                        value={formData.keterangan}
                                        onChange={handleInputChange}
                                        placeholder="Contoh: Filter oli bocor, perlu penggantian segera — unit Excavator NL339"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-0 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                                    <FileX className="w-4 h-4" />Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                                    <FileCheck className="w-4 h-4" />{editingItem ? 'Update' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==============================================================
                MODAL: Approve / Reject
            ============================================================== */}
            {showActionModal && actionTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className={`flex items-center justify-between p-5 border-b rounded-t-xl ${actionType === 'approve' ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div className="flex items-center gap-3">
                                {actionType === 'approve'
                                    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    : <XCircle className="w-5 h-5 text-red-600" />}
                                <div>
                                    <h3 className="font-bold text-gray-900">
                                        {actionType === 'approve' ? 'Setujui' : 'Tolak'} Permintaan
                                    </h3>
                                    <p className="text-sm text-gray-600">{actionTarget.no_pr}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowActionModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Ringkasan PR */}
                            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                                {[
                                    ['Barang', actionTarget.nama_barang],
                                    ['Part Number', actionTarget.part_number || '-'],
                                    ['Qty Request', `${fmtQty(actionTarget.qty_request)} ${actionTarget.satuan || ''}`],
                                    ['Stok Fisik', `${fmtQty(actionTarget.stok_fisik ?? 0)} ${actionTarget.satuan || ''}`],
                                    ['Stok Tersedia', `${fmtQty(actionTarget.stok_tersedia ?? 0)} ${actionTarget.satuan || ''}`],
                                ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between gap-4">
                                        <span className="text-gray-400">{label}</span>
                                        <span className="font-medium text-gray-800 text-right">{val}</span>
                                    </div>
                                ))}
                                <div className="pt-1 border-t border-gray-200">
                                    <FulfillmentBadge
                                        stokTersedia={actionTarget.stok_tersedia}
                                        qtyRequest={actionTarget.qty_request}
                                    />
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Prioritas</span>
                                    <PriorityBadge prioritas={actionTarget.prioritas} />
                                </div>
                                {actionTarget.keterangan && (
                                    <div className="flex justify-between gap-4">
                                        <span className="text-gray-400">Keterangan</span>
                                        <span className="text-gray-700 text-right text-xs">{actionTarget.keterangan}</span>
                                    </div>
                                )}
                            </div>

                            {/* Catatan */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Catatan{actionType === 'reject' && <span className="text-red-500"> * (wajib)</span>}
                                </label>
                                <textarea rows={3} value={actionCatatan} onChange={e => setActionCatatan(e.target.value)}
                                    placeholder={actionType === 'approve' ? 'Catatan persetujuan (opsional)...' : 'Alasan penolakan (wajib)...'}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowActionModal(false)}
                                    className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                                    Batal
                                </button>
                                <button onClick={handleConfirmAction}
                                    className={`px-5 py-2 text-sm text-white rounded-lg font-medium shadow-sm transition-colors ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                                    {actionType === 'approve' ? '✓ Setujui' : '✕ Tolak'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                Nested Modal: Tambah Barang Baru
                ══════════════════════════════════════════════════════ */}
            {
                showAddBarangModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                            <form onSubmit={handleAddNewBarang}>
                                {/* Modal Header */}
                                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                                    <h2 className="text-xl font-bold">Tambah Barang Baru</h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddBarangModal(false);
                                            setNewBarangData({
                                                kode_barang: '',
                                                part_number: '',
                                                nama_barang: '',
                                                alias: '',
                                                satuan: '',
                                                kode_kategori: '',
                                                kode_sub_kategori: '',
                                                kode_armada: '',
                                                nama_armada: '',
                                            });
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="px-6 py-4 space-y-4">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <p className="text-sm text-green-800">
                                            <strong>Info:</strong> Barang yang ditambahkan akan otomatis dipilih untuk transaksi permintaan barang.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Kode Barang
                                            </label>
                                            <input
                                                type="text"
                                                name="kode_barang"
                                                value={newBarangData.kode_barang}
                                                readOnly
                                                className="w-full px-3 py-2 border rounded-lg outline-none bg-gray-100 text-gray-500 cursor-not-allowed"
                                                placeholder="(dibuat otomatis)"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Part Number
                                            </label>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Nama Barang [-Spesifikasi (jika ada)]*
                                            </label>
                                            <input
                                                type="text"
                                                name="nama_barang"
                                                value={newBarangData.nama_barang}
                                                onChange={handleNewBarangChange}
                                                required
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none uppercase"
                                                placeholder="Contoh: OLI MESIN - SAE40"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Alias
                                            </label>
                                            <input
                                                type="text"
                                                name="alias"
                                                value={newBarangData.alias}
                                                onChange={handleNewBarangChange}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Kategori *
                                            </label>
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Sub Kategori
                                            </label>
                                            <select
                                                name="kode_sub_kategori"
                                                value={newBarangData.kode_sub_kategori}
                                                onChange={handleNewBarangChange}
                                                disabled={!newBarangData.kode_kategori || subKatModalList.length === 0}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                            >
                                                <option value="">Pilih Sub Kategori</option>
                                                {subKatModalList.map((sub) => (
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
                                                <p className="mt-1 text-xs text-red-500">
                                                    Armada wajib diisi untuk kategori Suku Cadang
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Satuan *
                                            </label>
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

                                {/* Modal Footer */}
                                <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddBarangModal(false);
                                            setNewBarangData({
                                                kode_barang: '',
                                                part_number: '',
                                                nama_barang: '',
                                                alias: '',
                                                satuan: '',
                                                kode_kategori: '',
                                                kode_sub_kategori: '',
                                                kode_armada: '',
                                                nama_armada: '',
                                            });
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg">
                                        <FileX className="w-4 h-4" />Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                                        <FileCheck className="w-4 h-4" />Simpan Barang
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </MainLayout>
    );
}