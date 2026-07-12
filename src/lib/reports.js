import { supabase } from './supabaseClient';

// ===== Reports =====

/**
 * Fetch sales within a date and time range, joined with egg size info.
 * Used for generating shift-based reports.
 */
export async function fetchSalesReport({ startDate, endDate, startTime, endTime }) {
  let query = supabase
    .from('sales')
    .select('*, egg_sizes(name, sort_order)');

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  if (startTime && endTime) {
    // Handle overnight shifts (e.g., 7PM to 9AM next day)
    if (startTime > endTime) {
      // Time range crosses midnight: sale_time >= startTime OR sale_time <= endTime
      query = query.or(`sale_time.gte.${startTime},sale_time.lte.${endTime}`);
    } else {
      // Normal same-day shift: sale_time >= startTime AND sale_time <= endTime
      query = query.gte('sale_time', startTime);
      query = query.lte('sale_time', endTime);
    }
  }

  const { data, error } = await query.order('sale_time', { ascending: true });
  if (error) throw error;
  return data;
}
