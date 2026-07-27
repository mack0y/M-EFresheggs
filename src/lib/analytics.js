import { supabase } from './supabaseClient';
import { getLocalDate, TRAY_SIZE } from './utils';
import { EGG_SIZES } from './eggSizes';
import { fetchPriceSettings } from './pricing';

// ===== Analytics =====

export async function fetchSalesBySize(startDate, endDate) {
  let query = supabase
    .from('sales')
    .select('*, egg_sizes(name, sort_order)');

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  query = query.order('sale_date', { ascending: true });

  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function fetchSalesByHour(startDate, endDate) {
  let query = supabase
    .from('sales')
    .select('sale_time, quantity, unit, tray_size');

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  query = query.order('sale_date', { ascending: true });

  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function fetchSalesTrend(days = 30, endDate) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('sales')
    .select('sale_date, quantity, unit, tray_size, total_amount')
    .gte('sale_date', getLocalDate(startDate))
    .order('sale_date', { ascending: true });

  if (endDate) query = query.lte('sale_date', endDate);

  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

// ===== Product Analytics =====

export async function fetchProductSalesBySize(startDate, endDate) {
  let query = supabase
    .from('product_sales')
    .select('*, products(name, category)')
    .order('sale_date', { ascending: true });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function fetchProductSalesByHour(startDate, endDate) {
  let query = supabase
    .from('product_sales')
    .select('sale_time, quantity, product_id')
    .order('sale_date', { ascending: true });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function fetchProductSalesTrend(days = 30, endDate) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('product_sales')
    .select('sale_date, quantity, total_amount')
    .gte('sale_date', getLocalDate(startDate))
    .order('sale_date', { ascending: true });

  if (endDate) query = query.lte('sale_date', endDate);

  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData || [];
}

// ===== Cost & Margin Helpers =====

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
 * Fetch cost per sell-unit for each product based on the MOST RECENT product delivery.
 * Mirrors fetchCostsPerEgg() but for products.
 * Derives: cost_per_sell_unit = cost_per_purchase_unit / purchase_qty_per_unit
 * Returns a Map of product_id -> costPerUnit
 */
export async function fetchCostsPerProduct() {
  const { data: deliveries, error } = await supabase
    .from('product_deliveries')
    .select('product_id, cost_per_purchase_unit')
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  const latestPerProduct = {};
  (deliveries || []).forEach(d => {
    if (!latestPerProduct[d.product_id]) {
      latestPerProduct[d.product_id] = d;
    }
  });

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, purchase_qty_per_unit');
  if (prodErr) throw prodErr;

  const productMap = {};
  (products || []).forEach(p => { productMap[p.id] = p; });

  const result = {};
  Object.keys(latestPerProduct).forEach(id => {
    const delivery = latestPerProduct[id];
    const product = productMap[id];
    const costPerPurchaseUnit = parseFloat(delivery.cost_per_purchase_unit || 0);
    const qtyPerUnit = parseFloat(product?.purchase_qty_per_unit || 1);
    result[id] = qtyPerUnit > 0
      ? Math.round((costPerPurchaseUnit / qtyPerUnit) * 100) / 100
      : 0;
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

  if (deliveries.error) throw deliveries.error;

  // Count deliveries per egg size for accurate deliveryCount
  const deliveryCountPerSize = {};
  (deliveries.data || []).forEach(d => {
    const id = d.egg_size_id;
    if (!deliveryCountPerSize[id]) deliveryCountPerSize[id] = 0;
    deliveryCountPerSize[id]++;
  });

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
      deliveryCount: price?.egg_size_id ? (deliveryCountPerSize[price.egg_size_id] || 0) : 0,
    };
  });

  return margins.filter(m => m.totalDelivered > 0);
}
