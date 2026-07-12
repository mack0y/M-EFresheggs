import { supabase } from './supabaseClient';
import { fetchInventory } from './inventory';
import { fetchPriceSettings } from './pricing';
import { fetchProducts } from './products';

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.2.0';

/** Calculate inventory monetary value — eggs, products, and combined total */
export async function fetchInventoryValue() {
  const [inv, prices, products] = await Promise.all([
    fetchInventory(),
    fetchPriceSettings(),
    fetchProducts(),
  ]);

  const priceMap = {};
  (prices || []).forEach(p => {
    priceMap[p.egg_size_id] = parseFloat(p.price_per_piece || 0);
  });

  let eggValue = 0;
  (inv || []).forEach(item => {
    const qty = item.quantity_on_hand || 0;
    const pp = priceMap[item.egg_size_id] || 0;
    eggValue += qty * pp;
  });

  let productValue = 0;
  (products || []).forEach(p => {
    const qty = parseFloat(p.quantity_on_hand || 0);
    const price = parseFloat(p.price || 0);
    productValue += qty * price;
  });

  return { eggValue, productValue, totalValue: eggValue + productValue };
}

/** Calculate cost of spoilage data */
export async function fetchSpoilageWithCost({ startDate, endDate, limit = 200, offset = 0 } = {}) {
  let query = supabase
    .from('spoilage')
    .select('*, egg_sizes(name, sort_order)')
    .order('spoilage_date', { ascending: false });

  if (startDate) query = query.gte('spoilage_date', startDate);
  if (endDate) query = query.lte('spoilage_date', endDate);

  const { data: spoilageData, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  // Fetch prices to calculate cost
  const { data: priceData } = await supabase
    .from('price_settings')
    .select('egg_size_id, price_per_piece');

  const priceMap = {};
  (priceData || []).forEach(p => {
    priceMap[p.egg_size_id] = parseFloat(p.price_per_piece || 0);
  });

  // Add cost to each spoilage entry
  const withCost = (spoilageData || []).map(s => ({
    ...s,
    cost: s.quantity * (priceMap[s.egg_size_id] || 0),
  }));

  return withCost;
}

/** Export all data for backup */
export async function exportAllData() {
  const tableFns = [
    { name: 'sales', fn: () => supabase.from('sales').select('*').order('created_at') },
    { name: 'deliveries', fn: () => supabase.from('deliveries').select('*, suppliers(name), egg_sizes(name)').order('delivery_date') },
    { name: 'expenses', fn: () => supabase.from('expenses').select('*').order('expense_date') },
    { name: 'spoilage', fn: () => supabase.from('spoilage').select('*, egg_sizes(name)').order('spoilage_date') },
    { name: 'inventory', fn: () => supabase.from('inventory').select('*, egg_sizes(name)') },
    { name: 'price_settings', fn: () => supabase.from('price_settings').select('*, egg_sizes(name)') },
    { name: 'suppliers', fn: () => supabase.from('suppliers').select('*').order('name') },
    { name: 'customers', fn: () => supabase.from('customers').select('*').order('name') },
  ];
  const results = await Promise.allSettled(
    tableFns.map(async ({ name, fn }) => {
      const { data, error } = await fn();
      if (error) {
        console.error(`Export error for ${name}:`, error);
        return { name, data: { error: error.message } };
      }
      return { name, data: data || [] };
    })
  );
  const merged = {};
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      merged[r.value.name] = r.value.data;
    } else {
      console.error('Export table rejected:', r.reason);
      merged['error'] = merged['error'] || [];
    }
  });
  return { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, data: merged };
}
