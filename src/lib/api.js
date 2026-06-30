import { supabase } from '../lib/supabaseClient';

// ===== Local Date Helper =====
// Returns today's date in YYYY-MM-DD format using the user's LOCAL timezone
// (not UTC, which is what toISOString() would give)
export function getLocalDate(date) {
  const d = date || new Date();
  return d.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
}

// ===== Egg Sizes =====
export const EGG_SIZES = [
  'Peewee',
  'Pullet',
  'Small',
  'Medium',
  'Large',
  'Extra Large',
  'Jumbo',
];

export async function fetchEggSizes() {
  const { data, error } = await supabase
    .from('egg_sizes')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ===== Inventory =====
export async function fetchInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, egg_sizes(name, sort_order)');
  if (error) throw error;
  return data;
}

export async function updateInventory(eggSizeId, quantity) {
  const { data, error } = await supabase
    .from('inventory')
    .update({ quantity_on_hand: quantity, updated_at: new Date().toISOString() })
    .eq('egg_size_id', eggSizeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== Price Settings =====

export async function fetchPriceSettings() {
  const { data, error } = await supabase
    .from('price_settings')
    .select('*, egg_sizes(name, sort_order)');
  if (error) throw error;
  return data;
}

export async function updatePriceSetting(eggSizeId, pricePerPiece, pricePerTray) {
  const { data, error } = await supabase
    .from('price_settings')
    .upsert({
      egg_size_id: eggSizeId,
      price_per_piece: pricePerPiece,
      price_per_tray: pricePerTray,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'egg_size_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== Sales =====
export async function recordSale({ eggSizeId, quantity, unit, traySize }) {
  const today = new Date();
  const dateStr = getLocalDate(today);
  const timeStr = today.toTimeString().split(' ')[0];

  // Fetch current price to calculate total amount
  const { data: priceData } = await supabase
    .from('price_settings')
    .select('price_per_piece, price_per_tray')
    .eq('egg_size_id', eggSizeId)
    .single();

  let totalAmount = 0;
  if (priceData) {
    if (unit === 'tray') {
      totalAmount = quantity * parseFloat(priceData.price_per_tray || 0);
    } else {
      totalAmount = quantity * parseFloat(priceData.price_per_piece || 0);
    }
  }

  const { data, error } = await supabase
    .from('sales')
    .insert({
      egg_size_id: eggSizeId,
      quantity,
      unit,
      tray_size: unit === 'tray' ? traySize : null,
      total_amount: totalAmount,
      sale_date: dateStr,
      sale_time: timeStr,
    })
    .select('*, egg_sizes(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSales({ limit = 50, offset = 0, startDate, endDate } = {}) {
  let query = supabase
    .from('sales')
    .select('*, egg_sizes(name)')
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function fetchTodaySales() {
  const today = getLocalDate();
  const { data, error } = await supabase
    .from('sales')
    .select('*, egg_sizes(name)')
    .eq('sale_date', today)
    .order('sale_time', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteSale(id) {
  // Fetch the sale first so we can restore inventory
  const { data: sale, error: fetchErr } = await supabase
    .from('sales')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr) throw fetchErr;
  if (!sale) throw new Error('Sale not found');

  // Delete the sale record first (safe — no trigger on DELETE)
  const { error: delErr } = await supabase
    .from('sales')
    .delete()
    .eq('id', id);
  if (delErr) throw delErr;

  // Calculate egg count to restore
  const eggCount = sale.unit === 'tray'
    ? sale.quantity * (sale.tray_size || TRAY_SIZE)
    : sale.quantity;

  // Fetch current inventory quantity
  const { data: invItem, error: invFetchErr } = await supabase
    .from('inventory')
    .select('quantity_on_hand')
    .eq('egg_size_id', sale.egg_size_id)
    .single();
  if (invFetchErr) throw invFetchErr;

  // Restore inventory by adding back the egg count
  const newQty = (invItem?.quantity_on_hand || 0) + eggCount;
  const { error: updateErr } = await supabase
    .from('inventory')
    .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
    .eq('egg_size_id', sale.egg_size_id);
  if (updateErr) throw updateErr;

  return sale;
}

// ===== Analytics =====
export async function fetchSalesBySize(startDate, endDate) {
  let query = supabase
    .from('sales')
    .select('*, egg_sizes(name, sort_order)');

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const { data, error } = await query.order('sale_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchSalesByHour(startDate, endDate) {
  let query = supabase
    .from('sales')
    .select('sale_time, quantity, unit, tray_size');

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchSalesTrend(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('sales')
    .select('sale_date, quantity, unit, tray_size')
    .gte('sale_date', getLocalDate(startDate))
    .order('sale_date', { ascending: true });
  if (error) throw error;
  return data;
}

// ===== Reports =====

/**
 * Fetch sales within a date and time range, joined with egg size info.
 * Used for generating shift-based reports.
 */
export async function fetchSalesReport({ startDate, endDate, startTime, endTime }) {
  let query = supabase
    .from('sales')
    .select('*, egg_sizes(name, sort_order)')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate);

  if (startTime && endTime) {
    // Handle overnight shifts (e.g., 7PM to 9AM next day)
    if (startTime > endTime) {
      // Time range crosses midnight: sale_time >= startTime OR sale_time <= endTime
      query = query.or(`sale_time.gte.${startTime},sale_time.lte.${endTime}`);
    } else {
      // Normal same-day shift: sale_time >= startTime AND sale_time <= endTime
      query = query.gte('sale_time', startTime);
      query = query.lte('sale_time', endTime);
    }
  }

  const { data, error } = await query.order('sale_time', { ascending: true });
  if (error) throw error;
  return data;
}

// ===== Expenses =====

export const EXPENSE_CATEGORIES = [
  'Feed',
  'Labor',
  'Utilities',
  'Transport',
  'Packaging',
  'Maintenance',
  'Misc',
];

export async function fetchExpenses({ startDate, endDate, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('expense_date', startDate);
  if (endDate) query = query.lte('expense_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function fetchTodayExpenses() {
  const today = getLocalDate();
  return fetchExpenses({ startDate: today, endDate: today });
}

export async function recordExpense({ category, description, amount }) {
  const today = getLocalDate();
  const { data, error } = await supabase
    .from('expenses')
    .insert({ category, description, amount, expense_date: today })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpenses(ids) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .in('id', ids);
  if (error) throw error;
}

// ===== Spoilage =====

export const SPOILAGE_REASONS = [
  'Cracked',
  'Broken',
  'Expired',
  'Damaged',
  'Other',
];

export async function fetchSpoilage({ startDate, endDate, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('spoilage')
    .select('*, egg_sizes(name, sort_order)')
    .order('spoilage_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('spoilage_date', startDate);
  if (endDate) query = query.lte('spoilage_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

// ===== Spoilage =====

export async function recordSpoilage({ eggSizeId, quantity, reason, spoilageDate }) {
  const { data, error } = await supabase
    .from('spoilage')
    .insert({
      egg_size_id: eggSizeId,
      quantity,
      reason,
      spoilage_date: spoilageDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSpoilageRecords(ids) {
  const { data, error } = await supabase
    .from('spoilage')
    .delete()
    .in('id', ids)
    .select();
  if (error) throw error;
  return data;
}

export async function fetchSpoilageByIds(ids) {
  const { data, error } = await supabase
    .from('spoilage')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return data;
}

// ===== Customers =====

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addCustomer({ name, phone, notes }) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, phone, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== Suppliers =====

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addSupplier({ name, phone, notes }) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name, phone, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSupplier(id) {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== Deliveries =====

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

export async function fetchDeliveries({ limit = 50, offset = 0, startDate, endDate } = {}) {
  let query = supabase
    .from('deliveries')
    .select('*, suppliers(name), egg_sizes(name, sort_order)')
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('delivery_date', startDate);
  if (endDate) query = query.lte('delivery_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function recordDelivery({ supplierId, eggSizeId, quantity, unit, traySize, costPerTray, totalCost, paymentStatus, notes, deliveryDate }) {
  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      supplier_id: supplierId,
      egg_size_id: eggSizeId,
      quantity,
      unit,
      tray_size: traySize || 30,
      cost_per_egg: costPerTray,
      total_cost: totalCost,
      payment_status: paymentStatus,
      notes,
      delivery_date: deliveryDate,
    })
    .select('*, suppliers(name), egg_sizes(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function recordDeliveryBatch({ supplierId, items, unit, traySize, paymentStatus, notes, deliveryDate }) {
  if (!items || items.length === 0) {
    throw new Error('No items to record');
  }
  const batchId = crypto.randomUUID();
  const rows = items.map(item => ({
    supplier_id: supplierId,
    egg_size_id: item.eggSizeId,
    quantity: item.quantity,
    unit,
    tray_size: traySize || 30,
    cost_per_egg: item.costPerTray,
    total_cost: item.quantity * parseFloat(item.costPerTray),
    payment_status: paymentStatus,
    notes: notes.trim(),
    delivery_date: deliveryDate,
    batch_id: batchId,
  }));
  const { data, error } = await supabase
    .from('deliveries')
    .insert(rows)
    .select('*, suppliers(name), egg_sizes(name)');
  if (error) throw error;
  return data;
}

export async function deleteDeliveryBatch(batchId) {
  const { error } = await supabase
    .from('deliveries')
    .delete()
    .eq('batch_id', batchId);
  if (error) throw error;
}

export async function updateDeliveryPayment(id, paymentStatus) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({ payment_status: paymentStatus })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDelivery(id) {
  const { error } = await supabase
    .from('deliveries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== Utilities =====

export const TRAY_SIZE = 30;

/** Calculate total inventory monetary value */
export async function fetchInventoryValue() {
  const [inv, prices] = await Promise.all([
    fetchInventory(),
    fetchPriceSettings(),
  ]);

  const priceMap = {};
  (prices || []).forEach(p => {
    priceMap[p.egg_size_id] = parseFloat(p.price_per_piece || 0);
  });

  let totalValue = 0;
  (inv || []).forEach(item => {
    const qty = item.quantity_on_hand || 0;
    const pp = priceMap[item.egg_size_id] || 0;
    totalValue += qty * pp;
  });

  return totalValue;
}

/**
 * Find the most recent delivery per egg size from a list of deliveries.
 * Returns { latestPerSize, totalCountPerSize } where:
 * - latestPerSize: { [egg_size_id]: delivery } (most recent delivery per size)
 * - totalCountPerSize: { [egg_size_id]: totalEggs } (sum of all eggs delivered per size)
 */
function findLatestDeliveryPerSize(deliveries) {
  const latestPerSize = {};
  const totalCountPerSize = {};
  (deliveries || []).forEach(d => {
    if (!latestPerSize[d.egg_size_id]) {
      latestPerSize[d.egg_size_id] = d;
    }
    if (!totalCountPerSize[d.egg_size_id]) totalCountPerSize[d.egg_size_id] = 0;
    const eggCount = d.unit === 'tray' ? d.quantity * (d.tray_size || TRAY_SIZE) : d.quantity;
    totalCountPerSize[d.egg_size_id] += eggCount;
  });
  return { latestPerSize, totalCountPerSize };
}

/**
 * Derive cost per egg and cost per tray from a delivery record.
 * The cost_per_egg column stores cost per tray.
 */
function deriveCostPerEgg(delivery) {
  if (!delivery) return { avgCostPerEgg: 0, avgCostPerTray: 0 };
  const costPerTray = parseFloat(delivery.cost_per_egg || 0);
  const traySize = delivery.tray_size || TRAY_SIZE;
  const costPerEgg = traySize > 0 ? costPerTray / traySize : 0;
  return {
    avgCostPerEgg: Math.round(costPerEgg * 100) / 100,
    avgCostPerTray: Math.round(costPerTray * 100) / 100,
  };
}

/**
 * Fetch cost per egg for each egg size based on the MOST RECENT delivery.
 * Uses latest delivery cost instead of historical average, since selling prices
 * are adjusted each time a new delivery arrives.
 * Returns a Map of egg_size_id -> { avgCostPerEgg, avgCostPerTray }
 */
export async function fetchCostsPerEgg() {
  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select('egg_size_id, cost_per_egg, tray_size')
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { latestPerSize } = findLatestDeliveryPerSize(deliveries);

  const result = {};
  Object.keys(latestPerSize).forEach(id => {
    result[id] = deriveCostPerEgg(latestPerSize[id]);
  });

  return result;
}

/**
 * Calculate profit margins per egg size.
 * Uses the MOST RECENT delivery cost per egg size vs selling price.
 */
export async function fetchProfitMargins() {
  const [prices, deliveries] = await Promise.all([
    fetchPriceSettings(),
    supabase
      .from('deliveries')
      .select('egg_size_id, cost_per_egg, tray_size, quantity, unit')
      .order('delivery_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  const { latestPerSize, totalCountPerSize } = findLatestDeliveryPerSize(deliveries.data);

  // Build margins per egg size
  const margins = EGG_SIZES.map((name, index) => {
    const price = (prices || []).find(p => p.egg_sizes?.sort_order === index + 1);
    const latest = latestPerSize[price?.egg_size_id];
    const totalEggs = totalCountPerSize[price?.egg_size_id] || 0;
    const { avgCostPerEgg } = deriveCostPerEgg(latest);
    const pricePerPiece = parseFloat(price?.price_per_piece || 0);
    const pricePerTray = parseFloat(price?.price_per_tray || 0);
    const profitPerEgg = pricePerPiece - avgCostPerEgg;
    const marginPercent = pricePerPiece > 0 ? (profitPerEgg / pricePerPiece) * 100 : 0;

    return {
      name,
      eggSizeId: price?.egg_size_id,
      pricePerPiece,
      pricePerTray,
      avgCostPerEgg,
      profitPerEgg: Math.round(profitPerEgg * 100) / 100,
      marginPercent: Math.round(marginPercent * 10) / 10,
      totalDelivered: totalEggs,
      totalDeliveryCost: totalEggs * avgCostPerEgg,
      deliveryCount: latest ? 1 : 0,
    };
  });

  return margins.filter(m => m.totalDelivered > 0);
}

/** Calculate cost of spoilage data */
export async function fetchSpoilageWithCost({ startDate, endDate, limit = 200, offset = 0 } = {}) {
  let query = supabase
    .from('spoilage')
    .select('*, egg_sizes(name, sort_order)')
    .order('spoilage_date', { ascending: false });

  if (startDate) query = query.gte('spoilage_date', startDate);
  if (endDate) query = query.lte('spoilage_date', endDate);

  const { data: spoilageData, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  // Fetch prices to calculate cost
  const { data: priceData } = await supabase
    .from('price_settings')
    .select('egg_size_id, price_per_piece');

  const priceMap = {};
  (priceData || []).forEach(p => {
    priceMap[p.egg_size_id] = parseFloat(p.price_per_piece || 0);
  });

  // Add cost to each spoilage entry
  const withCost = (spoilageData || []).map(s => ({
    ...s,
    cost: s.quantity * (priceMap[s.egg_size_id] || 0),
  }));

  return withCost;
}

// ===== Operational Expenses / Funds =====

export async function fetchOperationalFunds({ limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('operational_funds')
    .select('*')
    .order('fund_date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function addOperationalFund({ amount, description, fundDate }) {
  const { data, error } = await supabase
    .from('operational_funds')
    .insert({
      amount,
      description: description || '',
      fund_date: fundDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOperationalFund(id) {
  const { error } = await supabase
    .from('operational_funds')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== 1% Daily Revenue Cut =====

const DAILY_CUT_PERCENT = 0.01; // 1%

/**
 * Calculate 1% of today's total sales revenue.
 * Returns { revenue, cutAmount, alreadyRecorded, fundId }.
 */
export async function getDailyRevenueCutPreview() {
  const today = getLocalDate();

  // Fetch today's total revenue
  const { data: salesData, error: salesErr } = await supabase
    .from('sales')
    .select('total_amount')
    .eq('sale_date', today);
  if (salesErr) throw salesErr;

  const revenue = (salesData || []).reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0), 0
  );
  const cutAmount = Math.round(revenue * DAILY_CUT_PERCENT * 100) / 100;

  // Check if already recorded today
  const { data: existingFund, error: fundErr } = await supabase
    .from('operational_funds')
    .select('id')
    .eq('fund_date', today)
    .eq('description', '1% Daily Revenue Cut')
    .maybeSingle();
  if (fundErr) throw fundErr;

  return {
    revenue,
    cutAmount,
    alreadyRecorded: !!existingFund,
    fundId: existingFund?.id || null,
  };
}

/**
 * Record today's 1% revenue cut as an operational fund entry.
 */
export async function recordDailyRevenueCut() {
  const today = getLocalDate();

  const preview = await getDailyRevenueCutPreview();
  if (preview.alreadyRecorded) {
    throw new Error('Daily revenue cut already recorded today');
  }
  if (preview.cutAmount <= 0) {
    throw new Error('No sales recorded today — nothing to cut');
  }

  const { data, error } = await supabase
    .from('operational_funds')
    .insert({
      amount: preview.cutAmount,
      description: '1% Daily Revenue Cut',
      fund_date: today,
    })
    .select()
       .single();
  if (error) throw error;
  return { ...data, revenue: preview.revenue, cutAmount: preview.cutAmount };
}

/**
 * Remove the daily revenue cut entry for a given date.
 * Returns the deleted fund record.
 */
export async function deleteDailyRevenueCut(date) {
  const { data, error } = await supabase
    .from('operational_funds')
    .delete()
    .eq('fund_date', date)
    .eq('description', '1% Daily Revenue Cut')
    .select()
    .single();
  if (error) throw error;
  return data;
}

const EXPENSE_TRACKING_START = '2026-06-19';

export async function getOperationalBalance(startDate) {
  // Total funds added minus expenses since expense tracking started (June 19, 2026)
  // Expenses before this date are not deducted from operational funds

  const effectiveStartDate = startDate || EXPENSE_TRACKING_START;

  const [fundsData, expensesData] = await Promise.all([
    supabase.from('operational_funds').select('amount'),
    supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', effectiveStartDate),
  ]);

  if (fundsData.error) throw fundsData.error;
  if (expensesData.error) throw expensesData.error;

  const totalFunds = (fundsData.data || []).reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);
  const totalExpenses = (expensesData.data || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return {
    totalFunds: Math.round(totalFunds * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    balance: Math.round((totalFunds - totalExpenses) * 100) / 100,
    startDate: effectiveStartDate,
  };
}

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.1.0';

export async function exportAllData() {
  const tableFns = [
    { name: 'sales', fn: () => supabase.from('sales').select('*').order('created_at') },
    { name: 'deliveries', fn: () => supabase.from('deliveries').select('*, suppliers(name), egg_sizes(name)').order('delivery_date') },
    { name: 'expenses', fn: () => supabase.from('expenses').select('*').order('expense_date') },
    { name: 'spoilage', fn: () => supabase.from('spoilage').select('*, egg_sizes(name)').order('spoilage_date') },
    { name: 'inventory', fn: () => supabase.from('inventory').select('*, egg_sizes(name)') },
    { name: 'price_settings', fn: () => supabase.from('price_settings').select('*, egg_sizes(name)') },
    { name: 'suppliers', fn: () => supabase.from('suppliers').select('*').order('name') },
    { name: 'customers', fn: () => supabase.from('customers').select('*').order('name') },
  ];
  const results = await Promise.allSettled(
    tableFns.map(async ({ name, fn }) => {
      const { data, error } = await fn();
      if (error) {
        console.error(`Export error for ${name}:`, error);
        return { name, data: { error: error.message } };
      }
      return { name, data: data || [] };
    })
  );
  const merged = {};
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      merged[r.value.name] = r.value.data;
    } else {
      console.error('Export table rejected:', r.reason);
      merged['error'] = merged['error'] || [];
    }
  });
  return { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, data: merged };
}

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

/** Format a peso amount */
export function formatPeso(amount) {
  return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
