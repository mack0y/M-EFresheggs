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

export async function adjustInventory(eggSizeId, delta) {
  // Fetch current
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('quantity_on_hand')
    .eq('egg_size_id', eggSizeId)
    .single();
  if (fetchError) throw fetchError;

  const newQty = Math.max(0, current.quantity_on_hand + delta);
  return updateInventory(eggSizeId, newQty);
}

// ===== Sales =====
export async function recordSale({ eggSizeId, quantity, unit, traySize }) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const timeStr = today.toTimeString().split(' ')[0];

  const { data, error } = await supabase
    .from('sales')
    .insert({
      egg_size_id: eggSizeId,
      quantity,
      unit,
      tray_size: unit === 'tray' ? traySize : null,
      sale_date: dateStr,
      sale_time: timeStr,
    })
    .select()
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
