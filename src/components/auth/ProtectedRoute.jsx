// src/components/auth/ProtectedRoute.jsx
// Protect routes that require authentication

import { Navigate } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const isAuthenticated = authAPI.isAuthenticated();
  const currentUser = authAPI.getCurrentUser();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if specified
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!allowedRoles.includes(currentUser?.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
            <div className="text-red-500 text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Required role: <strong>{requiredRole}</strong><br />
              Your role: <strong>{currentUser?.role}</strong>
            </p>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // Authenticated and authorized
  return children;
}