// src/App.jsx
// Main app with routing and authentication

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
    try {
      if (authAPI.isAuthenticated()) {
        await withTimeout(authAPI.verify(), 5000);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error.message);
      if (!error.message.includes('timeout')) {
        authAPI.logout();
      }
    } finally {
      setLoading(false);
    }
  };

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
            <ProtectedRoute>
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
