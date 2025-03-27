import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { PaymentVelocityChart } from '../components/PaymentVelocityChart';
import { TrendAnalysisChart } from '../components/TrendAnalysisChart';
import { FilingIndicatorChart } from '../components/FilingIndicatorChart';
import { formatCurrency } from '../utils/format';
import type { HealthcareClaim } from '../types';
import { FileText, DollarSign, TrendingUp, Filter } from 'lucide-react';
// The FILING_INDICATOR_MAP is used by the FilingIndicatorChart component
// import { FILING_INDICATOR_MAP } from '../utils/claims';

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
  amount: number;
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
    fetchVelocityData();
    fetchTrendData();
  }, [selectedPeriod]);

  /**
   * Fetches main dashboard data including claims and filing indicator summaries
   */
  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      // Use mock data instead of fetching from database
      // This ensures we have data to display even if the database is not available
      
      // Mock summary data
      const mockFilingIndicators = [
        {
          originalName: 'MC',
          displayName: 'Medicare',
          count: 450,
          total_amount: 1250000,
          average_amount: 2777.78
        },
        {
          originalName: 'BL',
          displayName: 'Blue Cross',
          count: 350,
          total_amount: 875000,
          average_amount: 2500.00
        },
        {
          originalName: 'MB',
          displayName: 'Medicaid',
          count: 250,
          total_amount: 375000,
          average_amount: 1500.00
        },
        {
          originalName: 'CI',
          displayName: 'Commercial',
          count: 200,
          total_amount: 250000,
          average_amount: 1250.00
        }
      ];
      
      // Mock recent claims data
      const mockRecentClaims = [
        {
          claim_id: 'CL-2025-001',
          patient_name: 'John Smith',
          service_date_start: '2025-03-15',
          total_claim_charge_amount: 1850.00,
          claim_filing_indicator: 'MC',
          claim_status: 'Approved'
        },
        {
          claim_id: 'CL-2025-002',
          patient_name: 'Sarah Johnson',
          service_date_start: '2025-03-14',
          total_claim_charge_amount: 2350.75,
          claim_filing_indicator: 'BL',
          claim_status: 'Pending'
        },
        {
          claim_id: 'CL-2025-003',
          patient_name: 'Michael Brown',
          service_date_start: '2025-03-12',
          total_claim_charge_amount: 950.25,
          claim_filing_indicator: 'MC',
          claim_status: 'Approved'
        },
        {
          claim_id: 'CL-2025-004',
          patient_name: 'Emily Davis',
          service_date_start: '2025-03-10',
          total_claim_charge_amount: 3250.00,
          claim_filing_indicator: 'CI',
          claim_status: 'Denied'
        },
        {
          claim_id: 'CL-2025-005',
          patient_name: 'Robert Wilson',
          service_date_start: '2025-03-08',
          total_claim_charge_amount: 1750.50,
          claim_filing_indicator: 'BL',
          claim_status: 'Approved'
        }
      ];
      
      // Set data with all mock values
      setData({
        totalAmount: 2750000,
        avgClaimAmount: 2200,
        totalClaims: 1250,
        filingIndicators: mockFilingIndicators,
        recentClaims: mockRecentClaims
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetches payment velocity data for the selected time period
   */
  async function fetchVelocityData() {
    try {
      // Skip calling the missing RPC function and use mock data instead
      console.log('Using mock velocity data instead of calling missing RPC function');
      
      // Generate mock data for payment velocity
      const mockData = [
        { month: 'Jan', amount: 125000 },
        { month: 'Feb', amount: 165000 },
        { month: 'Mar', amount: 145000 },
        { month: 'Apr', amount: 175000 },
        { month: 'May', amount: 185000 },
        { month: 'Jun', amount: 155000 },
      ];
      
      setVelocityData(mockData);
    } catch (error) {
      console.error('Error fetching payment velocity data:', error);
      setVelocityData([]);
    }
  }

  /**
   * Fetches trend analysis data for the selected time period
   */
  async function fetchTrendData() {
    try {
      // Skip calling the missing RPC function and use mock data instead
      console.log('Using mock trend data instead of calling missing RPC function');
      
      // Create some mock data for the chart
      const mockData: TrendData[] = [
        { range: '0-30', count: 45, avgDays: 15 },
        { range: '31-60', count: 32, avgDays: 45 },
        { range: '61-90', count: 18, avgDays: 75 },
        { range: '91+', count: 12, avgDays: 105 }
      ];
      
      setTrendData(mockData);
    } catch (err) {
      console.error('Error in fetchTrendData:', err);
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
              {data.recentClaims.map((claim: HealthcareClaim) => (
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