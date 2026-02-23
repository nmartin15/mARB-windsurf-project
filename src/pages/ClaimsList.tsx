import { Fragment, useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { formatCurrency, formatDate } from '../utils/format';
import type { ClaimHeader } from '../types';
import { supabase } from '../lib/supabase';
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { getClaimStatusBadgeClass } from '../utils/claimStatus';
import { useClaimDetails } from '../hooks/useClaimDetails';
import { ClaimDetailPanel } from '../components/claims/ClaimDetailPanel';
import { buildClaimsSearchClause, getNextClaimsSortState } from '../utils/claimsList';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = ['all', 'submitted', 'accepted', 'paid', 'partial', 'denied', 'rejected', 'appealed'];
const RISK_OPTIONS = ['all', 'high', 'medium', 'low'] as const;

export function ClaimsList() {
  const [claims, setClaims] = useState<ClaimHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<(typeof RISK_OPTIONS)[number]>('all');
  const { expandedClaim, claimDetail, loadingClaimId, toggleClaimDetails } = useClaimDetails();

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('claim_headers')
        .select('*', { count: 'exact' })
        .not('file_name', 'is', null)
        .order(sortField, { ascending: sortAsc })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('claim_status', statusFilter);
      }
      if (riskFilter === 'high') {
        query = query.lt('prediction_score', 0.7);
      } else if (riskFilter === 'medium') {
        query = query.gte('prediction_score', 0.7).lt('prediction_score', 0.9);
      } else if (riskFilter === 'low') {
        query = query.gte('prediction_score', 0.9);
      }
      const searchClause = buildClaimsSearchClause(searchTerm);
      if (searchClause) {
        query = query.or(searchClause);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setClaims((data as ClaimHeader[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching claims:', err);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortAsc, statusFilter, riskFilter, searchTerm]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  function handleSort(field: string) {
    const nextSortState = getNextClaimsSortState({ sortField, sortAsc }, field);
    setSortField(nextSortState.sortField);
    setSortAsc(nextSortState.sortAsc);
    setPage(0);
  }

  function getAriaSort(field: string): 'ascending' | 'descending' | 'none' {
    if (sortField !== field) return 'none';
    return sortAsc ? 'ascending' : 'descending';
  }

  function getRiskBadge(score?: number | null) {
    if (score == null) {
      return { label: '--', className: 'bg-gray-100 text-gray-700' };
    }
    if (score < 0.7) {
      return { label: 'High', className: 'bg-red-100 text-red-800' };
    }
    if (score < 0.9) {
      return { label: 'Medium', className: 'bg-yellow-100 text-yellow-800' };
    }
    return { label: 'Low', className: 'bg-green-100 text-green-800' };
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Claims Explorer</h1>
        <span className="text-sm text-gray-500">{totalCount} claims found</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by claim ID, payer, or patient..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            aria-label="Search claims by claim ID, payer, or patient"
          />
        </div>
        <select
          className="px-3 py-2 border rounded-lg text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          aria-label="Filter claims by status"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 border rounded-lg text-sm"
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value as (typeof RISK_OPTIONS)[number]); setPage(0); }}
          aria-label="Filter claims by acceptance risk"
        >
          {RISK_OPTIONS.map(r => (
            <option key={r} value={r}>{r === 'all' ? 'All Risks' : `${r.charAt(0).toUpperCase() + r.slice(1)} Risk`}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64" role="status" aria-live="polite" aria-label="Loading claims">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500" role="status" aria-live="polite">
            <FileText className="h-12 w-12 mb-3" />
            <p className="text-sm">No claims found</p>
            <p className="text-xs mt-1 text-gray-600">Upload EDI files to populate claims data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Claims explorer table">
              <caption className="sr-only">Claims explorer with sortable columns and expandable details</caption>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('claim_id')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('claim_id')}>
                      Claim ID <SortIcon field="claim_id" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('payer_name')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('payer_name')}>
                      Payer <SortIcon field="payer_name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('claim_filing_indicator_desc')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('claim_filing_indicator_desc')}>
                      Insurance Type <SortIcon field="claim_filing_indicator_desc" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('total_charge_amount')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('total_charge_amount')}>
                      Charged <SortIcon field="total_charge_amount" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('paid_amount')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('paid_amount')}>
                      Paid <SortIcon field="paid_amount" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('claim_status')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('claim_status')}>
                      Status <SortIcon field="claim_status" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('prediction_score')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('prediction_score')}>
                      Risk <SortIcon field="prediction_score" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase" aria-sort={getAriaSort('created_at')}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" onClick={() => handleSort('created_at')}>
                      Date <SortIcon field="created_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {claims.map((claim) => (
                  <Fragment key={claim.id}>
                    {(() => {
                      const risk = getRiskBadge(claim.prediction_score);
                      return (
                    <tr
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{claim.claim_id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{claim.payer_name || claim.payer_id || '--'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{claim.claim_filing_indicator_desc || claim.claim_filing_indicator_code || '--'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(claim.total_charge_amount || 0)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{claim.paid_amount != null ? formatCurrency(claim.paid_amount) : '--'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getClaimStatusBadgeClass(claim.claim_status)}`} aria-label={`Claim status ${claim.claim_status}`}>
                          {claim.claim_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${risk.className}`} aria-label={`Prediction risk ${risk.label}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(claim.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleClaimDetails(claim.id)}
                          aria-expanded={expandedClaim === claim.id}
                          aria-controls={`claim-detail-${claim.id}`}
                          aria-label={`${expandedClaim === claim.id ? 'Collapse' : 'Expand'} details for claim ${claim.claim_id}`}
                          className="p-1 rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          {expandedClaim === claim.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                      );
                    })()}
                    {expandedClaim === claim.id && (
                      <tr id={`claim-detail-${claim.id}`}>
                        <td colSpan={9} className="px-4 py-4 bg-gray-50">
                          {loadingClaimId === claim.id ? (
                            <div className="flex items-center justify-center h-20 text-sm text-gray-600" role="status" aria-live="polite">
                              Loading claim details...
                            </div>
                          ) : claimDetail ? (
                            <ClaimDetailPanel detail={claimDetail} claim={claim} />
                          ) : (
                            <p className="text-sm text-gray-600">No detail data available.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-600">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className="p-1 border rounded disabled:opacity-30"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-700">Page {page + 1} of {totalPages}</span>
              <button
                type="button"
                className="p-1 border rounded disabled:opacity-30"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
