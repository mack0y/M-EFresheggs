-- ============================================
-- Sprint 5 — #: Atomic inventory validation RPC
-- Prevents concurrent oversell race condition.
-- Uses SELECT FOR UPDATE to lock the row,
-- then validates stock is sufficient.
-- Actual deduction is handled by DB triggers.
-- Run this in your Supabase SQL Editor.
-- ============================================

-- Atomic egg inventory validation (lock + check, no deduction)
CREATE OR REPLACE FUNCTION validate_egg_stock(
  p_egg_size_id INT,
  p_quantity INT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current INT;
BEGIN
  SELECT quantity_on_hand INTO v_current
  FROM inventory
  WHERE egg_size_id = p_egg_size_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Inventory record not found for egg_size_id %', p_egg_size_id;
  END IF;

  IF v_current < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for egg_size_id %: have %, need %',
      p_egg_size_id, v_current, p_quantity;
  END IF;

  RETURN jsonb_build_object('success', true, 'available', v_current);
END;
$$;

-- Atomic product inventory validation (lock + check, no deduction)
CREATE OR REPLACE FUNCTION validate_product_stock(
  p_product_id INT,
  p_quantity NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  SELECT quantity_on_hand INTO v_current
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Product record not found for id %', p_product_id;
  END IF;

  IF v_current < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product_id %: have %, need %',
      p_product_id, v_current, p_quantity;
  END IF;

  RETURN jsonb_build_object('success', true, 'available', v_current);
END;
$$;
