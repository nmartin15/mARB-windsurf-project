import React from 'react';
import { DollarSign, FileText, TrendingUp } from 'lucide-react';

interface DashboardMetricsProps {
  totalAmount: number;
  avgClaimAmount: number;
  totalClaims: number;
}

/**
 * DashboardMetrics Component
 * Displays key metrics in card format for the dashboard
 */
export function DashboardMetrics({ totalAmount, avgClaimAmount, totalClaims }: DashboardMetricsProps) {
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Claims Amount Card */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-100 mr-4">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Claims Amount</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</h3>
          </div>
        </div>
      </div>

      {/* Average Claim Amount Card */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-100 mr-4">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Average Claim Amount</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(avgClaimAmount)}</h3>
          </div>
        </div>
      </div>

      {/* Total Claims Count Card */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-purple-100 mr-4">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Claims</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalClaims.toLocaleString()}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
