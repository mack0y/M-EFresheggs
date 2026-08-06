import { supabase } from './supabaseClient';
import { getLocalDate } from './utils';

// ===== Operational Funds =====

export async function fetchOperationalFunds({ limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('operational_funds')
    .select('*')
    .order('fund_date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function addOperationalFund({ amount, description, fundDate }) {
  const { data, error } = await supabase
    .from('operational_funds')
    .insert({
      amount,
      description: description || '',
      fund_date: fundDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOperationalFund(id) {
  const { error } = await supabase
    .from('operational_funds')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== 3% Daily Revenue Cut =====

const DAILY_CUT_PERCENT = 0.03; // 3%

/**
 * Calculate 3% of today's total sales revenue.
 * Returns { revenue, cutAmount, alreadyRecorded, fundId }.
 */
export async function getDailyRevenueCutPreview() {
  const today = getLocalDate();

  // Fetch today's total revenue (chunked to avoid the 1,000-row cap
  // silently understating the cut when a day has many sales)
  async function fetchDayTotal(table) {
    const pageSize = 1000;
    let allData = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('total_amount')
        .eq('sale_date', today)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return allData;
  }

  const [salesData, productSalesData] = await Promise.all([
    fetchDayTotal('sales'),
    fetchDayTotal('product_sales'),
  ]);

  const revenue = (salesData || []).reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0), 0
  ) + (productSalesData || []).reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0), 0
  );
  const cutAmount = Math.round(revenue * DAILY_CUT_PERCENT * 100) / 100;

  // Check if already recorded today
  const { data: existingFund, error: fundErr } = await supabase
    .from('operational_funds')
    .select('id')
    .eq('fund_date', today)
    .eq('description', '3% Daily Revenue Cut')
    .maybeSingle();
  if (fundErr) throw fundErr;

  return {
    revenue,
    cutAmount,
    alreadyRecorded: !!existingFund,
    fundId: existingFund?.id || null,
  };
}

/**
 * Record today's 3% revenue cut as an operational fund entry.
 */
export async function recordDailyRevenueCut() {
  const today = getLocalDate();

  const preview = await getDailyRevenueCutPreview();
  if (preview.alreadyRecorded) {
    throw new Error('Daily revenue cut already recorded today');
  }
  if (preview.cutAmount <= 0) {
    throw new Error('No sales recorded today — nothing to cut');
  }

  const { data, error } = await supabase
    .from('operational_funds')
    .insert({
      amount: preview.cutAmount,
      description: '3% Daily Revenue Cut',
      fund_date: today,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, revenue: preview.revenue, cutAmount: preview.cutAmount };
}

/**
 * Remove the daily revenue cut entry for a given date.
 * Returns the deleted fund record.
 */
export async function deleteDailyRevenueCut(date) {
  const { data, error } = await supabase
    .from('operational_funds')
    .delete()
    .eq('fund_date', date)
    .eq('description', '3% Daily Revenue Cut')
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== Operational Balance =====

const EXPENSE_TRACKING_START = '2026-06-19';

export async function getOperationalBalance(startDate) {
  const effectiveStartDate = startDate || EXPENSE_TRACKING_START;

  const [fundsData, expensesData] = await Promise.all([
    supabase.from('operational_funds').select('amount'),
    supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', effectiveStartDate),
  ]);

  if (fundsData.error) throw fundsData.error;
  if (expensesData.error) throw expensesData.error;

  const totalFunds = (fundsData.data || []).reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);
  const totalExpenses = (expensesData.data || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return {
    totalFunds: Math.round(totalFunds * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    balance: Math.round((totalFunds - totalExpenses) * 100) / 100,
    startDate: effectiveStartDate,
  };
}
