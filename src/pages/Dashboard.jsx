// src/pages/Dashboard.jsx
// Complete dashboard with doughnut chart and top 10 list

import { useState, useEffect } from 'react';
import { TrendingUp, Package, AlertTriangle, ShoppingCart, Clock, DollarSign } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { dashboardAPI } from '../services/api';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadMetrics();
  }, [selectedMonth, selectedYear]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await dashboardAPI.getMetrics(selectedMonth, selectedYear);
      setMetrics(data);
    } catch (error) {
      console.error('Error loading metrics:', error);
      alert('Error loading dashboard metrics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Doughnut Chart Component dengan Legend di Bawah & Animasi Hover
  const DoughnutChart = ({ data }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!data || data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.count, 0);

    const colors = {
      'Tersedia': '#10b981',
      'Stok Kurang': '#f59e0b',
      'Habis': '#ef4444',
      'Stok Lebih': '#3b82f6'
    };

    let currentAngle = 0;
    const isHovering = hoveredIndex !== null;
    const activeItem = isHovering ? data[hoveredIndex] : null;

    return (
      // Gunakan flex-1 agar komponen ini mengisi sisa ruang yang ada di dalam Card
      <div className="flex flex-col items-center justify-between flex-1 min-h-0 w-full">

        {/* Container Chart: Dibuat fleksibel dengan flex-1 */}
        <div className="relative w-full flex-1 min-h-[220px] max-h-[300px] flex items-center justify-center p-2">
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full max-w-full max-h-full overflow-visible"
          >
            {data.map((item, index) => {
              const percentage = (item.count / total) * 100;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;

              const start = polarToCartesian(100, 100, 80, endAngle);
              const end = polarToCartesian(100, 100, 80, startAngle);
              const largeArcFlag = angle > 180 ? 1 : 0;

              const pathData = [
                `M 100 100`,
                `L ${start.x} ${start.y}`,
                `A 80 80 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
                'Z'
              ].join(' ');

              currentAngle += angle;
              const isItemHovered = hoveredIndex === index;

              return (
                <path
                  key={index}
                  d={pathData}
                  fill={colors[item.status] || '#6b7280'}
                  stroke="white"
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    transform: isItemHovered ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: 'center',
                    opacity: isHovering && !isItemHovered ? 0.5 : 1,
                  }}
                />
              );
            })}

            <circle cx="100" cy="100" r="50" fill="white" />

            <text x="100" y="95" textAnchor="middle" fontSize="24" fontWeight="bold" fill={isHovering ? colors[activeItem.status] : "#1f2937"} className="transition-colors duration-300">
              {isHovering ? activeItem.count : total}
            </text>
            <text x="100" y="115" textAnchor="middle" fontSize="12" fill="#6b7280">
              {isHovering ? activeItem.status : "Total Items"}
            </text>
          </svg>
        </div>

        {/* Legend: Dipastikan masuk ke dalam area bawah container */}
        <div className="w-full mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {data.map((item, index) => (
              <div
                key={index}
                className={`flex items-center space-x-2 cursor-pointer transition-all duration-200 ${hoveredIndex === index ? 'scale-105' : 'opacity-80'}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[item.status] || '#6b7280' }}
                ></div>
                <span className={`text-xs font-medium ${hoveredIndex === index ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                  {item.status} ({item.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <div className="flex space-x-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {months.map((month, index) => (
                <option key={index} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Total Nilai Persediaan */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Nilai Persediaan</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(metrics.totalNilai)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Item Stok Kritis */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Item Stok Kritis</p>
                    <p className="text-2xl font-bold text-red-600 mt-2">
                      {metrics.itemKritis}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Perlu restock</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Transaksi Keluar */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Transaksi Keluar</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {metrics.transaksiKeluar.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Items periode ini</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Rata-rata Lead Time */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Rata-rata Lead Time</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {metrics.avgLeadTime} hari
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Waktu pengiriman</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Pesanan Aktif */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Pesanan Aktif</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {metrics.pesananAktif}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Purchase orders</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Total Pembelian */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Pembelian</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(metrics.totalPembelian)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Periode ini</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Doughnut Chart Card */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col min-h-[450px]">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Komposisi Stok Berdasarkan Status
                </h3>

                {metrics.stockByStatus && metrics.stockByStatus.length > 0 ? (
                  <div className="flex-1 flex flex-col">
                    <DoughnutChart data={metrics.stockByStatus} />
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No data available</p>
                )}
              </div>

              {/* Top 10 Items - Enhanced Interactive Version */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Top 10 Permintaan Suku Cadang
                  </h3>
                  <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-600 rounded">
                    {months[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>

                {metrics.top10Items && metrics.top10Items.length > 0 ? (
                  <div className="space-y-3">
                    {(() => {
                      // Mencari nilai tertinggi untuk menghitung persentase bar
                      const maxQty = Math.max(...metrics.top10Items.map(i => i.total_qty));

                      return metrics.top10Items.map((item, index) => {
                        const percentage = (item.total_qty / maxQty) * 100;

                        return (
                          <div
                            key={index}
                            className="group relative flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-green-100 hover:bg-green-50/30 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-default overflow-hidden"
                          >
                            {/* Background Progress Bar (Visualisasi perbandingan kuantitas) */}
                            <div
                              className="absolute left-0 top-0 h-full bg-green-100/40 transition-all duration-1000 ease-out z-0"
                              style={{ width: `${percentage}%` }}
                            />

                            <div className="flex items-center space-x-4 flex-1 min-w-0 z-10">
                              {/* Ranking Badge dengan warna medali untuk Top 3 */}
                              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${index === 0 ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-200' :
                                index === 1 ? 'bg-slate-300 text-slate-700' :
                                  index === 2 ? 'bg-orange-300 text-orange-800' :
                                    'bg-gray-100 text-gray-500 group-hover:bg-green-500 group-hover:text-white'
                                }`}>
                                {index + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                                  {item.nama_barang}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-gray-400 font-mono tracking-tight">
                                    {item.kode_barang}
                                  </p>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs text-green-600 font-mono tracking-tight">
                                    {item.nama_armada}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Informasi Kuantitas */}
                            <div className="flex-shrink-0 ml-4 z-10 text-right">
                              <div className="flex items-baseline space-x-1">
                                <span className="text-lg font-black text-gray-800 group-hover:text-green-600 transition-colors">
                                  {item.total_qty}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                  pcs
                                </span>
                              </div>
                              {/* Indikator persentase terhadap item terpopuler */}
                              <div className="text-[9px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                {percentage.toFixed(0)}% of peak
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                      <Package className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm font-medium">Data permintaan belum tersedia</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-500">No data available</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/mutasi_gudang"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Mutasi Gudang</span>
            </a>

            <a
              href="/pembelian"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ShoppingCart className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Pembelian</span>
            </a>

            <a
              href="/stok"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Package className="w-8 h-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Cek Stok</span>
            </a>

            <a
              href="/summary"
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">View Critical</span>
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}