/**
 * Utility formatters for Indian GST Reconciliation Platform
 */

/**
 * Formats a numeric value into Indian Rupee currency format (e.g. ₹ 1,50,000.00)
 */
export const formatINR = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '₹ 0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(val);
};

/**
 * Formats a date string into readable short date (e.g., "15 Jul 2026")
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
};
