-- ============================================
-- FIX: Correct inventory backfill for sales/spoilage
-- Run this AFTER the initial migration_auto_inventory_on_delivery.sql
--
-- Two fixes:
-- 1. Update trigger functions with COALESCE for tray_size safety
-- 2. Subtract sales and spoilage from the backfilled inventory values
-- ============================================

-- ============================================
-- FIX 1: Update trigger functions with COALESCE
-- ============================================

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

-- ============================================
-- FIX 2: Correct the backfilled inventory values
-- ============================================

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

-- Show the corrected counts
SELECT 'Egg Inventory' AS type, egg_sizes.name, i.quantity_on_hand
FROM inventory i
JOIN egg_sizes ON egg_sizes.id = i.egg_size_id
ORDER BY egg_sizes.sort_order;

SELECT 'Product Stock' AS type, p.name, p.quantity_on_hand
FROM products p
ORDER BY p.name;
