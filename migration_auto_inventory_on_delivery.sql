-- ============================================
-- Migration: Auto-update inventory on delivery
-- 
-- When a delivery is recorded, automatically add
-- stock to the appropriate inventory/stock table.
-- When a delivery is deleted (undo), reverse it.
--
-- Run this in your Supabase SQL Editor.
-- ============================================

-- ============================================
-- 1. EGG DELIVERIES → inventory.quantity_on_hand
-- ============================================

-- Insert trigger: add egg count to inventory
CREATE OR REPLACE FUNCTION update_egg_inventory_on_delivery_insert()
RETURNS TRIGGER AS $$
DECLARE
  egg_count INTEGER;
BEGIN
  egg_count := NEW.quantity * COALESCE(NEW.tray_size, 30);

  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand + egg_count,
      updated_at = NOW()
  WHERE egg_size_id = NEW.egg_size_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Delete trigger: subtract egg count from inventory
CREATE OR REPLACE FUNCTION update_egg_inventory_on_delivery_delete()
RETURNS TRIGGER AS $$
DECLARE
  egg_count INTEGER;
BEGIN
  egg_count := OLD.quantity * COALESCE(OLD.tray_size, 30);

  UPDATE inventory
  SET quantity_on_hand = GREATEST(0, quantity_on_hand - egg_count),
      updated_at = NOW()
  WHERE egg_size_id = OLD.egg_size_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate triggers (safe re-run)
DROP TRIGGER IF EXISTS after_delivery_insert ON deliveries;
CREATE TRIGGER after_delivery_insert
  AFTER INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_egg_inventory_on_delivery_insert();

DROP TRIGGER IF EXISTS after_delivery_delete ON deliveries;
CREATE TRIGGER after_delivery_delete
  AFTER DELETE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_egg_inventory_on_delivery_delete();


-- ============================================
-- 2. PRODUCT DELIVERIES → products.quantity_on_hand
-- ============================================

-- Insert trigger: add converted quantity to product stock
CREATE OR REPLACE FUNCTION update_product_inventory_on_delivery_insert()
RETURNS TRIGGER AS $$
DECLARE
  qty_per_unit NUMERIC;
  total_units NUMERIC;
BEGIN
  -- Get the purchase-to-sale unit conversion factor
  SELECT COALESCE(purchase_qty_per_unit, 1) INTO qty_per_unit
  FROM products
  WHERE id = NEW.product_id;

  -- Calculate total sale units (e.g., 10 boxes × 100 pcs/box = 1000 pcs)
  total_units := NEW.purchase_quantity * qty_per_unit;

  UPDATE products
  SET quantity_on_hand = quantity_on_hand + total_units,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Delete trigger: subtract converted quantity from product stock
CREATE OR REPLACE FUNCTION update_product_inventory_on_delivery_delete()
RETURNS TRIGGER AS $$
DECLARE
  qty_per_unit NUMERIC;
  total_units NUMERIC;
BEGIN
  SELECT COALESCE(purchase_qty_per_unit, 1) INTO qty_per_unit
  FROM products
  WHERE id = OLD.product_id;

  total_units := OLD.purchase_quantity * qty_per_unit;

  UPDATE products
  SET quantity_on_hand = GREATEST(0, quantity_on_hand - total_units),
      updated_at = NOW()
  WHERE id = OLD.product_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate triggers (safe re-run)
DROP TRIGGER IF EXISTS after_product_delivery_insert ON product_deliveries;
CREATE TRIGGER after_product_delivery_insert
  AFTER INSERT ON product_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_product_inventory_on_delivery_insert();

DROP TRIGGER IF EXISTS after_product_delivery_delete ON product_deliveries;
CREATE TRIGGER after_product_delivery_delete
  AFTER DELETE ON product_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_product_inventory_on_delivery_delete();


-- ============================================
-- 3. BACKFILL: Fix existing data
-- ============================================

-- Reset egg inventory to 0 and recompute from deliveries
UPDATE inventory SET quantity_on_hand = 0, updated_at = NOW();

WITH delivery_sums AS (
  SELECT
    egg_size_id,
    SUM(quantity * COALESCE(tray_size, 30)) AS total_eggs
  FROM deliveries
  GROUP BY egg_size_id
)
UPDATE inventory i
SET quantity_on_hand = GREATEST(0, i.quantity_on_hand + COALESCE(ds.total_eggs, 0)),
    updated_at = NOW()
FROM delivery_sums ds
WHERE i.egg_size_id = ds.egg_size_id;

-- Subtract sales from egg inventory
WITH sales_deductions AS (
  SELECT
    egg_size_id,
    SUM(CASE WHEN unit = 'tray' THEN quantity * COALESCE(tray_size, 30) ELSE quantity END) AS sold_eggs
  FROM sales
  GROUP BY egg_size_id
)
UPDATE inventory i
SET quantity_on_hand = GREATEST(0, i.quantity_on_hand - COALESCE(sd.sold_eggs, 0)),
    updated_at = NOW()
FROM sales_deductions sd
WHERE i.egg_size_id = sd.egg_size_id;

-- Subtract spoilage from egg inventory
WITH spoilage_deductions AS (
  SELECT egg_size_id, SUM(quantity) AS spoiled_eggs
  FROM spoilage
  GROUP BY egg_size_id
)
UPDATE inventory i
SET quantity_on_hand = GREATEST(0, i.quantity_on_hand - COALESCE(sd.spoiled_eggs, 0)),
    updated_at = NOW()
FROM spoilage_deductions sd
WHERE i.egg_size_id = sd.egg_size_id;

-- Reset product stock to 0 and recompute from product deliveries
UPDATE products SET quantity_on_hand = 0, updated_at = NOW();

WITH product_delivery_sums AS (
  SELECT
    pd.product_id,
    SUM(pd.purchase_quantity * COALESCE(p.purchase_qty_per_unit, 1)) AS total_units
  FROM product_deliveries pd
  JOIN products p ON p.id = pd.product_id
  GROUP BY pd.product_id
)
UPDATE products p
SET quantity_on_hand = GREATEST(0, p.quantity_on_hand + COALESCE(pds.total_units, 0)),
    updated_at = NOW()
FROM product_delivery_sums pds
WHERE p.id = pds.product_id;

-- Subtract product sales from product stock
WITH product_sales_deductions AS (
  SELECT product_id, SUM(quantity) AS sold_qty
  FROM product_sales
  GROUP BY product_id
)
UPDATE products p
SET quantity_on_hand = GREATEST(0, p.quantity_on_hand - COALESCE(psd.sold_qty, 0)),
    updated_at = NOW()
FROM product_sales_deductions psd
WHERE p.id = psd.product_id;
