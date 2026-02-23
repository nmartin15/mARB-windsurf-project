import { useState, useEffect } from 'react';
import { supabase, safeQuery } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';
import type { PayerPerformanceRow } from '../../types/reports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function PayerPerformanceReport() {
  const [data, setData] = useState<PayerPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6M');

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const { data: result, error } = await safeQuery<PayerPerformanceRow[]>(async () =>
          await supabase.rpc('get_payer_performance', { p_period: period })
        );
        if (error) throw error;
        setData(result || []);
      } catch (err) {
        console.error('Payer performance error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [period]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  const chartData = data.slice(0, 10).map(r => ({
    name: r.payer_name.length > 20 ? r.payer_name.slice(0, 20) + '...' : r.payer_name,
    charged: r.total_charged,
    paid: r.total_paid,
    reimbursement: Math.round(r.reimbursement_rate * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-500">Period:</span>
        {['1M', '3M', '6M', '1Y', 'ALL'].map(p => (
          <button
            key={p}
            className={`px-3 py-1 text-sm rounded ${period === p ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            onClick={() => setPeriod(p)}
          >{p}</button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Charged vs Paid by Payer</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="charged" name="Total Charged" fill="#93c5fd" />
              <Bar dataKey="paid" name="Total Paid" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No payer performance data available</p>
        )}
      </div>

      {/* Detail table */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-semibold p-6 pb-3">Payer Metrics</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Claims</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Charged</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Days to Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Denial Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reimbursement %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{row.payer_name}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.total_claims}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.total_charged)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.total_paid)}</td>
                    <td className="px-4 py-3 text-sm text-right">{Math.round(row.avg_days_to_payment)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={row.denial_rate > 10 ? 'text-red-600 font-medium' : ''}>
                        {Math.round(row.denial_rate * 10) / 10}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={row.reimbursement_rate < 80 ? 'text-amber-600 font-medium' : 'text-green-600'}>
                        {Math.round(row.reimbursement_rate * 10) / 10}%
                      </span>
                    </td>
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
