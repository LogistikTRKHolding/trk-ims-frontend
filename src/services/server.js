// backend/server.js
// TRK Inventory System - Backend API with Supabase
// Version 2.1 - Added VIEWs support while maintaining backward compatibility

// ============================================
// LOAD ENVIRONMENT VARIABLES FIRST!
// ============================================
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ============================================
// VALIDATE ENVIRONMENT VARIABLES
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000;

console.log('🔍 Checking environment variables...\n');

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL is not set!');
  console.log('\n💡 Solution:');
  console.log('   1. Make sure you have a .env file in the backend folder');
  console.log('   2. Add: SUPABASE_URL=https://xxxxx.supabase.co\n');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_KEY is not set!');
  console.log('\n💡 Solution:');
  console.log('   1. Go to Supabase Dashboard → Settings → API');
  console.log('   2. Copy the "service_role" key');
  console.log('   3. Add to .env: SUPABASE_SERVICE_KEY=eyJhbGci...\n');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('❌ Error: JWT_SECRET is not set!');
  console.log('\n💡 Solution:');
  console.log('   Add to .env: JWT_SECRET=your-secret-key-min-32-chars\n');
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log('   SUPABASE_URL:', SUPABASE_URL);
console.log('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');
console.log('   JWT_SECRET:', JWT_SECRET.substring(0, 10) + '...');
console.log('   PORT:', PORT);
console.log();

// ============================================
// INITIALIZE SUPABASE CLIENT
// ============================================

let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log('✅ Supabase client initialized\n');
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
  process.exit(1);
}

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://ims.trk-holding.com',
    'https://trk-ims-frontend.vercel.app',
    'https://trk-ims-backend.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ============================================
// AUTH ROUTES
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('status', 'Active')
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        id: user.id, // ← Added UUID for created_by/updated_by
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        id: user.id, // ← Include UUID
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, department } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name required' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate user_id
    const { data: maxUser } = await supabase
      .from('users')
      .select('user_id')
      .order('user_id', { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (maxUser && maxUser.user_id) {
      nextNum = parseInt(maxUser.user_id.substring(3)) + 1;
    }
    const userId = 'USR' + String(nextNum).padStart(3, '0');

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'Staff',
        status: 'Active',
        phone: phone || null,
        department: department || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      message: 'Registration successful',
      userId: newUser.user_id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

// Get all users (Admin only)
app.get('/api/users', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const sanitizedUsers = users.map(({ password_hash, ...user }) => user);
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (Admin only)
app.put('/api/users/:userId', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    if (userId === req.user.userId && updates.role) {
      return res.status(400).json({ error: 'Cannot change own role' });
    }

    delete updates.password_hash;
    delete updates.user_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    const { password_hash, ...sanitizedUser } = data;
    res.json(sanitizedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:userId', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete own account' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// TABLE & VIEW MAPPINGS
// ============================================

// Map for backward compatibility (existing endpoints)
const tableMap = {
  barang: 'barang',
  vendor: 'vendor',
  pembelian: 'pembelian',
  mutasi: 'mutasi_gudang',
  stok: 'v_stok_summary', // ← Now points to VIEW
  kategori: 'kategori',
  armada: 'armada', // ← Added direct mapping
};

// Map of VIEWs (for new /api/views endpoints)
const viewMap = {
  v_barang_complete: 'v_barang_complete',
  v_barang_stocked: 'v_barang_stocked',
  v_barang_non_stocked: 'v_barang_non_stocked',
  v_mutasi_gudang_complete: 'v_mutasi_gudang_complete',
  v_pembelian_complete: 'v_pembelian_complete',
  v_stok_summary: 'v_stok_summary',
};

// Map of BASE TABLEs (for write operations)
const baseTableMap = {
  barang: 'barang',
  kategori: 'kategori',
  armada: 'armada',
  vendor: 'vendor',
  pembelian: 'pembelian',
  mutasi_gudang: 'mutasi_gudang',
};

// ============================================
// NEW: VIEW ROUTES (READ ONLY)
// ============================================

// Get all records from a VIEW
app.get('/api/views/:viewName', authenticateToken, async (req, res) => {
  try {
    const { viewName } = req.params;
    const filters = req.query;

    if (!viewMap[viewName]) {
      return res.status(400).json({ error: 'Invalid view name' });
    }

    const actualViewName = viewMap[viewName];
    console.log(`📊 [${req.user.email}] Querying VIEW: ${actualViewName}`);

    let query = supabase.from(actualViewName).select('*');

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'month' && key !== 'year' && key !== 'limit') {
        // Handle boolean filters
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        query = query.eq(key, value);
      }
    });

    // Handle date filters (for mutasi, pembelian)
    if (filters.month && filters.year) {
      const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
      const lastDay = new Date(filters.year, filters.month, 0).getDate();
      const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      if (actualViewName.includes('mutasi')) {
        query = query.gte('tanggal', startDate).lte('tanggal', endDate);
      } else if (actualViewName.includes('pembelian')) {
        query = query.gte('tanggal_po', startDate).lte('tanggal_po', endDate);
      }
    }

    // Handle limit
    if (filters.limit) {
      query = query.limit(parseInt(filters.limit));
    }

    // Apply ordering
    if (actualViewName.includes('barang') || actualViewName.includes('stok')) {
      query = query.order('kode_barang', { ascending: true });
    } else if (actualViewName.includes('mutasi')) {
      query = query.order('tanggal', { ascending: false });
    } else if (actualViewName.includes('pembelian')) {
      query = query.order('tanggal_po', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Error querying VIEW ${actualViewName}:`, error);
      
      // Check if view doesn't exist
      if (error.code === '42P01') {
        return res.status(500).json({ 
          error: `View ${actualViewName} does not exist`,
          details: 'Run the SQL scripts to create database views',
          hint: 'See documentation for VIEW creation scripts'
        });
      }
      
      throw error;
    }

    console.log(`✅ Retrieved ${data.length} records from VIEW ${actualViewName}`);
    res.json(data || []);

  } catch (error) {
    console.error('❌ VIEW query error:', error);
    res.status(500).json({ 
      error: 'Failed to query view',
      details: error.message,
      code: error.code 
    });
  }
});

// Get single record from VIEW by ID
app.get('/api/views/:viewName/:id', authenticateToken, async (req, res) => {
  try {
    const { viewName, id } = req.params;

    if (!viewMap[viewName]) {
      return res.status(400).json({ error: 'Invalid view name' });
    }

    const actualViewName = viewMap[viewName];
    console.log(`📊 [${req.user.email}] Getting single record from VIEW: ${actualViewName}, ID: ${id}`);

    const { data, error } = await supabase
      .from(actualViewName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`❌ Error:`, error);
      
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Record not found' });
      }
      
      throw error;
    }

    console.log(`✅ Record found in VIEW ${actualViewName}`);
    res.json(data);

  } catch (error) {
    console.error('❌ VIEW query error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch record',
      details: error.message 
    });
  }
});

// ============================================
// EXISTING DATA ROUTES (BACKWARD COMPATIBLE)
// ============================================

// Get data - UPDATED to support VIEWs
app.get('/api/data/:table', authenticateToken, async (req, res) => {
  try {
    const tableName = tableMap[req.params.table];
    if (!tableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    console.log(`📊 [${req.user.email}] Getting data from: ${tableName}`);

    // Check if it's a view
    const isView = tableName.startsWith('v_');

    let query = supabase.from(tableName).select('*');
    
    // Order by created_at if column exists (only for base tables)
    if (!isView) {
      const tablesWithCreatedAt = ['barang', 'vendor', 'pembelian', 'mutasi_gudang', 'users'];
      if (tablesWithCreatedAt.includes(tableName)) {
        query = query.order('created_at', { ascending: false });
      }
    } else {
      // For views, order by appropriate column
      if (tableName.includes('barang')) {
        query = query.order('kode_barang', { ascending: true });
      } else if (tableName.includes('stok')) {
        query = query.order('kode_barang', { ascending: true });
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Error fetching ${tableName}:`, error);
      
      if (error.code === '42P01') {
        return res.status(500).json({ 
          error: `${tableName} does not exist`,
          details: 'Table or view may not be created yet',
          hint: 'Check database schema'
        });
      }
      
      throw error;
    }

    console.log(`✅ Retrieved ${data.length} items from ${tableName}`);
    res.json(data);

  } catch (error) {
    console.error('❌ Get data error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      code: error.code 
    });
  }
});

// Create record - ENHANCED with better metadata handling
app.post('/api/data/:table', authenticateToken, async (req, res) => {
  try {
    const tableName = tableMap[req.params.table];
    if (!tableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Prevent writing to views
    if (tableName.startsWith('v_')) {
      return res.status(400).json({ 
        error: 'Cannot insert into VIEW',
        hint: 'Use base table name instead of view name'
      });
    }

    console.log(`📝 [${req.user.email}] Creating record in: ${tableName}`);

    // Prepare record data
    const record = { ...req.body };

    // Sanitize: ubah string kosong pada field tanggal menjadi null
    const dateFields = ['tanggal', 'tanggal_po', 'tanggal_terima', 'tanggal_selesai'];
    dateFields.forEach(field => {
      if (field in record && record[field] === '') {
        record[field] = null;
      }
    });

    // Add created_by using UUID from JWT token
    const tablesWithCreatedBy = ['barang', 'vendor', 'pembelian', 'mutasi_gudang', 'kategori', 'armada'];
    if (tablesWithCreatedBy.includes(tableName)) {
      record.created_by = req.user.id; // ← Use UUID from JWT
    }

    console.log(`📦 Inserting record:`, {
      table: tableName,
      keys: Object.keys(record),
      created_by: record.created_by
    });

    // Insert record
    const { data, error } = await supabase
      .from(tableName)
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating record:`, error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        return res.status(400).json({ 
          error: 'Duplicate entry', 
          details: error.message,
          hint: 'A record with this unique key already exists' 
        });
      }

      if (error.code === '23503') {
        return res.status(400).json({ 
          error: 'Foreign key constraint violation',
          details: error.message,
          hint: 'Make sure referenced records exist'
        });
      }
      
      if (error.code === '23502') {
        return res.status(400).json({ 
          error: 'Missing required field', 
          details: error.message,
          hint: 'Check that all required fields are provided'
        });
      }
      
      throw error;
    }

    console.log(`✅ Record created successfully:`, data.id || data.kode_barang || data.no_transaksi);

    res.status(201).json(data);

  } catch (error) {
    console.error('❌ Create record error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      code: error.code 
    });
  }
});

// Update record - ENHANCED with better metadata handling
app.put('/api/data/:table/:id', authenticateToken, async (req, res) => {
  try {
    const tableName = tableMap[req.params.table];
    if (!tableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Prevent updating views
    if (tableName.startsWith('v_')) {
      return res.status(400).json({ 
        error: 'Cannot update VIEW',
        hint: 'Use base table name instead of view name'
      });
    }

    console.log(`✏️ [${req.user.email}] Updating record in: ${tableName}, ID: ${req.params.id}`);

    // Prepare updates
    const updates = { ...req.body };

    // Sanitize: ubah string kosong pada field tanggal menjadi null
    // agar tidak menyebabkan error "invalid input syntax for type date"
    const dateFields = ['tanggal', 'tanggal_po', 'tanggal_terima', 'tanggal_selesai'];
    dateFields.forEach(field => {
      if (field in updates && updates[field] === '') {
        updates[field] = null;
      }
    });
    
    // Add updated_by using UUID from JWT token
    const tablesWithUpdatedBy = ['barang', 'vendor', 'pembelian', 'mutasi_gudang', 'kategori', 'armada'];
    if (tablesWithUpdatedBy.includes(tableName)) {
      updates.updated_by = req.user.id; // ← Use UUID from JWT
      updates.updated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating record:`, error);

      // Handle specific database errors (sama seperti POST handler)
      if (error.code === '23505') {
        return res.status(400).json({
          error: 'Duplicate entry',
          details: error.message,
          hint: 'A record with this unique key already exists'
        });
      }

      if (error.code === '23503') {
        return res.status(400).json({
          error: 'Foreign key constraint violation',
          details: error.message,
          hint: 'Make sure referenced records exist'
        });
      }

      if (error.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field',
          details: error.message,
          hint: 'Check that all required fields are provided'
        });
      }

      if (error.code === '22007' || error.code === '22008') {
        return res.status(400).json({
          error: 'Invalid date/time format',
          details: error.message,
          hint: 'Pastikan field tanggal berisi format YYYY-MM-DD atau null, bukan string kosong'
        });
      }

      throw error;
    }

    console.log(`✅ Record updated successfully`);
    res.json(data);

  } catch (error) {
    console.error('❌ Update record error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Delete record - UNCHANGED (already good)
app.delete('/api/data/:table/:id', authenticateToken, async (req, res) => {
  try {
    const tableName = tableMap[req.params.table];
    if (!tableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Prevent deleting from views
    if (tableName.startsWith('v_')) {
      return res.status(400).json({ 
        error: 'Cannot delete from VIEW',
        hint: 'Use base table name instead of view name'
      });
    }

    console.log(`🗑️ [${req.user.email}] Deleting record from: ${tableName}, ID: ${req.params.id}`);

    const { role } = req.user;
    
    // Check permissions
    if (tableName === 'barang' && role !== 'Admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    if ((tableName === 'kategori' || tableName === 'vendor') && role === 'Staff') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error(`❌ Error deleting record:`, error);
      
      // Handle foreign key constraint
      if (error.code === '23503') {
        return res.status(400).json({ 
          error: 'Cannot delete - record is referenced by other data', 
          details: error.message 
        });
      }
      
      throw error;
    }

    console.log(`✅ Record deleted successfully`);
    res.json({ message: 'Record deleted successfully' });

  } catch (error) {
    console.error('❌ Delete record error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});  

// ============================================
// DASHBOARD METRICS - ENHANCED with VIEWs
// ============================================

app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;

    console.log(`📊 Getting dashboard metrics for ${year}-${month}`);

    // 1. Total inventory value - Use VIEW
    const { data: stokData } = await supabase
      .from('v_stok_summary')
      .select('nilai_stok')
      .eq('is_stocked', true);
    
    const totalNilai = stokData.reduce((sum, item) => sum + (parseFloat(item.nilai_stok) || 0), 0);

    // 2. Critical stock items - Use VIEW
    const { data: kritisData } = await supabase
      .from('v_stok_summary')
      .select('*')
      .eq('is_stocked', true)
      .in('status_stok', ['Habis', 'Stok Kurang']);
    
    const itemKritis = kritisData.length;

    // 3. Transactions out - Use VIEW
    let transaksiQuery = supabase
      .from('v_mutasi_gudang_complete')
      .select('qty')
      .eq('jenis_transaksi', 'Keluar');

    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      transaksiQuery = transaksiQuery.gte('tanggal', startDate).lte('tanggal', endDate);
    }

    const { data: transaksiData } = await transaksiQuery;
    const transaksiKeluar = transaksiData.reduce((sum, t) => sum + (t.qty || 0), 0);

    // 4. Average lead time - Use VIEW
    const { data: leadTimeData } = await supabase
      .from('v_pembelian_complete')
      .select('lead_time_days')
      .not('lead_time_days', 'is', null);
    
    const avgLeadTime = leadTimeData.length > 0
      ? leadTimeData.reduce((sum, p) => sum + (p.lead_time_days || 0), 0) / leadTimeData.length
      : 0;

    // 5. Active orders - Use VIEW
    const { data: activeOrders } = await supabase
      .from('v_pembelian_complete')
      .select('*')
      .eq('status', 'Pending');
    
    const pesananAktif = activeOrders.length;

    // 6. Total purchases - Use VIEW
    let pembelianQuery = supabase
      .from('v_pembelian_complete')
      .select('total_harga');

    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      pembelianQuery = pembelianQuery.gte('tanggal_po', startDate).lte('tanggal_po', endDate);
    }

    const { data: pembelianData } = await pembelianQuery;
    const totalPembelian = pembelianData.reduce((sum, p) => sum + (parseFloat(p.total_harga) || 0), 0);

    // 7. Stock composition by status - Use VIEW
    const { data: stockComposition } = await supabase
      .from('v_stok_summary')
      .select('status_stok')
      .eq('is_stocked',true);
    
    const compositionCount = stockComposition.reduce((acc, item) => {
      acc[item.status_stok] = (acc[item.status_stok] || 0) + 1;
      return acc;
    }, {});

    const stockByStatus = Object.entries(compositionCount).map(([status, count]) => ({
      status,
      count
    }));

    // 8. Top 10 requested items - Use VIEW
    let topItemsQuery = supabase
      .from('v_mutasi_gudang_complete')
      .select('kode_barang, nama_barang, nama_armada, nama_kategori, qty')
      .eq('jenis_transaksi', 'Keluar')
      .eq('kode_kategori', 'KAT001');

    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      topItemsQuery = topItemsQuery.gte('tanggal', startDate).lte('tanggal', endDate);
    }

    const { data: mutasiData } = await topItemsQuery;
    
    // Aggregate by item
    const itemTotals = mutasiData.reduce((acc, item) => {
      const key = item.kode_barang;
      if (!acc[key]) {
        acc[key] = {
          kode_barang: item.kode_barang,
          nama_barang: item.nama_barang,
          nama_armada: item.nama_armada || 'N/A',
          nama_kategori: item.nama_kategori, // ← From VIEW
          total_qty: 0
        };
      }
      acc[key].total_qty += item.qty || 0;
      return acc;
    }, {});

    // Sort and take top 10
    const top10Items = Object.values(itemTotals)
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 10);

    console.log('✅ Dashboard metrics calculated');

    res.json({
      totalNilai,
      itemKritis,
      transaksiKeluar,
      avgLeadTime: Math.round(avgLeadTime * 10) / 10,
      pesananAktif,
      totalPembelian,
      stockByStatus,      // Chart data
      top10Items,         // Table data with kategori
    });
  } catch (error) {
    console.error('❌ Dashboard metrics error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'Supabase',
    version: '2.1',
    features: ['VIEWs', 'BASE TABLEs', 'JWT Auth'],
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'TRK Inventory System API',
    version: '2.1',
    database: 'Supabase',
    features: {
      views: 'Supported',
      baseTables: 'Supported',
      authentication: 'JWT',
      rbac: 'Admin, Manager, Staff'
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('✅ SERVER STARTED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🗄️ Database: Supabase (${SUPABASE_URL})`);
  console.log(`🔐 Authentication: JWT`);
  console.log(`📊 Version: 2.1 (VIEWs + BASE TABLEs)`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('\n📋 Available endpoints:');
  console.log('   GET  /api/health');
  console.log('   POST /api/auth/login');
  console.log('   POST /api/auth/register');
  console.log('   GET  /api/auth/verify');
  console.log('   GET  /api/users (Admin)');
  console.log('   \n   📖 READ (VIEWs):');
  console.log('   GET  /api/views/:viewName');
  console.log('   GET  /api/views/:viewName/:id');
  console.log('   \n   ✏️  WRITE (BASE TABLEs):');
  console.log('   GET  /api/data/:table');
  console.log('   POST /api/data/:table');
  console.log('   PUT  /api/data/:table/:id');
  console.log('   DELETE /api/data/:table/:id');
  console.log('   \n   📊 DASHBOARD:');
  console.log('   GET  /api/dashboard/metrics');
  console.log('\n🎯 Supported VIEWs:');
  console.log('   - v_barang_complete');
  console.log('   - v_barang_stocked');
  console.log('   - v_barang_non_stocked');
  console.log('   - v_mutasi_gudang_complete');
  console.log('   - v_pembelian_complete');
  console.log('   - v_stok_summary');
  console.log('\n🚀 Ready to accept requests!\n');
});

module.exports = app;