// src/routesConfig.jsx
//
// Peta path → komponen halaman.
// MainLayout menggunakan file ini untuk merender semua tab secara bersamaan
// (keep-alive: komponen tidak di-unmount saat tab tidak aktif).
//
// Setiap halaman di-lazy-load (React.lazy) supaya jadi chunk JS terpisah,
// bukan ikut menumpuk ke bundle utama. Karena MainLayout tetap keep-alive
// (display:none/block, tidak unmount), chunk hanya di-fetch SEKALI saat
// tab itu pertama kali dibuka — setelahnya komponennya tetap hidup di memory
// seperti biasa, tidak re-fetch tiap switch tab.
//
// Jika menambah halaman baru:
//   1. Tambahkan lazy import di sini
//   2. Tambahkan entri path → Komponen
//   3. Tambahkan metadata (title, description, icon) di pageInfo dalam MainLayout.jsx
//   4. Tambahkan item menu di Sidebar.jsx (jika perlu)

import { lazy } from 'react';

const Dashboard        = lazy(() => import('./pages/Dashboard'));
const Summary          = lazy(() => import('./pages/Summary'));
const Stok             = lazy(() => import('./pages/Stok'));
const KartuStok        = lazy(() => import('./pages/KartuStok'));
const Barang            = lazy(() => import('./pages/Barang'));
const Kategori          = lazy(() => import('./pages/Kategori'));
const SubKategori      = lazy(() => import('./pages/SubKategori'));
const Armada            = lazy(() => import('./pages/Armada'));
const Vendor            = lazy(() => import('./pages/Vendor'));
const MutasiGudang     = lazy(() => import('./pages/MutasiGudang'));
const Pembelian        = lazy(() => import('./pages/Pembelian'));
const PermintaanBarang = lazy(() => import('./pages/PermintaanBarang'));
const Users             = lazy(() => import('./pages/Users'));

const routesConfig = {
  '/dashboard':         Dashboard,
  '/summary':           Summary,
  '/stok':              Stok,
  '/kartu-stok':        KartuStok,
  '/barang':            Barang,
  '/kategori':          Kategori,
  '/sub_kategori':      SubKategori,
  '/armada':            Armada,
  '/vendor':            Vendor,
  '/mutasi_gudang':     MutasiGudang,
  '/pembelian':         Pembelian,
  '/permintaan_barang': PermintaanBarang,
  '/users':             Users,
};

export default routesConfig;
