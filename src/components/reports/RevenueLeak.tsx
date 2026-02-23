import { useState, useEffect } from 'react';
import { Download, DollarSign, AlertCircle, TrendingDown, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { RevenueLeak as RevenueLeakType } from '../../types/reports';
import { formatCurrency } from '../../utils/format';
import ExcelJS from 'exceljs';

interface RevenueSummary {
  totalGap: number;
  avgCollectionRatio: number;
  totalClaims: number;
  topDenialReason: string;
}

export function RevenueLeak() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([] as RevenueLeakType[]);
  const [summary, setSummary] = useState({
    totalGap: 0, avgCollectionRatio: 0, totalClaims: 0, topDenialReason: '',
  } as RevenueSummary);
  const [error, setError] = useState(null as string | null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: claims, error: err } = await supabase
        .from('claim_headers')
        .select('*')
        .not('file_name', 'is', null);

      if (err) throw err;

      const revenueData: RevenueLeakType[] = (claims || [])
        .filter((c: Record<string, unknown>) => {
          const charged = Number(c.total_charge_amount) || 0;
          const paid = Number(c.paid_amount) || 0;
          const isDenied = c.claim_status === 'denied';
          const hasGap = charged > 0 && paid < charged;
          const isUnpaid = c.paid_amount === null || c.paid_amount === undefined;
          return isDenied || hasGap || isUnpaid;
        })
        .map((c: Record<string, unknown>) => {
          const charged = Number(c.total_charge_amount) || 0;
          const paid = Number(c.paid_amount) || 0;
          return {
            claimId: String(c.claim_id || c.id),
            payerId: String(c.payer_id || ''),
            payerName: String(c.payer_name || ''),
            procedureCode: '',
            serviceDate: c.created_at ? String(c.created_at) : undefined,
            claimFilingIndicator: String(c.claim_filing_indicator_desc || ''),
            claimStatus: String(c.claim_status || ''),
            totalBilled: charged,
            totalPaid: paid,
            revenueGap: charged - paid,
            collectionRatio: charged > 0 ? paid / charged : 0,
            denialReasons: c.claim_status === 'denied' ? ['Denied'] : charged > paid ? ['Underpaid'] : ['Unpaid'],
          };
        });

      setData(revenueData);

      if (revenueData.length > 0) {
        const totalGap = revenueData.reduce((s, r) => s + r.revenueGap, 0);
        const avgRatio = revenueData.reduce((s, r) => s + r.collectionRatio, 0) / revenueData.length;
        const reasonCounts: Record<string, number> = {};
        revenueData.forEach(r => r.denialReasons.forEach(dr => { reasonCounts[dr] = (reasonCounts[dr] || 0) + 1; }));
        const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        setSummary({ totalGap, avgCollectionRatio: avgRatio, totalClaims: revenueData.length, topDenialReason: topReason });
      }
    } catch (err) {
      console.error('Revenue leakage error:', err);
      setError('Failed to fetch revenue leakage data.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Revenue Leakage');

    sheet.columns = [
      { header: 'Claim ID', key: 'claimId', width: 20 },
      { header: 'Payer', key: 'payerName', width: 25 },
      { header: 'Filing Indicator', key: 'claimFilingIndicator', width: 20 },
      { header: 'Billed', key: 'totalBilled', width: 15 },
      { header: 'Paid', key: 'totalPaid', width: 15 },
      { header: 'Revenue Gap', key: 'revenueGap', width: 15 },
      { header: 'Collection %', key: 'collectionRatio', width: 15 },
      { header: 'Issue', key: 'issue', width: 20 },
    ];

    data.forEach((row: RevenueLeakType) => {
      sheet.addRow({
        ...row,
        collectionRatio: Math.round(row.collectionRatio * 100) + '%',
        issue: row.denialReasons.join(', '),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue_leakage_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-xs text-gray-500">Total Revenue Gap</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalGap)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-amber-500 mr-3" />
            <div>
              <p className="text-xs text-gray-500">Avg Collection Ratio</p>
              <p className="text-xl font-bold">{Math.round(summary.avgCollectionRatio * 100)}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-xs text-gray-500">Affected Claims</p>
              <p className="text-xl font-bold">{summary.totalClaims}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <p className="text-xs text-gray-500">Top Issue</p>
              <p className="text-xl font-bold">{summary.topDenialReason}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export button */}
      {data.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </button>
        </div>
      )}

      {/* Claims table */}
      {data.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Billed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gap</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Collection %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row: RevenueLeakType, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{row.claimId}</td>
                    <td className="px-4 py-3 text-sm">{row.payerName || '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{row.claimFilingIndicator || '--'}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.totalBilled)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.totalPaid)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{formatCurrency(row.revenueGap)}</td>
                    <td className="px-4 py-3 text-sm text-right">{Math.round(row.collectionRatio * 100)}%</td>
                    <td className="px-4 py-3 text-sm">
                      {row.denialReasons.map((r: string, j: number) => (
                        <span key={j} className="inline-block px-2 py-0.5 mr-1 text-xs rounded-full bg-red-100 text-red-700">{r}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3" />
          <p>No revenue leakage detected</p>
          <p className="text-xs mt-1">Upload and process EDI files to analyze revenue leakage</p>
        </div>
      )}
    </div>
  );
}

export { RevenueLeak as RevenueLeakReport };
