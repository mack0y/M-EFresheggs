-- ============================================
-- Sprint 4 — #11: Add CHECK constraints to prevent negative quantities/amounts
-- Run this in your Supabase SQL Editor
-- ============================================
-- Idempotent: uses ADD CONSTRAINT IF NOT EXISTS everywhere.
-- Safe to re-run; skips columns that are already guarded.
--
-- ============================================
-- ALREADY GUARDED in base/migration schema (not re-added here):
-- ============================================
--   inventory.quantity_on_hand         >= 0   (database_schema.sql)
--   price_settings.price_per_piece     >= 0   (database_schema.sql)
--   price_settings.price_per_tray      >= 0   (database_schema.sql)
--   sales.quantity                     > 0    (database_schema.sql, strict: no zero-qty sales)
--   sales.total_amount                 >= 0   (database_schema.sql)
--   expenses.amount                    >= 0   (database_schema.sql)
--   spoilage.quantity                  > 0    (database_schema.sql, strict: no zero-qty spoilage)
--   deliveries.quantity                > 0    (migration_suppliers_deliveries.sql)
--   deliveries.cost_per_egg            >= 0   (migration_suppliers_deliveries.sql)
--   deliveries.total_cost              >= 0   (migration_suppliers_deliveries.sql)
--   deliveries.amount_paid             >= 0   (migration_add_amount_paid_to_deliveries.sql)
--   operational_funds.amount           > 0    (migration_operational_expenses.sql, strict: no zero-amount funds)
--
-- Notes on columns mentioned in #11 that do not exist in this schema:
--   spoilage.cost          — no cost column on spoilage (quantity-only tracking)
--   operational_funds.balance — balance is computed client-side, not stored per-row
-- ============================================

-- ============================================
-- 1. Products table
-- ============================================
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_cost_nonneg;
ALTER TABLE products ADD CONSTRAINT chk_products_cost_nonneg
  CHECK (cost >= 0);

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_price_nonneg;
ALTER TABLE products ADD CONSTRAINT chk_products_price_nonneg
  CHECK (price >= 0);

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_qty_on_hand_nonneg;
ALTER TABLE products ADD CONSTRAINT chk_products_qty_on_hand_nonneg
  CHECK (quantity_on_hand >= 0);

-- ============================================
-- 2. Product Sales table
-- ============================================
ALTER TABLE product_sales DROP CONSTRAINT IF EXISTS chk_product_sales_quantity_nonneg;
ALTER TABLE product_sales ADD CONSTRAINT chk_product_sales_quantity_nonneg
  CHECK (quantity > 0);

ALTER TABLE product_sales DROP CONSTRAINT IF EXISTS chk_product_sales_total_amount_nonneg;
ALTER TABLE product_sales ADD CONSTRAINT chk_product_sales_total_amount_nonneg
  CHECK (total_amount >= 0);

-- ============================================
-- 3. Product Deliveries table
-- ============================================
ALTER TABLE product_deliveries DROP CONSTRAINT IF EXISTS chk_product_deliveries_purchase_qty_nonneg;
ALTER TABLE product_deliveries ADD CONSTRAINT chk_product_deliveries_purchase_qty_nonneg
  CHECK (purchase_quantity > 0);

ALTER TABLE product_deliveries DROP CONSTRAINT IF EXISTS chk_product_deliveries_cost_per_unit_nonneg;
ALTER TABLE product_deliveries ADD CONSTRAINT chk_product_deliveries_cost_per_unit_nonneg
  CHECK (cost_per_purchase_unit >= 0);

ALTER TABLE product_deliveries DROP CONSTRAINT IF EXISTS chk_product_deliveries_total_cost_nonneg;
ALTER TABLE product_deliveries ADD CONSTRAINT chk_product_deliveries_total_cost_nonneg
  CHECK (total_cost >= 0);

ALTER TABLE product_deliveries DROP CONSTRAINT IF EXISTS chk_product_deliveries_amount_paid_nonneg;
ALTER TABLE product_deliveries ADD CONSTRAINT chk_product_deliveries_amount_paid_nonneg
  CHECK (amount_paid >= 0);
