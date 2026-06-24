-- ============================================
-- Egg Monitoring App - Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Egg Sizes lookup table
CREATE TABLE egg_sizes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert all egg sizes in order
INSERT INTO egg_sizes (name, sort_order) VALUES
  ('Peewee', 1),
  ('Pullet', 2),
  ('Small', 3),
  ('Medium', 4),
  ('Large', 5),
  ('Extra Large', 6),
  ('Jumbo', 7);

-- 2. Inventory table
CREATE TABLE inventory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  egg_size_id BIGINT UNIQUE NOT NULL REFERENCES egg_sizes(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial inventory records for all sizes
INSERT INTO inventory (egg_size_id, quantity_on_hand)
SELECT id, 0 FROM egg_sizes;

-- 3. Price Settings table (each egg size has its own per-piece and per-tray price)
CREATE TABLE price_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  egg_size_id BIGINT UNIQUE NOT NULL REFERENCES egg_sizes(id) ON DELETE CASCADE,
  price_per_piece NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_per_piece >= 0),
  price_per_tray NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_per_tray >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default price records for all sizes (set to 0 initially)
INSERT INTO price_settings (egg_size_id, price_per_piece, price_per_tray)
SELECT id, 0, 0 FROM egg_sizes;

-- 4. Sales table (now includes total_amount for monetary tracking)
CREATE TABLE sales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  egg_size_id BIGINT NOT NULL REFERENCES egg_sizes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'piece' CHECK (unit IN ('piece', 'tray')),
  tray_size INTEGER CHECK (tray_size IS NULL OR tray_size = 30),
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_time TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Expenses table
CREATE TABLE expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Spoilage table (egg wastage tracking)
CREATE TABLE spoilage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  egg_size_id BIGINT NOT NULL REFERENCES egg_sizes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL DEFAULT 'Unknown',
  spoilage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Customers table
CREATE TABLE customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Auto-update inventory when a sale is recorded
CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  egg_count INTEGER;
BEGIN
  -- Calculate egg count based on unit
  IF NEW.unit = 'tray' THEN
    egg_count := NEW.quantity * NEW.tray_size;
  ELSE
    egg_count := NEW.quantity;
  END IF;

  -- Deduct from inventory
  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand - egg_count,
      updated_at = NOW()
  WHERE egg_size_id = NEW.egg_size_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_sale_insert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_on_sale();

-- 9. Auto-update inventory when spoilage is recorded
CREATE OR REPLACE FUNCTION update_inventory_on_spoilage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand - NEW.quantity,
      updated_at = NOW()
  WHERE egg_size_id = NEW.egg_size_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_spoilage_insert
  AFTER INSERT ON spoilage
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_on_spoilage();

-- 7. Enable Row Level Security (for single-user app, allow all operations)
ALTER TABLE egg_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE spoilage ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anonymous users
CREATE POLICY "Allow all on egg_sizes" ON egg_sizes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on inventory" ON inventory
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on price_settings" ON price_settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on sales" ON sales
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on expenses" ON expenses
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on spoilage" ON spoilage
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_time ON sales(sale_time);
CREATE INDEX IF NOT EXISTS idx_sales_egg_size ON sales(egg_size_id);
CREATE INDEX IF NOT EXISTS idx_inventory_egg_size ON inventory(egg_size_id);
CREATE INDEX IF NOT EXISTS idx_price_settings_egg_size ON price_settings(egg_size_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_spoilage_date ON spoilage(spoilage_date);
CREATE INDEX IF NOT EXISTS idx_spoilage_egg_size ON spoilage(egg_size_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_operational_funds_date ON operational_funds(fund_date);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
