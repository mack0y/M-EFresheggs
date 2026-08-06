import { supabase } from './supabaseClient';
import { getLocalDate } from './utils';

// ===== Product Sales CRUD =====

/**
 * Re-insert a deleted product sale EXACTLY as it was recorded (undo path).
 * Preserves original total_amount, sale_date, sale_time, and transaction_id
 * so undoing never re-prices at current prices or drifts dates.
 */
export async function restoreProductSale(sale) {
  if (!sale) throw new Error('Product sale not found');
  const { data, error } = await supabase
    .from('product_sales')
    .insert({
      product_id: sale.product_id,
      quantity: sale.quantity,
      total_amount: sale.total_amount ?? 0,
      sale_date: sale.sale_date,
      sale_time: sale.sale_time,
      transaction_id: sale.transaction_id ?? null,
    })
    .select('*, products(name, unit)')
    .single();
  if (error) throw error;
  return data;
}

export async function recordProductSale({ productId, quantity, saleDate }) {
  const today = getLocalDate();
  
  // Fetch current product price to calculate total amount
  const { data: productData, error: productErr } = await supabase
    .from('products')
    .select('price')
    .eq('id', productId)
    .single();

  if (productErr) throw productErr;

  let totalAmount = 0;
  if (productData && productData.price > 0) {
    totalAmount = parseFloat(quantity) * parseFloat(productData.price);
  }

  const { data, error } = await supabase
    .from('product_sales')
    .insert({
      product_id: productId,
      quantity,
      total_amount: totalAmount,
      sale_date: saleDate || today,
      sale_time: new Date().toTimeString().split(' ')[0],
    })
    .select('*, products(name)')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchProductSales({ limit, offset = 0, startDate, endDate } = {}) {
  let query = supabase
    .from('product_sales')
    .select('*, products(name, unit)')
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  // Explicit limit (list view pagination): single range query, never page past it.
  if (limit !== undefined) {
    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  // No limit: page through ALL matching rows so aggregates never silently
  // drop rows past the 1,000-row cap (same pattern as fetchSales).
  const pageSize = 1000;
  let allData = [];
  let from = offset;
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

export async function fetchTodayProductSales() {
  const today = getLocalDate();
  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('product_sales')
      .select('*, products(name, unit)')
      .eq('sale_date', today)
      .order('sale_time', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData || [];
}

export async function deleteProductSale(id) {
  // Fetch the sale first so we can restore inventory
  const { data: sale, error: fetchErr } = await supabase
    .from('product_sales')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr) throw fetchErr;
  if (!sale) throw new Error('Product sale not found');

  // Delete the sale record first
  const { error: delErr } = await supabase
    .from('product_sales')
    .delete()
    .eq('id', id);

  if (delErr) throw delErr;

  // Restore inventory by adding back the quantity
  const { data: invItem, error: invFetchErr } = await supabase
    .from('products')
    .select('quantity_on_hand')
    .eq('id', sale.product_id)
    .single();

  if (invFetchErr) throw invFetchErr;

  const newQty = parseFloat(invItem?.quantity_on_hand || 0) + parseFloat(sale.quantity);

  const { error: updateErr } = await supabase
    .from('products')
    .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
    .eq('id', sale.product_id);

  // If inventory restore fails, re-insert the sale to keep data consistent
  if (updateErr) {
    await restoreProductSale(sale).catch(() => {});
    throw updateErr;
  }

  return sale;
}

/**
 * Fetch product sales within a date range for reports.
 * Uses chunked pagination (1,000 rows per page) so large ranges are not
 * silently truncated by Supabase's 1,000-row response cap.
 */
export async function fetchProductSalesReport({ startDate, endDate } = {}) {
  let query = supabase
    .from('product_sales')
    .select('*, products(name, category, unit)')
    .order('sale_date', { ascending: false });

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

export async function deleteProductSales(ids) {
  if (!ids || ids.length === 0) return [];

  // Fetch all sales to restore inventory later
  const { data: sales, error: fetchErr } = await supabase
    .from('product_sales')
    .select('*')
    .in('id', ids);

  if (fetchErr) throw fetchErr;

  // Delete the records
  const { error: delErr } = await supabase
    .from('product_sales')
    .delete()
    .in('id', ids);

  if (delErr) throw delErr;

  // Restore inventory for each deleted sale
  const restoreMap = {};
  (sales || []).forEach(sale => {
    const qty = parseFloat(sale.quantity || 0);
    if (!restoreMap[sale.product_id]) restoreMap[sale.product_id] = 0;
    restoreMap[sale.product_id] += qty;
  });

  for (const [productId, qty] of Object.entries(restoreMap)) {
    const { data: invItem, error: invFetchErr } = await supabase
      .from('products')
      .select('quantity_on_hand')
      .eq('id', productId)
      .single();
    if (invFetchErr) throw invFetchErr;

    const newQty = parseFloat(invItem?.quantity_on_hand || 0) + qty;
    const { error: updateErr } = await supabase
      .from('products')
      .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
      .eq('id', productId);

    // If inventory restore fails, re-insert the affected sales to keep data consistent
    if (updateErr) {
      const toRestore = sales.filter(s => s.product_id === parseInt(productId));
      if (toRestore.length > 0) {
        await supabase.from('product_sales').insert(
          toRestore.map(s => ({
            product_id: s.product_id,
            quantity: s.quantity,
            total_amount: s.total_amount,
            sale_date: s.sale_date,
            sale_time: s.sale_time,
            transaction_id: s.transaction_id ?? null,
          }))
        );
      }
      throw updateErr;
    }
  }

  return sales;
}
