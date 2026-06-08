// src/components/layout/MainLayout.jsx

import { useState, useEffect, useContext, createContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Warehouse, ClipboardList,
  Package, FolderOpen, Settings, Truck, ShoppingCart, Users,
} from 'lucide-react';

import Sidebar      from './Sidebar';
import Header       from './Header';
import TabBar       from './TabBar';
import routesConfig from '../../routesConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Context: menandai bahwa kita sudah berada di dalam MainLayout (outer).
//
// Page component (Dashboard, Stok, dll.) biasanya memanggil:
//   return <MainLayout title="...">konten</MainLayout>
//
// Tanpa context ini, outer MainLayout merender Dashboard dari routesConfig,
// Dashboard merender inner MainLayout, inner MainLayout merender Dashboard
// lagi → infinite loop.
//
// Dengan context ini:
//   - Outer MainLayout set context = true, render full chrome + tab system.
//   - Inner MainLayout (dari page component) deteksi isNested = true,
//     langsung return {children} saja — tidak ada chrome, tidak ada rekursi.
// ─────────────────────────────────────────────────────────────────────────────
export const MainLayoutContext = createContext(false);

// ─── Page metadata ────────────────────────────────────────────────────────────
const pageInfo = {
  '/dashboard':         { title: 'Dashboard',           description: 'Overview dan analitik inventori gudang',  icon: LayoutDashboard  },
  '/summary':           { title: 'Summary',              description: 'Ringkasan status inventori',              icon: TrendingUp      },
  '/stok':              { title: 'Stok',                 description: 'Data stok barang di gudang',              icon: Warehouse       },
  '/kartu-stok':        { title: 'Kartu Stok',           description: 'Riwayat mutasi per barang',               icon: ClipboardList   },
  '/barang':            { title: 'Master Barang',        description: 'Kelola data master barang',               icon: Package         },
  '/kategori':          { title: 'Master Kategori',      description: 'Kelola kategori barang',                  icon: FolderOpen      },
  '/sub_kategori':      { title: 'Master Sub Kategori',  description: 'Kelola sub kategori barang',              icon: FolderOpen      },
  '/armada':            { title: 'Master Armada',        description: 'Kelola data armada/mesin',                icon: Settings        },
  '/vendor':            { title: 'Master Vendor',        description: 'Kelola data vendor/supplier',             icon: Truck           },
  '/permintaan_barang': { title: 'Permintaan Barang',    description: 'Permintaan pengadaan barang',             icon: ClipboardList   },
  '/mutasi_gudang':     { title: 'Mutasi Gudang',        description: 'Transaksi keluar masuk barang',           icon: TrendingUp      },
  '/pembelian':         { title: 'Pembelian',            description: 'Data purchase order',                     icon: ShoppingCart    },
  '/users':             { title: 'User Management',      description: 'Kelola pengguna sistem',                  icon: Users           },
};

const defaultPage = {
  title: 'TRK IMS',
  description: 'Sistem Manajemen Inventori Gudang',
  icon: LayoutDashboard,
};

function buildTab(path) {
  return { path, ...(pageInfo[path] ?? defaultPage) };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MainLayout({ children }) {
  // ── Semua hook dipanggil tanpa kondisi (React rules) ─────────────────────
  const isNested    = useContext(MainLayoutContext);
  const location    = useLocation();
  const navigate    = useNavigate();

  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [openTabs,      setOpenTabs]      = useState(() => [buildTab(location.pathname)]);
  const [activeTabPath, setActiveTabPath] = useState(location.pathname);

  useEffect(() => {
    // Jangan jalankan tab logic jika ini instance nested (dari page component)
    if (isNested) return;

    const path = location.pathname;
    setOpenTabs(prev => {
      if (prev.some(t => t.path === path)) return prev;
      return [...prev, buildTab(path)];
    });
    setActiveTabPath(path);
  }, [location.pathname, isNested]);

  // ── Early return untuk instance NESTED ───────────────────────────────────
  // Dipanggil dari page component: <MainLayout title="...">konten</MainLayout>
  // Cukup render kontennya saja — layout chrome sudah disediakan outer MainLayout.
  if (isNested) {
    return <>{children}</>;
  }

  // ── OUTER MainLayout: full chrome + keep-alive tab system ─────────────────
  const handleSelectTab = (path) => navigate(path);

  const handleCloseTab = (path) => {
    setOpenTabs(prev => {
      if (prev.length <= 1) return prev;
      const newTabs = prev.filter(t => t.path !== path);
      if (path === activeTabPath) {
        const idx     = prev.findIndex(t => t.path === path);
        const nextTab = newTabs[Math.min(idx, newTabs.length - 1)];
        navigate(nextTab.path);
      }
      return newTabs;
    });
  };

  const currentPage = pageInfo[activeTabPath] ?? defaultPage;

  return (
    // Provider value={true}: semua child (termasuk page component) tahu
    // mereka berada di dalam outer MainLayout.
    <MainLayoutContext.Provider value={true}>
      <div className="min-h-screen bg-gray-50">

        {/* Overlay mobile untuk sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Fixed chrome ───────────────────────────────────────────────── */}
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        {/* Header wrapper — ikut bergeser dengan sidebar */}
        <div className={`
          transition-all duration-300 ease-in-out
          ml-0 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
        `}>
          <Header
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            title={currentPage.title}
            description={currentPage.description}
          />
        </div>

        {/* Tab bar — fixed, tepat di bawah Header */}
        <TabBar
          tabs={openTabs}
          activeTab={activeTabPath}
          onClose={handleCloseTab}
          onSelect={handleSelectTab}
          sidebarOpen={sidebarOpen}
        />

        {/* ── Content area ─────────────────────────────────────────────────
         *  pt-[6.5rem] = Header (4rem) + TabBar (2.5rem)
         * ──────────────────────────────────────────────────────────────── */}
        <div className={`
          transition-all duration-300 ease-in-out
          pt-[6.5rem] ml-0
          ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
        `}>
          <main className="p-4 sm:p-6 lg:p-6">
            {/*
             * Keep-alive rendering:
             * Semua tab di-render sekaligus. Hanya tab aktif yang visible.
             * key={tab.path} menjaga instance komponen tetap hidup
             * selama tab tidak ditutup.
             *
             * Saat PageComponent (mis. Dashboard) merender <MainLayout> di
             * dalamnya, inner MainLayout mendeteksi isNested=true dan hanya
             * me-return {children} — tidak ada rekursi.
             */}
            {openTabs.map(tab => {
              const PageComponent = routesConfig[tab.path];
              if (!PageComponent) return null;

              return (
                <div
                  key={tab.path}
                  style={{ display: tab.path === activeTabPath ? 'block' : 'none' }}
                >
                  <PageComponent />
                </div>
              );
            })}
          </main>

          <footer className="bg-white border-t border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-600">
              <p>© 2025 TRK Holding</p>
              <p>Version 3.0</p>
            </div>
          </footer>
        </div>

      </div>
    </MainLayoutContext.Provider>
  );
}