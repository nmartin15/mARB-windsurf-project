import React, { useState, useEffect } from 'react';
import { LogOut, Scale, Menu, X, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase, testSupabaseConnection } from '../lib/supabase';
import { NotificationsPanel } from './NotificationsPanel';

interface DashboardLayoutProps {
  children: JSX.Element | JSX.Element[];
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<string | null>(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);

  // Test Supabase connection when component mounts
  useEffect(() => {
    const checkConnection = async () => {
      const result = await testSupabaseConnection();
      setConnectionStatus(result.ok ? 'connected' : 'error');
      setConnectionDetails(result.message || null);
      
      if (!result.ok) {
        console.error('Supabase connection error:', result.error);
      }
    };
    
    checkConnection();
  }, []);

  const handleSignOut = async () => {
    try {
      // Auth signOut returns { error } directly, not { data, error }
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        // You could add a toast notification here if you have a notification system
        return;
      }
      
      navigate('/login');
    } catch (err) {
      console.error('Unexpected error during sign out:', err);
      // Still try to navigate to login as a fallback
      navigate('/login');
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Check if the current route is active
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-white border-r">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-5">
            <Scale className="mr-2 h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">mARB</span>
          </div>
          <nav className="mt-5 flex-1 px-2 space-y-1">
            <Link
              to="/dashboard"
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                isActive('/dashboard')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg
                className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive('/dashboard') ? 'text-blue-500' : 'text-gray-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Dashboard
            </Link>
            <Link
              to="/claims"
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                isActive('/claims')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg
                className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive('/claims') ? 'text-blue-500' : 'text-gray-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Claims
            </Link>
            <Link
              to="/messages"
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                isActive('/messages')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg
                className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive('/messages') ? 'text-blue-500' : 'text-gray-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Messages
            </Link>
            <Link
              to="/reports"
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                isActive('/reports')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg
                className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive('/reports') ? 'text-blue-500' : 'text-gray-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Reports
            </Link>
          </nav>
        </div>
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-2 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
            type="button"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
          
          {connectionStatus && (
            <div
              className={`mt-4 text-sm rounded-md p-2 ${
                connectionStatus === 'connected'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              <div className="flex items-center">
                {connectionStatus === 'connected' ? (
                  <span className="w-2 h-2 mr-2 rounded-full bg-green-500"></span>
                ) : (
                  <AlertCircle className="w-4 h-4 mr-1 text-red-500" />
                )}
                <span>
                  {connectionStatus === 'connected' 
                    ? 'Connected to Supabase' 
                    : 'Connection issue'}
                </span>
              </div>
              
              {connectionStatus !== 'connected' && connectionDetails && (
                <button
                  type="button"
                  className="mt-2 text-xs underline"
                  onClick={() => setShowConnectionDetails(!showConnectionDetails)}
                  aria-expanded={showConnectionDetails}
                >
                  {showConnectionDetails ? 'Hide details' : 'Show details'}
                </button>
              )}

              {showConnectionDetails && connectionDetails && (
                <div className="mt-2 text-xs bg-white p-2 rounded border border-red-200">
                  {connectionDetails}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile menu */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Scale className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">mARB</span>
          </div>
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            type="button"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
        
        {isMobileMenuOpen && (
          <nav className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/dashboard"
              onClick={closeMobileMenu}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/dashboard')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/claims"
              onClick={closeMobileMenu}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/claims')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Claims
            </Link>
            <Link
              to="/messages"
              onClick={closeMobileMenu}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/messages')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Messages
            </Link>
            <Link
              to="/reports"
              onClick={closeMobileMenu}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/reports')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Reports
            </Link>
            <button
              onClick={async () => {
                closeMobileMenu();
                await handleSignOut();
              }}
              className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
              type="button"
            >
              Sign Out
            </button>
          </nav>
        )}
      </div>

      {/* Main content */}
      <div className="md:ml-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white border-b md:hidden">
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex"></div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                onClick={toggleMobileMenu}
                className="p-1 rounded-full text-gray-400 hover:text-gray-500"
                type="button"
                aria-label="Open navigation menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
        
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* Connection error alert for mobile */}
          {connectionStatus === 'error' && (
            <div className="mb-6 md:hidden bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    Database connection issues. Some features may not work correctly.
                  </p>
                  {connectionDetails && (
                    <p className="mt-2 text-xs text-red-700">{connectionDetails}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {children}
        </main>
      </div>

      {/* Notifications Panel - Hidden in this simplified version */}
      <NotificationsPanel />
    </div>
  );
}