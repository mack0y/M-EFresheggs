-- ============================================
-- Suppliers & Deliveries Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Suppliers table
CREATE TABLE suppliers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Deliveries table
CREATE TABLE deliveries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  egg_size_id BIGINT NOT NULL REFERENCES egg_sizes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'tray' CHECK (unit IN ('piece', 'tray')),
  tray_size INTEGER NOT NULL DEFAULT 30 CHECK (tray_size = 30),
  cost_per_egg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (cost_per_egg >= 0),
  total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  notes TEXT,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 4. Allow all operations (single-user app)
CREATE POLICY "Allow all on suppliers" ON suppliers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on deliveries" ON deliveries
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_egg_size ON deliveries(egg_size_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
