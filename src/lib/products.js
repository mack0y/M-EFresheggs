import { supabase } from './supabaseClient';

// ===== Product Catalog Helpers =====

export function calculateMarkup(cost, sellingPrice) {
  if (!cost || cost <= 0) return 0;
  return parseFloat((((sellingPrice - cost) / cost) * 100).toFixed(2));
}

export function calculateSellingPrice(cost, markupPercent) {
  if (!cost || cost <= 0) return 0;
  return parseFloat((cost * (1 + (markupPercent / 100))).toFixed(2));
}

// Auto-fill the third value when any two are provided
export function autoFillPricing(cost, sellingPrice, markupPercent) {
  if (cost > 0 && sellingPrice > 0) {
    return { cost, sellingPrice, markup: calculateMarkup(cost, sellingPrice) };
  }
  if (cost > 0 && markupPercent) {
    return { cost, sellingPrice: calculateSellingPrice(cost, markupPercent), markup: parseFloat(markupPercent) };
  }
  if (sellingPrice > 0 && markupPercent) {
    const cost = sellingPrice / (1 + (markupPercent / 100));
    return { cost: parseFloat(cost.toFixed(2)), sellingPrice, markup: parseFloat(markupPercent) };
  }
  return null;
}

// ===== Products CRUD =====

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function addProduct({ name, category, unitOfSale, purchaseUnit, qtyPerPurchase, costPrice, sellingPrice }) {
  const markup = calculateMarkup(costPrice, sellingPrice);
  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      category: category || 'Others',
      unit: unitOfSale || 'pcs',
      purchase_unit: purchaseUnit || 'pcs',
      purchase_qty_per_unit: parseFloat(qtyPerPurchase) || 1,
      cost: costPrice,
      price: sellingPrice,
      markup_percentage: markup,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
