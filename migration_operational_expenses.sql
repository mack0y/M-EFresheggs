-- ============================================
-- Operational Expenses Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Operational Funds table (tracks money added to the business)
CREATE TABLE operational_funds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  fund_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE operational_funds ENABLE ROW LEVEL SECURITY;

-- 3. Allow all operations (single-user app)
CREATE POLICY "Allow all on operational_funds" ON operational_funds
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_operational_funds_date ON operational_funds(fund_date);
