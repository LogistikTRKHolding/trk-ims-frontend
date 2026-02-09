// src/App.jsx
// Main app with routing and authentication

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import { authAPI } from './services/api';

// Import pages
import Dashboard from './pages/Dashboard';
import Summary from './pages/Summary';
import Stok from './pages/Stok';
import KartuStok from './pages/KartuStok';
import Barang from './pages/Barang';
import Kategori from './pages/Kategori';
import Armada from './pages/Armada';
import Vendor from './pages/Vendor';
import MutasiGudang from './pages/MutasiGudang';
import Pembelian from './pages/Pembelian';
import Users from './pages/Users';

function App() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (authAPI.isAuthenticated()) {
        await authAPI.verify();
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      authAPI.logout();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          } 
        />

        {/* Protected Routes - Wrapped in MainLayout */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
                <Dashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/summary" 
          element={
            <ProtectedRoute>
              <Summary />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/stok" 
          element={
            <ProtectedRoute>
              <Stok />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/kartu-stok" 
          element={
            <ProtectedRoute>
              <KartuStok />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/barang" 
          element={
            <ProtectedRoute>
              <Barang />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/kategori" 
          element={
            <ProtectedRoute>
              <Kategori />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/armada" 
          element={
            <ProtectedRoute>
              <Armada />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/vendor" 
          element={
            <ProtectedRoute>
              <Vendor />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/mutasi_gudang" 
          element={
            <ProtectedRoute>
              <MutasiGudang />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/pembelian" 
          element={
            <ProtectedRoute>
              <Pembelian />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/users" 
          element={
            <ProtectedRoute requiredRole="Admin">
              <Users />
            </ProtectedRoute>
          } 
        />

        {/* Default redirect */}
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />

        {/* 404 */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">Page not found</p>
                <a href="/dashboard" className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Go to Dashboard
                </a>
              </div>
            </div>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;