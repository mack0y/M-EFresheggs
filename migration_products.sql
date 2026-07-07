-- ============================================
-- Product Catalog Migration Script (Safe Re-run Version)
-- This version uses IF NOT EXISTS to avoid duplicate table errors
-- ============================================

-- 1. Products table (catalog of eggs, frozen goods, canned goods, etc.)
CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE,
  category TEXT DEFAULT 'Others',
  unit_of_sale TEXT DEFAULT 'pcs', -- pcs/kg/box/tray/can/etc.
  purchase_unit TEXT DEFAULT 'pcs', -- what supplier ships in
  purchase_qty_per_unit NUMERIC(10,4) DEFAULT 1, -- conversion: how many sell-units = 1 purchase-unit
  cost_price NUMERIC(10,2) DEFAULT 0,
  selling_price NUMERIC(10,2) DEFAULT 0,
  markup_percentage NUMERIC(5,2), -- stored as hint; computed client-side
  quantity_on_hand NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If table exists but is missing constraints/defaults, run these safe alterations:
ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Others';
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_sale TEXT DEFAULT 'pcs';
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_unit TEXT DEFAULT 'pcs';
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_qty_per_unit NUMERIC(10,4) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_on_hand NUMERIC(10,4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Product Deliveries table (supplier orders for products)
CREATE TABLE IF NOT EXISTS product_deliveries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id BIGINT REFERENCES suppliers(id),
  product_id BIGINT REFERENCES products(id),
  purchase_quantity NUMERIC(10,4) DEFAULT 0,
  cost_per_purchase_unit NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  amount_paid NUMERIC(10,2) DEFAULT 0,
  delivery_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id);
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id);
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS purchase_quantity NUMERIC(10,4) DEFAULT 0;
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS cost_per_purchase_unit NUMERIC(10,2) DEFAULT 0;
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0;
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE product_deliveries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Product Sales table (sales of non-egg products)
CREATE TABLE IF NOT EXISTS product_sales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES products(id),
  quantity NUMERIC(10,4) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  sale_date DATE DEFAULT CURRENT_DATE,
  sale_time TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id);
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,4) DEFAULT 0;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS sale_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS sale_time TIME DEFAULT CURRENT_TIME;
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- TRIGGERS & AUTOMATION
-- ============================================

-- Auto-update inventory when a product sale is recorded
CREATE OR REPLACE FUNCTION update_product_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET quantity_on_hand = GREATEST(0, quantity_on_hand - NEW.quantity),
      updated_at = NOW()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS after_product_sale_insert ON product_sales;

CREATE TRIGGER after_product_sale_insert
  AFTER INSERT ON product_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_product_inventory_on_sale();

-- Auto-calculate markup percentage when cost or selling price changes
CREATE OR REPLACE FUNCTION calculate_markup_on_save()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cost_price > 0 AND NEW.selling_price > 0 THEN
    NEW.markup_percentage := ROUND(((NEW.selling_price - NEW.cost_price) / NEW.cost_price) * 100, 2);
  ELSE
    NEW.markup_percentage := NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS before_product_update ON products;

CREATE TRIGGER before_product_update
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION calculate_markup_on_save();

-- ============================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow all on products" ON products;
DROP POLICY IF EXISTS "Allow all on product_deliveries" ON product_deliveries;
DROP POLICY IF EXISTS "Allow all on product_sales" ON product_sales;

-- Allow all operations for this single-user app
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_deliveries" ON product_deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_sales" ON product_sales FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_product_sales_date ON product_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_product_sales_product ON product_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
