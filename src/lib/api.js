import { supabase } from '../lib/supabaseClient';

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
    .select('*, egg_sizes(name, sort_order)')
    .order('egg_size_id');
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
    .select('*, egg_sizes(name, sort_order)')
    .order('egg_size_id');
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
  const dateStr = today.toISOString().split('T')[0];
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

export async function fetchSales({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, egg_sizes(name)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function fetchTodaySales() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sales')
    .select('*, egg_sizes(name)')
    .eq('sale_date', today)
    .order('sale_time', { ascending: false });
  if (error) throw error;
  return data;
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

export async function fetchSalesByHour() {
  const { data, error } = await supabase
    .from('sales')
    .select('sale_time, quantity, unit, tray_size, egg_sizes(name)');
  if (error) throw error;
  return data;
}

export async function fetchSalesTrend(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('sales')
    .select('sale_date, quantity, unit, tray_size')
    .gte('sale_date', startDate.toISOString().split('T')[0])
    .order('sale_date', { ascending: true });
  if (error) throw error;
  return data;
}

// ===== Utilities =====

export const TRAY_SIZE = 30;

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
