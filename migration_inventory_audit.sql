-- ============================================
-- Migration: Inventory Audit Log
-- 
-- Records every change to inventory/stock values
-- so any future drift can be traced.
-- 
-- Run this in your Supabase SQL Editor.
-- ============================================

-- 1. Create audit log table
CREATE TABLE IF NOT EXISTS inventory_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id BIGINT NOT NULL,
  field_name TEXT NOT NULL DEFAULT 'quantity_on_hand',
  old_value NUMERIC NOT NULL DEFAULT 0,
  new_value NUMERIC NOT NULL DEFAULT 0,
  changed_by TEXT NOT NULL DEFAULT 'unknown',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_table ON inventory_audit(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_time ON inventory_audit(changed_at DESC);

-- 2. Trigger: log egg inventory changes
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.quantity_on_hand IS DISTINCT FROM NEW.quantity_on_hand THEN
    INSERT INTO inventory_audit (table_name, record_id, old_value, new_value, changed_by)
    VALUES ('inventory', OLD.egg_size_id, OLD.quantity_on_hand, NEW.quantity_on_hand, TG_TABLE_NAME || '_' || TG_OP);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_audit_trigger ON inventory;
CREATE TRIGGER inventory_audit_trigger
  AFTER UPDATE OF quantity_on_hand ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_change();

-- 3. Trigger: log product stock changes
CREATE OR REPLACE FUNCTION log_product_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.quantity_on_hand IS DISTINCT FROM NEW.quantity_on_hand THEN
    INSERT INTO inventory_audit (table_name, record_id, old_value, new_value, changed_by)
    VALUES ('products', OLD.id, OLD.quantity_on_hand, NEW.quantity_on_hand, TG_TABLE_NAME || '_' || TG_OP);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_stock_audit_trigger ON products;
CREATE TRIGGER product_stock_audit_trigger
  AFTER UPDATE OF quantity_on_hand ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_product_stock_change();

-- 4. Fix product sale trigger — remove GREATEST(0, …) so overselling is rejected
CREATE OR REPLACE FUNCTION update_product_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET quantity_on_hand = quantity_on_hand - NEW.quantity,
      updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Also fix egg sale trigger — add COALESCE on tray_size for safety
CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  egg_count INTEGER;
BEGIN
  IF NEW.unit = 'tray' THEN
    egg_count := NEW.quantity * COALESCE(NEW.tray_size, 30);
  ELSE
    egg_count := NEW.quantity;
  END IF;

  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand - egg_count,
      updated_at = NOW()
  WHERE egg_size_id = NEW.egg_size_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
