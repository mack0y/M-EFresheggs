import { supabase } from './supabaseClient';

// ===== Product Losses =====

export const PRODUCT_LOSS_REASONS = ['expired', 'damaged', 'other'];

export async function fetchProductLosses({ startDate, endDate, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('product_losses')
    .select('*, products(name)')
    .order('loss_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('loss_date', startDate);
  if (endDate) query = query.lte('loss_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function addProductLoss({ productId, quantity, reason = 'expired', lossDate, notes }) {
  const payload = {
    product_id: productId,
    quantity,
    reason,
    loss_date: lossDate,
  };
  if (notes) payload.notes = notes;

  const { data, error } = await supabase
    .from('product_losses')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProductLoss(id) {
  const { data, error } = await supabase
    .from('product_losses')
    .delete()
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}
