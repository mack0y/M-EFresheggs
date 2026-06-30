import { supabase } from './supabaseClient';
import { getLocalDate, TRAY_SIZE } from './utils';

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
