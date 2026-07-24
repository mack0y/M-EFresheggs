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

  query = query.order('sale_time', { ascending: true });

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
