// src/components/layout/TabBar.jsx

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function TabBar({ tabs, activeTab, onClose, onSelect, sidebarOpen }) {
  const containerRef = useRef(null);

  // Auto-scroll tab aktif ke posisi visible
  useEffect(() => {
    const activeEl = containerRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeTab]);

  if (tabs.length === 0) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-30 bg-gray-100 border-b border-gray-200 h-10">
      <div
        ref={containerRef}
        className={`
          flex h-full items-stretch overflow-x-auto
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}
        `}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const Icon     = tab.icon;
          const isActive = tab.path === activeTab;
          const isOnly   = tabs.length === 1;

          return (
            <div
              key={tab.path}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onSelect(tab.path)}
              title={tab.title}
              className={`
                relative flex items-center gap-1.5 px-3
                min-w-[100px] max-w-[180px] flex-shrink-0
                cursor-pointer border-r border-gray-200 group select-none
                transition-colors duration-150
                ${isActive
                  ? 'bg-white text-gray-800 border-t-2 border-t-green-500'
                  : 'bg-gray-100 hover:bg-gray-50 text-gray-500 border-t-2 border-t-transparent'
                }
              `}
            >
              {Icon && (
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
              )}

              <span className="text-xs font-medium truncate flex-1 leading-none">
                {tab.title}
              </span>

              {/* Tombol tutup — disembunyikan jika hanya 1 tab */}
              {!isOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(tab.path); }}
                  className={`
                    flex-shrink-0 w-4 h-4 rounded flex items-center justify-center
                    transition-all duration-150
                    hover:bg-red-100 hover:text-red-500
                    ${isActive
                      ? 'opacity-60 hover:opacity-100 text-gray-500'
                      : 'opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 text-gray-400'
                    }
                  `}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}

              {/* Tutup bottom border agar tab aktif menyatu dengan konten */}
              {isActive && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-white" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
