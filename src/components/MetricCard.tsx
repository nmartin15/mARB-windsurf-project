import React, { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

export interface MetricCardProps {
  title: string;
  value: string;
  icon?: ReactElement;
  trend?: string | number;
  trendUp?: boolean;
  loading?: boolean;
  type?: 'paid' | 'receivables' | 'negotiation' | 'unpaid';
}

export function MetricCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendUp = true, 
  loading = false,
  type 
}: MetricCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (type) {
      navigate(`/claims/${type}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse" role="status" aria-live="polite" aria-label={`Loading ${title} metric`}>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (type) {
    return (
      <button
        type="button"
        className="w-full text-left bg-white rounded-lg shadow-sm p-6 cursor-pointer transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={handleClick}
        aria-label={`View ${title} claims`}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
            {trend && (
              <p className={`mt-1 text-sm font-medium ${trendUp ? 'text-green-700' : 'text-red-700'}`}>
                {typeof trend === 'number' ? `${trend > 0 ? '+' : ''}${trend}%` : trend} {trendUp ? '↑' : '↓'}
              </p>
            )}
          </div>
          {icon && (
            <div className="p-3 bg-gray-50 rounded-full">
              {icon}
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {trend && (
            <p className={`mt-1 text-sm font-medium ${trendUp ? 'text-green-700' : 'text-red-700'}`}>
              {typeof trend === 'number' ? `${trend > 0 ? '+' : ''}${trend}%` : trend} {trendUp ? '↑' : '↓'}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-gray-50 rounded-full">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}