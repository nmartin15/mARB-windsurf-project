import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { PaymentVelocityChart } from '../components/PaymentVelocityChart';
import { TrendAnalysisChart } from '../components/TrendAnalysisChart';
import { FilingIndicatorChart } from '../components/FilingIndicatorChart';
import { formatCurrency } from '../utils/format';
import type { ClaimHeader, PaymentVelocityData, TrendData } from '../types';
import { FileText, DollarSign, TrendingUp, CheckCircle, Filter } from 'lucide-react';
import { callPaymentVelocityRpc, callTrendDataRpc, supabase, safeQuery } from '../lib/supabase';
import { getClaimStatusBadgeClass } from '../utils/claimStatus';
import { buildDashboardSummary, type DashboardSummary } from '../utils/dashboardData';

const PERIOD_OPTIONS = ['1M', '3M', '6M', '1Y', 'ALL'] as const;

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);
  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [data, setData] = useState({
    totalAmount: 0,
    avgClaimAmount: 0,
    totalClaims: 0,
    approvalRate: 0,
    filingIndicators: [],
    recentClaims: [],
  } as DashboardSummary);
  const [trendData, setTrendData] = useState([] as TrendData[]);
  const [velocityData, setVelocityData] = useState([] as PaymentVelocityData[]);
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: claimsData, error: claimsError } = await safeQuery<ClaimHeader[]>(async () =>
        await supabase
          .from('claim_headers')
          .select('*')
          .not('file_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100)
      );

      if (claimsError) throw claimsError;

      setData(buildDashboardSummary(claimsData));
    } catch (err) {
      console.error('Dashboard data error:', err);
      setError('Failed to load dashboard data. Check your database connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVelocityData = useCallback(async () => {
    try {
      const { data: result, error: err } = await safeQuery<PaymentVelocityData[]>(async () =>
        await callPaymentVelocityRpc(selectedPeriod, null)
      );
      if (err) throw err;
      setVelocityData(result && result.length > 0 ? result : []);
    } catch (err) {
      console.error('Velocity data error:', err);
      setVelocityData([]);
    }
  }, [selectedPeriod]);

  const fetchTrendData = useCallback(async () => {
    try {
      const { data: result, error: err } = await safeQuery<TrendData[]>(async () =>
        await callTrendDataRpc(selectedPeriod, null)
      );
      if (err) throw err;
      setTrendData(result && result.length > 0 ? result : []);
    } catch (err) {
      console.error('Trend data error:', err);
      setTrendData([]);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchDashboardData();
    fetchVelocityData();
    fetchTrendData();
  }, [fetchDashboardData, fetchVelocityData, fetchTrendData]);

  function handlePeriodChange(period: string) {
    setSelectedPeriod(period);
  }

  function handleClaimClick(claimId: string) {
    navigate(`/claims/${claimId}`);
  }

  const NoDataMessage = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500" role="status" aria-live="polite">
      <FileText className="h-12 w-12 mb-3" />
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1 text-gray-600">Upload EDI files to see data here</p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex border rounded overflow-x-auto">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p}
                type="button"
                className={`px-3 py-1 text-sm ${selectedPeriod === p ? 'bg-blue-500 text-white' : 'bg-white'}`}
                onClick={() => handlePeriodChange(p)}
                aria-pressed={selectedPeriod === p}
                aria-label={`Select ${p} period`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex items-center px-3 py-1 text-sm border rounded"
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
            aria-label="Toggle dashboard filters"
          >
            <Filter size={16} className="mr-1" />
            Filter
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6" role="alert">
          <p className="text-sm text-yellow-700">{error}</p>
        </div>
      )}

      {loading && (
        <div className="sr-only" role="status" aria-live="polite">
          Loading dashboard data
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          title="Total Claims"
          value={data.totalClaims.toString()}
          icon={<FileText className="h-8 w-8 text-blue-500" />}
        />
        <MetricCard
          title="Total Charges"
          value={formatCurrency(data.totalAmount)}
          icon={<DollarSign className="h-8 w-8 text-green-500" />}
        />
        <MetricCard
          title="Average Claim"
          value={formatCurrency(data.avgClaimAmount)}
          icon={<TrendingUp className="h-8 w-8 text-amber-500" />}
        />
        <MetricCard
          title="Approval Rate"
          value={data.totalClaims > 0 ? `${data.approvalRate}%` : '--'}
          icon={<CheckCircle className="h-8 w-8 text-purple-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Claims by Insurance Type</h2>
          {data.filingIndicators.length > 0
            ? <FilingIndicatorChart data={data.filingIndicators} />
            : <NoDataMessage message="No filing indicator data available" />
          }
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Velocity</h2>
          {velocityData.length > 0
            ? <PaymentVelocityChart data={velocityData} />
            : <NoDataMessage message="No payment velocity data available" />
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Claim Aging Distribution</h2>
          {trendData.length > 0
            ? <TrendAnalysisChart data={trendData} />
            : <NoDataMessage message="No trend data available" />
          }
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Claims</h2>
          {loading ? (
            <div className="flex justify-center items-center h-64" role="status" aria-live="polite" aria-label="Loading recent claims">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : data.recentClaims.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200" aria-label="Recent claims table">
                <caption className="sr-only">Most recently imported claim records</caption>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Claim ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Payer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Charge</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Paid</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.recentClaims.map((claim: ClaimHeader) => (
                    <tr
                      key={claim.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <button
                          type="button"
                          className="text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                          onClick={() => handleClaimClick(claim.claim_id)}
                          aria-label={`Open claim ${claim.claim_id}`}
                        >
                          {claim.claim_id}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {claim.payer_name || claim.payer_id || '--'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(claim.total_charge_amount || 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {claim.paid_amount != null ? formatCurrency(claim.paid_amount) : '--'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getClaimStatusBadgeClass(claim.claim_status)}`} aria-label={`Claim status ${claim.claim_status}`}>
                          {claim.claim_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoDataMessage message="No claims data yet" />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
