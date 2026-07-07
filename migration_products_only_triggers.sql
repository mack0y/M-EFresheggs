-- ============================================
-- Run ONLY this if tables already exist
-- ============================================

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
  IF NEW.cost_price > 0 AND NEW.selling_price > 0 THEN
    NEW.markup_percentage := ROUND(((NEW.selling_price - NEW.cost_price) / NEW.cost_price) * 100, 2);
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

-- RLS Policies
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
