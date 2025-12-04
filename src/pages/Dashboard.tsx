import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PaymentVelocityChart } from '../components/PaymentVelocityChart';
import { TrendAnalysisChart } from '../components/TrendAnalysisChart';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { format, subMonths, subDays, startOfYear } from 'date-fns';
import type { HealthcareClaim } from '../types';

interface FilingIndicatorSummary {
  originalName: string;
  displayName: string;
  count: number;
  total_amount: number;
  average_amount: number;
}

interface DashboardData {
  totalAmount: number;
  avgClaimAmount: number;
  totalClaims: number;
  filingIndicators: FilingIndicatorSummary[];
  recentClaims: HealthcareClaim[];
}

interface VelocityData {
  month: string;
  disputes_closed: number;
  days_to_payment: number;
}

interface TrendData {
  range: string;
  count: number;
}

// Define filing indicator mappings - MUST match the mapping in ClaimsList.tsx
export const FILING_INDICATOR_MAP: Record<string, { display: string, matches: string[] }> = {
  'Commercial': {
    display: 'Commercial',
    matches: ['Commercial Insurance Private', 'CI', 'Commercial Insurance']
  },
  'Medicare': {
    display: 'Medicare',
    matches: ['Medicare Part A', 'MB', 'Medicare']
  },
  'Medicaid': {
    display: 'Medicaid',
    matches: ['Medicaid', 'MC']
  },
  'Workers Comp': {
    display: 'Workers Compensation',
    matches: ['Workers Compensation', 'WC']
  },
  'Other': {
    display: 'Other',
    matches: []
  }
};

const GRADIENTS = [
  ['#22c55e', '#15803d'], // Green
  ['#3b82f6', '#1d4ed8'], // Blue
  ['#f59e0b', '#b45309'], // Amber
  ['#ec4899', '#be185d'], // Pink
  ['#8b5cf6', '#6d28d9'], // Purple
];

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

  const getCategoryForIndicator = (indicator: string | null): string => {
    if (!indicator) return 'Other';

    // Check each category's matches
    for (const [category, config] of Object.entries(FILING_INDICATOR_MAP)) {
      if (config.matches.some(match =>
        indicator.toLowerCase().includes(match.toLowerCase())
      )) {
        return category;
      }
    }

    return 'Other';
  };

  async function fetchDashboardData() {
    try {
      const { data: claims, error } = await supabase
        .from('healthcare_claims')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!claims) {
        throw new Error('No claims data returned');
      }

      const totalAmount = claims.reduce((sum, claim) => sum + (Number(claim.total_claim_charge_amount) || 0), 0);
      const totalClaims = claims.length;
      const avgClaimAmount = totalAmount / totalClaims;

      // Initialize aggregation object
      const aggregatedGroups: Record<string, FilingIndicatorSummary> = {};

      // Initialize all categories
      Object.entries(FILING_INDICATOR_MAP).forEach(([key, config]) => {
        aggregatedGroups[key] = {
          originalName: key,
          displayName: config.display,
          count: 0,
          total_amount: 0,
          average_amount: 0
        };
      });

      // Aggregate claims into categories
      claims.forEach(claim => {
        const category = getCategoryForIndicator(claim.claim_filing_indicator_desc);
        aggregatedGroups[category].count++;
        aggregatedGroups[category].total_amount += Number(claim.total_claim_charge_amount) || 0;
      });

      // Calculate averages and prepare final array
      const filingIndicators = Object.values(aggregatedGroups)
        .map(group => ({
          ...group,
          average_amount: group.count > 0 ? group.total_amount / group.count : 0
        }))
        .filter(group => group.count > 0)
        .sort((a, b) => b.total_amount - a.total_amount);

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

  async function fetchVelocityData(period: string) {
    try {
      let startDate;
      const now = new Date();

      switch (period) {
        case '1D':
          startDate = subDays(now, 1);
          break;
        case '1W':
          startDate = subDays(now, 7);
          break;
        case '1M':
          startDate = subMonths(now, 1);
          break;
        case '3M':
          startDate = subMonths(now, 3);
          break;
        case 'YTD':
          startDate = startOfYear(now);
          break;
        default:
          startDate = subMonths(now, 1);
      }

      const { data: claims, error } = await supabase
        .from('healthcare_claims')
        .select('created_at, updated_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const monthlyData = claims.reduce((acc: Record<string, any>, claim) => {
        const month = format(new Date(claim.created_at), 'MMM yyyy');
        if (!acc[month]) {
          acc[month] = {
            disputes_closed: 0,
            total_days: 0,
            total_claims: 0
          };
        }

        // Calculate days between creation and update
        const createdDate = new Date(claim.created_at);
        const updatedDate = new Date(claim.updated_at);
        const daysDiff = Math.ceil((updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        acc[month].disputes_closed++;
        acc[month].total_days += daysDiff;
        acc[month].total_claims++;

        return acc;
      }, {});

      const velocityData = Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
        month,
        disputes_closed: data.disputes_closed,
        days_to_payment: data.total_claims > 0 ? data.total_days / data.total_claims : 0
      }));

      setVelocityData(velocityData);
    } catch (error) {
      console.error('Error fetching velocity data:', error);
    }
  }

  async function fetchTrendData() {
    try {
      const { data: claims, error } = await supabase
        .from('healthcare_claims')
        .select('created_at, hospital_payment_date, claim_status')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('fetchTrendData: Supabase error:', error);
        throw error;
      }

      if (!claims || claims.length === 0) {
        setTrendData([
          { range: '0-30', count: 0 },
          { range: '31-60', count: 0 },
          { range: '61-90', count: 0 },
          { range: '90+', count: 0 }
        ]);
        return;
      }

      const ranges = ['0-30', '31-60', '61-90', '90+'];
      const trendData = ranges.map(range => {
        const [min, max] = range.split('-').map(Number);
        const count = claims.filter(claim => {
          // For paid claims, use payment date as end date
          // For unpaid claims, use current date as end date
          const endDate = claim.hospital_payment_date
            ? new Date(claim.hospital_payment_date)
            : new Date();
          const startDate = new Date(claim.created_at);
          const daysOld = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

          return max ? (daysOld >= min && daysOld <= max) : daysOld > min;
        }).length;
        return { range, count };
      });

      setTrendData(trendData);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  }

  const handleFilingIndicatorClick = (entry: any) => {
    if (entry && entry.originalName) {
      navigate(`/claims/filing-indicator/${encodeURIComponent(entry.originalName)}`);
    }
  };

  const handleRecentClaimClick = (claimId: string) => {
    navigate(`/claims/detail/${claimId}`);
  };

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Total Claims Value"
          value={formatCurrency(data.totalAmount)}
          subtitle={`${data.totalClaims} total claims`}
          type="receivables"
        />
        <MetricCard
          title="Average Claim Amount"
          value={formatCurrency(data.avgClaimAmount)}
          type="paid"
        />
        <MetricCard
          title="Total Claims"
          value={data.totalClaims.toString()}
          type="negotiation"
        />
        <MetricCard
          title="Filing Indicators"
          value={data.filingIndicators.length.toString()}
          type="unpaid"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Claims by Filing Indicator</h2>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.filingIndicators}
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                onClick={(data) => data && handleFilingIndicatorClick(data.payload)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="displayName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar
                  dataKey="total_amount"
                  name="Total Amount"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                >
                  {data.filingIndicators.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#colorGradient${index})`}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
                <defs>
                  {GRADIENTS.map((gradient, index) => (
                    <linearGradient
                      key={`gradient-${index}`}
                      id={`colorGradient${index}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={gradient[0]} stopOpacity={1} />
                      <stop offset="100%" stopColor={gradient[1]} stopOpacity={0.8} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribution Analysis</h3>
          <div className="space-y-6">
            {data.filingIndicators.map((indicator, index) => (
              <div
                key={indicator.originalName}
                className="group cursor-pointer"
                onClick={() => handleFilingIndicatorClick(indicator)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    {indicator.displayName}
                  </span>
                  <span className="text-sm font-bold" style={{ color: GRADIENTS[index][0] }}>
                    {((indicator.count / data.totalClaims) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{indicator.count} claims</span>
                    <span>{formatCurrency(indicator.average_amount)} avg</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                      style={{
                        width: `${(indicator.count / data.totalClaims) * 100}%`,
                        background: `linear-gradient(to right, ${GRADIENTS[index][0]}, ${GRADIENTS[index][1]})`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Claims</h2>
          <div className="space-y-4">
            {data.recentClaims.map((claim) => (
              <div
                key={claim.id}
                className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                onClick={() => handleRecentClaimClick(claim.claim_id)}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    Claim #{claim.claim_id}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {claim.claim_filing_indicator_desc || 'No Filing Indicator'}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">
                    {claim.service_date_start}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-bold text-gray-900">
                    {formatCurrency(claim.total_claim_charge_amount)}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <PaymentVelocityChart
            data={velocityData}
            onPeriodChange={(period) => setSelectedPeriod(period)}
          />
        </div>
      </div>

      <div className="mt-8">
        <TrendAnalysisChart data={trendData} />
      </div>
    </DashboardLayout>
  );
}