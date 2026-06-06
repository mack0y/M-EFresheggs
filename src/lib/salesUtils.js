import { TRAY_SIZE, getEggCount, formatInventory, formatPeso, getLocalDate } from './api';

export function calculateSaleTotal(quantity, unit, traySize, priceSettings, eggSizeId) {
  if (!quantity || !eggSizeId) return null;
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) return null;
  const price = priceSettings.find(p => p.egg_size_id === parseInt(eggSizeId, 10));
  if (!price) return null;
  const perUnitPrice = unit === 'tray'
    ? parseFloat(price.price_per_tray || 0)
    : parseFloat(price.price_per_piece || 0);
  const total = qty * perUnitPrice;
  return total > 0 ? total : null;
}

export function validateStock(inventory, eggSizeId, quantity, unit, traySize) {
  if (!eggSizeId || !quantity) return { valid: true };
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) return { valid: false, message: 'Enter a valid quantity' };
  const traySz = unit === 'tray' ? parseInt(traySize, 10) || TRAY_SIZE : 1;
  const totalEggs = unit === 'tray' ? qty * traySz : qty;
  const invItem = inventory.find(i => i.egg_size_id === parseInt(eggSizeId, 10));
  const stock = invItem?.quantity_on_hand || 0;
  if (totalEggs > stock) {
    return { valid: false, message: `Not enough stock — only ${stock} eggs available`, stock, totalEggs };
  }
  return { valid: true };
}

export function formatSaleForDisplay(sale) {
  const eggCount = getEggCount(sale);
  return {
    id: sale.id,
    sizeName: sale.egg_sizes?.name || 'Unknown',
    quantity: sale.quantity,
    unit: sale.unit,
    traySize: sale.tray_size || TRAY_SIZE,
    eggCount,
    eggBreakdown: formatInventory(eggCount),
    amount: parseFloat(sale.total_amount || 0),
    amountFormatted: formatPeso(sale.total_amount),
    date: sale.sale_date,
    time: sale.sale_time?.slice(0, 5),
    createdAt: sale.created_at,
  };
}

export function groupSalesByDate(sales, today) {
  const groups = {};
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterday);

  sales.forEach(sale => {
    const date = sale.sale_date;
    let label = date;
    if (date === today) label = 'Today';
    else if (date === yesterdayStr) label = 'Yesterday';
    else {
      const d = new Date(date + 'T00:00:00');
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (!groups[label]) groups[label] = { label, date, sales: [] };
    groups[label].sales.push(formatSaleForDisplay(sale));
  });

  const sortedLabels = Object.keys(groups).sort((a, b) => {
    const dateA = groups[a].date;
    const dateB = groups[b].date;
    return dateB.localeCompare(dateA);
  });

  return sortedLabels.map(label => groups[label]);
}

export function getPeriodPresets(today) {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterday);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = getLocalDate(weekStart);

  const monthStart = new Date(today);
  monthStart.setDate(1);
  const monthStartStr = getLocalDate(monthStart);

  return [
    { key: 'today', label: 'Today', startDate: today, endDate: today },
    { key: 'yesterday', label: 'Yesterday', startDate: yesterdayStr, endDate: yesterdayStr },
    { key: 'week', label: 'This Week', startDate: weekStartStr, endDate: today },
    { key: 'month', label: 'This Month', startDate: monthStartStr, endDate: today },
    { key: 'custom', label: 'Custom', startDate: today, endDate: today },
  ];
}

export const QUICK_QTY_CHIPS = {
  piece: [1, 5, 10, 30],
  tray: [1, 2, 5, 10],
};