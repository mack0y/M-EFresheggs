-- ============================================
-- Fix: Update products unit check constraint
-- The frontend uses these unit values:
-- pcs, kg, box, tray, can, pack, bottle, sachet
-- 
-- The DB constraint only allowed: kg, box, tray, pack
-- This caused 400 errors when adding products
-- with unit='pcs' which is the frontend default.
-- ============================================

-- Drop the old constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;

-- Add new constraint with all valid unit values
ALTER TABLE products ADD CONSTRAINT products_unit_check
  CHECK (unit IN ('pcs', 'kg', 'box', 'tray', 'can', 'pack', 'bottle', 'sachet'));

-- Show the updated constraint
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'products'::regclass AND conname = 'products_unit_check';
