import { supabase } from './supabaseClient';
import { getLocalDate, getEggCount } from './utils';
import { fetchCostsPerEgg, fetchCostsPerProduct } from './analytics';
import { fetchExpenses } from './expenses';

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

// ===== 10% Daily Net Income Cut =====

// Cut = 10% of NET INCOME (revenue − COGS). Expenses are NOT part of net
// income — they are accounted for separately in operational funds only.
// Nothing is cut on a loss day (net income <= 0).
const NET_INCOME_CUT_PERCENT = 0.10; // 10% of net income
const CUT_DESCRIPTION = '10% Net Income Cut';

/**
 * Calculate 10% of today's net income (revenue − COGS − expenses).
 * Returns { revenue, cogs, expenses, netIncome, cutAmount, alreadyRecorded, fundId }.
 */
export async function getDailyRevenueCutPreview() {
  const today = getLocalDate();

  // Fetch today's full rows (chunked to avoid the 1,000-row cap
  // silently understating the cut when a day has many sales)
  async function fetchDayRows(table, columns) {
    const pageSize = 1000;
    let allData = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
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

  const [salesData, productSalesData, expensesData, costsPerEgg, costsPerProduct] = await Promise.all([
    fetchDayRows('sales', 'total_amount, egg_size_id, quantity, unit, tray_size'),
    fetchDayRows('product_sales', 'total_amount, product_id, quantity'),
    fetchExpenses({ startDate: today, endDate: today }),
    fetchCostsPerEgg(),
    fetchCostsPerProduct(),
  ]);

  const revenue = (salesData || []).reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0), 0
  ) + (productSalesData || []).reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0), 0
  );
  // COGS at latest delivery cost (same source as Profits/Dashboard)
  // costsPerEgg avgCostPerEgg is now full precision (no 2-decimal rounding)
  const cogs = (salesData || []).reduce(
    (sum, s) => sum + (costsPerEgg[s.egg_size_id]?.avgCostPerEgg || 0) * getEggCount(s), 0
  ) + (productSalesData || []).reduce(
    (sum, s) => sum + (costsPerProduct[s.product_id] || 0) * parseFloat(s.quantity || 0), 0
  );
  const expenses = (expensesData || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  // Net income = revenue − COGS; the cut comes off the profit, not the top line.
  // Expenses are NOT part of net income — accounted for separately in operational funds only.
  const netIncome = Math.round((revenue - cogs) * 100) / 100;
  const cutAmount = Math.round(Math.max(0, netIncome) * NET_INCOME_CUT_PERCENT * 100) / 100;

  // Check if already recorded today
  const { data: existingFund, error: fundErr } = await supabase
    .from('operational_funds')
    .select('id')
    .eq('fund_date', today)
    .eq('description', CUT_DESCRIPTION)
    .maybeSingle();
  if (fundErr) throw fundErr;

  return {
    revenue,
    cogs: Math.round(cogs * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    netIncome,
    cutAmount,
    alreadyRecorded: !!existingFund,
    fundId: existingFund?.id || null,
  };
}

/**
 * Record today's 10% net income cut as an operational fund entry.
 */
export async function recordDailyRevenueCut() {
  const today = getLocalDate();

  const preview = await getDailyRevenueCutPreview();
  if (preview.alreadyRecorded) {
    throw new Error('Daily net income cut already recorded today');
  }
  if (preview.cutAmount <= 0) {
    throw new Error('No profit today — nothing to cut');
  }

  const { data, error } = await supabase
    .from('operational_funds')
    .insert({
      amount: preview.cutAmount,
      description: CUT_DESCRIPTION,
      fund_date: today,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, revenue: preview.revenue, netIncome: preview.netIncome, cutAmount: preview.cutAmount };
}

/**
 * Remove the daily net income cut entry for a given date.
 * Returns the deleted fund record.
 */
export async function deleteDailyRevenueCut(date) {
  const { data, error } = await supabase
    .from('operational_funds')
    .delete()
    .eq('fund_date', date)
    .eq('description', CUT_DESCRIPTION)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== Operational Balance =====

const EXPENSE_TRACKING_START = '2026-06-19';

export async function getOperationalBalance(startDate) {
  const effectiveStartDate = startDate || EXPENSE_TRACKING_START;

  // Page through ALL rows so the balance never silently drops rows past the
  // 1,000-row response cap (same pattern as fetchSales).
  async function fetchAll(query) {
    const pageSize = 1000;
    let allData = [];
    let from = 0;
    while (true) {
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return allData;
  }

  const [fundsData, expensesData] = await Promise.all([
    fetchAll(supabase.from('operational_funds').select('amount')),
    fetchAll(
      supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', effectiveStartDate)
    ),
  ]);

  const totalFunds = (fundsData || []).reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);
  const totalExpenses = (expensesData || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return {
    totalFunds: Math.round(totalFunds * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    balance: Math.round((totalFunds - totalExpenses) * 100) / 100,
    startDate: effectiveStartDate,
  };
}
