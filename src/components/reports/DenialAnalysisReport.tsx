import { useState, useEffect } from 'react';
import { supabase, safeQuery } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';
import type { DenialSummaryRow } from '../../types/reports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DenialAnalysisReport() {
  const [data, setData] = useState<DenialSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6M');

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const { data: result, error } = await safeQuery<DenialSummaryRow[]>(async () =>
          await supabase.rpc('get_denial_summary', { p_period: period })
        );
        if (error) throw error;
        setData(result || []);
      } catch (err) {
        console.error('Denial analysis error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [period]);

  // Aggregate by CARC code
  const byCarcMap: Record<string, { code: string; desc: string; count: number; amount: number }> = {};
  data.forEach(r => {
    if (!byCarcMap[r.carc_code]) {
      byCarcMap[r.carc_code] = { code: r.carc_code, desc: r.carc_description, count: 0, amount: 0 };
    }
    byCarcMap[r.carc_code].count += r.denial_count;
    byCarcMap[r.carc_code].amount += r.total_denied_amount;
  });
  const byCarc = Object.values(byCarcMap).sort((a, b) => b.count - a.count).slice(0, 15);

  // Aggregate by payer
  const byPayerMap: Record<string, { name: string; count: number; amount: number }> = {};
  data.forEach(r => {
    const key = r.payer_id || 'Unknown';
    if (!byPayerMap[key]) {
      byPayerMap[key] = { name: r.payer_name, count: 0, amount: 0 };
    }
    byPayerMap[key].count += r.denial_count;
    byPayerMap[key].amount += r.total_denied_amount;
  });
  const byPayer = Object.values(byPayerMap).sort((a, b) => b.count - a.count);

  const totalDenials = data.reduce((s, r) => s + r.denial_count, 0);
  const totalDeniedAmt = data.reduce((s, r) => s + r.total_denied_amount, 0);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Denials</p>
          <p className="text-2xl font-bold text-red-600">{totalDenials}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Denied Amount</p>
          <p className="text-2xl font-bold">{formatCurrency(totalDeniedAmt)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Unique CARC Codes</p>
          <p className="text-2xl font-bold">{byCarc.length}</p>
        </div>
      </div>

      {/* Top CARC chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Top Denial Reason Codes (CARC)</h3>
        {byCarc.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byCarc.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="code" type="category" width={60} />
              <Tooltip
                formatter={(value: number, name: string) => name === 'count' ? value : formatCurrency(value)}
                labelFormatter={(label) => {
                  const item = byCarc.find(c => c.code === label);
                  return item ? `${item.code}: ${item.desc}` : label;
                }}
              />
              <Bar dataKey="count" name="Denial Count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No denial data available. Process 835 files to see denial codes.</p>
        )}
      </div>

      {/* CARC detail table */}
      {byCarc.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-semibold p-6 pb-3">Denial Reason Codes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CARC Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byCarc.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{row.code}</td>
                    <td className="px-4 py-3 text-sm">{row.desc || '--'}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.count}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Denials by Payer */}
      {byPayer.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-semibold p-6 pb-3">Denials by Payer</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Denials</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Denied Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byPayer.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.count}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{formatCurrency(row.amount)}</td>
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
