import { supabase } from './supabaseClient';
import { getLocalDate } from './utils';

// ===== Product Sales CRUD =====

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

export async function fetchProductSales({ limit = 50, offset = 0, startDate, endDate } = {}) {
  let query = supabase
    .from('product_sales')
    .select('*, products(name, unit)')
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

export async function fetchTodayProductSales() {
  const today = getLocalDate();
  const { data, error } = await supabase
    .from('product_sales')
    .select('*, products(name, unit)')
    .eq('sale_date', today)
    .order('sale_time', { ascending: false });
  
  if (error) throw error;
  return data || [];
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
  
  if (updateErr) throw updateErr;

  return sale;
}

/**
 * Fetch product sales within a date range for reports.
 */
export async function fetchProductSalesReport({ startDate, endDate } = {}) {
  let query = supabase
    .from('product_sales')
    .select('*, products(name, category, unit)')
    .order('sale_date', { ascending: false });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const { data, error } = await query.limit(500);
  if (error) throw error;
  return data || [];
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
    if (updateErr) throw updateErr;
  }

  return sales;
}
