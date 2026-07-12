import { supabase } from './supabaseClient';

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

export async function restoreInventoryForSpoilage(spoilageRecords) {
  const restoreMap = {};
  (spoilageRecords || []).forEach(s => {
    restoreMap[s.egg_size_id] = (restoreMap[s.egg_size_id] || 0) + s.quantity;
  });

  for (const [eggSizeId, qty] of Object.entries(restoreMap)) {
    const { data: invItem, error: fetchErr } = await supabase
      .from('inventory')
      .select('quantity_on_hand')
      .eq('egg_size_id', eggSizeId)
      .single();
    if (fetchErr) throw fetchErr;

    const newQty = (invItem?.quantity_on_hand || 0) + qty;
    const { error: updateErr } = await supabase
      .from('inventory')
      .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
      .eq('egg_size_id', eggSizeId);
    if (updateErr) throw updateErr;
  }
}
