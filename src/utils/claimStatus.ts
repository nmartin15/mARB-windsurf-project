const CLAIM_STATUS_BADGE_CLASSES: Record<string, string> = {
  paid: 'bg-green-100 text-green-900 border border-green-200',
  accepted: 'bg-green-100 text-green-900 border border-green-200',
  denied: 'bg-red-100 text-red-900 border border-red-200',
  rejected: 'bg-red-100 text-red-900 border border-red-200',
  partial: 'bg-amber-100 text-amber-900 border border-amber-300',
  appealed: 'bg-blue-100 text-blue-900 border border-blue-200',
};

const DEFAULT_BADGE_CLASS = 'bg-gray-100 text-gray-900 border border-gray-200';

export function getClaimStatusBadgeClass(status: string | null | undefined): string {
  if (!status) return DEFAULT_BADGE_CLASS;
  return CLAIM_STATUS_BADGE_CLASSES[status] ?? DEFAULT_BADGE_CLASS;
}
