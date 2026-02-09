// src/components/layout/Sidebar.jsx

import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  FolderOpen,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { authAPI } from '../../services/api';

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = authAPI.getCurrentUser();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
      // Auto-collapse sidebar on mobile by default
      if (window.innerWidth < 1024 && isOpen === undefined) {
        setIsOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      setIsOpen(false);
    }
  }, [location.pathname]);

  const menuItems = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Staff'] },
        { name: 'Summary', path: '/summary', icon: TrendingUp, roles: ['Admin', 'Manager', 'Staff'] },
        { name: 'Stok', path: '/stok', icon: Warehouse, roles: ['Admin', 'Manager', 'Staff'] },
        { name: 'Kartu Stok', path: '/kartu-stok', icon: ClipboardList, roles: ['Admin', 'Manager', 'Staff'] }, //, badge: 'New' },
      ]
    },
    {
      title: 'Master Data',
      items: [
        { name: 'Barang', path: '/barang', icon: Package, roles: ['Admin'] },
        { name: 'Kategori', path: '/kategori', icon: FolderOpen, roles: ['Admin'] },
        { name: 'Armada', path: '/armada', icon: Settings, roles: ['Admin'] },
        { name: 'Vendor', path: '/vendor', icon: Truck, roles: ['Admin'] },
      ]
    },
    {
      title: 'Transactions',
      items: [
        { name: 'Mutasi Gudang', path: '/mutasi_gudang', icon: TrendingUp, roles: ['Admin', 'Manager', 'Staff'] },
        { name: 'Pembelian', path: '/pembelian', icon: ShoppingCart, roles: ['Admin', 'Manager', 'Staff'] },
      ]
    },
    {
      title: 'Administration',
      items: [
        { name: 'Users', path: '/users', icon: Users, roles: ['Admin'] },
      ]
    },
  ];

  const isActive = (path) => location.pathname === path;

  const canAccessMenu = (menuRoles) => {
    return menuRoles.includes(currentUser?.role);
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out
        /* ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'} */
        ${isOpen 
          ? 'w-64 translate-x-0' 
          : 'w-0 -translate-x-full hidden lg:block lg:w-20 lg:translate-x-0'
        }
        lg:top-16 lg:h-[calc(100vh-4rem)]
      `}>

        <div className="flex flex-col h-full">
          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            {menuItems.map((section, idx) => (
              <div key={idx} className="mb-6">
                {isOpen && (
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                    {section.title}
                  </h3>
                )}

                <div className="space-y-1">
                  {section.items
                    .filter(item => canAccessMenu(item.roles))
                    .map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`
                            flex items-center justify-between px-3 py-2.5 rounded-lg
                            transition-colors duration-150
                            ${active
                              ? 'bg-green-50 text-green-600'
                              : 'text-gray-700 hover:bg-gray-100'
                            }
                            ${!isOpen && 'justify-center'}
                          `}
                          title={!isOpen ? item.name : ''}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-green-600' : 'text-gray-500'}`} />
                            {isOpen && (
                              <span className="text-sm font-medium">{item.name}</span>
                            )}
                          </div>

                          {isOpen && item.badge && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}