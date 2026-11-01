import { format, formatDistanceToNow } from 'date-fns';

/**
 * @param {string|Date} date
 * @returns {string} e.g. "Apr 15, 2026"
 */
export const formatDate = (date) => format(new Date(date), 'MMM dd, yyyy');

/**
 * @param {string|Date} date
 * @returns {string} e.g. "Apr 15, 2026 - 14:30"
 */
export const formatDateTime = (date) =>
  format(new Date(date), 'MMM dd, yyyy - HH:mm');

/**
 * @param {string|Date} date
 * @returns {string} e.g. "Wednesday, April 15, 2026"
 */
export const formatFullDate = (date) =>
  format(new Date(date), 'EEEE, MMMM dd, yyyy');

/**
 * @param {string|Date} date
 * @returns {string} e.g. "3 days ago"
 */
export const formatTimeAgo = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

/**
 * @param {number} amount
 * @returns {string} e.g. "₹1,234.00" or "Free"
 */
export const formatCurrency = (amount) => {
  const numericAmount = Number(amount);
  if (numericAmount === 0) return 'FREE';
  if (!Number.isFinite(numericAmount)) return 'Price unavailable';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(numericAmount);
};

/**
 * @param {number} num
 * @returns {string} e.g. "1,234"
 */
export const formatNumber = (num) => num.toLocaleString('en-US');

/**
 * @param {number} current
 * @param {number} total
 * @returns {string} e.g. "75%"
 */
export const formatPercentage = (current, total) => {
  if (total === 0) return '0%';
  return `${Math.round((current / total) * 100)}%`;
};
