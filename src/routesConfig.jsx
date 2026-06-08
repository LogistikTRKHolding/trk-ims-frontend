// src/routesConfig.jsx
//
// Peta path → komponen halaman.
// MainLayout menggunakan file ini untuk merender semua tab secara bersamaan
// (keep-alive: komponen tidak di-unmount saat tab tidak aktif).
//
// Jika menambah halaman baru:
//   1. Import komponen di sini
//   2. Tambahkan entri path → Komponen
//   3. Tambahkan metadata (title, description, icon) di pageInfo dalam MainLayout.jsx
//   4. Tambahkan item menu di Sidebar.jsx (jika perlu)

import Dashboard        from './pages/Dashboard';
import Summary          from './pages/Summary';
import Stok             from './pages/Stok';
import KartuStok        from './pages/KartuStok';
import Barang           from './pages/Barang';
import Kategori         from './pages/Kategori';
import SubKategori      from './pages/SubKategori';
import Armada           from './pages/Armada';
import Vendor           from './pages/Vendor';
import MutasiGudang     from './pages/MutasiGudang';
import Pembelian        from './pages/Pembelian';
import PermintaanBarang from './pages/PermintaanBarang';
import Users            from './pages/Users';

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