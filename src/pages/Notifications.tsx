import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'initial_proposal' | 'counter_proposal' | 'lawyer_intervention' | 'settlement_reached' | 'payment_received';
  claim_id: string;
  title: string;
  description: string;
  amount?: number;
  created_at: string;
  is_read: boolean;
  action_url: string;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = [
    { id: 'initial_proposal', label: 'Initial Settlement Proposal', color: 'bg-blue-100 text-blue-800' },
    { id: 'counter_proposal', label: 'Counter Proposal', color: 'bg-purple-100 text-purple-800' },
    { id: 'lawyer_intervention', label: 'Lawyer Intervention', color: 'bg-orange-100 text-orange-800' },
    { id: 'settlement_reached', label: 'Settlement Reached', color: 'bg-green-100 text-green-800' },
    { id: 'payment_received', label: 'Payment Received', color: 'bg-emerald-100 text-emerald-800' }
  ];

  useEffect(() => {
    fetchNotifications();
  }, [selectedFilters]);

  const fetchNotifications = async () => {
    setError(null);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedFilters.length > 0) {
        query = query.in('type', selectedFilters);
      }

      const { data, error: apiError } = await query;

      if (apiError) throw apiError;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const resetFilters = () => {
    setSelectedFilters([]);
  };

  const getActionButton = (type: string, url: string) => {
    const buttonStyles = {
      initial_proposal: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
      counter_proposal: 'bg-purple-500 hover:bg-purple-600 focus:ring-purple-500',
      lawyer_intervention: 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500',
      settlement_reached: 'bg-green-500 hover:bg-green-600 focus:ring-green-500',
      payment_received: 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500'
    };

    const buttonLabels = {
      initial_proposal: 'Review Proposal',
      counter_proposal: 'View Counter Proposal',
      lawyer_intervention: 'Contact Lawyer',
      settlement_reached: 'View Agreement',
      payment_received: 'View Payment Details'
    };

    return (
      <a
        href={url}
        className={`inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${buttonStyles[type as keyof typeof buttonStyles]}`}
      >
        {buttonLabels[type as keyof typeof buttonLabels]}
      </a>
    );
  };

  const getStatusBadge = (type: string) => {
    const filter = filters.find(f => f.id === type);
    return filter ? (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${filter.color}`}>
        {filter.label}
      </span>
    ) : null;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your claim notifications and updates
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {filters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedFilters.includes(filter.id)
                        ? filter.color
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-6">
              <div className="flex items-center justify-center gap-2 text-red-600 bg-red-50 rounded-lg p-4">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          ) : loading ? (
            <div className="p-6">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading notifications...</span>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">
                <p className="text-lg font-medium">No notifications found</p>
                <p className="mt-1 text-sm">Check back later for updates on your claims</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-6 transition-colors ${
                    notification.is_read ? 'bg-white' : 'bg-blue-50'
                  }`}
                >
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(notification.type)}
                          <span className="text-sm text-gray-500">
                            {format(new Date(notification.created_at), 'MMM dd, yyyy • h:mm a')}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {notification.title}
                        </h3>
                      </div>
                      <div className="flex-shrink-0">
                        {getActionButton(notification.type, notification.action_url)}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-gray-600">
                        {notification.description}
                      </p>
                      {notification.amount && (
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          Amount: ${notification.amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}