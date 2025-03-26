// Shared utility functions for claims processing

export const FILING_INDICATOR_MAP: Record<string, { display: string, matches: string[] }> = {
  'Commercial': {
    display: 'Commercial',
    matches: ['Commercial Insurance Private', 'CI', 'Commercial Insurance']
  },
  'Medicare': {
    display: 'Medicare',
    matches: ['Medicare Part A', 'MB', 'Medicare']
  },
  'Medicaid': {
    display: 'Medicaid',
    matches: ['Medicaid', 'MC']
  },
  'Workers Comp': {
    display: 'Workers Compensation',
    matches: ['Workers Compensation', 'WC']
  },
  'Other': {
    display: 'Other',
    matches: []
  }
};

export function getCategoryForIndicator(indicator: string | null): string {
  if (!indicator) return 'Other';

  // Check each category's matches
  for (const [category, config] of Object.entries(FILING_INDICATOR_MAP)) {
    if (config.matches.some(match => 
      indicator.toLowerCase().includes(match.toLowerCase())
    )) {
      return category;
    }
  }

  return 'Other';
}