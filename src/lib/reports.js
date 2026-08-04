import { supabase } from './supabaseClient';

// ===== Reports =====

/**
 * Fetch sales within a date and time range, joined with egg size info.
 * Used for generating shift-based reports.
 *
 * Overnight shifts (startTime > endTime, e.g. 19:00 → 09:35 next day) are
 * handled per-day: the early-morning window (<= endTime) applies to every day
 * in the range, but the late-night window (>= startTime) applies ONLY to the
 * last day — the shift began the prior evening and ended on `endDate`. This
 * avoids catching day-1 19:00+ sales that belong to the previous night.
 */
export async function fetchSalesReport({ startDate, endDate, startTime, endTime }) {
  const pageSize = 1000;
  const isOvernight = !!startTime && !!endTime && startTime > endTime;
  let allData = [];

  async function fetchPage(query) {
    let from = 0;
    while (true) {
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  if (isOvernight) {
    // Day 1..N-1: only the early-morning window (00:00–endTime)
    const prevDays = supabase
      .from('sales')
      .select('*, egg_sizes(name, sort_order)')
      .gte('sale_date', startDate)
      .lt('sale_date', endDate)
      .lte('sale_time', endTime)
      .order('sale_time', { ascending: true });
    await fetchPage(prevDays);

    // Last day: full overnight window (>= startTime) OR (<= endTime)
    const lastDay = supabase
      .from('sales')
      .select('*, egg_sizes(name, sort_order)')
      .eq('sale_date', endDate)
      .or(`sale_time.gte.${startTime},sale_time.lte.${endTime}`)
      .order('sale_time', { ascending: true });
    await fetchPage(lastDay);

    return allData;
  }

  let query = supabase
    .from('sales')
    .select('*, egg_sizes(name, sort_order)');

  if (startDate) query = query.gte('sale_date', startDate);
  if (endDate) query = query.lte('sale_date', endDate);

  if (startTime && endTime) {
    // Normal same-day shift: sale_time >= startTime AND sale_time <= endTime
    query = query.gte('sale_time', startTime);
    query = query.lte('sale_time', endTime);
  }

  query = query.order('sale_time', { ascending: true });

  await fetchPage(query);
  return allData;
}
