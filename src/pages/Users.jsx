// src/pages/Users.jsx
// User Management page with CRUD operations (Admin Only)

import { useState, useEffect, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import ProfileModal from '../components/common/ProfileModal';
import { authAPI } from '../services/api';
import * as XLSX from 'xlsx';
import { Edit, Trash2, Users as UsersIcon, X, Search, Mail, Phone, Building, RefreshCw,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Users() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const currentUser = authAPI.getCurrentUser();
  const isAdmin = currentUser?.role === 'Admin';

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      alert('Access denied. Admin only.');
      window.location.href = '/dashboard';
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // ============================================
  // API CALLS
  // ============================================
  const getAuthToken = () => localStorage.getItem('authToken');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load users');

      const result = await response.json();
      setData(result);
    } catch (error) {
      alert('Error loading users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  const handleEdit = (item) => {
    setProfileUserId(item.user_id);
    setShowProfileModal(true);
  };

  const handleProfileModalClose = (updated) => {
    setShowProfileModal(false);
    setProfileUserId(null);
    if (updated) loadUsers();
  };

  const handleDelete = async (item) => {
    if (item.user_id === currentUser?.userId) {
      alert('Tidak dapat menghapus akun sendiri!');
      return;
    }

    if (!confirm(`Delete user "${item.full_name}"?`)) return;

    try {
      const token = getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${item.user_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete');
      }

      alert('User berhasil dihapus!');
      loadUsers();
    } catch (error) {
      alert('Error deleting: ' + error.message);
    }
  };

  // ============================================
  // SORTING
  // ============================================
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'asc' });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // ============================================
  // FILTERS & HELPERS
  // ============================================
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const query = debouncedSearchQuery.trim().toLowerCase();

    // 1. Filtering
    let result = data.filter(item => {
      if (query !== '') {
        const searchMatch =
          item.user_id?.toLowerCase().includes(query) ||
          item.email?.toLowerCase().includes(query) ||
          item.full_name?.toLowerCase().includes(query) ||
          item.phone?.toLowerCase().includes(query) ||
          item.department?.toLowerCase().includes(query);
        if (!searchMatch) return false;
      }
      if (filterRole !== 'all' && item.role !== filterRole) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      return true;
    });

    // 2. Sorting
    result.sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return result;
  }, [data, debouncedSearchQuery, filterRole, filterStatus, sortConfig]);

  const hasActiveFilters = () => {
    return filterRole !== 'all' ||
      filterStatus !== 'all' ||
      searchQuery.trim() !== '';
  };

  const clearFilters = () => {
    setFilterRole('all');
    setFilterStatus('all');
    setSearchQuery('');
  };

  // ============================================
  // PAGINATION
  // ============================================
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [customRowsInput, setCustomRowsInput] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filterRole, filterStatus]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await loadUsers(); } finally { setIsRefreshing(false); }
  };

  return (
    <MainLayout title="User Management">
      <div className="space-y-6">
        {/* Search & Filters - Single Row Layout */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="space-y-4">
            {/* Search, Filters, and Actions in One Row */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Role Filter */}
              <div className="flex-1">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                >
                  <option value="all">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                  <option value="Staff Gudang">Staff Gudang</option>
                  <option value="Staff Pembelian">Staff Pembelian</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex-1">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters() && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                  <X className="w-4 h-4" /> Reset
                </button>
              )}

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
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => requestSort('full_name')}
                  >
                    Name {sortConfig.key === 'full_name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Phone (WhatsApps)</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        <span className="ml-2">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <p className="text-lg font-medium">No users found</p>
                        {hasActiveFilters() && (
                          <p className="text-sm mt-2">Try adjusting your filters or search term</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">

                          <div className="ml-4">
                            <div className="text-xs font-medium">{item.full_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-xs">
                          <Mail className="w-4 h-4 mr-2" />
                          {item.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${item.role === 'Admin' ? 'bg-red-100 text-red-800' :
                          item.role === 'Manager' ? 'bg-purple-100 text-purple-800' :
                            item.role === 'Staff_gudang' ? 'bg-blue-100 text-blue-800' :
                              item.role === 'Staff_pembelian' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                          }`}>
                          {item.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${item.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.phone ? (
                          <div className="flex items-center text-xs">
                            <Phone className="w-4 h-4 mr-2" />
                            {item.phone}
                          </div>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.department ? (
                          <div className="flex items-center text-xs">
                            <Building className="w-4 h-4 mr-2" />
                            {item.department}
                          </div>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs">
                          {item.last_login ? new Date(item.last_login).toLocaleString('id-ID') : 'Never'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {item.user_id !== currentUser?.userId && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
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
                      <option value={rowsPerPage} hidden={[10, 20, 30].includes(rowsPerPage)}>
                        {rowsPerPage}
                      </option>
                    </select>

                    <div className="flex items-center border border-gray-300 rounded ml-1">
                      <input
                        type="number"
                        placeholder="Sesuaikan"
                        value={customRowsInput}
                        onChange={(e) => setCustomRowsInput(e.target.value)}
                        className="w-16 px-2 py-1 text-sm outline-none rounded-l"
                      />
                      <button
                        onClick={() => {
                          const val = parseInt(customRowsInput);
                          if (val > 0) {
                            setRowsPerPage(val);
                            setCurrentPage(1);
                            setCustomRowsInput('');
                          }
                        }}
                        className="bg-gray-100 px-2 py-1 text-sm font-medium border-l hover:bg-gray-200 rounded-r"
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700">
                    Menampilkan <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> -{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * rowsPerPage, filteredData.length)}
                    </span> dari{' '}
                    <span className="font-medium">{filteredData.length}</span> hasil
                  </p>
                </div>

                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronFirst className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-green-50 text-sm font-medium text-green-600">
                      Halaman {currentPage} dari {totalPages || 1}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLast className="w-5 h-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={handleProfileModalClose}
        userId={profileUserId}
      />
    </MainLayout>
  );
}