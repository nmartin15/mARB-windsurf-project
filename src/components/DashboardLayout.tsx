import { useState } from 'react';
import { LogOut, Scale, Menu, X } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NotificationsPanel } from './NotificationsPanel';

interface DashboardLayoutProps {
  children: JSX.Element | JSX.Element[];
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActivePath = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div 
                className="flex-shrink-0 flex items-center cursor-pointer"
                onClick={() => navigate('/dashboard')}
              >
                <Scale className="h-8 w-8 text-green-500" />
              </div>
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                <Link 
                  to="/dashboard" 
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActivePath('/dashboard')
                      ? 'border-green-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/claims" 
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActivePath('/claims')
                      ? 'border-green-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Claims
                </Link>
                <Link 
                  to="/reports" 
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActivePath('/reports')
                      ? 'border-green-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Reports
                </Link>
              </div>
            </div>
            
            <div className="flex items-center">
              <NotificationsPanel />
              
              <button
                onClick={handleSignOut}
                className="hidden md:block ml-4 p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <span className="sr-only">Sign out</span>
                <LogOut className="h-6 w-6" />
              </button>

              <div className="flex items-center md:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
                >
                  <span className="sr-only">Open main menu</span>
                  {isMobileMenuOpen ? (
                    <X className="block h-6 w-6" />
                  ) : (
                    <Menu className="block h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}>
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/dashboard"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                isActivePath('/dashboard')
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/claims"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                isActivePath('/claims')
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Claims
            </Link>
            <Link
              to="/reports"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                isActivePath('/reports')
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Reports
            </Link>
            <button
              onClick={handleSignOut}
              className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}