import React, { useState, useEffect } from 'react';
import { LogOut, Scale, Menu, X, AlertCircle, Database, Wrench } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase, testSupabaseConnection } from '../lib/supabase';
import { NotificationsPanel } from './NotificationsPanel';
import type { AppReadinessStatus } from '../utils/appReadiness';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AppReadinessStatus | 'checking'>('checking');
  const [connectionDetails, setConnectionDetails] = useState<string | null>(null);
  const [claimCount, setClaimCount] = useState<number | null>(null);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);

  // Test Supabase connection when component mounts
  useEffect(() => {
    const checkConnection = async () => {
      setConnectionStatus('checking');
      const result = await testSupabaseConnection();
      setConnectionStatus(result.status);
      setConnectionDetails(result.message || null);
      setClaimCount(result.claimCount ?? null);

      if (!result.ok && result.status !== 'rpc_missing') {
        console.error('Supabase connection error:', result.error);
      }
    };

    checkConnection();
  }, []);

  const isBlockingStatus = connectionStatus === 'missing_schema' || connectionStatus === 'error';
  const isWarningStatus = connectionStatus === 'empty_data' || connectionStatus === 'rpc_missing';
  const statusColorClass =
    connectionStatus === 'ready'
      ? 'bg-green-50 text-green-700'
      : connectionStatus === 'checking'
        ? 'bg-gray-50 text-gray-700'
        : connectionStatus === 'empty_data' || connectionStatus === 'rpc_missing'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-red-50 text-red-700';
  const statusLabel =
    connectionStatus === 'ready'
      ? 'Connected to database'
      : connectionStatus === 'checking'
        ? 'Checking database connection...'
        : connectionStatus === 'missing_schema'
          ? 'Setup required'
          : connectionStatus === 'empty_data'
            ? 'Connected (no claims data yet)'
            : connectionStatus === 'rpc_missing'
              ? 'Connected (reporting functions missing)'
              : 'Connection issue';

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
              className={`mt-4 text-sm rounded-md p-2 ${statusColorClass}`}
            >
              <div className="flex items-center">
                {connectionStatus === 'ready' ? (
                  <span className="w-2 h-2 mr-2 rounded-full bg-green-500"></span>
                ) : connectionStatus === 'checking' ? (
                  <span className="w-2 h-2 mr-2 rounded-full bg-gray-500 animate-pulse"></span>
                ) : (
                  <AlertCircle className="w-4 h-4 mr-1" />
                )}
                <span>{statusLabel}</span>
              </div>

              {connectionStatus === 'empty_data' && claimCount === 0 && (
                <p className="mt-2 text-xs">Use Reports &gt; Data Import or run the demo journey loader to populate claims.</p>
              )}

              {connectionStatus !== 'ready' && connectionStatus !== 'checking' && connectionDetails && (
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
          {/* Connection status alert for mobile */}
          {(isBlockingStatus || isWarningStatus) && (
            <div className={`mb-6 md:hidden border-l-4 p-4 ${isBlockingStatus ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
              <div className="flex">
                <AlertCircle className={`h-5 w-5 ${isBlockingStatus ? 'text-red-400' : 'text-amber-500'}`} />
                <div className="ml-3">
                  <p className={`text-sm ${isBlockingStatus ? 'text-red-700' : 'text-amber-700'}`}>
                    {connectionStatus === 'missing_schema'
                      ? 'Setup required: run canonical schema migrations before using the app.'
                      : connectionStatus === 'empty_data'
                        ? 'Connected, but no claims are loaded yet.'
                        : connectionStatus === 'rpc_missing'
                          ? 'Connected, but required report RPC functions are missing.'
                          : 'Database connection issues detected.'}
                  </p>
                  {connectionDetails && (
                    <p className={`mt-2 text-xs ${isBlockingStatus ? 'text-red-700' : 'text-amber-700'}`}>{connectionDetails}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {connectionStatus === 'checking' ? (
            <div className="bg-white border rounded-lg p-6 flex items-center gap-3" role="status" aria-live="polite">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-700">Checking database readiness...</p>
            </div>
          ) : connectionStatus === 'missing_schema' ? (
            <div className="bg-white border border-red-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Database setup required</h2>
                  <p className="text-sm text-gray-700 mt-2">
                    This environment is connected, but canonical tables are missing. Apply the migration SQL files below to make UAT usable.
                  </p>
                  <ol className="list-decimal list-inside text-sm text-gray-700 mt-3 space-y-1">
                    <li><code>supabase/migrations/00001_canonical_schema.sql</code></li>
                    <li><code>supabase/migrations/00002_rpc_functions.sql</code></li>
                    <li><code>supabase/migrations/20260221_01_add_claim_payment_matching_fields.sql</code></li>
                    <li><code>supabase/migrations/20260221_02_pipeline_safe_index_hardening.sql</code></li>
                    <li><code>supabase/migrations/20260221_03_pipeline_preflight_audit.sql</code></li>
                    <li><code>supabase/migrations/20260221_04_guarded_natural_key_uniqueness.sql</code></li>
                  </ol>
                  <p className="text-xs text-gray-600 mt-3">
                    After running migrations, refresh this page. If you still see issues, expand details in the sidebar status panel.
                  </p>
                </div>
              </div>
            </div>
          ) : connectionStatus === 'error' ? (
            <div className="bg-white border border-red-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Wrench className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Unable to verify database readiness</h2>
                  <p className="text-sm text-gray-700 mt-2">
                    Check your Supabase environment variables and connectivity, then refresh.
                  </p>
                  {connectionDetails && (
                    <p className="text-xs text-red-700 mt-3 bg-red-50 border border-red-200 rounded p-2">{connectionDetails}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {isWarningStatus && (
                <div className="mb-4 bg-amber-50 border-l-4 border-amber-400 p-4">
                  <p className="text-sm text-amber-800">
                    {connectionStatus === 'empty_data'
                      ? 'Database is ready, but no claims are loaded yet. Use Reports > Data Import or run the demo loader to preload UAT data.'
                      : 'Database is connected, but reporting RPC functions are missing. Some charts may be unavailable until migrations are applied.'}
                  </p>
                </div>
              )}
              {children}
            </>
          )}
        </main>
      </div>

      {/* Notifications Panel - Hidden in this simplified version */}
      <NotificationsPanel />
    </div>
  );
}