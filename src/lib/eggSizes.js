import { supabase } from './supabaseClient';

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
