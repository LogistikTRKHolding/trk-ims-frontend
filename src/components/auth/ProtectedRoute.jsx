// src/components/auth/ProtectedRoute.jsx
// Pure auth guard — tidak membungkus MainLayout.
// Menerima isAuthenticated dari App.jsx agar tidak perlu re-check sendiri.

import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function ProtectedRoute({ children, isAuthenticated, requiredRole = null }) {
  const location    = useLocation();

  // Gunakan prop jika tersedia, fallback ke cek lokal
  const isAuth      = isAuthenticated ?? authAPI.isAuthenticated();
  const currentUser = authAPI.getCurrentUser();

  console.log('[ProtectedRoute] path:', location.pathname, '| isAuth:', isAuth);

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && currentUser?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
