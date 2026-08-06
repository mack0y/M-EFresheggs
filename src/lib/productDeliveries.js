import { supabase } from './supabaseClient';
import { getLocalDate } from './utils';

// ===== Product Deliveries CRUD =====

export async function fetchProductDeliveries({ limit = 50, offset = 0, startDate, endDate } = {}) {
  let query = supabase
    .from('product_deliveries')
    .select('*, suppliers(name), products(name, unit, purchase_unit)')
    .order('delivery_date', { ascending: false });

  if (startDate) query = query.gte('delivery_date', startDate);
  if (endDate) query = query.lte('delivery_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

export async function recordProductDelivery({ supplierId, productId, purchaseQuantity, costPerPurchaseUnit, deliveryDate, expiryDate, notes, paymentStatus }) {
  const today = getLocalDate();
  const totalCost = parseFloat(purchaseQuantity) * parseFloat(costPerPurchaseUnit);
  const amountPaid = paymentStatus === 'paid' ? totalCost : 0;

  const { data, error } = await supabase
    .from('product_deliveries')
    .insert({
      supplier_id: supplierId,
      product_id: productId,
      purchase_quantity: purchaseQuantity,
      cost_per_purchase_unit: costPerPurchaseUnit,
      total_cost: totalCost,
      payment_status: paymentStatus || 'unpaid',
      amount_paid: amountPaid,
      delivery_date: deliveryDate || today,
      expiry_date: expiryDate || null,
      notes,
    })
    .select('*, suppliers(name), products(name, unit, purchase_unit)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProductDeliveryPayment(id, paymentStatus, amountPaid = 0) {
  const { data, error } = await supabase
    .from('product_deliveries')
    .update({ 
      payment_status: paymentStatus, 
      amount_paid: parseFloat(amountPaid || 0) 
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteProductDelivery(id) {
  const { error } = await supabase
    .from('product_deliveries')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
