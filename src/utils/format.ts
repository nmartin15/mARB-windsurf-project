export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
}

/**
 * Formats a date string into a more readable format
 * Handles various date formats including YYYY-MM-DD and YYYYMMDD
 * @param dateString The date string to format
 * @param format Optional format to use (default: 'MM/DD/YYYY')
 * @returns Formatted date string
 */
export function formatDate(dateString: string, format: string = 'MM/DD/YYYY'): string {
  if (!dateString) return '';
  
  try {
    // Handle different date formats
    let date: Date;
    
    // Check if it's a numeric format like "20230819"
    if (/^\d{8}$/.test(dateString)) {
      const year = parseInt(dateString.substring(0, 4));
      const month = parseInt(dateString.substring(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(dateString.substring(6, 8));
      date = new Date(year, month, day);
    } else {
      // Otherwise try standard parsing
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }
    
    // Format the date according to the specified format
    if (format === 'MM/DD/YYYY') {
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    } else if (format === 'YYYY-MM-DD') {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    } else {
      // Default format
      return date.toLocaleDateString();
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if there's an error
  }
}