import { useState, useCallback, useMemo } from 'react';
import { fetchSales } from '../lib/api';
import { getLocalDate } from '../lib/api';
import { groupSalesByDate, getPeriodPresets } from '../lib/salesUtils';

export function useSalesList() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('today');
  const [startDate, setStartDate] = useState(getLocalDate());
  const [endDate, setEndDate] = useState(getLocalDate());
  const [customStart, setCustomStart] = useState(getLocalDate());
  const [customEnd, setCustomEnd] = useState(getLocalDate());

  const today = getLocalDate();
  const presets = getPeriodPresets(today);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const limit = filter === 'today' || (startDate && endDate) ? 500 : 100;
      const data = await fetchSales({ limit, offset: 0, startDate, endDate });
      setSales(data || []);
    } catch (err) {
      console.error('Sales load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filter, startDate, endDate]);

  const changePeriod = useCallback((key) => {
    setFilter(key);
    const preset = presets.find(p => p.key === key);
    if (preset && key !== 'custom') {
      setStartDate(preset.startDate);
      setEndDate(preset.endDate);
    } else if (key === 'custom') {
      setStartDate(customStart);
      setEndDate(customEnd);
    }
  }, [presets, customStart, customEnd]);

  const applyCustom = useCallback(() => {
    setStartDate(customStart);
    setEndDate(customEnd);
    setFilter('custom');
  }, [customStart, customEnd]);

  const groupedSales = useMemo(() => groupSalesByDate(sales, today), [sales, today]);

  const periodTotalEggs = useMemo(() =>
    sales.reduce((sum, s) => sum + (s.quantity * (s.unit === 'tray' ? (s.tray_size || 30) : 1)), 0),
    [sales]
  );

  const periodRevenue = useMemo(() =>
    sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
    [sales]
  );

  const retry = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    sales,
    groupedSales,
    loading,
    error,
    filter,
    startDate,
    endDate,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    presets,
    periodTotalEggs,
    periodRevenue,
    changePeriod,
    applyCustom,
    loadData,
    retry,
  };
}