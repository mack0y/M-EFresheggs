import { supabase } from './supabaseClient';
import { getLocalDate } from './utils';

// ===== Expenses =====

export const EXPENSE_CATEGORIES = [
  'Feed',
  'Labor',
  'Utilities',
  'Transport',
  'Packaging',
  'Maintenance',
  'Misc',
];

export async function fetchExpenses({ startDate, endDate, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('expense_date', startDate);
  if (endDate) query = query.lte('expense_date', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function fetchTodayExpenses() {
  const today = getLocalDate();
  return fetchExpenses({ startDate: today, endDate: today });
}

export async function recordExpense({ category, description, amount }) {
  const today = getLocalDate();
  const { data, error } = await supabase
    .from('expenses')
    .insert({ category, description, amount, expense_date: today })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpenses(ids) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .in('id', ids);
  if (error) throw error;
}
