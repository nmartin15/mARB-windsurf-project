import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { DataTable } from '../components/DataTable';
import { ClaimDetails } from '../components/ClaimDetails';
import { ClaimChat } from '../components/ClaimChat';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { FILING_INDICATOR_MAP } from '../utils/claims';
import { format } from 'date-fns';
import { DollarSign, FileText } from 'lucide-react';
import type { HealthcareClaim } from '../types';

const columns = [
  {
    header: 'Claim ID',
    accessorKey: 'claim_id',
  },
  {
    header: 'Facility',
    accessorKey: 'facility_type_desc',
  },
  {
    header: 'Service Start',
    accessorKey: 'service_date_start',
  },
  {
    header: 'Service End',
    accessorKey: 'service_date_end',
  },
  {
    header: 'Total Charge',
    accessorKey: 'total_claim_charge_amount',
    cell: (info: any) => formatCurrency(info.getValue()),
  },
  {
    header: 'Status',
    accessorKey: 'claim_frequency_type_desc',
    cell: (info: any) => (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        {info.getValue() || 'Processing'}
      </span>
    ),
  },
  {
    header: 'Filing Indicator',
    accessorKey: 'claim_filing_indicator_desc',
    cell: (info: any) => (
      <span className="text-sm text-gray-600">
        {info.getValue() || 'Not specified'}
      </span>
    ),
  },
];

interface ClaimsSummary {
  totalAmount: number;
  totalClaims: number;
  averageAmount: number;
}

export function ClaimsList() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<HealthcareClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<HealthcareClaim | null>(null);
  const [summary, setSummary] = useState<ClaimsSummary>({
    totalAmount: 0,
    totalClaims: 0,
    averageAmount: 0
  });

  useEffect(() => {
    async function fetchClaims() {
      try {
        let query = supabase.from('healthcare_claims').select('*');

        // Handle different view types
        if (location.pathname.includes('/claims/detail/')) {
          query = query.eq('claim_id', id);
        } else if (type === 'filing-indicator' && id) {
          const category = decodeURIComponent(id);
          const config = FILING_INDICATOR_MAP[category];

          if (config) {
            if (category === 'Other') {
              // For "Other" category, exclude all known categories
              const allKnownMatches = Object.values(FILING_INDICATOR_MAP)
                .filter(c => c.display !== 'Other')
                .flatMap(c => c.matches);
              query = query.not('claim_filing_indicator_desc', 'in', `(${allKnownMatches.map(d => `'${d}'`).join(',')})`);
            } else {
              // For specific categories, match any of the configured values
              const orCondition = config.matches
                .map(match => `claim_filing_indicator_desc.ilike.%${match}%`)
                .join(',');
              query = query.or(orCondition);
            }
          }
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const claims = data || [];
        setClaims(claims);

        // Calculate summary
        const totalAmount = claims.reduce((sum, claim) => sum + (Number(claim.total_claim_charge_amount) || 0), 0);
        setSummary({
          totalAmount,
          totalClaims: claims.length,
          averageAmount: claims.length > 0 ? totalAmount / claims.length : 0
        });

        // If this is a detail view, set the selected claim
        if (location.pathname.includes('/claims/detail/') && claims.length > 0) {
          setSelectedClaim(claims[0]);
        }
      } catch (error) {
        console.error('Error fetching claims:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchClaims();
  }, [type, id, location.pathname]);

  const handleRowClick = (claim: HealthcareClaim) => {
    navigate(`/claims/detail/${claim.claim_id}`);
  };

  const getTitle = () => {
    if (location.pathname.includes('/claims/detail/')) {
      return `Claim Details - ${id}`;
    }
    if (type === 'filing-indicator') {
      const category = decodeURIComponent(id);
      const config = FILING_INDICATOR_MAP[category];
      return `Claims - ${config?.display || category}`;
    }
    return 'Healthcare Claims';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {selectedClaim ? (
          <>
            <ClaimDetails claim={selectedClaim} />
            <ClaimChat
              claimId={selectedClaim.claim_id}
              claimAmount={selectedClaim.total_claim_charge_amount}
            />
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {getTitle()}
              </h2>
              {type === 'filing-indicator' && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <FileText className="h-4 w-4" />
                      <span>Total Claims</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {summary.totalClaims}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Total Amount</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(summary.totalAmount)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Average Amount</span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(summary.averageAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-4">Loading claims...</div>
              ) : claims.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No claims found for this category
                </div>
              ) : (
                <DataTable
                  data={claims}
                  columns={columns}
                  onRowClick={handleRowClick}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}