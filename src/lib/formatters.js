import { TRAY_SIZE, getLocalDate } from './api';

/**
 * Format a date string (YYYY-MM-DD) to a human-readable label.
 * Returns "Today", "Yesterday", or "Mon DD" format.
 */
export function formatDate(dateStr) {
  const today = getLocalDate();
  if (dateStr === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalDate(yesterday)) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a timestamp (from created_at) to a readable time string.
 * e.g. "11:45 PM"
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Format a delivery's quantity into a readable string.
 * e.g. "2 trays + 15 pcs" or "60 pcs"
 */
export function formatQuantity(delivery) {
  const totalEggs = delivery.quantity * (delivery.tray_size || TRAY_SIZE);
  const trays = Math.floor(totalEggs / TRAY_SIZE);
  const pieces = totalEggs % TRAY_SIZE;
  if (trays === 0) return `${pieces} pcs`;
  if (pieces === 0) return `${trays} tray${trays > 1 ? 's' : ''}`;
  return `${trays}t + ${pieces}p`;
}

/**
 * Format a date string to short "Mon DD" format (no Today/Yesterday).
 * Useful for chart x-axis labels.
 */
export function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a full date string for report headers.
 * e.g. "June 30, 2026"
 */
export function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Format a shift time string to 12-hour format.
 * e.g. "06:00" → "6:00 AM"
 */
export function formatShiftTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
