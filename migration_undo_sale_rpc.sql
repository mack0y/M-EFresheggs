-- Sprint 3 fix (#8): make Undo-sale transactional via Postgres RPC
-- Wraps sale delete + inventory restore in a single atomic transaction
-- so both succeed or both roll back together.

-- Single-sale undo: returns the deleted sale record
CREATE OR REPLACE FUNCTION undo_sale(p_sale_id BIGINT)
RETURNS SETOF sales
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_egg_count INTEGER;
BEGIN
  -- Fetch the sale before deleting so we can return it
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Calculate eggs to restore (piece unit uses qty as-is, tray unit multiplies by tray_size)
  IF v_sale.unit = 'tray' AND v_sale.tray_size IS NOT NULL THEN
    v_egg_count := v_sale.quantity * v_sale.tray_size;
  ELSE
    v_egg_count := v_sale.quantity;
  END IF;

  -- Delete the sale
  DELETE FROM sales WHERE id = p_sale_id;

  -- Restore inventory
  -- If this fails, the DELETE above is automatically rolled back because
  -- the entire function runs inside a single transaction.
  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand + v_egg_count,
      updated_at = NOW()
  WHERE egg_size_id = v_sale.egg_size_id;

  -- Return the deleted sale data
  RETURN NEXT v_sale;
  RETURN;
END;
$$;

-- Bulk-sale undo: accepts an array of sale IDs, returns all deleted records
CREATE OR REPLACE FUNCTION undo_sales(p_sale_ids BIGINT[])
RETURNS SETOF sales
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_egg_count INTEGER;
BEGIN
  -- Guard against null/empty input
  IF p_sale_ids IS NULL OR array_length(p_sale_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR v_sale IN SELECT * FROM sales WHERE id = ANY(p_sale_ids) LOOP
    IF v_sale.unit = 'tray' AND v_sale.tray_size IS NOT NULL THEN
      v_egg_count := v_sale.quantity * v_sale.tray_size;
    ELSE
      v_egg_count := v_sale.quantity;
    END IF;

    DELETE FROM sales WHERE id = v_sale.id;
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + v_egg_count,
        updated_at = NOW()
    WHERE egg_size_id = v_sale.egg_size_id;

    RETURN NEXT v_sale;
  END LOOP;

  RETURN;
END;
$$;

-- Allow the app roles to call these functions
GRANT EXECUTE ON FUNCTION undo_sale(BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undo_sales(BIGINT[]) TO anon, authenticated;
