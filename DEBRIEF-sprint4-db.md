# DEBRIEF — Database Hardening (#11 CHECK constraints + #14 schema docs)

**Date:** 2026-07-11  
**Agent:** subagent  
**Scope:** Sprint 4 DB hardening — quantity/amount CHECK constraints + schema documentation

---

## What you found

### Positive: Many constraints already exist
The base schema and prior migrations already guard most columns:
- `inventory.quantity_on_hand >= 0` (base schema)
- `sales.quantity > 0` and `total_amount >= 0` (base schema)
- `expenses.amount >= 0` (base schema)
- `spoilage.quantity > 0` (base schema)
- `deliveries.quantity > 0`, `cost_per_egg >= 0`, `total_cost >= 0` (suppliers migration)
- `deliveries.amount_paid >= 0` (amount_paid migration)
- `operational_funds.amount > 0` (operational expenses migration)

### Tricky: Two columns don't exist
- `spoilage.cost` — there is no cost column on spoilage (spoilage tracks quantity only; cost is implied/externally calculated).
- `operational_funds.balance` — balance is computed client-side across all rows, not stored per-row.

### Tricky: `products` and `product_sales` were unguarded
`products.cost_price`, `products.selling_price`, `products.quantity_on_hand`, `product_sales.quantity`, `product_sales.total_amount`, `product_deliveries.purchase_quantity`, `product_deliveries.cost_per_purchase_unit`, `product_deliveries.total_cost`, `product_deliveries.amount_paid` had no CHECK constraints.

### Tricky: JS code has column-name bugs (deferred to future sprint)
While writing the constraint migration, I confirmed the DB column-name issues flagged by the earlier database debrief:
- `products.js:49-53` uses `unit`, `cost`, `price` but schema columns are `unit_of_sale`, `cost_price`, `selling_price`
- `productSales.js:11-12` queries `products.price` but column is `selling_price`
- `migration_products_fix.sql:54-55` trigger references `NEW.cost`/`NEW.price` but columns are `cost_price`/`selling_price`

These are **not fixed here** — task was SQL-only, no code changes. JS bugs should be fixed in a future coding sprint.

---

## What you learned

1. **Always map schema columns against actual table definitions before writing constraints.** The task brief listed `spoilage.cost` and `operational_funds.balance` as targets, but neither exists. HEAD schemas from prior debriefs saved me from writing broken migration code.

2. **`ADD CONSTRAINT IF NOT EXISTS` lets you write truly idempotent CHECK migrations.** Unlike `NOT NULL` / `DEFAULT` which require `ADD COLUMN IF NOT EXISTS` per column, CHECK constraints live at the table level and use `ADD CONSTRAINT IF NOT EXISTS <name> CHECK (...)`.

3. **Documenting constraints via `COMMENT ON CONSTRAINT` is high-value.** Future devs working in Supabase SQL Editor can see business rules next to constraint names without hunting through 6 migration files.

4. **Comment-only migration files are genuinely useful for Supabase.** Supabase doesn't expose a single `schema.sql` view; comments survive across `\d+` and pg_catalog queries, making them the closest thing to inline documentation.

---

## What's unfinished

- **Fix JS column-name bugs** in `products.js`, `productSales.js`, `migration_products_fix.sql` — these are real runtime bugs but out of scope for SQL-only migration task.
- **Add `GREATEST(0, ...)` to egg sale/spoilage triggers** — currently they can drive `inventory.quantity_on_hand` negative if Qty sold > stock (product triggers already use `GREATEST`). DB constraint exists but trigger loophole bypasses it for negative inventory.
- **Verify the CHECK constraints land correctly** — run both SQL files in Supabase SQL Editor and confirm no errors.

---

## Files created

| File | Purpose |
|------|---------|
| `migration_add_quantity_constraints.sql` | CHECK constraints for products/product_sales/product_deliveries |
| `migration_consolidate_schema_notes.sql` | COMMENT-only schema documentation for all tables/columns/constraints/triggers |
