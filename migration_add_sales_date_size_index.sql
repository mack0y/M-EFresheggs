-- ============================================
-- Migration: Add missing composite and supporting indexes
-- Fixes critical runtime breaker #5 — slow dashboard at scale
-- ============================================

-- 1. PRIMARY COMPOSITE INDEX: sales(sale_date, egg_size_id)
--    Covers the dashboard's most frequent query patterns:
--    - fetchTodaySales():       WHERE sale_date = today ORDER BY sale_time DESC
--    - fetchSales():            WHERE sale_date BETWEEN ? AND ? ORDER BY created_at DESC
--    - fetchSalesBySize():      WHERE sale_date BETWEEN ? AND ? ORDER BY sale_date ASC
--    - fetchSalesTrend():       WHERE sale_date >= ? ORDER BY sale_date ASC
--    - fetchSalesReport():      WHERE sale_date BETWEEN ? AND ? ORDER BY sale_time ASC
--    - getDailyRevenueCutPreview(): SELECT total_amount WHERE sale_date = today
--    The composite covers date-range filtering with optional egg_size_id grouping
--    (used client-side in Analytics). Single-column indexes existed on each column,
--    but the composite enables index-only scans for queries filtering both.
CREATE INDEX IF NOT EXISTS idx_sales_date_egg_size ON sales(sale_date, egg_size_id);


-- 2. DELIVERIES BATCH ID INDEX: deliveries(batch_id)
--    The deliveries table has a batch_id column (UUID) but NO index on it.
--    Query patterns that filter by batch_id:
--    - deleteDeliveryBatch(batchId): DELETE FROM deliveries WHERE batch_id = ?
--    - Deliveries grouped list in the UI filters by batch_id for expansion
--    - A batch can have 1–7 rows (one per egg size); scanning the whole table
--      to find them does not scale as the table grows.
CREATE INDEX IF NOT EXISTS idx_deliveries_batch_id ON deliveries(batch_id);


-- 3. COMPOSITE INDEX: operational_funds(fund_date, description)
--    The daily revenue cut feature makes two common queries that filter by
--    BOTH fund_date AND description together:
--    - getDailyRevenueCutPreview(): SELECT id WHERE fund_date = ? AND description = '1% Daily Revenue Cut'
--    - deleteDailyRevenueCut():     DELETE WHERE fund_date = ? AND description = '1% Daily Revenue Cut'
--    The existing idx_operational_funds_date covers date-only queries, but
--    the exact two-column match benefits from a composite covering both.
CREATE INDEX IF NOT EXISTS idx_operational_funds_date_desc ON operational_funds(fund_date, description);
