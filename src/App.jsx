// src/App.jsx  —  versi DIAGNOSTIK (sementara untuk debugging)
// Setelah masalah ditemukan, hapus semua baris console.log

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login          from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout     from './components/layout/MainLayout';
import { authAPI }    from './services/api';

// Helper: bungkus promise dengan timeout agar tidak hang selamanya
function withTimeout(promise, ms = 5000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`timeout setelah ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function App() {
  const [loading, setLoading]                 = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    console.log('[App] checkAuth dimulai');
    try {
      const isAuth = authAPI.isAuthenticated();
      console.log('[App] isAuthenticated (lokal):', isAuth);

      if (isAuth) {
        console.log('[App] memanggil authAPI.verify()...');
        await withTimeout(authAPI.verify(), 5000);   // ← timeout 5 detik
        console.log('[App] verify() berhasil');
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('[App] checkAuth error:', error.message);
      // Jika timeout atau error verify, tetap lanjutkan (logout jika perlu)
      if (!error.message.includes('timeout')) {
        authAPI.logout();
      }
    } finally {
      console.log('[App] setLoading(false) dipanggil');
      setLoading(false);
    }
  };

  console.log('[App] render — loading:', loading, '| isAuthenticated:', isAuthenticated);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        {/* Satu route catch-all — MainLayout persistent (keep-alive tabs) */}
        <Route
          path="/*"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <MainLayout />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
