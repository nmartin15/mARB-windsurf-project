import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PaymentVelocityChart } from '../components/PaymentVelocityChart';
import { TrendAnalysisChart } from '../components/TrendAnalysisChart';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { getCategoryForIndicator } from '../utils/claims';
import { format, subMonths, startOfMonth, subDays, startOfYear } from 'date-fns';
import type { HealthcareClaim } from '../types';

/**
 * Summary data for each filing indicator category
 */
interface FilingIndicatorSummary {
  originalName: string;
  displayName: string;
  count: number;
  total_amount: number;
  average_amount: number;
}

/**
 * Main dashboard data structure
 */
interface DashboardData {
  totalAmount: number;
  avgClaimAmount: number;
  totalClaims: number;
  filingIndicators: FilingIndicatorSummary[];
  recentClaims: HealthcareClaim[];
}

/**
 * Data structure for payment velocity chart
 */
interface VelocityData {
  month: string;
  disputes_closed: number;
  days_to_payment: number;
}

/**
 * Data structure for trend analysis chart
 */
interface TrendData {
  range: string;
  count: number;
}

// Colors for the filing indicator chart
const GRADIENTS = [
  ['#22c55e', '#15803d'], // Green
  ['#3b82f6', '#1d4ed8'], // Blue
  ['#f59e0b', '#b45309'], // Amber
  ['#ec4899', '#be185d'], // Pink
  ['#8b5cf6', '#6d28d9'], // Purple
];

/**
 * Dashboard component - displays overview metrics, charts, and recent claims
 */
export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    totalAmount: 0,
    avgClaimAmount: 0,
    totalClaims: 0,
    filingIndicators: [],
    recentClaims: []
  });
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1M');

  useEffect(() => {
    fetchDashboardData();
    fetchVelocityData(selectedPeriod);
    fetchTrendData();
  }, [selectedPeriod]);

  /**
   * Fetches main dashboard data including claims and filing indicator summaries
   */
  async function fetchDashboardData() {
    try {
      const { data: claims, error } = await supabase
        .from('healthcare_claims')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!claims || claims.length === 0) {
        setData({
          totalAmount: 0,
          avgClaimAmount: 0,
          totalClaims: 0,
          filingIndicators: [],
          recentClaims: []
        });
        return;
      }

      // Calculate total and average amounts
      const totalAmount = claims.reduce((sum, claim) => sum + (Number(claim.total_claim_charge_amount) || 0), 0);
      const totalClaims = claims.length;
      const avgClaimAmount = totalClaims > 0 ? totalAmount / totalClaims : 0;

      // Initialize aggregation object with all possible categories
      const aggregatedGroups = initializeFilingIndicatorGroups();
      
      // Group claims by filing indicator category
      aggregateClaimsByCategory(claims, aggregatedGroups);

      // Prepare final array of filing indicators with calculated averages
      const filingIndicators = prepareFilingIndicatorSummaries(aggregatedGroups);

      setData({
        totalAmount,
        avgClaimAmount,
        totalClaims,
        filingIndicators,
        recentClaims: claims.slice(0, 5)
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Initializes filing indicator groups with zero counts
   */
  function initializeFilingIndicatorGroups() {
    const aggregatedGroups: Record<string, FilingIndicatorSummary> = {};
    
    // Import categories from utils/claims.ts
    Object.entries(FILING_INDICATOR_MAP).forEach(([key, config]) => {
      aggregatedGroups[key] = {
        originalName: key,
        displayName: config.display,
        count: 0,
        total_amount: 0,
        average_amount: 0
      };
    });
    
    return aggregatedGroups;
  }

  /**
   * Groups claims by their filing indicator category
   */
  function aggregateClaimsByCategory(claims: HealthcareClaim[], groups: Record<string, FilingIndicatorSummary>) {
    claims.forEach(claim => {
      const category = getCategoryForIndicator(claim.claim_filing_indicator_desc);
      groups[category].count++;
      groups[category].total_amount += Number(claim.total_claim_charge_amount) || 0;
    });
  }

  /**
   * Prepares filing indicator summaries with calculated averages
   */
  function prepareFilingIndicatorSummaries(groups: Record<string, FilingIndicatorSummary>) {
    return Object.values(groups)
      .map(group => ({
        ...group,
        average_amount: group.count > 0 ? group.total_amount / group.count : 0
      }))
      .filter(group => group.count > 0)
      .sort((a, b) => b.total_amount - a.total_amount);
  }

  /**
   * Fetches payment velocity data for the selected time period
   */
  async function fetchVelocityData(period: string) {
    try {
      const startDate = getStartDateForPeriod(period);

      const { data: claims, error } = await supabase
        .from('healthcare_claims')
        .select('created_at, updated_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!claims || claims.length === 0) {
        setVelocityData([]);
        return;
      }

      // Process claims data into monthly velocity metrics
      const monthlyData = processClaimsIntoMonthlyVelocity(claims);
      setVelocityData(monthlyData);
    } catch (error) {
      console.error('Error fetching velocity data:', error);
    }
  }

  /**
   * Gets the start date based on the selected period
   */
  function getStartDateForPeriod(period: string): Date {
    const now = new Date();
    
    switch (period) {
      case '1D': return subDays(now, 1);
      case '1W': return subDays(now, 7);
      case '1M': return subMonths(now, 1);
      case '3M': return subMonths(now, 3);
      case 'YTD': return startOfYear(now);
      default: return subMonths(now, 1);
    }
  }

  /**
   * Processes claims data into monthly velocity metrics
   */
  function processClaimsIntoMonthlyVelocity(claims: any[]): VelocityData[] {
    const monthlyData = claims.reduce((acc: Record<string, any>, claim) => {
      const createdDate = new Date(claim.created_at);
      const monthKey = format(createdDate, 'MMM yyyy');
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          disputes_closed: 0,
          days_to_payment: 0,
          total_claims: 0
        };
      }
      
      // Count this claim
      acc[monthKey].total_claims++;
      
      // If claim has been updated, consider it closed and calculate days to payment
      if (claim.updated_at) {
        acc[monthKey].disputes_closed++;
        
        const updatedDate = new Date(claim.updated_at);
        const daysDiff = Math.max(1, Math.round((updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
        acc[monthKey].days_to_payment += daysDiff;
      }
      
      return acc;
    }, {});
    
    // Calculate average days to payment
    return Object.values(monthlyData).map((item: any) => ({
      month: item.month,
      disputes_closed: item.disputes_closed,
      days_to_payment: item.disputes_closed > 0 ? Math.round(item.days_to_payment / item.disputes_closed) : 0
    }));
  }

  /**
   * Fetches trend analysis data for claims over time
   */
  async function fetchTrendData() {
    try {
      const { data: claims, error } = await supabase
        .from('healthcare_claims')
        .select('created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!claims || claims.length === 0) {
        setTrendData([]);
        return;
      }

      // Group claims by time periods for trend analysis
      const trendData = calculateTrendData(claims);
      setTrendData(trendData);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  }

  /**
   * Calculates trend data by grouping claims into time periods
   */
  function calculateTrendData(claims: any[]): TrendData[] {
    // Get the earliest and latest dates
    const dates = claims.map(claim => new Date(claim.created_at));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Calculate the number of months between the earliest and latest dates
    const monthDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + maxDate.getMonth() - minDate.getMonth();
    
    // Determine the appropriate grouping based on the date range
    let grouping: 'day' | 'week' | 'month' = 'month';
    if (monthDiff <= 1) {
      grouping = 'day';
    } else if (monthDiff <= 6) {
      grouping = 'week';
    }
    
    // Group the claims by the determined grouping
    const groupedData: Record<string, number> = {};
    
    claims.forEach(claim => {
      const date = new Date(claim.created_at);
      let key: string;
      
      if (grouping === 'day') {
        key = format(date, 'MMM d');
      } else if (grouping === 'week') {
        // Get the start of the week (Sunday)
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = `Week of ${format(startOfWeek, 'MMM d')}`;
      } else {
        key = format(date, 'MMM yyyy');
      }
      
      groupedData[key] = (groupedData[key] || 0) + 1;
    });
    
    // Convert to array and sort chronologically
    return Object.entries(groupedData)
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => {
        // Simple string comparison works for our format
        return a.range.localeCompare(b.range);
      });
  }

  // Render functions for dashboard components
  
  /**
   * Renders the filing indicator chart
   */
  const renderFilingIndicatorChart = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Claims by Filing Indicator</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.filingIndicators}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayName" 
              angle={-45} 
              textAnchor="end" 
              tick={{ fontSize: 12 }}
              height={60}
            />
            <YAxis />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === 'total_amount') return formatCurrency(value);
                return value;
              }}
              labelFormatter={(label) => `Category: ${label}`}
            />
            <Bar 
              dataKey="total_amount" 
              name="Total Amount" 
              radius={[4, 4, 0, 0]}
            >
              {data.filingIndicators.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#gradient-${index})`} 
                />
              ))}
            </Bar>
            {/* Define gradients for bars */}
            <defs>
              {data.filingIndicators.map((entry, index) => {
                const colorIndex = index % GRADIENTS.length;
                const [startColor, endColor] = GRADIENTS[colorIndex];
                return (
                  <linearGradient 
                    key={`gradient-${index}`} 
                    id={`gradient-${index}`} 
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={startColor} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={endColor} stopOpacity={0.8} />
                  </linearGradient>
                );
              })}
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        
        {/* Top metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard 
            title="Total Claims" 
            value={data.totalClaims.toString()} 
            icon={<FileText className="h-6 w-6 text-blue-500" />} 
            loading={loading}
          />
          <MetricCard 
            title="Total Amount" 
            value={formatCurrency(data.totalAmount)} 
            icon={<DollarSign className="h-6 w-6 text-green-500" />} 
            loading={loading}
          />
          <MetricCard 
            title="Average Claim" 
            value={formatCurrency(data.avgClaimAmount)} 
            icon={<TrendingUp className="h-6 w-6 text-purple-500" />} 
            loading={loading}
          />
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderFilingIndicatorChart()}
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Payment Velocity</h3>
              <div className="flex space-x-2">
                {['1M', '3M', 'YTD'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 py-1 text-xs rounded-full ${
                      selectedPeriod === period
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <PaymentVelocityChart data={velocityData} />
          </div>
        </div>
        
        {/* Trend Analysis */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Claims Trend Analysis</h3>
          <TrendAnalysisChart data={trendData} />
        </div>
        
        {/* Recent Claims */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Claims</h3>
          {loading ? (
            <div className="text-center py-4">Loading claims...</div>
          ) : data.recentClaims.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No claims found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Facility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.recentClaims.map((claim) => (
                    <tr 
                      key={claim.claim_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/claims/detail/${claim.claim_id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {claim.claim_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {claim.facility_type_desc || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {claim.service_date_start || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(claim.total_claim_charge_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {claim.claim_frequency_type_desc || 'Processing'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.recentClaims.length > 0 && (
            <div className="mt-4 text-right">
              <button
                onClick={() => navigate('/claims')}
                className="text-sm font-medium text-green-600 hover:text-green-500"
              >
                View all claims
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Missing imports from the original code
import { FileText, DollarSign, TrendingUp } from 'lucide-react';
import { FILING_INDICATOR_MAP } from '../utils/claims';