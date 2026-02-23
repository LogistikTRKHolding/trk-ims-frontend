// src/components/layout/Header.jsx

import { Menu, Bell, User, ChevronDown, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { authAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.png';
import ProfileModal from '../common/ProfileModal';

export default function Header({ onMenuClick, title = 'Dashboard', description = '' }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const currentUser = authAPI.getCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin logout?')) {
      authAPI.logout();
      navigate('/login');
    }
  };

  const handleOpenProfileSettings = () => {
    setIsProfileOpen(false);
    setShowProfileModal(true);
  };

  const handleCloseProfileModal = (updated) => {
    setShowProfileModal(false);
    
    // Reload page if profile was updated to reflect changes
    if (updated) {
      window.location.reload();
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40 w-full">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Left: Menu Button + Logo + Page Title */}
          <div className="flex items-center gap-4">
          {/* Hamburger Menu Button - Mobile only */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            {/* Logo - Desktop: acts as menu toggle. Mobile: hidden */}
            <button
              onClick={onMenuClick}
              className="hidden md:flex items-center gap-3 pr-4 border-r border-gray-200 p-2 pl-6 hover:bg-gray-100 transition-colors -ml-6 lg:pl-8 lg:-ml-8"
            >
              <img 
                src={logo} 
                alt="TRK Logo" 
                className="h-12 w-auto object-contain"
              />
            </button>

            {/* Page Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                {title}
              </h1>
              {description && (
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Notifications + User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              {/* Notification Badge */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:px-3 sm:py-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-800">
                    {currentUser?.fullName || currentUser?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentUser?.role || 'Staff'}
                  </p>
                </div>
                <ChevronDown className="hidden sm:block w-4 h-4 text-gray-500" />
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  
                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-800">
                        {currentUser?.fullName || currentUser?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {currentUser?.email || ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {currentUser?.role || 'Staff'}
                      </p>
                    </div>
                    
                    <div className="py-2">
                      <button 
                        onClick={handleOpenProfileSettings}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Pengaturan Profil
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={handleCloseProfileModal}
        userId={currentUser?.userId}
      />
    </>
  );
}