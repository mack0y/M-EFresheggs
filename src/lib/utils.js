// ===== Constants =====
export const TRAY_SIZE = 30;

// ===== Local Date Helper =====
// Returns today's date in YYYY-MM-DD format using the LOCAL timezone (Asia/Manila)
export function getLocalDate(date) {
  const d = date || new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // en-CA gives YYYY-MM-DD format
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


