// ===== Constants =====
export const TRAY_SIZE = 30;

// ===== Local Date Helper =====
// Returns today's date in YYYY-MM-DD format using the LOCAL timezone (Asia/Manila)
export function getLocalDate(date) {
  const d = date || new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // en-CA gives YYYY-MM-DD format
}

// ===== Environment =====
export function isProduction() {
  return typeof window !== 'undefined' && window.location?.hostname?.includes('localhost') ? false : true;
}

// ===== Egg Count Helpers =====

/** Convert a sale record to total egg count */
export function getEggCount(sale) {
  if (sale.unit === 'tray') return sale.quantity * (sale.tray_size || 30);
  return sale.quantity;
}

/** Convert total eggs to { trays, pieces } */
export function toTraysAndPieces(totalEggs) {
  const trays = Math.floor(totalEggs / TRAY_SIZE);
  const pieces = totalEggs % TRAY_SIZE;
  return { trays, pieces };
}

/** Format total eggs as a readable string, e.g. "2 trays + 22 pcs" */
export function formatInventory(totalEggs) {
  const { trays, pieces } = toTraysAndPieces(totalEggs);
  if (trays === 0) return `${pieces} pcs`;
  if (pieces === 0) return `${trays} tray${trays > 1 ? 's' : ''}`;
  return `${trays} tray${trays > 1 ? 's' : ''} + ${pieces} pcs`;
}

// ===== Currency =====

/** Format a peso amount */
export function formatPeso(amount) {
  return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ===== Period Ranges =====

/** Period presets shared by Profits and Dashboard views */
export const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

/** Compute { startDate, endDate } (YYYY-MM-DD, Asia/Manila) for a period key.
 *  Also returns prevEndDate/prevDateCount for period-over-period baselines. */
export function getPeriodRange(period) {
  const now = new Date();
  const end = getLocalDate(now);

  if (period === 'today') {
    return { startDate: end, endDate: end };
  }

  if (period === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    return { startDate: getLocalDate(d), endDate: end };
  }

  if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: getLocalDate(d), endDate: end };
  }

  return { startDate: end, endDate: end };
}


