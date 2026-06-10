// src/pages/MutasiGudang.jsx

// Hapus semua karakter selain huruf dan angka untuk normalisasi pencarian
const normalizeSearch = (str) => String(str).replace(/[^a-z0-9]/gi, '').toLowerCase();

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import MainLayout from '../components/layout/MainLayout';
import ImportModal from '../components/common/ImportModal';
import { useDataTable } from '../hooks/useDataTable';
import { gudangAPI, mutasiAPI, barangAPI, authAPI, 
  kategoriAPI, subKategoriAPI, armadaAPI, rakAPI } from '../services/api';
import { Search, Filter, X, Download, Upload, Plus, Edit, Trash2, TrendingUp, 
  TrendingDown, Calendar, Package, FileText, FileCheck, FileX, RefreshCw,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MutasiGudang() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams();

  // Current user & permissions
  const currentUser = authAPI.getCurrentUser();
  const canCreate = ['Admin', 'Manager', 'Staff_gudang'].includes(currentUser?.role);
  const canEdit = ['Admin', 'Manager', 'Staff_gudang'].includes(currentUser?.role);
  const canDelete = ['Admin', 'Manager', 'Staff_gudang'].includes(currentUser?.role);

  // Modal & Form states
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Import progress & result
  const [importProgress, setImportProgress] = useState({ loading: false, total: 0, processed: 0 });
  const [importResult, setImportResult] = useState(null);

  // importResult: null | { successCount, apiErrorCount, parseErrors: string[], apiErrors: string[] }
  const [editingItem, setEditingItem] = useState(null);
  const [barangList, setBarangList] = useState([]);
  const [formData, setFormData] = useState({
    no_transaksi: '',
    kode_gudang: '',
    nama_gudang: '',
    tanggal: new Date().toISOString().split('T')[0],
    jenis_transaksi: 'Masuk',
    kode_barang: '',
    part_number: '',
    nama_barang: '',
    alias: '',
    qty: 0,
    satuan: '',
    kode_rak: '',
    nama_rak: '',
    keterangan: '',
    referensi: '',
  });

  // State untuk Pencarian Barang di Modal
  const [searchTermBarang, setSearchTermBarang] = useState('');
  const [showBarangDropdown, setShowBarangDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // State untuk Modal Tambah Barang Baru
  const [showAddBarangModal, setShowAddBarangModal] = useState(false);
  const [subKategoriListModal, setSubKategoriListModal] = useState([]);

  // State Dropdown — diisi dari API masing-masing
  const [gudangList, setGudangList] = useState([]);
  const [rakList, setRakList] = useState([]);         // semua rak (raw)
  const [rakListFiltered, setRakListFiltered] = useState([]); // rak yang cascading dari gudang
  const [kategoriList, setKategoriList] = useState([]);
  const [armadaList, setArmadaList] = useState([]);
  const [newBarangData, setNewBarangData] = useState({
    kode_barang: '',
    part_number: '',
    nama_barang: '',
    alias: '',
    satuan: '',
    kode_kategori: '',
    kode_sub_kategori: '',
    kode_armada: '',   // FIX: foreign key ke tabel armada
    nama_armada: '',
  });

  // State sub kategori untuk filter toolbar (cascading dari filter Kategori)
  const [subKategoriList, setSubKategoriList] = useState([]);

  // Load barang list untuk dropdown
  useEffect(() => {
    loadBarangList();
    loadDropdownData();
  }, []);

  // ── Auto-buka modal Tambah Mutasi Keluar dari PermintaanBarang ──────────────
  // FASE 1: Saat params masuk → simpan intent ke state, bersihkan URL.
  //         loadBarangList() sudah dipanggil di mount, tapi jika belum selesai, Fase 2 menunggu.
  const [prIntent, setPrIntent] = useState(null); // { action, kodeBarang, qty, refNo }

  useEffect(() => {
    const action = searchParams.get('action');
    const kodeBarang = searchParams.get('kode_barang');
    const qty = searchParams.get('qty');
    // tambah_masuk -> ref_no berisi No PO; tambah_keluar -> pr_no berisi No PR
    const refNo = searchParams.get('ref_no') || searchParams.get('pr_no') || '';

    if (!['tambah_keluar', 'tambah_masuk'].includes(action) || !kodeBarang) return;

    // Simpan intent dan bersihkan URL — barangList mungkin belum siap, Fase 2 yang tunggu
    setPrIntent({ action, kodeBarang, qty: parseFloat(qty) || 0, refNo });
    setSearchParams({}, { replace: true });
  }, [searchParams]);

  // FASE 2: Setelah barangList terisi dan intent tersimpan → prefill + buka modal.
  useEffect(() => {
    if (!prIntent || barangList.length === 0) return;

    const { action, kodeBarang, qty, refNo } = prIntent;
    const barang = barangList.find(b => b.kode_barang === kodeBarang);
    const jenis = action === 'tambah_masuk' ? 'Masuk' : 'Keluar';
    const ket = action === 'tambah_masuk'
      ? (refNo ? `Penerimaan barang dari PO: ${refNo}` : '')
      : (refNo ? `Penyerahan dari PR: ${refNo}` : '');

    setFormData(prev => ({
      ...prev,
      jenis_transaksi: jenis,
      kode_barang: kodeBarang,
      part_number: barang?.part_number || '',
      nama_barang: barang?.nama_barang || '',
      alias: barang?.alias || '',
      satuan: barang?.satuan || '',
      qty: qty,
      referensi: refNo,
      keterangan: ket,
    }));
    setEditingItem(null);
    setShowModal(true);
    setPrIntent(null); // clear intent setelah dipakai
  }, [prIntent, barangList]);

  const loadBarangList = async () => {
    try {
      const result = await barangAPI.getAll();
      setBarangList(result);
    } catch (error) {
      console.error('Error loading barang:', error);
    }
  };

  const loadDropdownData = async () => {
    try {
      const [gudangResult, kategoriResult, armadaResult, rakResult] = await Promise.all([
        gudangAPI.getAll(),
        kategoriAPI.getAll(),
        armadaAPI.getAll(),
        rakAPI.getAll(),
      ]);
      setGudangList(gudangResult.map(g => ({ kode: g.kode_gudang, nama: g.nama_gudang })));
      setKategoriList(kategoriResult);
      setArmadaList(armadaResult);
      setRakList(rakResult);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const loadSubKategoriByKategori = async (kode_kategori, target) => {
    // target: 'modal' | 'filter'
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

  // Filter barang berdasarkan input search di modal
  const filteredBarangSearch = useMemo(() => {
    if (!searchTermBarang) return [];
    const term = normalizeSearch(searchTermBarang);
    if (!term) return [];
    return barangList.filter(b =>
      normalizeSearch(b.kode_barang).includes(term) ||
      normalizeSearch(b.nama_barang).includes(term) ||
      (b.alias && normalizeSearch(b.alias).includes(term)) ||
      (b.part_number && normalizeSearch(b.part_number).includes(term))
    ).slice(0, 10); // Batasi 10 hasil untuk kenyamanan visual
  }, [searchTermBarang, barangList]);

  // Handle klik di luar untuk menutup dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowBarangDropdown(false);
      }
    };
    if (showBarangDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBarangDropdown]);

  // Fetch mutasi data
  const fetchMutasiData = useCallback(async () => {
    try {
      const result = await mutasiAPI.getAll();
      return result;
    } catch (error) {
      console.error('Error fetching mutasi:', error);
      throw error;
    }
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Custom hook untuk table management
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
  } = useDataTable({
    fetchData: fetchMutasiData,
    filterKeys: ['kode_gudang', 'jenis_transaksi', 'kode_kategori', 'kode_sub_kategori', 'nama_armada'],
    searchKeys: ['kode_barang', 'part_number', 'nama_barang', 'alias', 'keterangan', 'referensi'],
    dateFilterKey: 'tanggal',
    defaultSort: { key: 'tanggal', direction: 'desc' },
    defaultRowsPerPage: 10
  });

  // ── Group By kode_barang ──────────────────────────────────────────────────
  // Sort: tanggal desc → jenis_transaksi (Masuk=0, Keluar=1)
  // Group: by kode_barang (group order = first tanggal of each barang)
  const groupedData = useMemo(() => {
    const jenisOrder = { Masuk: 0, Keluar: 1 };
    const sorted = [...filteredData].sort((b, a) => {
      const dateCompare = new Date(a.tanggal) - new Date(b.tanggal);
      if (dateCompare !== 0) return dateCompare;
      return (jenisOrder[a.jenis_transaksi] ?? 2) - (jenisOrder[b.jenis_transaksi] ?? 2);
    });

    const groupMap = new Map();
    for (const row of sorted) {
      if (!groupMap.has(row.kode_barang)) {
        groupMap.set(row.kode_barang, {
          kode_barang: row.kode_barang,
          nama_barang: row.nama_barang,
          alias: row.alias || '',
          rows: [],
        });
      }
      groupMap.get(row.kode_barang).rows.push(row);
    }
    return Array.from(groupMap.values());
  }, [filteredData]);

  // Pagination berbasis jumlah group (bukan rows) agar group tidak terpotong
  const groupedTotalPages = Math.max(1, Math.ceil(groupedData.length / rowsPerPage));
  const groupedTotalGroups = groupedData.length;
  const groupedTotalRows = filteredData.length;
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return groupedData.slice(start, start + rowsPerPage);
  }, [groupedData, currentPage, rowsPerPage]);

  // Stok aktual dihitung dari allData (semua transaksi, tidak terpengaruh filter)
  // sehingga nilai stok selalu akurat meski tabel sedang difilter
  const stokByBarang = useMemo(() => {
    const map = new Map();
    for (const row of allData) {
      if (!map.has(row.kode_barang)) {
        map.set(row.kode_barang, { masuk: 0, keluar: 0, satuan: row.satuan || '' });
      }
      const entry = map.get(row.kode_barang);
      if (row.jenis_transaksi === 'Masuk') entry.masuk += (row.qty || 0);
      else if (row.jenis_transaksi === 'Keluar') entry.keluar += (row.qty || 0);
    }
    return map;
  }, [allData]);

  // Saldo di luar filter = net Masuk−Keluar dari transaksi yang TIDAK masuk filteredData.
  // Ditampilkan sebagai synthetic "Masuk" row pertama dalam setiap group saat filter aktif,
  // sehingga: saldo_luar + masuk_filter − keluar_filter = stok_aktual
  const stokLuarFilterByBarang = useMemo(() => {
    if (!hasActiveFilters) return new Map();
    const filteredIds = new Set(filteredData.map(r => r.id));
    const map = new Map();
    for (const row of allData) {
      if (filteredIds.has(row.id)) continue;             // skip baris yang tampil di tabel
      if (!map.has(row.kode_barang)) {
        map.set(row.kode_barang, { qty: 0, satuan: row.satuan || '' });
      }
      const entry = map.get(row.kode_barang);
      if (row.jenis_transaksi === 'Masuk') entry.qty += (row.qty || 0);
      else if (row.jenis_transaksi === 'Keluar') entry.qty -= (row.qty || 0);
    }
    return map;
  }, [allData, filteredData, hasActiveFilters]);
  // ─────────────────────────────────────────────────────────────────────────

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;

    if (name === 'kode_gudang') {
      const selectedGudang = gudangList.find(g => g.kode === value);
      // Cascading: filter rak berdasarkan gudang yang dipilih
      const filtered = value ? rakList.filter(r => r.kode_gudang === value) : [];
      setRakListFiltered(filtered);
      setFormData(prev => ({
        ...prev,
        kode_gudang: value,
        nama_gudang: selectedGudang?.nama || '',
        kode_rak: '',   // reset rak saat gudang berubah
        nama_rak: '',
      }));
    } else if (name === 'kode_rak') {
      const selectedRak = rakList.find(r => r.kode_rak === value);
      setFormData(prev => ({
        ...prev,
        kode_rak: value,
        nama_rak: selectedRak?.nama_rak || '',
      }));
    } else if (name === 'kode_barang') {
      const selectedBarang = barangList.find(b => b.kode_barang === value);
      if (selectedBarang) {
        setFormData(prev => ({
          ...prev,
          kode_barang: value,
          nama_barang: selectedBarang.nama_barang,
          satuan: selectedBarang.satuan,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value,
        }));
      }
    } else if (name === 'jenis_transaksi') {
      // Clear referensi jika jenis transaksi berubah ke Keluar
      setFormData(prev => ({
        ...prev,
        jenis_transaksi: value,
        referensi: value === 'Keluar' ? '' : prev.referensi,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value,
      }));
    }
  };

  const handleSelectBarang = (barang) => {
    setFormData(prev => ({
      ...prev,
      kode_barang: barang.kode_barang,
      part_number: barang.part_number || '',
      nama_barang: barang.nama_barang,
      alias: barang.alias || '',
      satuan: barang.satuan,
    }));
    setSearchTermBarang('');
    setShowBarangDropdown(false);
  };

  // Handler untuk Modal Tambah Barang Baru
  const handleNewBarangChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = type === 'number' ? parseFloat(value) || 0 : value;

    // Auto uppercase untuk nama_barang
    if (name === 'nama_barang') {
      finalValue = value.toUpperCase();
    }

    // FIX: Saat armada dipilih, tangkap kode_armada sekaligus dari dataset
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

    // Load sub kategori dari API saat kategori berubah
    if (name === 'kode_kategori') {
      loadSubKategoriByKategori(finalValue, 'modal');
    }
  };

  const handleAddNewBarang = async (e) => {
    e.preventDefault();

    // Validasi armada untuk kategori KAT001
    if (newBarangData.kode_kategori === 'KAT001' && !newBarangData.nama_armada) {
      alert('Armada wajib diisi untuk kategori Suku Cadang!');
      return;
    }

    try {
      // Simpan barang baru ke database
      const savedBarang = await barangAPI.create(newBarangData);

      // Reload barang list
      await loadBarangList();

      // Auto-select barang yang baru ditambahkan
      setFormData(prev => ({
        ...prev,
        kode_barang: savedBarang.kode_barang,
        nama_barang: savedBarang.nama_barang,
        satuan: savedBarang.satuan,
      }));

      // Reset form barang baru dan tutup modal
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
      setShowAddBarangModal(false);
      setSearchTermBarang('');
      setShowBarangDropdown(false);

      alert('Barang berhasil ditambahkan!');
    } catch (error) {
      console.error('Error adding barang:', error);
      alert('Gagal menambahkan barang: ' + (error.message || 'Unknown error'));
    }
  };

  const openAddBarangModal = () => {
    // Pre-fill nama barang dari search term jika ada (kode_barang di-generate otomatis oleh database)
    setNewBarangData(prev => ({
      ...prev,
      nama_barang: searchTermBarang.toUpperCase(),
    }));
    setShowAddBarangModal(true);
  };

  const resetForm = () => {
    setFormData({
      no_transaksi: '',
      kode_gudang: '',
      nama_gudang: '',
      tanggal: new Date().toISOString().split('T')[0],
      jenis_transaksi: 'Masuk',
      kode_barang: '',
      part_number: '',
      nama_barang: '',
      alias: '',
      qty: 1,
      satuan: '',
      kode_rak: '',
      nama_rak: '',
      keterangan: '',
      referensi: '',
    });
    setSearchTermBarang('');
    setRakListFiltered([]);
    setEditingItem(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    // Pre-filter rak sesuai gudang dari data yang diedit
    const filtered = item.kode_gudang
      ? rakList.filter(r => r.kode_gudang === item.kode_gudang)
      : [];
    setRakListFiltered(filtered);

    setFormData({
      no_transaksi: item.no_transaksi || '',
      kode_gudang: item.kode_gudang || '',
      nama_gudang: item.nama_gudang || '',
      tanggal: item.tanggal ? item.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
      jenis_transaksi: item.jenis_transaksi || 'Masuk',
      kode_barang: item.kode_barang || '',
      part_number: item.part_number || '',
      nama_barang: item.nama_barang || '',
      alias: item.alias || '',
      qty: item.qty || 0,
      satuan: item.satuan || '',
      kode_rak: item.kode_rak || '',
      nama_rak: item.nama_rak || '',
      keterangan: item.keterangan || '',
      referensi: item.referensi || '',
    });
    setSearchTermBarang('');
    setEditingItem(item);
    setShowModal(true);
  };

  // CRUD Operations
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.kode_gudang || !formData.tanggal || !formData.kode_barang || !formData.qty) {
      alert('Mohon lengkapi semua field yang wajib diisi!');
      return;
    }

    if (formData.qty <= 0) {
      alert('Qty harus lebih dari 0!');
      return;
    }

    try {
      const payload = {
        ...formData,
        created_by: editingItem ? undefined : currentUser.userId,
        updated_by: editingItem ? currentUser.userId : undefined,
      };

      if (editingItem) {
        await mutasiAPI.update(editingItem.id, payload);
        alert('Mutasi berhasil diupdate!');
      } else {
        await mutasiAPI.create(payload);
        alert('Mutasi berhasil ditambahkan!');
      }

      setShowModal(false);
      resetForm();
      refresh();
    } catch (error) {
      console.error('Error submitting mutasi:', error);
      alert('Gagal menyimpan mutasi: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data ini?')) {
      return;
    }

    try {
      await mutasiAPI.delete(id);
      alert('Mutasi berhasil dihapus!');
      await refresh();
    } catch (error) {
      console.error('Error deleting mutasi:', error);
      alert('Gagal menghapus mutasi: ' + (error.message || 'Unknown error'));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    // Pre-filter rak sesuai gudang dari data yang diedit
    const filtered = item.kode_gudang
      ? rakList.filter(r => r.kode_gudang === item.kode_gudang)
      : [];
    setRakListFiltered(filtered);

    setFormData({
      no_transaksi: item.no_transaksi || '',
      kode_gudang: item.kode_gudang,
      nama_gudang: item.nama_gudang,
      tanggal: item.tanggal.split('T')[0],
      jenis_transaksi: item.jenis_transaksi,
      kode_barang: item.kode_barang,
      nama_barang: item.nama_barang,
      alias: item.alias,
      qty: item.qty,
      satuan: item.satuan,
      kode_rak: item.kode_rak || '',
      nama_rak: item.nama_rak || '',
      keterangan: item.keterangan || '',
      referensi: item.referensi || '',
    });
    setShowModal(true);
  };

  // Refresh — muat ulang data tabel
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────
  // Kolom wajib yang harus ada di baris header (baris 1) file Excel.
  const IMPORT_REQUIRED_COLS = ['Kode Gudang', 'Tanggal', 'Jenis Transaksi', 'Kode Barang', 'Jumlah'];
  const IMPORT_VALID_JENIS = ['Masuk', 'Keluar'];
  const IMPORT_MAX_ROWS = 10000;
  const IMPORT_BATCH_SIZE = 50;   // baris per batch Promise.allSettled

  /**
   * Konversi nilai sel tanggal dari Excel ke string ISO yyyy-mm-dd.
   * Mendukung tiga kemungkinan format keluaran XLSX.js (raw: false):
   *   1. "dd/mm/yyyy"  — string teks yang diketik user sesuai panduan template
   *   2. "yyyy-mm-dd"  — ISO, ketika cell diformat sebagai ISO di Excel
   *   3. "M/D/YY" atau "D/M/YYYY" — format lokal lain
   *   4. Angka serial Excel (5 digit) — jika cell punya format date di Excel
   */
  const parseImportDate = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const str = String(raw).trim();

    // Format dd/mm/yyyy (panduan template)
    const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const [, dd, mm, yyyy] = dmyMatch;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    // Format yyyy-mm-dd (ISO)
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return str;

    // Format mm/dd/yyyy (US locale — XLSX default formatting)
    const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
      // Sudah ditangani dmyMatch di atas, tapi jika tidak cocok (bulan > 12) coba MDY
      const [, mm, dd, yyyy] = mdyMatch;
      if (parseInt(mm, 10) <= 12) {
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
    }

    // Excel serial number (angka bulat 5 digit, mis. 45397)
    if (/^\d{5}$/.test(str)) {
      try {
        const parsed = XLSX.SSF.parse_date_code(parseInt(str, 10));
        if (parsed && parsed.y) {
          return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
      } catch (_) { /* lewati */ }
    }

    return null; // tidak bisa diparsing
  };

  // Callback dari ImportModal — dipanggil setelah user pilih file & tekan "Proses Impor"
  const handleImportFile = async (file) => {
    // Tutup modal segera agar user bisa melihat progress bar
    setShowImportModal(false);
    setImportResult(null);

    try {
      // ── 1. Baca file ──────────────────────────────────────────────────────
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('File Excel tidak memiliki sheet yang dapat dibaca.');
      const ws = wb.Sheets[sheetName];

      // raw: false → semua sel dikembalikan sebagai string terformat (angka, tanggal, dsb.)
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

      if (rows.length < 2) {
        setImportResult({ successCount: 0, apiErrorCount: 0, parseErrors: ['File tidak memiliki data (hanya header atau kosong).'], apiErrors: [] });
        return;
      }

      // ── 2. Validasi header ────────────────────────────────────────────────
      const headers = rows[0].map((h) => String(h).trim());
      const missingCols = IMPORT_REQUIRED_COLS.filter((c) => !headers.includes(c));
      if (missingCols.length > 0) {
        setImportResult({
          successCount: 0,
          apiErrorCount: 0,
          parseErrors: [`Kolom wajib tidak ditemukan di file: ${missingCols.join(', ')}`],
          apiErrors: [],
        });
        return;
      }

      // Buat index posisi kolom berdasarkan nama header
      const colIdx = {};
      headers.forEach((h, i) => { colIdx[h] = i; });

      // ── 3. Parse & validasi baris data ────────────────────────────────────
      const dataRows = rows.slice(1, 1 + IMPORT_MAX_ROWS);
      const parseErrors = [];
      const payloads = [];

      dataRows.forEach((row, i) => {
        const excelRowNum = i + 2; // baris ke-2 di Excel = indeks 0 di dataRows

        const kode_gudang = String(row[colIdx['Kode Gudang']] ?? '').trim();
        const tanggalRaw = row[colIdx['Tanggal']];
        const jenis_transaksi = String(row[colIdx['Jenis Transaksi']] ?? '').trim();
        const kode_barang = String(row[colIdx['Kode Barang']] ?? '').trim();
        const jumlahRaw = row[colIdx['Jumlah']];
        const referensi = String(row[colIdx['Referensi (PO No)']] ?? '').trim() || null;
        const lokasi = String(row[colIdx['Lokasi']] ?? '').trim() || null;

        // Skip baris benar-benar kosong (semua sel kosong)
        if (!kode_gudang && !kode_barang && !tanggalRaw) return;

        // Validasi kolom wajib
        if (!kode_gudang) {
          parseErrors.push(`Baris ${excelRowNum}: Kode Gudang kosong.`);
          return;
        }
        if (!kode_barang) {
          parseErrors.push(`Baris ${excelRowNum}: Kode Barang kosong.`);
          return;
        }
        if (!IMPORT_VALID_JENIS.includes(jenis_transaksi)) {
          parseErrors.push(`Baris ${excelRowNum}: Jenis Transaksi tidak valid ("${jenis_transaksi}") — harus "Masuk" atau "Keluar".`);
          return;
        }

        const tanggal = parseImportDate(tanggalRaw);
        if (!tanggal) {
          parseErrors.push(`Baris ${excelRowNum}: Format tanggal tidak valid ("${tanggalRaw}") — gunakan dd/mm/yyyy.`);
          return;
        }

        const qty = parseFloat(String(jumlahRaw).replace(',', '.'));
        if (isNaN(qty) || qty <= 0) {
          parseErrors.push(`Baris ${excelRowNum}: Jumlah tidak valid ("${jumlahRaw}") — harus angka positif.`);
          return;
        }

        payloads.push({
          kode_gudang,
          tanggal,
          jenis_transaksi,
          kode_barang,
          qty,
          referensi,
          kode_rak: lokasi,
          created_by: currentUser?.userId ?? null,
        });
      });

      // ── 4. Konfirmasi sebelum kirim ───────────────────────────────────────
      if (payloads.length === 0) {
        setImportResult({ successCount: 0, apiErrorCount: 0, parseErrors, apiErrors: [] });
        return;
      }

      const confirmLines = [
        `File: ${file.name}`,
        `Baris valid siap diimpor : ${payloads.length}`,
        parseErrors.length > 0 ? `Baris dilewati (error parse) : ${parseErrors.length}` : null,
        '',
        'Lanjutkan proses impor?',
      ].filter((l) => l !== null).join('\n');

      if (!window.confirm(confirmLines)) return;

      // ── 5. Kirim ke API dalam batch ───────────────────────────────────────
      setImportProgress({ loading: true, total: payloads.length, processed: 0 });

      let successCount = 0;
      const apiErrors = [];

      for (let i = 0; i < payloads.length; i += IMPORT_BATCH_SIZE) {
        const batch = payloads.slice(i, i + IMPORT_BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map((p) => mutasiAPI.create(p))
        );

        results.forEach((res, j) => {
          const excelRowNum = i + j + 2;
          if (res.status === 'fulfilled') {
            successCount++;
          } else {
            const msg = res.reason?.response?.data?.message
              || res.reason?.response?.data?.error
              || res.reason?.message
              || 'Unknown error';
            apiErrors.push(`Baris ${excelRowNum} (${batch[j].kode_barang}): ${msg}`);
          }
        });

        setImportProgress({ loading: true, total: payloads.length, processed: Math.min(i + IMPORT_BATCH_SIZE, payloads.length) });
      }

      // ── 6. Selesai — refresh tabel & tampilkan hasil ──────────────────────
      setImportProgress({ loading: false, total: payloads.length, processed: payloads.length });
      await refresh();

      setImportResult({ successCount, apiErrorCount: apiErrors.length, parseErrors, apiErrors });

    } catch (err) {
      console.error('[MutasiGudang] Import error:', err);
      setImportProgress({ loading: false, total: 0, processed: 0 });
      setImportResult({
        successCount: 0,
        apiErrorCount: 0,
        parseErrors: [`Terjadi kesalahan saat memproses file: ${err.message || 'Unknown error'}`],
        apiErrors: [],
      });
    }
  };

  // Export to Excel — sorted & grouped sama seperti data table
  const handleExport = () => {
    const COLS = [
      'Gudang', 'Tanggal', 'No Transaksi', 'Transaksi',
      'Kode Barang', 'Nama Barang', 'Alias',
      'Qty', 'Satuan',
      'Kategori', 'Armada',
      'Referensi', 'Lokasi Rak', 'Keterangan',
      // kolom summary (hanya terisi di group header)
      'Total Masuk', 'Total Keluar', 'Stok',
    ];

    // Build rows: untuk setiap group → 1 header row + N data rows + 1 empty separator
    const rows = [COLS]; // baris pertama = header kolom

    for (const group of groupedData) {
      const satuan = group.rows[0]?.satuan || '';
      const totalMasuk = group.rows.filter(r => r.jenis_transaksi === 'Masuk').reduce((s, r) => s + (r.qty || 0), 0);
      const totalKeluar = group.rows.filter(r => r.jenis_transaksi === 'Keluar').reduce((s, r) => s + (r.qty || 0), 0);

      // Stok aktual dari allData (tidak terpengaruh filter)
      const stokInfo = stokByBarang.get(group.kode_barang) || { masuk: 0, keluar: 0 };
      const stokAktual = stokInfo.masuk - stokInfo.keluar;

      // ── Group header row ──
      rows.push([
        '', '', '', '',                        // Gudang, Tanggal, No Transaksi, Transaksi
        group.kode_barang,                     // Kode Barang
        group.nama_barang,                     // Nama Barang
        group.alias || '-',                    // Alias
        '', satuan,                            // Qty, Satuan
        '', '',                                // Kategori, Armada
        '', '', '',                            // Referensi, Lokasi Rak, Keterangan
        `${totalMasuk} ${satuan}`,             // Total Masuk
        `${totalKeluar} ${satuan}`,            // Total Keluar
        `${stokAktual} ${satuan}`,             // Stok Aktual
      ]);

      // ── Saldo sebelum filter (hanya ketika filter aktif) ──
      if (hasActiveFilters) {
        const saldo = stokLuarFilterByBarang.get(group.kode_barang) ?? { qty: 0 };
        rows.push([
          '-',                                   // Gudang
          '-',                                   // Tanggal
          '-',                                   // No Transaksi
          'Masuk',                               // Transaksi
          group.kode_barang,                     // Kode Barang
          group.nama_barang,                     // Nama Barang
          '-',                                   // Alias
          saldo.qty,                             // Qty
          satuan,                                // Satuan
          '-', '-',                              // Kategori, Armada
          '-',                                   // Referensi
          '-',                                   // Lokasi Rak
          'Saldo sebelum periode filter',        // Keterangan
          '', '', '',                            // kolom summary kosong
        ]);
      }

      // ── Data rows ──
      for (const item of group.rows) {
        rows.push([
          item.nama_gudang,
          formatDate(item.tanggal),
          item.no_transaksi || '-',
          item.jenis_transaksi,
          item.kode_barang,
          item.nama_barang,
          item.alias || '-',
          item.qty,
          item.satuan,
          item.nama_kategori || '-',
          item.nama_armada || '-',
          item.referensi || '-',
          item.nama_rak || '-',
          item.keterangan || '-',
          '', '', '',                          // kolom summary kosong di data rows
        ]);
      }

      // ── Baris pemisah antar group ──
      rows.push(new Array(COLS.length).fill(''));
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Lebar kolom otomatis (estimasi)
    ws['!cols'] = [
      { wch: 14 }, // Gudang
      { wch: 12 }, // Tanggal
      { wch: 18 }, // Kode Barang
      { wch: 28 }, // Nama Barang
      { wch: 20 }, // Alias
      { wch: 10 }, // Transaksi
      { wch: 8 }, // Qty
      { wch: 8 }, // Satuan
      { wch: 14 }, // Kategori
      { wch: 14 }, // Armada
      { wch: 16 }, // Referensi
      { wch: 12 }, // Lokasi Rak
      { wch: 24 }, // Keterangan
      { wch: 14 }, // Total Masuk
      { wch: 14 }, // Total Keluar
      { wch: 12 }, // Stok
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mutasi Gudang');

    const fileName = `mutasi_gudang_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <MainLayout title="Mutasi Gudang">
      <div className="space-y-6">

        {/* Toolbar: Two-row layout — Row 1: Search | Row 2: Filters + Actions */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col gap-3">

            {/* ── Row 1: Search ── */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>

            {/* ── Row 2: Filters + Actions ── */}
            <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between">

              {/* Left: Filter Controls */}
              <div className="flex flex-wrap gap-2 flex-1">

                {/* Filter Gudang */}
                <select
                  value={filters.kode_gudang || 'all'}
                  onChange={(e) => setFilter('kode_gudang', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                >
                  <option value="all">Semua Gudang</option>
                  {gudangList.map((gud) => (
                    <option key={gud.kode} value={gud.kode}>
                      {gud.nama}
                    </option>
                  ))}
                </select>

                {/* Filter Jenis Transaksi */}
                <select
                  value={filters.jenis_transaksi || 'all'}
                  onChange={(e) => setFilter('jenis_transaksi', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-w-[140px]"
                >
                  <option value="all">Semua Transaksi</option>
                  <option value="Masuk">Masuk</option>
                  <option value="Keluar">Keluar</option>
                </select>

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
                  {kategoriList.map((kat) => (
                    <option key={kat.kode_kategori} value={kat.kode_kategori}>
                      {kat.nama_kategori}
                    </option>
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
                  title="Segarkan data"
                  className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
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
                {canCreate && (
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    <span>Import</span>
                  </button>
                )}
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

                const displayValue = filter.key === 'kode_gudang'
                  ? gudangList.find(g => g.kode === filter.value)?.nama || filter.value
                  : filter.key === 'kode_kategori'
                    ? kategoriList.find(k => k.kode_kategori === filter.value)?.nama_kategori || filter.value
                    : filter.key === 'kode_sub_kategori'
                      ? subKategoriList.find(s => s.kode_sub_kategori === filter.value)?.nama_sub_kategori || filter.value
                      : filter.key === 'nama_armada'
                        ? armadaList.find(a => a.nama_armada === filter.value)?.nama_armada || filter.value
                        : filter.value;

                return (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                    <Filter className="w-3 h-3" />
                    {filter.key === 'kode_gudang' && 'Gudang: '}
                    {filter.key === 'jenis_transaksi' && 'Transaksi: '}
                    {filter.key === 'kode_kategori' && 'Kategori: '}
                    {filter.key === 'kode_sub_kategori' && 'Sub Kategori: '}
                    {filter.key === 'nama_armada' && 'Armada: '}
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

        {/* ── Import Progress Bar ── tampil saat proses import berjalan */}
        {importProgress.loading && (
          <div className="bg-white rounded-lg shadow px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Sedang mengimpor data...</span>
              <span className="text-sm text-gray-500">
                {importProgress.processed} / {importProgress.total} baris
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${importProgress.total > 0 ? Math.round((importProgress.processed / importProgress.total) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Jangan menutup halaman ini sampai proses selesai.
            </p>
          </div>
        )}

        {/* ── Import Result Panel ── tampil setelah proses import selesai */}
        {importResult && !importProgress.loading && (
          <div className={`rounded-lg shadow px-5 py-4 border ${importResult.successCount > 0 && importResult.apiErrorCount === 0 && importResult.parseErrors.length === 0
            ? 'bg-green-50 border-green-200'
            : importResult.successCount > 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-gray-800">Hasil Import</p>
                <div className="flex flex-wrap gap-3 text-sm mt-1">
                  <span className="text-green-700 font-medium">
                    ✅ Berhasil: {importResult.successCount} baris
                  </span>
                  {importResult.parseErrors.length > 0 && (
                    <span className="text-amber-700 font-medium">
                      ⚠️ Dilewati (parse): {importResult.parseErrors.length} baris
                    </span>
                  )}
                  {importResult.apiErrorCount > 0 && (
                    <span className="text-red-700 font-medium">
                      ❌ Gagal (API): {importResult.apiErrorCount} baris
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="p-1 rounded hover:bg-black/10 shrink-0 mt-0.5"
                title="Tutup"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Detail error (maks 10 baris pertama, sisanya ringkas) */}
            {(importResult.parseErrors.length > 0 || importResult.apiErrors.length > 0) && (
              <details className="mt-3">
                <summary className="text-xs font-medium text-gray-600 cursor-pointer select-none hover:text-gray-800">
                  Lihat detail error ({importResult.parseErrors.length + importResult.apiErrors.length} baris)
                </summary>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto text-xs text-gray-600">
                  {[...importResult.parseErrors, ...importResult.apiErrors]
                    .slice(0, 50)
                    .map((err, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="shrink-0 text-gray-400">•</span>
                        {err}
                      </li>
                    ))}
                  {(importResult.parseErrors.length + importResult.apiErrors.length) > 50 && (
                    <li className="text-gray-400 italic">
                      ...dan {(importResult.parseErrors.length + importResult.apiErrors.length) - 50} error lainnya.
                    </li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Quick Date Filters (if date mode active) */}
        {
          dateFilterMode !== 'all' && (
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
          )
        }

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Gudang
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Nama Barang
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Kode Barang,<br />Part Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Armada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Transaksi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Referensi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Lokasi Rak
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  {(canEdit || canDelete) && (
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
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
                ) : (
                  paginatedGroups.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                        {hasActiveFilters
                          ? 'Tidak ada data yang sesuai dengan filter'
                          : 'Belum ada data mutasi gudang'}
                      </td>
                    </tr>
                  ) : (
                    paginatedGroups.map((group) => {
                      // Masuk/Keluar dalam periode filter (filteredData)
                      const totalMasuk = group.rows
                        .filter(r => r.jenis_transaksi === 'Masuk')
                        .reduce((sum, r) => sum + (r.qty || 0), 0);
                      const totalKeluar = group.rows
                        .filter(r => r.jenis_transaksi === 'Keluar')
                        .reduce((sum, r) => sum + (r.qty || 0), 0);
                      const satuan = group.rows[0]?.satuan || '';

                      // Stok aktual dari allData (tidak terpengaruh filter)
                      const stokInfo = stokByBarang.get(group.kode_barang) || { masuk: 0, keluar: 0 };
                      const stokAktual = stokInfo.masuk - stokInfo.keluar;

                      return (
                        <React.Fragment key={group.kode_barang}>
                          {/* ── Group Header Row ── */}
                          <tr className="bg-green-50 border-t-2 border-green-300">
                            <td
                              colSpan={(canEdit || canDelete) ? 11 : 10}
                              className="px-4 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                {/* Nama Barang */}
                                <span className="text-xs font-bold text-green-900">
                                  {group.nama_barang}{group.alias && ` (${group.alias})`}
                                </span>
                                {/* Stats */}
                                <span className="ml-auto flex items-center gap-3 text-xs font-semibold">
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800"
                                    title={hasActiveFilters ? 'Total masuk dalam periode / filter aktif' : 'Total masuk'}
                                  >
                                    <TrendingUp className="w-3 h-3" />
                                    Masuk: {totalMasuk} {satuan}
                                    {hasActiveFilters && <span className="opacity-60 font-normal">(filter)</span>}
                                  </span>
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800"
                                    title={hasActiveFilters ? 'Total keluar dalam periode / filter aktif' : 'Total keluar'}
                                  >
                                    <TrendingDown className="w-3 h-3" />
                                    Keluar: {totalKeluar} {satuan}
                                    {hasActiveFilters && <span className="opacity-60 font-normal">(filter)</span>}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold ${stokAktual > 0
                                      ? 'bg-blue-100 text-blue-800'
                                      : stokAktual < 0
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-gray-100 text-gray-600'
                                      }`}
                                    title="Stok aktual dari seluruh data (tidak terpengaruh filter)"
                                  >
                                    <Package className="w-3 h-3" />
                                    Stok: {stokAktual} {satuan}
                                  </span>
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* ── Data Rows ── */}
                          {group.rows.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-xs">{item.nama_gudang}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs">{formatDate(item.tanggal)}</td>
                              <td className="px-6 py-4">
                                <div>
                                  <p className="text-xs font-medium">{item.nama_barang}</p>
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
                              <td className="px-6 py-4 text-xs">{item.nama_armada || '─'}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${item.jenis_transaksi === 'Masuk'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                  {item.jenis_transaksi === 'Masuk' ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  {item.jenis_transaksi}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${item.jenis_transaksi === 'Masuk' ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}`}>
                                {item.jenis_transaksi === 'Masuk' ? '+' : '-'}{item.qty} {item.satuan}
                              </td>
                              <td className="px-6 py-4 text-xs">{item.referensi || '─'}</td>
                              <td className="px-6 py-4 text-xs">{item.nama_rak || '─'}</td>
                              <td className="px-6 py-4 text-xs">{item.keterangan || '─'}</td>
                              {(canEdit || canDelete) && (
                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                  <div className="flex items-center justify-end gap-2">
                                    {canEdit && (
                                      <button
                                        onClick={() => openEditModal(item)}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Edit"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-red-600 hover:text-red-800"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}

                          {/* ── Saldo Sebelum Filter (hanya ketika filter aktif) ── */}
                          {hasActiveFilters && (() => {
                            const saldo = stokLuarFilterByBarang.get(group.kode_barang) ?? { qty: 0, satuan };
                            return (
                              <tr key={`saldo-${group.kode_barang}`} style={{ fontStyle: "italic" }}>
                                <td className="px-6 py-2 whitespace-nowrap text-xs text-gray-400">—</td>
                                <td className="px-6 py-2 whitespace-nowrap text-xs text-gray-400">—</td>
                                <td className="px-6 py-2 text-sm font-medium text-gray-500" colSpan={2}>
                                  Saldo sebelum periode filter
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                    <TrendingUp className="w-3 h-3" />
                                    Masuk
                                  </span>
                                </td>
                                <td className="px-6 py-2 text-xs font-semibold text-right text-emerald-700">
                                  {'+'}{saldo.qty} {satuan}
                                </td>
                                <td className="px-6 py-2 text-xs text-gray-400" colSpan={(canEdit || canDelete) ? 4 : 3}>—</td>
                              </tr>
                            );
                          })()}
                        </React.Fragment>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, groupedTotalPages))}
                disabled={currentPage === groupedTotalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
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
                  Menampilkan{' '}
                  <span className="font-medium">
                    {(currentPage - 1) * rowsPerPage + 1}
                  </span>–
                  <span className="font-medium">
                    {Math.min(currentPage * rowsPerPage, groupedTotalGroups)}
                  </span>{' '}
                  dari{' '}
                  <span className="font-medium">{groupedTotalGroups}</span> barang
                  {' '}
                  <span className="text-gray-400">({groupedTotalRows} transaksi)</span>
                </p>
              </div>

              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronFirst className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-green-50 text-sm font-medium text-green-600">
                    Halaman {currentPage} dari {groupedTotalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, groupedTotalPages))}
                    disabled={currentPage === groupedTotalPages || groupedTotalPages === 0}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(groupedTotalPages)}
                    disabled={currentPage === groupedTotalPages || groupedTotalPages === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLast className="w-5 h-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal - Mutasi Gudang */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                
                {/* Modal Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
                  <h2 className="text-xl font-bold">
                    {editingItem ? 'Edit Mutasi Gudang' : 'Tambah Mutasi Gudang'}
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

                  {/* Banner: form berasal dari PR (Diterima → Masuk, atau Diserahkan → Keluar) */}
                  {formData.referensi && !editingItem && (
                    formData.jenis_transaksi === 'Masuk' ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
                        <TrendingUp className="w-4 h-4 flex-shrink-0" />
                        <span>Mutasi <strong>Masuk</strong> ini untuk menerima barang dari PO terkait <strong>{formData.referensi}</strong>. Pilih Gudang &amp; Rak, lalu simpan.</span>
                      </div>
                    ) : formData.jenis_transaksi === 'Keluar' ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800">
                        <TrendingDown className="w-4 h-4 flex-shrink-0" />
                        <span>Mutasi <strong>Keluar</strong> ini untuk menyerahkan barang ke peminta terkait <strong>{formData.referensi}</strong>. Pilih Gudang &amp; Rak, lalu simpan.</span>
                      </div>
                    ) : null
                  )}
                  
                  {/* Tanggal & Jenis Transaksi*/}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gudang *
                      </label>
                      <select
                        name="kode_gudang"
                        value={formData.kode_gudang}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">-- Pilih Gudang --</option>
                        {gudangList.map((gud) => (
                          <option key={gud.kode} value={gud.kode}>
                            {gud.nama}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tanggal *
                      </label>
                      <input
                        type="date"
                        name="tanggal"
                        value={formData.tanggal}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Jenis Transaksi *
                      </label>
                      <select
                        name="jenis_transaksi"
                        value={formData.jenis_transaksi}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="Masuk">Masuk</option>
                        <option value="Keluar">Keluar</option>
                      </select>
                    </div>
                  </div>

                  {/* Search Bar Barang */}
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cari Barang *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari kode, nama barang atau part number..."
                        value={searchTermBarang}
                        onChange={(e) => { setSearchTermBarang(e.target.value); setShowBarangDropdown(true); }}
                        onFocus={() => setShowBarangDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>

                    {showBarangDropdown && searchTermBarang && (
                      <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredBarangSearch.length > 0 ? (
                          filteredBarangSearch.map((barang) => (
                            <div
                              key={barang.kode_barang}
                              onClick={() => handleSelectBarang(barang)}
                              className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">
                                  {barang.nama_barang}{barang.alias && ` (${barang.alias})`}
                                </span>
                              </div>
                              
                              <div className="text-sm text-gray-600">
                                {barang.kode_barang && (
                                  <span className="text-sm text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">
                                    KB: {barang.kode_barang}
                                  </span>
                                )}
                                {barang.part_number && (
                                  <span className="text-sm text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                                    PN: {barang.part_number}
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
                  </div>

                  {/* Preview Auto-fill */}
                  <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border">
                    <div>
                      <span className="block text-xs uppercase text-gray-400 font-bold">Nama Barang</span>
                      <span className="text-xs font-medium">{formData.nama_barang}</span><br />
                      <span className="text-xs text-green-800">{formData.alias}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-gray-400 font-bold">Kode Barang</span>
                      <span className="text-xs">{formData.kode_barang || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-gray-400 font-bold">Part Number</span>
                      <span className="text-xs font-mono text-blue-600">{formData.part_number || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-gray-400 font-bold">Satuan</span>
                      <span className="text-xs">{formData.satuan || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah *</label>
                      <input
                        type="number"
                        name="qty"
                        value={formData.qty}
                        onChange={handleInputChange}
                        required
                        min="1"
                        step="1"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Referensi</label>
                      <input
                        type="text"
                        name="referensi"
                        value={formData.referensi}
                        onChange={handleInputChange}
                        placeholder="Nomor PR/PO"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lokasi Rak
                      </label>
                      <select
                        name="kode_rak"
                        value={formData.kode_rak}
                        onChange={handleInputChange}
                        disabled={!formData.kode_gudang || rakListFiltered.length === 0}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">-- Pilih Lokasi Rak --</option>
                        {rakListFiltered.map((rak) => (
                          <option key={rak.kode_rak} value={rak.kode_rak}>
                            {rak.nama_rak}
                          </option>
                        ))}
                      </select>
                      {!formData.kode_gudang && (
                        <p className="mt-1 text-xs text-gray-400">Pilih Gudang terlebih dahulu</p>
                      )}
                      {formData.kode_gudang && rakListFiltered.length === 0 && (
                        <p className="mt-1 text-xs text-amber-500">Tidak ada rak untuk gudang ini</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                    <textarea name="keterangan" value={formData.keterangan} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="Catatan..."></textarea>
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
        )
      }

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
                      <strong>Info:</strong> Barang yang ditambahkan akan otomatis dipilih untuk transaksi mutasi.
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
                        satuan: '',
                        kode_kategori: '',
                        kode_sub_kategori: '',
                        kode_armada: '',
                        nama_armada: '',
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
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

      {/* ── Import Modal ── */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onFileSelect={handleImportFile}
        title="Import Mutasi Gudang"
        templateFileName="mutasi_gudang"
        templateDriveUrl="https://drive.google.com/uc?export=download&id=1qgZ3WpibH4VYkH8V8a-cee3sPTW7pW4V"
        columns={[
          'Kode Gudang',
          'Tanggal',
          'Jenis Transaksi',
          'Kode Barang',
          'Jumlah',
          'Referensi (PO No)',
          'Lokasi',
        ]}
        maxRows={10000}
      />
    </MainLayout>
  );
}