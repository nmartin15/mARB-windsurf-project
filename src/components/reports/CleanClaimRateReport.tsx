import { useState, useEffect } from 'react';
import { supabase, safeQuery } from '../../lib/supabase';
import type { CleanClaimRateRow } from '../../types/reports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';

export function CleanClaimRateReport() {
  const [data, setData] = useState<CleanClaimRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6M');

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const { data: result, error } = await safeQuery<CleanClaimRateRow[]>(async () =>
          await supabase.rpc('get_clean_claim_rate', { p_period: period })
        );
        if (error) throw error;
        setData(result || []);
      } catch (err) {
        console.error('Clean claim rate error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [period]);

  const overallTotal = data.reduce((s, r) => s + r.total_claims, 0);
  const overallClean = data.reduce((s, r) => s + r.clean_claims, 0);
  const overallRate = overallTotal > 0 ? Math.round((overallClean / overallTotal) * 1000) / 10 : 0;
  const overallDenied = data.reduce((s, r) => s + r.denied_claims, 0);
  const overallRejected = data.reduce((s, r) => s + r.rejected_claims, 0);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-500">Period:</span>
        {['3M', '6M', '1Y', 'ALL'].map(p => (
          <button
            key={p}
            className={`px-3 py-1 text-sm rounded ${period === p ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            onClick={() => setPeriod(p)}
          >{p}</button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Overall Clean Claim Rate</p>
          <p className={`text-3xl font-bold ${overallRate >= 95 ? 'text-green-600' : overallRate >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
            {overallRate}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Industry target: 95%+</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Claims</p>
          <p className="text-2xl font-bold">{overallTotal}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Denied</p>
          <p className="text-2xl font-bold text-red-600">{overallDenied}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-amber-600">{overallRejected}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Clean Claim Rate Over Time</h3>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period_label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="total_claims" name="Total Claims" fill="#93c5fd" />
              <Bar yAxisId="left" dataKey="clean_claims" name="Clean Claims" fill="#10b981" />
              <Line yAxisId="right" type="monotone" dataKey="clean_claim_rate" name="Clean Rate %" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No clean claim rate data available</p>
        )}
      </div>

      {/* Monthly detail table */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-semibold p-6 pb-3">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clean</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Denied</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{row.period_label}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.total_claims}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">{row.clean_claims}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-medium ${row.clean_claim_rate >= 95 ? 'text-green-600' : row.clean_claim_rate >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
                        {row.clean_claim_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{row.denied_claims}</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-600">{row.rejected_claims}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
