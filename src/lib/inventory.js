import { supabase } from './supabaseClient';

// ===== Inventory =====
export async function fetchInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, egg_sizes(name, sort_order)');
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
