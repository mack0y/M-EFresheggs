-- ============================================
-- Sprint 4 — #14: Schema documentation migration (COMMENT-only)
-- Run this in your Supabase SQL Editor
-- ============================================
-- This file does NOT create or alter tables/columns/indexes.
-- It only adds SQL comments so future developers can
-- understand the schema by reading \d+ or pg_catalog,
-- without opening 6 migration files.
-- ============================================

-- ============================================
-- 1. TABLE DESCRIPTIONS
-- ============================================
COMMENT ON TABLE egg_sizes IS 'Lookup: 7 fixed egg sizes (1-7). Seed data inserted once.';
COMMENT ON TABLE inventory IS 'One row per egg size. Tracks pieces/eggs on hand (not trays). Updated by DB triggers on sale/spoilage.';
COMMENT ON TABLE price_settings IS 'One row per egg size. Selling prices: price_per_piece (per egg) and price_per_tray (per 30 eggs).';
COMMENT ON TABLE sales IS 'Individual egg sales. quantity is in the stated unit (piece or tray). tray_size is 30 when unit=tray, NULL when unit=piece.';
COMMENT ON TABLE expenses IS 'Business operating expenses by category. amount is always non-negative.';
COMMENT ON TABLE spoilage IS 'Egg wastage records. quantity is in eggs/pieces (no tray unit column).';
COMMENT ON TABLE customers IS 'Customer contact directory.';
COMMENT ON TABLE suppliers IS 'Supplier contact directory.';
COMMENT ON TABLE deliveries IS 'Egg supplier deliveries. Supports batched multi-size records via shared batch_id (UUID). cost_per_egg actually stores cost PER TRAY (30 eggs) — not per egg.';
COMMENT ON TABLE products IS 'Non-egg product catalog. quantity_on_hand tracked here directly (no separate inventory table).';
COMMENT ON TABLE product_sales IS 'Sales of non-egg products. quantity is in unit_of_sale units.';
COMMENT ON TABLE product_deliveries IS 'Supplier deliveries for non-egg products.';
COMMENT ON TABLE operational_funds IS 'Capital injections and 1% daily revenue cut. balance is computed client-side from funds minus expenses — NOT stored per row.';

-- ============================================
-- 2. COLUMN DESCRIPTIONS — TRAY-SIZED TABLES
-- ============================================
COMMENT ON COLUMN sales.unit IS '"piece" or "tray". tray_size is required when unit=tray.';
COMMENT ON COLUMN sales.tray_size IS 'Required egg count per tray when unit=tray. MUST be 30. NULL when unit=piece.';
COMMENT ON COLUMN deliveries.cost_per_egg IS 'MISLEADING NAME: this is the cost PER TRAY (30 eggs), not per individual egg. Legacy column name kept for API compatibility.';
COMMENT ON COLUMN deliveries.batch_id IS 'UUID shared across all rows from one multi-size delivery entry. Used to group and bulk-delete deliveries.';
COMMENT ON COLUMN deliveries.unit IS '"tray" is standard; "piece" is technically allowed by schema but JS UI enforces tray-only for this business.';
COMMENT ON COLUMN deliveries.amount_paid IS 'Amount paid so far for this delivery row. Supports partial payments (payment_status=partial). Added per migration_add_amount_paid_to_deliveries.sql.';
COMMENT ON COLUMN products.unit IS 'How this product is sold (e.g. pcs, kg, box, tray, can).';
COMMENT ON COLUMN products.purchase_unit IS 'How the supplier ships this product (e.g. pcs, kg, box, tray, can).';
COMMENT ON COLUMN products.purchase_qty_per_unit IS 'Conversion factor: how many sell-units equal one purchase-unit. E.g. 1 box = 30 pcs => purchase_qty_per_unit = 30.';
COMMENT ON COLUMN products.markup_percentage IS 'Auto-calculated by DB trigger before_product_update when cost and price are both > 0.';

-- ============================================
-- 3. CHECKS / BUSINESS RULES DOCUMENTED IN SQL
-- ============================================
COMMENT ON CONSTRAINT chk_sales_quantity_positive ON sales IS 'quantity > 0: zero-quantity sales are rejected at the DB layer.';
COMMENT ON CONSTRAINT chk_sales_total_amount_nonneg ON sales IS 'total_amount >= 0: revenue cannot be negative.';
COMMENT ON CONSTRAINT chk_deliveries_quantity_positive ON deliveries IS 'quantity > 0: zero-quantity deliveries are rejected.';
COMMENT ON CONSTRAINT chk_deliveries_total_cost_nonneg ON deliveries IS 'total_cost >= 0.';
COMMENT ON CONSTRAINT chk_deliveries_cost_per_egg_nonneg ON deliveries IS 'cost_per_egg >= 0. cost_per_egg is actually cost-per-tray.';
COMMENT ON CONSTRAINT chk_deliveries_amount_paid_nonneg ON deliveries IS 'amount_paid >= 0. Cannot overpay a single delivery row.';
COMMENT ON CONSTRAINT chk_spoilage_quantity_positive ON spoilage IS 'quantity > 0: zero-quantity spoilage records are rejected.';
COMMENT ON CONSTRAINT chk_products_qty_on_hand_nonneg ON products IS 'quantity_on_hand >= 0: product inventory cannot go below zero at the DB level (unlike egg inventory which relies on client-side checks).';
COMMENT ON CONSTRAINT chk_inventory_quantity_nonneg ON inventory IS 'quantity_on_hand >= 0. Enforced at insert/update only; triggers do not use GREATEST(0, ...) so sequential execution can still drive it negative (see known issues).';

-- ============================================
-- 4. TRIGGER DESCRIPTIONS
-- ============================================
COMMENT ON TRIGGER after_sale_insert ON sales IS 'After a sale is inserted, deduct eggs from inventory.quantity_on_hand. Multiplies by tray_size when unit=tray. No GREATEST(0,...) guard — concurrent or over-sale can drive inventory negative.';
COMMENT ON TRIGGER after_spoilage_insert ON spoilage IS 'After spoilage is recorded, deduct eggs from inventory.quantity_on_hand. Quantity is treated as piece count (no tray concept on spoilage). No GREATEST(0,...) guard.';
COMMENT ON TRIGGER after_product_sale_insert ON product_sales IS 'After a product sale, deduct products.quantity_on_hand. Uses GREATEST(0,...) so quantity never goes below zero (unlike egg sale trigger).';
