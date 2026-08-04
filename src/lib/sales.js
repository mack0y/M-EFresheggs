import { supabase } from './supabaseClient';
import { getLocalDate } from './utils';

// ===== Sales =====

/**
 * Re-insert a deleted sale EXACTLY as it was recorded (undo path).
 * Preserves original total_amount, sale_date, sale_time, and transaction_id
 * so undoing a sale never re-prices it at current prices or drifts dates.
 * The inventory trigger (after_sale_insert) deducts stock on insert, matching
 * the restore-from-delete semantics.
 */
export async function restoreSale(sale) {
  if (!sale) throw new Error('Sale not found');
  const { data, error } = await supabase
    .from('sales')
    .insert({
      egg_size_id: sale.egg_size_id,
      quantity: sale.quantity,
      unit: sale.unit,
      tray_size: sale.tray_size ?? null,
      total_amount: sale.total_amount ?? 0,
      sale_date: sale.sale_date,
      sale_time: sale.sale_time,
      transaction_id: sale.transaction_id ?? null,
    })
    .select('*, egg_sizes(name)')
    .single();
  if (error) throw error;
  return data;
}

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
  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('sales')
      .select('*, egg_sizes(name)')
      .eq('sale_date', today)
      .order('sale_time', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function deleteSale(id) {
  // Use the atomic undo_sale RPC: delete + inventory restore happen in a
  // single DB transaction, so a failure rolls back both. Returns the deleted
  // sale record (SETOF sales wraps a single row in an array).
  const { data, error } = await supabase.rpc('undo_sale', { p_sale_id: id });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Sale not found');
  return data[0];
}

/**
 * Delete multiple sales records at once.
 * Uses the atomic undo_sales RPC — deletes + inventory restore happen in a
 * single DB transaction per sale. Returns the deleted sale records.
 */
export async function deleteSales(ids) {
  if (!ids || ids.length === 0) return [];

  const { data, error } = await supabase.rpc('undo_sales', { p_sale_ids: ids });
  if (error) throw error;
  return data || [];
}
