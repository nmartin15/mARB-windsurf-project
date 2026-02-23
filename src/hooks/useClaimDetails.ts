import { useCallback, useState } from 'react';
import { supabase, safeQuery } from '../lib/supabase';

export type ClaimDetailData = {
  lines: Array<Record<string, unknown>>;
  diagnoses: Array<Record<string, unknown>>;
  dates: Array<Record<string, unknown>>;
  providers: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
};

type ClaimDetailsMap = Record<number, ClaimDetailData>;

export function useClaimDetails() {
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);
  const [detailsById, setDetailsById] = useState<ClaimDetailsMap>({});
  const [loadingClaimId, setLoadingClaimId] = useState<number | null>(null);

  const toggleClaimDetails = useCallback(
    async (claimId: number) => {
      if (expandedClaim === claimId) {
        setExpandedClaim(null);
        return;
      }

      setExpandedClaim(claimId);
      if (detailsById[claimId]) return;

      setLoadingClaimId(claimId);
      try {
        const [linesRes, dxRes, datesRes, providersRes, paymentsRes] = await Promise.all([
          safeQuery(async () => supabase.from('claim_lines').select('*').eq('claim_header_id', claimId).order('line_number')),
          safeQuery(async () => supabase.from('claim_diagnoses').select('*').eq('claim_header_id', claimId).order('sequence_number')),
          safeQuery(async () => supabase.from('claim_dates').select('*').eq('claim_header_id', claimId)),
          safeQuery(async () => supabase.from('claim_providers').select('*').eq('claim_header_id', claimId)),
          safeQuery(async () => supabase.from('claim_payments').select('*').eq('claim_header_id', claimId)),
        ]);

        setDetailsById((prev) => ({
          ...prev,
          [claimId]: {
            lines: (linesRes.data as Array<Record<string, unknown>>) || [],
            diagnoses: (dxRes.data as Array<Record<string, unknown>>) || [],
            dates: (datesRes.data as Array<Record<string, unknown>>) || [],
            providers: (providersRes.data as Array<Record<string, unknown>>) || [],
            payments: (paymentsRes.data as Array<Record<string, unknown>>) || [],
          },
        }));
      } catch (error) {
        console.error('Error loading claim details:', error);
      } finally {
        setLoadingClaimId((prev) => (prev === claimId ? null : prev));
      }
    },
    [detailsById, expandedClaim]
  );

  const claimDetail = expandedClaim != null ? detailsById[expandedClaim] ?? null : null;

  return {
    expandedClaim,
    claimDetail,
    loadingClaimId,
    toggleClaimDetails,
  };
}
