-- ============================================
-- Migration: Add Pricing & Revenue Tracking
-- Run this in your Supabase SQL Editor
-- Tables already exist, so this only adds:
--   1. price_settings table
--   2. total_amount column on sales
--   3. RLS policy + index
-- ============================================

-- 1. Create price_settings table (skip if already exists)
CREATE TABLE IF NOT EXISTS price_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  egg_size_id BIGINT UNIQUE NOT NULL REFERENCES egg_sizes(id) ON DELETE CASCADE,
  price_per_piece NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_per_piece >= 0),
  price_per_tray NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_per_tray >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default price records for any egg sizes that don't have them yet
INSERT INTO price_settings (egg_size_id, price_per_piece, price_per_tray)
SELECT id, 0, 0 FROM egg_sizes
WHERE id NOT IN (SELECT egg_size_id FROM price_settings);

-- 2. Add total_amount column to existing sales table (skip if already exists)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0);

-- 3. Enable RLS on price_settings (safe to re-run)
ALTER TABLE price_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy first to avoid duplicate policy errors
DROP POLICY IF EXISTS "Allow all on price_settings" ON price_settings;

CREATE POLICY "Allow all on price_settings" ON price_settings
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Create index (skip if already exists)
CREATE INDEX IF NOT EXISTS idx_price_settings_egg_size ON price_settings(egg_size_id);
