import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, DollarSign, AlertCircle, TrendingDown } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { supabase } from '../../lib/supabase';
import type { RevenueLeak, ReportFilters } from '../../types/reports';
import { formatCurrency } from '../../utils/format';
import * as XLSX from 'xlsx';

interface RevenueSummary {
  totalGap: number;
  avgCollectionRatio: number;
  totalClaims: number;
  topDenialReason: string;
}

export function RevenueLeakReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevenueLeak[]>([]);
  const [summary, setSummary] = useState<RevenueSummary>({
    totalGap: 0,
    avgCollectionRatio: 0,
    totalClaims: 0,
    topDenialReason: '',
  });
  const [filters, setFilters] = useState<ReportFilters>({});
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [payers, setPayers] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchPayers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchProviders = async () => {
    const { data, error } = await supabase
      .from('providers')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching providers:', error);
      return;
    }

    setProviders(data || []);
  };

  const fetchPayers = async () => {
    const { data, error } = await supabase
      .from('insurance_companies')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching payers:', error);
      return;
    }

    setPayers(data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('revenue_leakage_view')
        .select('*');

      if (filters.providerId) {
        query = query.eq('provider_id', filters.providerId);
      }
      if (filters.payerId) {
        query = query.eq('payer_id', filters.payerId);
      }
      if (filters.minAmount) {
        query = query.gte('revenue_gap', filters.minAmount);
      }

      const { data, error } = await query;

      if (error) throw error;

      const revenueData = data || [];
      setData(revenueData);

      // Calculate summary metrics
      const totalGap = revenueData.reduce((sum, item) => sum + (item.revenue_gap || 0), 0);
      const avgRatio = revenueData.length > 0 
        ? revenueData.reduce((sum, item) => sum + (item.collection_ratio || 0), 0) / revenueData.length
        : 0;
      const totalClaims = revenueData.reduce((sum, item) => sum + (item.claim_count || 0), 0);

      // Find most common denial reason - safely handle null/undefined denial_reasons
      const denialReasons = revenueData
        .map(item => item.denial_reasons)
        .filter(Boolean) // Remove null/undefined values
        .flatMap(reasons => reasons.split(', ').filter(Boolean)); // Split and remove empty strings

      const reasonCounts = denialReasons.reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topReason = Object.entries(reasonCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'No denials recorded';

      setSummary({
        totalGap,
        avgCollectionRatio: avgRatio,
        totalClaims,
        topDenialReason: topReason,
      });
    } catch (err) {
      console.error('Error fetching revenue data:', err);
      setError('Failed to load revenue leakage data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = data.map(item => ({
      'Provider ID': item.providerId,
      'Payer ID': item.payerId,
      'Procedure Code': item.procedureCode,
      'Claim Count': item.claimCount,
      'Total Billed': item.totalBilled,
      'Total Paid': item.totalPaid,
      'Revenue Gap': item.revenueGap,
      'Collection Ratio': item.collectionRatio,
      'Denial Reasons': item.denialReasons,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue Leakage');
    XLSX.writeFile(wb, 'revenue-leakage-report.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Revenue Leakage Analysis</h2>
          <p className="mt-1 text-sm text-gray-500">
            Analyze claims with potential revenue loss and collection gaps
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-gray-600 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export Report
        </button>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        providers={providers}
        payers={payers}
        showAmountFilter
      />

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      ) : loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Loading report data...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm">Total Revenue Gap</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(summary.totalGap)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <TrendingDown className="h-5 w-5" />
                <span className="text-sm">Avg Collection Ratio</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {(summary.avgCollectionRatio * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">Total Affected Claims</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.totalClaims.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">Top Denial Reason</span>
              </div>
              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                {summary.topDenialReason || 'No denials'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Revenue Gap by Provider</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="providerId"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="revenueGap" fill="#EF4444" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.collectionRatio < 0.7 ? '#EF4444' : '#F87171'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Detailed Analysis</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claims
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Billed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue Gap
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Collection Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item) => (
                    <tr key={`${item.providerId}-${item.payerId}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.providerId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.payerId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.claimCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.totalBilled)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.totalPaid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatCurrency(item.revenueGap)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(item.collectionRatio * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}