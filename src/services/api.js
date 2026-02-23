// src/services/api.js
// Complete API service for Supabase backend with VIEWs support
// Pattern: READ from VIEWs, WRITE to BASE TABLEs

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function removeAuthToken() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
}

async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle authentication errors
  if (response.status === 401) {
    removeAuthToken();
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.details || 'Request failed');
  }

  return response.json();
}

// ============================================
// AUTHENTICATION API
// ============================================

export const authAPI = {
  async login(email, password) {
    const data = await fetchWithAuth(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      setAuthToken(data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
    }

    return data;
  },

  async register(userData) {
    return fetchWithAuth(`${API_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async verify() {
    try {
      return await fetchWithAuth(`${API_URL}/auth/verify`);
    } catch (error) {
      removeAuthToken();
      throw error;
    }
  },

  logout() {
    removeAuthToken();
    window.location.href = '/login';
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    return !!getAuthToken();
  },
};

// ============================================
// GENERIC DATA API (for BASE TABLEs)
// ============================================

const baseTableAPI = {
  async getAll(table) {
    return fetchWithAuth(`${API_URL}/data/${table}`);
  },

  async getById(table, id) {
    return fetchWithAuth(`${API_URL}/data/${table}/${id}`);
  },

  async create(table, data) {
    return fetchWithAuth(`${API_URL}/data/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(table, id, data) {
    return fetchWithAuth(`${API_URL}/data/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(table, id) {
    return fetchWithAuth(`${API_URL}/data/${table}/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// GENERIC VIEW API (for VIEWs - READ ONLY)
// ============================================

const viewAPI = {
  async getAll(viewName, filters = {}) {
    const params = new URLSearchParams();
    
    // Add filters to query string
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(key, value);
      }
    });
    
    const queryString = params.toString();
    const url = queryString 
      ? `${API_URL}/views/${viewName}?${queryString}`
      : `${API_URL}/views/${viewName}`;
    
    return fetchWithAuth(url);
  },

  async getById(viewName, id) {
    return fetchWithAuth(`${API_URL}/views/${viewName}/${id}`);
  },
};

// ============================================
// BARANG API (with VIEWs)
// ============================================

export const barangAPI = {
  // READ Operations - Use VIEW
  async getAll(filters = {}) {
    return viewAPI.getAll('v_barang_complete', filters);
  },

  async getById(id) {
    return viewAPI.getById('v_barang_complete', id);
  },

  async getByKategori(kodeKategori) {
    return viewAPI.getAll('v_barang_complete', { kode_kategori: kodeKategori });
  },

  async getByArmada(kodeArmada) {
    return viewAPI.getAll('v_barang_complete', { kode_armada: kodeArmada });
  },

  async getStocked() {
    return viewAPI.getAll('v_barang_stocked');
  },

  async getNonStocked() {
    return viewAPI.getAll('v_barang_non_stocked');
  },

  async getByStockType(isStocked) {
    return viewAPI.getAll('v_barang_complete', { is_stocked: isStocked });
  },

  // WRITE Operations - Use BASE TABLE
  async create(data) {
    // Prepare data - hanya kode, bukan nama
    const payload = {
      kode_barang: data.kode_barang,
      nama_barang: data.nama_barang,
      satuan: data.satuan,
      harga_satuan: data.harga_satuan,
      min_stok: data.min_stok || 0,
      max_stok: data.max_stok || 0,
      lokasi_gudang: data.lokasi_gudang,
      supplier_utama: data.supplier_utama,
      keterangan: data.keterangan,
      gambar_url: data.gambar_url,

      // Foreign keys - simpan KODE saja
      kode_kategori: data.kode_kategori,
      // FIX: Form MutasiGudang mengirim nama_armada (bukan kode_armada).
      // Prioritaskan kode_armada jika ada, fallback ke nama_armada agar
      // backend bisa resolve sendiri, atau kirim keduanya.
      kode_armada: data.kode_armada || undefined,
      nama_armada: data.nama_armada || undefined,

      // New field
      is_stocked: data.is_stocked ?? true,

      // Metadata
      is_active: true,
      // FIX: created_by bisa datang dari data, atau fallback ke currentUser
      created_by: data.created_by || authAPI.getCurrentUser()?.userId,
    };

    const result = await baseTableAPI.create('barang', payload);
    
    // Fetch kembali dari VIEW untuk dapat nama lengkap
    if (result.id) {
      return this.getById(result.id);
    }
    return result;
  },

  async update(id, data) {
    // Prepare data - hanya kode, bukan nama
    const payload = {
      nama_barang: data.nama_barang,
      satuan: data.satuan,
      harga_satuan: data.harga_satuan,
      min_stok: data.min_stok,
      max_stok: data.max_stok,
      lokasi_gudang: data.lokasi_gudang,
      supplier_utama: data.supplier_utama,
      keterangan: data.keterangan,
      gambar_url: data.gambar_url,
      
      // Foreign keys - update KODE saja
      kode_kategori: data.kode_kategori,
      kode_armada: data.kode_armada,
      
      // Update is_stocked
      is_stocked: data.is_stocked,
      
      // Metadata
      updated_by: data.updated_by,
    };

    const result = await baseTableAPI.update('barang', id, payload);
    
    // Fetch kembali dari VIEW untuk dapat nama lengkap
    return this.getById(id);
  },

  async delete(id, userId) {
    // Soft delete - set is_active = false
    return baseTableAPI.update('barang', id, {
      is_active: false,
      updated_by: userId,
    });
  },

  async hardDelete(id) {
    // Hard delete - permanent (Admin only)
    return baseTableAPI.delete('barang', id);
  },
};

// ============================================
// KATEGORI API
// ============================================

export const kategoriAPI = {
  // READ Operations
  async getAll() {
    return baseTableAPI.getAll('kategori');
  },

  async getById(id) {
    return baseTableAPI.getById('kategori', id);
  },

  async getActive() {
    return fetchWithAuth(`${API_URL}/data/kategori?is_active=true`);
  },

  // WRITE Operations
  async create(data) {
    const payload = {
      kode_kategori: data.kode_kategori,
      nama_kategori: data.nama_kategori,
      deskripsi: data.deskripsi,
      is_active: true,
      created_by: data.created_by,
    };
    return baseTableAPI.create('kategori', payload);
  },

  async update(id, data) {
    const payload = {
      nama_kategori: data.nama_kategori,
      deskripsi: data.deskripsi,
      updated_by: data.updated_by,
    };
    return baseTableAPI.update('kategori', id, payload);
  },

  async delete(id, userId) {
    return baseTableAPI.update('kategori', id, {
      is_active: false,
      updated_by: userId,
    });
  },
};

// ============================================
// ARMADA API 
// ============================================

export const armadaAPI = {
  // READ Operations
  async getAll() {
    return baseTableAPI.getAll('armada');
  },

  async getById(id) {
    return baseTableAPI.getById('armada', id);
  },

  async getActive() {
    return fetchWithAuth(`${API_URL}/data/armada?is_active=true`);
  },

  // WRITE Operations
  async create(data) {
    const payload = {
      kode_armada: data.kode_armada,
      nama_armada: data.nama_armada,
      is_active: true,
      created_by: data.created_by,
    };
    return baseTableAPI.create('armada', payload);
  },

  async update(id, data) {
    const payload = {
      nama_armada: data.nama_armada,
      updated_by: data.updated_by,
    };
    return baseTableAPI.update('armada', id, payload);
  },

  async delete(id, userId) {
    return baseTableAPI.update('armada', id, {
      is_active: false,
      updated_by: userId,
    });
  },
};

// ============================================
// VENDOR API
// ============================================

export const vendorAPI = {
  // READ Operations
  async getAll() {
    return baseTableAPI.getAll('vendor');
  },

  async getById(id) {
    return baseTableAPI.getById('vendor', id);
  },

  async getActive() {
    return fetchWithAuth(`${API_URL}/data/vendor?is_active=true`);
  },

  // WRITE Operations
  async create(data) {
    const payload = {
      kode_vendor: data.kode_vendor,
      nama_vendor: data.nama_vendor,
      kontak: data.kontak,
      alamat: data.alamat,
      email: data.email,
      telepon: data.telepon,
      keterangan: data.keterangan,
      is_active: true,
      created_by: data.created_by,
    };
    return baseTableAPI.create('vendor', payload);
  },

  async update(id, data) {
    const payload = {
      nama_vendor: data.nama_vendor,
      kontak: data.kontak,
      alamat: data.alamat,
      email: data.email,
      telepon: data.telepon,
      keterangan: data.keterangan,
      updated_by: data.updated_by,
    };
    return baseTableAPI.update('vendor', id, payload);
  },

  async delete(id, userId) {
    return baseTableAPI.update('vendor', id, {
      is_active: false,
      updated_by: userId,
    });
  },
};

// ============================================
// PEMBELIAN API (with VIEWs)
// ============================================

export const pembelianAPI = {
  // READ Operations - Use VIEW
  async getAll(filters = {}) {
    return viewAPI.getAll('v_pembelian_complete', filters);
  },

  async getById(id) {
    return viewAPI.getById('v_pembelian_complete', id);
  },

  async getByVendor(kodeVendor) {
    return viewAPI.getAll('v_pembelian_complete', { kode_vendor: kodeVendor });
  },

  async getByBarang(kodeBarang) {
    return viewAPI.getAll('v_pembelian_complete', { kode_barang: kodeBarang });
  },

  async getByStatus(status) {
    return viewAPI.getAll('v_pembelian_complete', { status });
  },

  async getByPeriod(month, year) {
    return viewAPI.getAll('v_pembelian_complete', { month, year });
  }, 

  // WRITE Operations - Use BASE TABLE
  async create(data) {
    const payload = {
      no_po: data.no_po,
      tanggal_po: data.tanggal_po,
      kode_vendor: data.kode_vendor,
      nama_vendor: data.nama_vendor,
      kode_barang: data.kode_barang,
      nama_barang: data.nama_barang,
      qty_order: data.qty_order,
      harga_satuan: data.harga_satuan,
      total_harga: data.total_harga || (data.qty_order * data.harga_satuan),
      tanggal_terima: data.tanggal_terima || '',
      status: data.status || 'Pending',
      keterangan: data.keterangan,
      created_by: data.created_by,
    };

    const result = await baseTableAPI.create('pembelian', payload);
    
    if (result.id) {
      return this.getById(result.id);
    }
    return result;
  },

  async update(id, data) {
    const payload = {
      tanggal_po: data.tanggal_po,
      kode_vendor: data.kode_vendor,
      nama_vendor: data.nama_vendor,
      kode_barang: data.kode_barang,
      nama_barang: data.nama_barang,
      qty_order: data.qty_order,
      harga_satuan: data.harga_satuan,
      total_harga: data.total_harga,
      tanggal_terima: data.tanggal_terima,
      status: data.status,
      keterangan: data.keterangan,
      updated_by: data.updated_by,
    };

    const result = await baseTableAPI.update('pembelian', id, payload);
    return this.getById(id);
  },

  async delete(id) {
    return baseTableAPI.delete('pembelian', id);
  },
};

// ============================================
// MUTASI GUDANG API (with VIEWs)
// ============================================

export const mutasiAPI = {
  // READ Operations - Use VIEW
  async getAll(filters = {}) {
    return viewAPI.getAll('v_mutasi_gudang_complete', filters);
  },

  async getById(id) {
    return viewAPI.getById('v_mutasi_gudang_complete', id);
  },

  async getByBarang(kodeBarang) {
    return viewAPI.getAll('v_mutasi_gudang_complete', { kode_barang: kodeBarang });
  },

  async getByJenis(jenis) {
    return viewAPI.getAll('v_mutasi_gudang_complete', { jenis_transaksi: jenis });
  },

  async getByPeriod(month, year) {
    return viewAPI.getAll('v_mutasi_gudang_complete', { month, year });
  },

  // WRITE Operations - Use BASE TABLE
  async create(data) {
    const payload = {
      no_transaksi: data.no_transaksi,
      tanggal: data.tanggal,
      jenis_transaksi: data.jenis_transaksi,
      kode_barang: data.kode_barang,
      nama_barang: data.nama_barang,
      qty: data.qty,
      satuan: data.satuan,
      keterangan: data.keterangan,
      referensi: data.referensi,
      created_by: data.created_by,
    };

    const result = await baseTableAPI.create('mutasi', payload);
    
    if (result.id) {
      return this.getById(result.id);
    }
    return result;
  },

  async update(id, data) {
    const payload = {
      tanggal: data.tanggal,
      jenis_transaksi: data.jenis_transaksi,
      kode_barang: data.kode_barang,
      nama_barang: data.nama_barang,
      qty: data.qty,
      satuan: data.satuan,
      keterangan: data.keterangan,
      referensi: data.referensi,
      updated_by: data.updated_by,
    };

    const result = await baseTableAPI.update('mutasi', id, payload);
    return this.getById(id);
  },

  async delete(id) {
    return baseTableAPI.delete('mutasi', id);
  },
};

// ============================================
// STOK API (VIEW only - READ ONLY)
// ============================================

export const stokAPI = {
  // READ Operations - Use VIEW (v_stok_summary)
  async getAll(filters = {}) {
    return viewAPI.getAll('v_stok_summary', filters);
  },

  async getById(id) {
    return viewAPI.getById('v_stok_summary', id);
  },

  async getByKategori(kodeKategori) {
    return viewAPI.getAll('v_stok_summary', { kode_kategori: kodeKategori });
  },

  async getByArmada(kodeArmada) {
    return viewAPI.getAll('v_stok_summary', { kode_armada: kodeArmada });
  },

  async getByStatus(status) {
    return viewAPI.getAll('v_stok_summary', { status_stok: status });
  },

  async getStocked() {
    return viewAPI.getAll('v_stok_summary', { is_stocked: true });
  },

  async getLowStock() {
    return viewAPI.getAll('v_stok_summary', { status_stok: 'Stok Kurang' });
  },

  async getOutOfStock() {
    return viewAPI.getAll('v_stok_summary', { status_stok: 'Habis' });
  },
};

// ============================================
// USERS API (Admin only)
// ============================================

export const usersAPI = {
  async getAll() {
    return fetchWithAuth(`${API_URL}/users`);
  },

  async getById(userId) {
    return fetchWithAuth(`${API_URL}/users/${userId}`);
  },

  async update(userId, updates) {
    return fetchWithAuth(`${API_URL}/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(userId) {
    return fetchWithAuth(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
    });
  },

  async getByRole(role) {
    return fetchWithAuth(`${API_URL}/users?role=${role}`);
  },

  async getByStatus(status) {
    return fetchWithAuth(`${API_URL}/users?status=${status}`);
  },

  /**
   * Ganti password user.
   * Hanya user itu sendiri yang bisa mengganti passwordnya sendiri.
   * Admin dapat mengganti password user lain (tanpa current_password).
   * @param {string} userId
   * @param {string} currentPassword - password saat ini (wajib untuk non-admin)
   * @param {string} newPassword - password baru
   */
  async changePassword(userId, currentPassword, newPassword) {
    return fetchWithAuth(`${API_URL}/users/${userId}/change-password`, {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },
};

// ============================================
// DASHBOARD API
// ============================================

export const dashboardAPI = {
  async getMetrics(month, year) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    
    const queryString = params.toString();
    const url = queryString 
      ? `${API_URL}/dashboard/metrics?${queryString}`
      : `${API_URL}/dashboard/metrics`;
    
    return fetchWithAuth(url);
  },

  async getStockComposition() {
    return fetchWithAuth(`${API_URL}/dashboard/stock-composition`);
  },

  async getTopPurchases(month, year, limit = 10) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    if (limit) params.append('limit', limit);
    
    const queryString = params.toString();
    const url = queryString 
      ? `${API_URL}/dashboard/top-purchases?${queryString}`
      : `${API_URL}/dashboard/top-purchases`;
    
    return fetchWithAuth(url);
  },

  async getCriticalStock() {
    return fetchWithAuth(`${API_URL}/dashboard/critical-stock`);
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthAPI = {
  async check() {
    const response = await fetch(`${API_URL}/health`);
    return response.json();
  },
};

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  auth: authAPI,
  barang: barangAPI,
  kategori: kategoriAPI,
  armada: armadaAPI,
  vendor: vendorAPI,
  pembelian: pembelianAPI,
  mutasi: mutasiAPI,
  stok: stokAPI,
  users: usersAPI,
  dashboard: dashboardAPI,
  health: healthAPI,
};