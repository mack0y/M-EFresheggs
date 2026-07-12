import { useState, useEffect, useCallback } from 'react';
import { fetchPriceSettings } from '../lib/api';

/**
 * Shared pricing state hook.
 *
 * Single source of truth for price_settings — both PriceSettings and
 * any other component that needs live prices should consume this hook
 * instead of duplicating fetch logic.
 */
export function usePricing() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (hasLoaded) return;

    let cancelled = false;

    async function loadPrices() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPriceSettings();
        if (!cancelled) {
          setPrices(data || []);
          setHasLoaded(true);
        }
      } catch (err) {
        console.error('Price load error:', err);
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [hasLoaded]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPriceSettings();
      setPrices(data || []);
      setHasLoaded(true);
    } catch (err) {
      console.error('Price load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { prices, setPrices, loading, error, reload };
}