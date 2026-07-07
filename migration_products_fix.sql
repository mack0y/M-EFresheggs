-- Add missing columns to existing products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_unit TEXT DEFAULT 'pcs';
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_qty_per_unit NUMERIC(10,4) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_on_hand NUMERIC(10,4) DEFAULT 0;

-- product_sales table (create only if missing)
CREATE TABLE IF NOT EXISTS product_sales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES products(id),
  quantity NUMERIC(10,4) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  sale_date DATE DEFAULT CURRENT_DATE,
  sale_time TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- product_deliveries table (create only if missing)
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

-- Triggers & Functions
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

DROP TRIGGER IF EXISTS after_product_sale_insert ON product_sales;
CREATE TRIGGER after_product_sale_insert
  AFTER INSERT ON product_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_product_inventory_on_sale();

CREATE OR REPLACE FUNCTION calculate_markup_on_save()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cost > 0 AND NEW.price > 0 THEN
    NEW.markup_percentage := ROUND(((NEW.price - NEW.cost) / NEW.cost) * 100, 2);
  ELSE
    NEW.markup_percentage := NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_product_update ON products;
CREATE TRIGGER before_product_update
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION calculate_markup_on_save();

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on products" ON products;
DROP POLICY IF EXISTS "Allow all on product_deliveries" ON product_deliveries;
DROP POLICY IF EXISTS "Allow all on product_sales" ON product_sales;

CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_deliveries" ON product_deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_sales" ON product_sales FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_sales_date ON product_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_product_sales_product ON product_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
