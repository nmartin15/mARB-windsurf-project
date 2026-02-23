export type ClaimsSortState = {
  sortField: string;
  sortAsc: boolean;
};

export function getNextClaimsSortState(current: ClaimsSortState, nextField: string): ClaimsSortState {
  if (current.sortField === nextField) {
    return {
      sortField: current.sortField,
      sortAsc: !current.sortAsc,
    };
  }

  return {
    sortField: nextField,
    sortAsc: true,
  };
}

export function buildClaimsSearchClause(searchTerm: string): string | null {
  const term = searchTerm.trim();
  if (!term) return null;
  return `claim_id.ilike.%${term}%,payer_name.ilike.%${term}%,patient_id.ilike.%${term}%`;
}
