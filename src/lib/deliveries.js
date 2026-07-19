import { supabase } from './supabaseClient';

// ===== Deliveries =====

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

export async function fetchDeliveries({ limit = 50, offset = 0, startDate, endDate } = {}) {
  let query = supabase
    .from('deliveries')
    .select('*, suppliers(name), egg_sizes(name, sort_order)')
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('delivery_date', startDate);
  if (endDate) query = query.lte('delivery_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function recordDelivery({ supplierId, eggSizeId, quantity, unit, traySize, costPerTray, totalCost, paymentStatus, notes, deliveryDate }) {
  // Set amount_paid based on initial payment status
  const amountPaid = paymentStatus === 'paid' ? parseFloat(totalCost || 0) : 0;

  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      supplier_id: supplierId,
      egg_size_id: eggSizeId,
      quantity,
      unit,
      tray_size: traySize || 30,
      cost_per_egg: costPerTray,
      total_cost: totalCost,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      notes,
      delivery_date: deliveryDate,
    })
    .select('*, suppliers(name), egg_sizes(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function recordDeliveryBatch({ supplierId, items, unit, traySize, paymentStatus, notes, deliveryDate }) {
  if (!items || items.length === 0) {
    throw new Error('No items to record');
  }
  const batchId = crypto.randomUUID();
  const rows = items.map(item => {
    const totalCost = item.quantity * parseFloat(item.costPerTray || 0);
    // Set amount_paid based on initial payment status
    const amountPaid = paymentStatus === 'paid' ? totalCost : 0;
    return {
      supplier_id: supplierId,
      egg_size_id: item.eggSizeId,
      quantity: item.quantity,
      unit,
      tray_size: traySize || 30,
      cost_per_egg: item.costPerTray,
      total_cost: totalCost,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      notes: (notes || '').trim(),
      delivery_date: deliveryDate,
      batch_id: batchId,
    };
  });
  const { data, error } = await supabase
    .from('deliveries')
    .insert(rows)
    .select('*, suppliers(name), egg_sizes(name)');
  if (error) throw error;
  return data;
}

export async function deleteDeliveryBatch(batchId) {
  const { error } = await supabase
    .from('deliveries')
    .delete()
    .eq('batch_id', batchId);
  if (error) throw error;
}

export async function updateDeliveryPayment(id, paymentStatus, amountPaid = 0) {
  const { data, error } = await supabase
    .from('deliveries')
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

export async function deleteDelivery(id) {
  const { error } = await supabase
    .from('deliveries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
