import { supabase } from './supabaseClient';

// ===== Price Settings =====
export async function fetchPriceSettings() {
  const { data, error } = await supabase
    .from('price_settings')
    .select('*, egg_sizes(name, sort_order)');
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
