-- ============================================
-- Migration: Add amount_paid column to deliveries table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add amount_paid column to deliveries table (matches product_deliveries schema)
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0);

-- Add index for efficient queries on amount_paid
CREATE INDEX IF NOT EXISTS idx_deliveries_amount_paid ON deliveries(amount_paid);

-- Update any existing records with default 0
UPDATE deliveries SET amount_paid = 0 WHERE amount_paid IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN deliveries.amount_paid IS 'Amount paid for this delivery (partial/full payment). Cost per tray is in cost_per_egg column.';