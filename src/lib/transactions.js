import { supabase } from './supabaseClient';
import { getLocalDate, TRAY_SIZE } from './utils';
import logger from './logger';

// ===== Unified Transactions =====

/**
 * Record a unified transaction with egg items and product items.
 * Validates stock for ALL items first, then inserts everything.
 * Returns the transaction record.
 */
export async function recordTransaction({ eggItems = [], productItems = [], customerId = null }) {
  const today = getLocalDate();
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  // Calculate total
  const eggTotal = eggItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const productTotal = productItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalAmount = eggTotal + productTotal;

  // === Step 1: Atomically validate and reserve stock for ALL items ===
  // Uses RPC if available, falls back to read-then-check.

  async function tryAtomicallyReserveEgg(item) {
    const totalEggs = item.unit === 'tray'
      ? item.quantity * (item.traySize || TRAY_SIZE)
      : item.quantity;
    const { error } = await supabase.rpc('validate_egg_stock', {
      p_egg_size_id: item.id,
      p_quantity: totalEggs,
    });
    if (error) throw error;
  }

  async function tryAtomicallyReserveProduct(item) {
    const { error } = await supabase.rpc('validate_product_stock', {
      p_product_id: item.id,
      p_quantity: item.quantity,
    });
    if (error) throw error;
  }

  // Try the atomic RPC path once for all items. If the RPC is unavailable
  // (function not deployed) or fails for ANY item, fall back to the
  // non-atomic read-then-check for every item.
  async function tryAtomicReserveAll() {
    for (const item of eggItems) {
      await tryAtomicallyReserveEgg(item);
    }
    for (const item of productItems) {
      await tryAtomicallyReserveProduct(item);
    }
  }

  let atomicWorked = true;
  try {
    await tryAtomicReserveAll();
  } catch (rpcErr) {
    atomicWorked = false;
    logger.warn('Atomic stock reserve failed, falling back to read-then-check:', rpcErr.message);
  }

  if (!atomicWorked) {
    if (eggItems.length > 0) {
      // Fallback: read-then-check (non-atomic but still catches most cases)
      const { data: inventory, error: invErr } = await supabase
        .from('inventory')
        .select('egg_size_id, quantity_on_hand');
      if (invErr) throw invErr;

      const invMap = {};
      (inventory || []).forEach(i => { invMap[i.egg_size_id] = i.quantity_on_hand || 0; });

      for (const item of eggItems) {
        const totalEggs = item.unit === 'tray'
          ? item.quantity * (item.traySize || TRAY_SIZE)
          : item.quantity;
        const stock = invMap[item.id] || 0;
        if (totalEggs > stock) {
          throw new Error(`Not enough ${item.name} stock — only ${stock} eggs available, need ${totalEggs}`);
        }
      }
    }

    if (productItems.length > 0) {
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, quantity_on_hand');
      if (prodErr) throw prodErr;

      const prodMap = {};
      (products || []).forEach(p => { prodMap[p.id] = p.quantity_on_hand || 0; });

      for (const item of productItems) {
        const stock = prodMap[item.id] || 0;
        if (item.quantity > stock) {
          throw new Error(`Not enough ${item.name} stock — only ${stock} available, need ${item.quantity}`);
        }
      }
    }
  }

  // Note: RPC uses SELECT FOR UPDATE to lock the row, preventing concurrent
  // oversells. The actual deduction is handled by DB triggers (after_sale_insert,
  // after_product_sale_insert). When RPC is not available (function doesn't
  // exist on Supabase), fallback is the non-atomic read-then-check approach.

  // === Step 2: Fetch prices for egg items (server-side price calculation) ===
  // Any item whose price is not set (0 or missing) is rejected — a sale with
  // total_amount 0 would give stock away for free and pollute revenue reports.
  const eggInserts = [];
  for (const item of eggItems) {
    const { data: priceData } = await supabase
      .from('price_settings')
      .select('price_per_piece, price_per_tray')
      .eq('egg_size_id', item.id)
      .single();

    let totalAmount = 0;
    if (priceData) {
      totalAmount = item.unit === 'tray'
        ? item.quantity * parseFloat(priceData.price_per_tray || 0)
        : item.quantity * parseFloat(priceData.price_per_piece || 0);
    }

    if (totalAmount <= 0) {
      throw new Error(`Cannot record sale of ${item.name} — no price is set for it. Set a price first.`);
    }

    eggInserts.push({
      egg_size_id: item.id,
      quantity: item.quantity,
      unit: item.unit,
      tray_size: item.unit === 'tray' ? (item.traySize || TRAY_SIZE) : null,
      total_amount: totalAmount,
      sale_date: today,
      sale_time: timeStr,
    });
  }

  // Fetch product prices
  const productInserts = [];
  for (const item of productItems) {
    const { data: productData } = await supabase
      .from('products')
      .select('price')
      .eq('id', item.id)
      .single();

    let totalAmount = 0;
    if (productData && productData.price > 0) {
      totalAmount = item.quantity * parseFloat(productData.price);
    }

    if (totalAmount <= 0) {
      throw new Error(`Cannot record sale of ${item.name} — no price is set for it. Set a price first.`);
    }

    productInserts.push({
      product_id: item.id,
      quantity: item.quantity,
      total_amount: totalAmount,
      sale_date: today,
      sale_time: timeStr,
    });
  }

  // === Step 3: Insert transaction record ===
  const { data: transaction, error: txErr } = await supabase
    .from('transactions')
    .insert({
      customer_id: customerId,
      total_amount: totalAmount,
      sale_date: today,
      sale_time: timeStr,
    })
    .select()
    .single();
  if (txErr) throw txErr;

  const txId = transaction.id;

  try {
    // === Step 4: Insert egg sales with transaction_id ===
    const eggResults = [];
    if (eggInserts.length > 0) {
      const withTxId = eggInserts.map(s => ({ ...s, transaction_id: txId }));
      const { data, error } = await supabase
        .from('sales')
        .insert(withTxId)
        .select('*, egg_sizes(name)');
      if (error) throw error;
      eggResults.push(...(data || []));
    }

    // === Step 5: Insert product sales with transaction_id ===
    const productResults = [];
    if (productInserts.length > 0) {
      const withTxId = productInserts.map(s => ({ ...s, transaction_id: txId }));
      const { data, error } = await supabase
        .from('product_sales')
        .insert(withTxId)
        .select('*, products(name)');
      if (error) throw error;
      productResults.push(...(data || []));
    }

    return {
      transaction,
      eggSales: eggResults,
      productSales: productResults,
    };
  } catch (insertErr) {
    // Roll back the transaction record so a partial insert never leaves an
    // orphan transaction row with zero linked sales.
    await supabase.from('transactions').delete().eq('id', txId);
    throw insertErr;
  }
}

/**
 * Delete a transaction and all linked sales, restoring inventory.
 * Currently unused — kept for future transaction management UI.
 */
export async function deleteTransaction(transactionId) {
  // Fetch linked egg sales
  const { data: eggSales, error: eggErr } = await supabase
    .from('sales')
    .select('*')
    .eq('transaction_id', transactionId);
  if (eggErr) throw eggErr;

  // Fetch linked product sales
  const { data: prodSales, error: prodErr } = await supabase
    .from('product_sales')
    .select('*')
    .eq('transaction_id', transactionId);
  if (prodErr) throw prodErr;

  // Delete egg sales
  if (eggSales && eggSales.length > 0) {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('transaction_id', transactionId);
    if (error) throw error;

    // Restore egg inventory
    const restoreMap = {};
    eggSales.forEach(sale => {
      const eggCount = sale.unit === 'tray'
        ? sale.quantity * (sale.tray_size || TRAY_SIZE)
        : sale.quantity;
      if (!restoreMap[sale.egg_size_id]) restoreMap[sale.egg_size_id] = 0;
      restoreMap[sale.egg_size_id] += eggCount;
    });

    for (const [eggSizeId, eggCount] of Object.entries(restoreMap)) {
      const { data: inv } = await supabase
        .from('inventory')
        .select('quantity_on_hand')
        .eq('egg_size_id', eggSizeId)
        .single();
      const newQty = (inv?.quantity_on_hand || 0) + eggCount;
      await supabase
        .from('inventory')
        .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
        .eq('egg_size_id', eggSizeId);
    }
  }

  // Delete product sales
  if (prodSales && prodSales.length > 0) {
    const { error } = await supabase
      .from('product_sales')
      .delete()
      .eq('transaction_id', transactionId);
    if (error) throw error;

    // Restore product inventory
    const restoreMap = {};
    prodSales.forEach(sale => {
      const qty = parseFloat(sale.quantity || 0);
      if (!restoreMap[sale.product_id]) restoreMap[sale.product_id] = 0;
      restoreMap[sale.product_id] += qty;
    });

    for (const [productId, qty] of Object.entries(restoreMap)) {
      const { data: inv } = await supabase
        .from('products')
        .select('quantity_on_hand')
        .eq('id', productId)
        .single();
      const newQty = parseFloat(inv?.quantity_on_hand || 0) + qty;
      await supabase
        .from('products')
        .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
        .eq('id', productId);
    }
  }

  // Delete the transaction
  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);
  if (delErr) throw delErr;

  return { eggSales: eggSales || [], productSales: prodSales || [] };
}

/**
 * Fetch transactions within a date range.
 */
export async function fetchTransactions({ startDate, endDate, limit = 100 } = {}) {
  let query = supabase
    .from('transactions')
    .select('*, customers(name)')
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single transaction with its linked egg and product sales.
 */
export async function fetchTransactionDetail(transactionId) {
  const [txResult, eggResult, prodResult] = await Promise.all([
    supabase.from('transactions').select('*, customers(name)').eq('id', transactionId).single(),
    supabase.from('sales').select('*, egg_sizes(name)').eq('transaction_id', transactionId),
    supabase.from('product_sales').select('*, products(name)').eq('transaction_id', transactionId),
  ]);

  if (txResult.error) throw txResult.error;

  return {
    transaction: txResult.data,
    eggSales: eggResult.data || [],
    productSales: prodResult.data || [],
  };
}
