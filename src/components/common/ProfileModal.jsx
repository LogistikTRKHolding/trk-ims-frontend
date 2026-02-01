// src/components/common/ProfileModal.jsx
// Modal for editing user profile from anywhere in the app

import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building, Shield, Save } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function ProfileModal({ isOpen, onClose, userId }) {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    department: '',
    role: '',
    status: '',
  });

  const currentUser = authAPI.getCurrentUser();

  useEffect(() => {
    if (isOpen && userId) {
      loadUserData();
    }
  }, [isOpen, userId]);

  const getAuthToken = () => localStorage.getItem('authToken');

  const loadUserData = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch('http://localhost:3000/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load user data');

      const users = await response.json();
      const user = users.find(u => u.user_id === userId);

      if (user) {
        setUserData(user);
        setFormData({
          full_name: user.full_name || '',
          phone: user.phone || '',
          department: user.department || '',
          role: user.role || 'Staff',
          status: user.status || 'Active',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      alert('Gagal memuat data user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name) {
      alert('Nama Lengkap harus diisi!');
      return;
    }

    try {
      setLoading(true);
      const token = getAuthToken();

      const updates = {
        full_name: formData.full_name,
        phone: formData.phone || null,
        department: formData.department || null,
      };

      // Only admin can change role and status
      if (currentUser?.role === 'Admin' && userId !== currentUser?.userId) {
        updates.role = formData.role;
        updates.status = formData.status;
      }

      const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update');
      }

      // Update localStorage if editing own profile
      if (userId === currentUser?.userId) {
        const updatedUser = {
          ...currentUser,
          fullName: formData.full_name,
          full_name: formData.full_name,
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }

      alert('Profile berhasil diupdate!');
      onClose(true); // Pass true to indicate success
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Profile Settings
              </h3>
              <p className="text-sm text-gray-500">
                Update your profile information
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Loading State */}
        {loading && !userData ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* User Info Card */}
            {userData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      Account Information
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                      <div>
                        <p className="text-xs text-blue-600">User ID</p>
                        <p className="font-mono font-semibold">{userData.user_id}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">Email</p>
                        <p className="font-medium">{userData.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">Created</p>
                        <p>{new Date(userData.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                      {userData.last_login && (
                        <div>
                          <p className="text-xs text-blue-600">Last Login</p>
                          <p>{new Date(userData.last_login).toLocaleDateString('id-ID')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4" />
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email (Read-only) */}
            {userData && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  value={userData.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="081234567890"
              />
            </div>

            {/* Department */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Building className="w-4 h-4" />
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="IT, Finance, Operations, etc."
              />
            </div>

            {/* Role & Status - Only visible for Admin and not editing own account */}
            {currentUser?.role === 'Admin' && userId !== currentUser?.userId && (
              <div className="border-t border-gray-200 pt-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-orange-800">Admin Controls</h4>
                      <p className="text-xs text-orange-600 mt-1">
                        You can modify role and status for other users
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Shield className="w-4 h-4" />
                      Role *
                    </label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Shield className="w-4 h-4" />
                      Status *
                    </label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Current Role & Status Display (for own profile or non-admin) */}
            {(userId === currentUser?.userId || currentUser?.role !== 'Admin') && userData && (
              <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Shield className="w-4 h-4" />
                    Role
                  </label>
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userData.role === 'Admin' ? 'bg-red-100 text-red-800' :
                      userData.role === 'Manager' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {userData.role}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Contact admin to change role</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Shield className="w-4 h-4" />
                    Status
                  </label>
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userData.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userData.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}