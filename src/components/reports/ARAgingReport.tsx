import { useState, useEffect } from 'react';
import { supabase, safeQuery } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';
import type { ARAgingRow } from '../../types/reports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function ARAgingReport() {
  const [data, setData] = useState<ARAgingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const { data: result, error } = await safeQuery<ARAgingRow[]>(async () =>
          await supabase.rpc('get_ar_aging')
        );
        if (error) throw error;
        setData(result || []);
      } catch (err) {
        console.error('AR aging error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const totalAR = data.reduce((sum, r) =>
    sum + r.amount_0_30 + r.amount_31_60 + r.amount_61_90 + r.amount_91_120 + r.amount_120_plus, 0);

  const totalCounts = data.reduce((acc, r) => ({
    c0: acc.c0 + r.count_0_30,
    c31: acc.c31 + r.count_31_60,
    c61: acc.c61 + r.count_61_90,
    c91: acc.c91 + r.count_91_120,
    c120: acc.c120 + r.count_120_plus,
  }), { c0: 0, c31: 0, c61: 0, c91: 0, c120: 0 });

  const chartData = [
    { bucket: '0-30', amount: data.reduce((s, r) => s + r.amount_0_30, 0), count: totalCounts.c0 },
    { bucket: '31-60', amount: data.reduce((s, r) => s + r.amount_31_60, 0), count: totalCounts.c31 },
    { bucket: '61-90', amount: data.reduce((s, r) => s + r.amount_61_90, 0), count: totalCounts.c61 },
    { bucket: '91-120', amount: data.reduce((s, r) => s + r.amount_91_120, 0), count: totalCounts.c91 },
    { bucket: '120+', amount: data.reduce((s, r) => s + r.amount_120_plus, 0), count: totalCounts.c120 },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {chartData.map(b => (
          <div key={b.bucket} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">{b.bucket} Days</p>
            <p className="text-lg font-semibold">{formatCurrency(b.amount)}</p>
            <p className="text-xs text-gray-400">{b.count} claims</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Total Outstanding A/R</p>
        <p className="text-2xl font-bold">{formatCurrency(totalAR)}</p>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">A/R Aging Distribution</h3>
        {chartData.some(d => d.amount > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" name="Outstanding Amount" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No A/R data available</p>
        )}
      </div>

      {/* By Payer */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-semibold p-6 pb-3">A/R by Payer</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">0-30</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">31-60</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">61-90</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">91-120</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">120+</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, i) => {
                  const total = row.amount_0_30 + row.amount_31_60 + row.amount_61_90 + row.amount_91_120 + row.amount_120_plus;
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{row.payer_name}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.amount_0_30)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.amount_31_60)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.amount_61_90)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.amount_91_120)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{formatCurrency(row.amount_120_plus)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
