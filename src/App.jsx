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

// Berapa lama sebelum token expired, peringatan ditampilkan ke user
const WARNING_BEFORE_EXPIRY_MS = 60 * 1000; // 1 menit

// Helper: jadwalkan callback pada waktu epoch (ms) tertentu.
// Kalau waktunya sudah lewat, callback langsung dipanggil.
// Mengembalikan fungsi cleanup untuk membatalkan timer.
function scheduleAt(targetMs, callback) {
  const delay = targetMs - Date.now();

  if (delay <= 0) {
    callback();
    return () => {};
  }

  const timerId = setTimeout(callback, delay);
  return () => clearTimeout(timerId);
}

function App() {
  const [loading, setLoading]                 = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionWarning, setSessionWarning]   = useState(false); // tampilkan banner "sesi akan berakhir"
  const [secondsLeft, setSecondsLeft]         = useState(0);     // countdown untuk banner

  useEffect(() => { checkAuth(); }, []);

  // Auto-logout saat token JWT expired + peringatan 1 menit sebelumnya.
  // Berjalan hanya ketika user sedang authenticated.
  useEffect(() => {
    if (!isAuthenticated) {
      setSessionWarning(false);
      return;
    }

    const expiry = authAPI.getTokenExpiry();

    const handleExpire = () => {
      console.warn('Sesi berakhir: token JWT sudah expired, logout otomatis.');
      setSessionWarning(false);
      setIsAuthenticated(false);
      authAPI.logout(); // hapus token + redirect ke /login
    };

    const handleWarning = () => {
      setSessionWarning(true);
    };

    // 1) Timer proaktif: logout tepat saat token expired, walau user idle
    //    (tanpa ada API call apa pun yang trigger cek 401), plus peringatan
    //    1 menit sebelumnya.
    const cancelLogoutTimer  = expiry ? scheduleAt(expiry, handleExpire) : () => {};
    const cancelWarningTimer = expiry
      ? scheduleAt(expiry - WARNING_BEFORE_EXPIRY_MS, handleWarning)
      : () => {};

    // 2) Jaga-jaga kalau timer meleset (misal laptop sleep lama):
    //    saat tab kembali terlihat, cek ulang validitas token.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !authAPI.isAuthenticated()) {
        handleExpire();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3) Sinkronisasi antar tab: kalau authToken dihapus di tab lain
    //    (logout / expired di tab lain), tab ini ikut logout.
    const handleStorage = (e) => {
      if (e.key === 'authToken' && !e.newValue) {
        setSessionWarning(false);
        setIsAuthenticated(false);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelLogoutTimer();
      cancelWarningTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAuthenticated]);

  // Countdown detik untuk banner peringatan, dihitung ulang setiap detik
  // selagi banner tampil, dari sisa waktu sampai token benar-benar expired.
  useEffect(() => {
    if (!sessionWarning) return;

    const expiry = authAPI.getTokenExpiry();
    if (!expiry) return;

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((expiry - Date.now()) / 1000)));
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [sessionWarning]);

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
      {sessionWarning && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-yellow-50 border border-yellow-300 rounded-lg shadow-lg p-4 flex items-start gap-3">
          <span className="text-2xl leading-none">⏰</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">
              Sesi akan berakhir dalam {secondsLeft}s
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Anda akan logout otomatis. Segera simpan pekerjaan Anda.
            </p>
          </div>
          <button
            onClick={() => setSessionWarning(false)}
            className="text-yellow-500 hover:text-yellow-700 text-sm leading-none"
            aria-label="Tutup peringatan"
          >
            ✕
          </button>
        </div>
      )}

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