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

  // If inventory restore fails, re-insert the sale to keep data consistent
  if (updateErr) {
    await supabase.from('sales').insert({
      egg_size_id: sale.egg_size_id,
      quantity: sale.quantity,
      unit: sale.unit,
      tray_size: sale.tray_size,
      total_amount: sale.total_amount,
      sale_date: sale.sale_date,
      sale_time: sale.sale_time,
    });
    throw updateErr;
  }

  return sale;
}

/**
 * Delete multiple sales records at once for better performance.
 */
export async function deleteSales(ids) {
  if (!ids || ids.length === 0) return [];

  // Fetch all sales to restore inventory later
  const { data: sales, error: fetchErr } = await supabase
    .from('sales')
    .select('*')
    .in('id', ids);
  if (fetchErr) throw fetchErr;

  // Delete the records
  const { error: delErr } = await supabase
    .from('sales')
    .delete()
    .in('id', ids);
  if (delErr) throw delErr;

  // Restore inventory for each deleted sale
  const restoreMap = {};
  (sales || []).forEach(sale => {
    const eggCount = sale.unit === 'tray'
      ? sale.quantity * (sale.tray_size || TRAY_SIZE)
      : sale.quantity;
    if (!restoreMap[sale.egg_size_id]) restoreMap[sale.egg_size_id] = 0;
    restoreMap[sale.egg_size_id] += eggCount;
  });

  for (const [eggSizeId, eggCount] of Object.entries(restoreMap)) {
    const { data: invItem, error: invFetchErr } = await supabase
      .from('inventory')
      .select('quantity_on_hand')
      .eq('egg_size_id', eggSizeId)
      .single();
    if (invFetchErr) throw invFetchErr;

    const newQty = (invItem?.quantity_on_hand || 0) + eggCount;
    const { error: updateErr } = await supabase
      .from('inventory')
      .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
      .eq('egg_size_id', eggSizeId);

    // If inventory restore fails, re-insert the affected sales to keep data consistent
    if (updateErr) {
      const toRestore = sales.filter(s => s.egg_size_id === parseInt(eggSizeId));
      if (toRestore.length > 0) {
        await supabase.from('sales').insert(
          toRestore.map(s => ({
            egg_size_id: s.egg_size_id,
            quantity: s.quantity,
            unit: s.unit,
            tray_size: s.tray_size,
            total_amount: s.total_amount,
            sale_date: s.sale_date,
            sale_time: s.sale_time,
          }))
        );
      }
      throw updateErr;
    }
  }

  return sales;
}
