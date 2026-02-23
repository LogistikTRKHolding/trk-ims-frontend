// src/components/common/ProfileModal.jsx
// Modal for editing user profile from anywhere in the app

import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building, Shield, Save, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI, usersAPI } from '../../services/api';

export default function ProfileModal({ isOpen, onClose, userId }) {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordStrength, setPasswordStrength] = useState(null);
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
      setActiveTab('profile');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordStrength(null);
      loadUserData();
    }
  }, [isOpen, userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);

      const isOwnProfile = userId === currentUser?.userId;

      if (isOwnProfile) {
        // Untuk profile sendiri: gunakan data dari localStorage (sudah ada sejak login)
        // Tidak perlu hit API, tidak ada masalah permission
        const user = currentUser;
        setUserData({
          user_id: user.userId || user.user_id,
          email: user.email,
          full_name: user.fullName || user.full_name || '',
          phone: user.phone || '',
          department: user.department || '',
          role: user.role || 'Staff',
          status: user.status || 'Active',
          created_at: user.created_at || user.createdAt,
          last_login: user.last_login || user.lastLogin,
        });
        setFormData({
          full_name: user.fullName || user.full_name || '',
          phone: user.phone || '',
          department: user.department || '',
          role: user.role || 'Staff',
          status: user.status || 'Active',
        });
      } else {
        // Untuk Admin yang edit user lain: hit API (Admin punya akses GET /users)
        const users = await usersAPI.getAll();
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
        } else {
          throw new Error(`User dengan ID ${userId} tidak ditemukan`);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      alert('Gagal memuat data user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkPasswordStrength = (password) => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 'Lemah', color: 'bg-red-500', textColor: 'text-red-600', width: 'w-1/4' };
    if (score <= 2) return { level: 'Cukup', color: 'bg-yellow-500', textColor: 'text-yellow-600', width: 'w-2/4' };
    if (score <= 3) return { level: 'Baik', color: 'bg-blue-500', textColor: 'text-blue-600', width: 'w-3/4' };
    return { level: 'Kuat', color: 'bg-green-500', textColor: 'text-green-600', width: 'w-full' };
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!passwordData.current_password) {
      alert('Kata sandi saat ini harus diisi!');
      return;
    }
    if (passwordData.new_password.length < 8) {
      alert('Kata sandi baru minimal 8 karakter!');
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('Konfirmasi kata sandi tidak sesuai!');
      return;
    }
    if (passwordData.current_password === passwordData.new_password) {
      alert('Kata sandi baru tidak boleh sama dengan kata sandi saat ini!');
      return;
    }

    try {
      setPasswordLoading(true);
      await usersAPI.changePassword(userId, passwordData.current_password, passwordData.new_password);
      alert('Kata sando berhasil diubah! Silakan login kembali.');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordStrength(null);
      onClose(true);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setPasswordLoading(false);
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

      await usersAPI.update(userId, updates);

      // Update localStorage jika edit profile sendiri agar data tetap sinkron
      if (userId === currentUser?.userId) {
        const updatedUser = {
          ...currentUser,
          fullName: formData.full_name,
          full_name: formData.full_name,
          phone: formData.phone || null,
          department: formData.department || null,
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }

      alert('Profil berhasil diperbarui!');
      onClose(true);
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
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Pengaturan Profil
            </h2>
            <p className="text-sm text-gray-500">
              Perbarui informasi profil Anda
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white sticky top-[73px] z-10">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'profile'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <User className="w-4 h-4" />
            Informasi Profil
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'password'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Lock className="w-4 h-4" />
            Ganti Kata sandi
          </button>
        </div>

        {/* Loading State */}
        {loading && !userData ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat profile...</p>
          </div>
        ) : activeTab === 'profile' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* User Info Card */}
            {userData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      Informasi Akun
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
                        <p className="text-xs text-blue-600">Dibuat pada</p>
                        <p>{new Date(userData.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                      {userData.last_login && (
                        <div>
                          <p className="text-xs text-blue-600">Terakhir Masuk</p>
                          <p>{new Date(userData.last_login).toLocaleDateString('id-ID')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email (Read-only) & Full Name */}
            <div className="grid grid-cols-2 gap-4">
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
                  <p className="mt-1 text-xs text-gray-500">Email tidak dapat diganti</p>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4" />
                  Nama Lengkap *
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
            </div>

            {/* Phone & Department*/}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4" />
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="081234567890"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Building className="w-4 h-4" />
                  Departemen
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="IT, Finance, Operations, etc."
                />
              </div>
            </div>

            {/* Role & Status - Only visible for Admin and not editing own account */}
            {currentUser?.role === 'Admin' && userId !== currentUser?.userId && (
              <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-orange-800">Admin Controls</h4>
                      <p className="text-xs text-orange-600 mt-1">
                        Anda dapat mengubah role dan status user lain.
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
                      <option value="Staff-gudang">Staff Gudang</option>
                      <option value="Staff-pembelian">Staff Pembelian</option>
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${userData.role === 'Admin' ? 'bg-red-100 text-red-800' :
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${userData.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                      {userData.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </form>
        ) : (
          /* Password Change Tab */
          <form onSubmit={handlePasswordChange} className="p-6 space-y-6">
            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-amber-800">Keamanan Akun</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    Pastikan kata sandi baru Anda kuat dan tidak digunakan di tempat lain.
                    Setelah mengganti kata sandi, Anda akan diminta login kembali.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Password */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Lock className="w-4 h-4" />
                Kata sandi Saat Ini *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'kata sandi'}
                  required
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Masukkan kata sandi saat ini"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Lock className="w-4 h-4" />
                Kata sandi Baru *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'kata sandi'}
                  required
                  value={passwordData.new_password}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPasswordData({ ...passwordData, new_password: val });
                    setPasswordStrength(checkPasswordStrength(val));
                  }}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {passwordStrength && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Kekuatan kata sandi</span>
                    <span className={`text-xs font-medium ${passwordStrength.textColor}`}>
                      {passwordStrength.level}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
                  </div>
                  <ul className="mt-2 space-y-1">
                    {[
                      { check: passwordData.new_password.length >= 8, label: 'Minimal 8 karakter' },
                      { check: /[A-Z]/.test(passwordData.new_password), label: 'Mengandung huruf kapital' },
                      { check: /[0-9]/.test(passwordData.new_password), label: 'Mengandung angka' },
                      { check: /[^A-Za-z0-9]/.test(passwordData.new_password), label: 'Mengandung karakter spesial (!@#$...)' },
                    ].map((rule, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs">
                        {rule.check
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          : <AlertCircle className="w-3.5 h-3.5 text-gray-300" />
                        }
                        <span className={rule.check ? 'text-green-700' : 'text-gray-400'}>{rule.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Lock className="w-4 h-4" />
                Konfirmasi Kata sandi Baru *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'kata sandi'}
                  required
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password
                    ? 'border-red-400 bg-red-50'
                    : passwordData.confirm_password && passwordData.new_password === passwordData.confirm_password
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300'
                    }`}
                  placeholder="Ulangi kata sandi baru"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Password tidak cocok
                </p>
              )}
              {passwordData.confirm_password && passwordData.new_password === passwordData.confirm_password && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Kata sandi cocok
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={passwordLoading || (passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {passwordLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Ubah Kata sandi
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