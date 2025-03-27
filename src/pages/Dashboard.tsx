import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { PaymentVelocityChart } from '../components/PaymentVelocityChart';
import { TrendAnalysisChart } from '../components/TrendAnalysisChart';
import { FilingIndicatorChart } from '../components/FilingIndicatorChart';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { getCategoryForIndicator } from '../utils/claims';
import { format, subMonths, subDays, startOfYear, parse } from 'date-fns';
import type { HealthcareClaim } from '../types';
import { FileText, DollarSign, TrendingUp, Filter } from 'lucide-react';
import { FILING_INDICATOR_MAP } from '../utils/claims';

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
type DashboardData = {
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
  avgDays?: number;
}

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
    filingIndicators: [] as FilingIndicatorSummary[],
    recentClaims: [] as HealthcareClaim[]
  });
  const [velocityData, setVelocityData] = useState<Array<VelocityData>>([]);
  const [trendData, setTrendData] = useState<Array<TrendData>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchVelocityData(selectedPeriod);
    fetchTrendData(selectedPeriod);
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
   * Fetches trend data for the selected period
   */
  const fetchTrendData = async (period: string) => {
    try {
      // Get the start date based on the selected period
      const endDate = new Date();
      let startDate = new Date();
      
      if (period === '1M') {
        startDate = subMonths(endDate, 1);
      } else if (period === '3M') {
        startDate = subMonths(endDate, 3);
      } else if (period === '6M') {
        startDate = subMonths(endDate, 6);
      } else if (period === 'YTD') {
        startDate = startOfYear(endDate);
      } else if (period === '1Y') {
        startDate = subMonths(endDate, 12);
      }
      
      // Format dates for the query
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      // Get monthly data for the trend analysis
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('healthcare_claims')
        .select('service_date_start, total_claim_charge_amount')
        .gte('service_date_start', startDateStr)
        .lte('service_date_start', endDateStr);
      
      if (monthlyError) throw monthlyError;
      
      // Process the data to get monthly counts and average days
      const monthlyStats: Record<string, { count: number, totalDays: number }> = {};
      
      monthlyData?.forEach(claim => {
        if (!claim.service_date_start) return;
        
        // Extract month and year (e.g., "Jan 2023")
        const date = new Date(claim.service_date_start);
        const monthYear = format(date, 'MMM yyyy');
        
        // Calculate days since service date
        const daysSince = Math.round((endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        
        if (!monthlyStats[monthYear]) {
          monthlyStats[monthYear] = { count: 0, totalDays: 0 };
        }
        
        monthlyStats[monthYear].count += 1;
        monthlyStats[monthYear].totalDays += daysSince;
      });
      
      // Convert to array and calculate average days
      const trendDataArray = Object.entries(monthlyStats).map(([range, stats]) => ({
        range,
        count: stats.count,
        avgDays: Math.round(stats.totalDays / stats.count)
      }));
      
      // Sort by date
      trendDataArray.sort((a, b) => {
        try {
          // Parse the month-year format correctly using date-fns
          const dateA = parse(a.range, 'MMM yyyy', new Date());
          const dateB = parse(b.range, 'MMM yyyy', new Date());
          
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return dateA.getTime() - dateB.getTime();
          }
        } catch (error) {
          console.error('Error parsing dates for sorting:', error);
        }
        
        // Fallback to string comparison
        return a.range.localeCompare(b.range);
      });
      
      console.log('Trend data after sorting:', trendDataArray);
      setTrendData(trendDataArray);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  /**
   * Handles period selection for data filtering
   */
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  /**
   * Renders the filing indicator chart section
   */
  const renderFilingIndicatorChart = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm h-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Claims by Filing Indicator</h3>
      <FilingIndicatorChart data={data.filingIndicators} />
    </div>
  );

  /**
   * Renders the payment velocity chart section
   */
  const renderPaymentVelocityChart = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm h-full">
      <PaymentVelocityChart 
        data={velocityData} 
        onPeriodChange={handlePeriodChange} 
      />
    </div>
  );

  /**
   * Renders the recent claims table
   */
  const renderRecentClaimsTable = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Claims</h3>
      {loading ? (
        <div className="text-center py-4">Loading claims...</div>
      ) : data.recentClaims.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No claims found</div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Facility
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {claim.service_date_start || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(claim.total_claim_charge_amount)}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
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
  );

  /**
   * Renders the main dashboard content
   */
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 sm:px-6 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          
          {/* Filter button for mobile */}
          <button 
            className="mt-2 sm:mt-0 flex items-center gap-1 px-3 py-1.5 bg-white border rounded-md shadow-sm text-sm text-gray-700 hover:bg-gray-50 md:hidden"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
          
          {/* Desktop filters */}
          <div className="hidden md:flex items-center gap-2">
            {['1M', '3M', 'YTD'].map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  selectedPeriod === period
                    ? 'bg-green-100 text-green-800 font-medium'
                    : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        
        {/* Mobile filters - collapsible */}
        {filterOpen && (
          <div className="bg-white p-4 rounded-lg shadow-sm md:hidden">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Filter by period</h3>
            <div className="flex flex-wrap gap-2">
              {['1D', '1W', '1M', '3M', 'YTD'].map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    handlePeriodChange(period);
                    setFilterOpen(false);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    selectedPeriod === period
                      ? 'bg-green-100 text-green-800 font-medium'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Top metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {renderFilingIndicatorChart()}
          {renderPaymentVelocityChart()}
        </div>
        
        {/* Trend Analysis */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Claims Trend Analysis</h3>
          <TrendAnalysisChart data={trendData} />
        </div>
        
        {/* Recent Claims */}
        {renderRecentClaimsTable()}
      </div>
    </DashboardLayout>
  );
}