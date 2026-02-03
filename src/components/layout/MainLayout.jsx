// src/components/layout/MainLayout.jsx

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const location = useLocation();

  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  // Define page titles and descriptions based on route
  const pageInfo = {
    '/dashboard': {
      title: 'Dashboard',
      description: 'Overview dan analitik inventori gudang'
    },
    '/summary': {
      title: 'Summary',
      description: 'Ringkasan status inventori'
    },
    '/stok': {
      title: 'Stok',
      description: 'Data stok barang di gudang'
    },
    '/kartu-stok': {
      title: 'Kartu Stok',
      description: 'Riwayat mutasi per barang'
    },
    '/barang': {
      title: 'Master Barang',
      description: 'Kelola data master barang'
    },
    '/kategori': {
      title: 'Master Kategori',
      description: 'Kelola kategori barang'
    },
    '/armada': {
      title: 'Master Armada',
      description: 'Kelola data armada/mesin'
    },
    '/vendor': {
      title: 'Master Vendor',
      description: 'Kelola data vendor/supplier'
    },
    '/mutasi_gudang': {
      title: 'Mutasi Gudang',
      description: 'Transaksi keluar masuk barang'
    },
    '/pembelian': {
      title: 'Pembelian',
      description: 'Data purchase order'
    },
    '/users': {
      title: 'User Management',
      description: 'Kelola pengguna sistem'
    }
  };

  const currentPage = pageInfo[location.pathname] || {
    title: 'TRK Inventory Management System',
    description: 'Sistem Manajemen Inventori Gudang'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Update 2: Overlay hanya muncul jika sidebar terbuka DI MOBILE */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Update 3: Margin-left hanya untuk layar desktop (lg) */}
      <div className={`
        transition-all duration-300 ease-in-out
        pt-16
        ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
        ml-0 
      `}>
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          title={currentPage.title}
          description={currentPage.description}
        />

        <main className="p-4 sm:p-6 lg:p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-600">
            <p>© 2025 TRK Holding</p>
            <p>Version 1.0</p>
          </div>
        </footer>
      </div>
    </div>
  );
};