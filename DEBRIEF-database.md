# DEBRIEF — Database Schema & Data Layer Assessment

**Date:** 2026-07-11  
**Scope:** All SQL files, migrations, and `src/lib/*.js` query layer  
**Project:** M&E Fresh Eggs (M-EFresheggs)

---

## 1. Schema Overview & Table Relationships

### Core Schema (13 tables across 4 migration epochs)

| Table | Purpose | FK Relationships | Row-Level Security? |
|-------|---------|-----------------|---------------------|
| `egg_sizes` | Lookup (7 sizes, 1–7) | — | ✅ RLS + permissive policy |
| `inventory` | Stock per egg size (trays + pcs) | `egg_size_id → egg_sizes` (CASCADE) | ✅ |
| `price_settings` | Selling prices per egg size | `egg_size_id → egg_sizes` (CASCADE) | ✅ |
| `sales` | Egg sale records | `egg_size_id → egg_sizes` (CASCADE) | ✅ |
| `expenses` | Business expenses by category | — | ✅ |
| `spoilage` | Egg wastage tracking | `egg_size_id → egg_sizes` (CASCADE) | ✅ |
| `customers` | Contact directory | — | ✅ |
| `suppliers` | Contact directory | — | ✅ |
| `deliveries` | Egg supplier deliveries (batchable) | `supplier_id → suppliers` (CASCADE), `egg_size_id → egg_sizes` (CASCADE) | ✅ |
| `operational_funds` | Capital injections + daily revenue cut | — | ✅ |
| `products` | Non-egg product catalog | — | ✅ |
| `product_deliveries` | Product supplier deliveries | `supplier_id → suppliers`, `product_id → products` | ✅ |
| `product_sales` | Non-egg product sales | `product_id → products` | ✅ |

### Entity-Relationship Map

```
egg_sizes (1) ──< inventory (1:1 via UNIQUE egg_size_id)
egg_sizes (1) ──< price_settings (1:1 via UNIQUE egg_size_id)
egg_sizes (1) ──< sales (1:N)
egg_sizes (1) ──< spoilage (1:N)
egg_sizes (1) ──< deliveries (1:N)
suppliers (1) ──< deliveries (1:N)
suppliers (1) ──< product_deliveries (1:N)
products (1) ──< product_deliveries (1:N)
products (1) ──< product_sales (1:N)
```

**Key observation:** There is NO direct relationship between `sales`/`deliveries`/`spoilage` and `inventory` at the FK level. Inventory is updated via triggers (sale insert, spoilage insert) but NOT via FK constraints. This is a **design choice** (triggers instead of computed columns), but it has important implications.

---

## 2. Migration History & Ordering Issues

### Migration Epochs (in inferred execution order)

| # | Migration File | Tables Introduced | Key Features |
|---|---------------|-------------------|--------------|
| 0 | `database_schema.sql` | egg_sizes, inventory, price_settings, sales, expenses, spoilage, customers | Core schema, ALL triggers, ALL indexes, ALL RLS policies |
| 1 | `migration_suppliers_deliveries.sql` | suppliers, deliveries | Supplier directory + batchable egg deliveries |
| 2 | `migration_operational_expenses.sql` | operational_funds | Capital injection tracking |
| 3 | `migration_pricing.sql` | Adds price_settings (IF NOT EXISTS), total_amount column on sales | Retroactive pricing + revenue tracking |
| 4 | `migration_products.sql` | products, product_deliveries, product_sales | Full product catalog |
| 5 | `migration_products_fix.sql` | Adds columns to products, creates product_sales/deliveries | Fixes missing columns |
| 6 | `migration_products_only_triggers.sql` | — (triggers + RLS only) | Run after tables exist |

### Critical Migration Problem: `migration_pricing.sql` creates `price_settings` with `IF NOT EXISTS`, but `database_schema.sql` already created it unconditionally

The main `database_schema.sql` (line 37–48) creates `price_settings` **unconditionally** (no `IF NOT EXISTS`). The `migration_pricing.sql` (line 11) uses `IF NOT EXISTS`. If the main schema was run first (which it must have been), the pricing migration's `CREATE TABLE IF NOT EXISTS` is a no-op — but the migration's `INSERT ... WHERE id NOT IN (SELECT egg_size_id FROM price_settings)` (line 20–22) correctly avoids duplicates.

**Verdict:** Safe for re-runs, but the migration ordering is misleading — the "pricing migration" was clearly written retroactively.

### Migration ordering issue: `database_schema.sql` creates indexes for `deliveries` and `operational_funds` that DON'T EXIST yet at that point

Lines 176–177 of `database_schema.sql`:
```sql
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_operational_funds_date ON operational_funds(fund_date);
```

These are safe because of `IF NOT EXISTS`, but they are **orphaned — no errors, but dead code** since these tables are created in later migration files. The main schema references tables that don't exist yet.

### `migration_products_fix.sql` has a column-name mismatch bug

The `calculate_markup_on_save()` function in `migration_products_fix.sql` (line 54–55) references `NEW.cost` and `NEW.price`:
```sql
IF NEW.cost > 0 AND NEW.price > 0 THEN
    NEW.markup_percentage := ROUND(((NEW.price - NEW.cost) / NEW.cost) * 100, 2);
```

But the `products` table columns are called **`cost_price`** and **`selling_price`** (as seen in `migration_products.sql` line 15–16). This is a **bug**: the trigger will never calculate markup because `NEW.cost` and `NEW.price` don't exist on the table.

Compare with `migration_products.sql` (line 108) which correctly uses `NEW.cost_price` and `NEW.selling_price`:
```sql
IF NEW.cost_price > 0 AND NEW.selling_price > 0 THEN
```

And `migration_products_only_triggers.sql` (line 26–27) also correctly uses `cost_price`/`selling_price`.

**Verdict:** `migration_products_fix.sql` has a **broken trigger** — the markup calculation will never fire correctly if this migration was run.

---

## 3. Data Integrity Constraints — Assessment

### What's Good

| Constraint Type | Coverage | Examples |
|----------------|----------|---------|
| PKs | ✅ All tables | `BIGINT GENERATED ALWAYS AS IDENTITY` |
| UNIQUE | ✅ Critical paths | `egg_sizes(name)`, `inventory(egg_size_id)`, `price_settings(egg_size_id)`, `products(name)` |
| NOT NULL | ✅ Key columns | All FK columns, `quantity_on_hand`, `total_amount`, amounts |
| CHECK (> 0) | ✅ Stock/quantity | `inventory.quantity_on_hand >= 0`, `sales.quantity > 0`, `expenses.amount >= 0` |
| CHECK (IN lists) | ✅ Enums | `unit IN ('piece','tray')`, `payment_status IN ('unpaid','partial','paid')`, `tray_size = 30` |
| FK (CASCADE) | ✅ All foreign keys | `ON DELETE CASCADE` on all FKs |
| TIMESTAMPTZ | ✅ Correct type choice | All timestamps use timezone-aware type |

### What's Missing / Weak

**1. No CHECK constraint on `sales.tray_size` for piece-unit sales**
When `unit = 'piece'`, the `tray_size` column is `NULL` (the schema allows this: `CHECK (tray_size IS NULL OR tray_size = 30)`). This is correct by design.

**2. `spoilage.reason` has a DEFAULT 'Unknown' but no CHECK constraint**
The schema (line 77) uses `TEXT NOT NULL DEFAULT 'Unknown'` but has **no CHECK constraint** to enforce valid reasons. The JS code defines `SPOILAGE_REASONS = ['Cracked', 'Broken', 'Expired', 'Damaged', 'Other']` but the DB doesn't enforce this. Any string can be inserted.

**3. `expenses.category` has no CHECK constraint**
The schema has `category TEXT NOT NULL` — any string goes in. The JS code defines `EXPENSE_CATEGORIES = ['Feed', 'Labor', 'Utilities', 'Transport', 'Packaging', 'Maintenance', 'Misc']`, but the DB won't enforce it. Misspellings ("Maintanance") would pass through silently.

**4. No CHECK constraint on `deliveries.unit` allows 'piece' but business rule says 'tray only'**
The schema declares `CHECK (unit IN ('piece', 'tray'))`, but the migration comment and business rules state deliveries should be in trays only. The `unit` column accepts `'piece'` even though it shouldn't.

**5. No FK between `sales`/`deliveries`/`spoilage` and `inventory`**
Inventory is updated via triggers, not references. The `inventory.egg_size_id` UNIQUE constraint ensures 1:1 mapping with egg_sizes, but there's no explicit relationship on the transaction tables.

**6. `products` has no CHECK on `category`**
Like `expenses`, the `category` column (default 'Others') has no constraint. Any category string is valid.

**7. `unit_of_sale` and `purchase_unit` in `products` have defaults but no CHECK**
Columns default to 'pcs' but nothing enforces valid values.

---

## 4. Triggers — Analysis

### Trigger Inventory

| Trigger Name | Table | Event | Timing | Purpose | Correct? |
|-------------|-------|-------|--------|---------|---------|
| `after_sale_insert` | sales | AFTER INSERT | Per row | Deduct inventory on sale | ✅ |
| `after_spoilage_insert` | spoilage | AFTER INSERT | Per row | Deduct inventory on spoilage | ✅ |
| `after_product_sale_insert` | product_sales | AFTER INSERT | Per row | Deduct product inventory | ✅ |
| `before_product_update` | products | BEFORE UPDATE | Per row | Auto-calc markup % | ⚠️ Bug in one migration |

### Key Trigger Observations

**1. Sale trigger correctly handles tray→piece conversion** (line 98–102):
```sql
IF NEW.unit = 'tray' THEN
  egg_count := NEW.quantity * NEW.tray_size;
ELSE
  egg_count := NEW.quantity;
END IF;
```
This multiplies qty × 30 when the unit is 'tray'. ✅

**2. Spoilage trigger deducts `NEW.quantity` directly** — but spoilage quantity is in **pieces/eggs**, not trays. The database stores spoilage as individual egg counts (unlike sales which has unit/tray_size). However, there is no unit column on spoilage, so the trigger assumes quantity is always in pieces. **If someone records spoilage in tray units, the deduction would be wrong.** ⚠️

**3. NO trigger for inventory deduction on delivery insertion** 
When a delivery is recorded (supplier delivers eggs), the inventory should increase — but **there is NO trigger for this**. The JS code `recordDelivery` and `recordDeliveryBatch` don't update inventory either. **Deliveries never increase inventory** — this is a significant business logic gap. ⚠️⚠️

**4. Sale delete (in JS) manually restores inventory** — but this is client-side, not a trigger. If a sale is deleted outside the app (direct SQL), inventory is permanently out of sync. ⚠️

**5. BEFORE UPDATE markup trigger uses `cost`/`price` in one migration vs `cost_price`/`selling_price` in others** — see migration bug above.

**6. `GREATEST(0, ...)` in product sale trigger** prevents inventory from going negative:
```sql
quantity_on_hand = GREATEST(0, quantity_on_hand - NEW.quantity)
```
But the egg triggers (`after_sale_insert`, `after_spoilage_insert`) do **NOT** use `GREATEST(0, ...)` — they could drive inventory below zero if sales exceed stock. ⚠️

---

## 5. Indexes — Assessment

### Existing Indexes (13 total)

| Table | Index | Column(s) | Justification |
|-------|-------|-----------|---------------|
| sales | `idx_sales_date` | sale_date | ✅ Date-range queries (reports, analytics) |
| sales | `idx_sales_time` | sale_time | ✅ Shift-based reports |
| sales | `idx_sales_egg_size` | egg_size_id | ✅ FK join with egg_sizes |
| inventory | `idx_inventory_egg_size` | egg_size_id | ✅ Already UNIQUE index but still useful |
| price_settings | `idx_price_settings_egg_size` | egg_size_id | ✅ Already UNIQUE but fine |
| expenses | `idx_expenses_date` | expense_date | ✅ Date range queries |
| spoilage | `idx_spoilage_date` | spoilage_date | ✅ Date range queries |
| spoilage | `idx_spoilage_egg_size` | egg_size_id | ✅ FK join |
| deliveries | `idx_deliveries_date` | delivery_date | ✅ Date range + reports |
| deliveries | `idx_deliveries_supplier` | supplier_id | ✅ FK join |
| deliveries | `idx_deliveries_egg_size` | egg_size_id | ✅ FK join |
| operational_funds | `idx_operational_funds_date` | fund_date | ✅ Date range queries |
| customers | `idx_customers_name` | name | ✅ Sort/display |
| product_sales | `idx_product_sales_date` | sale_date | ✅ Date range queries |
| product_sales | `idx_product_sales_product` | product_id | ✅ FK join |
| products | `idx_products_category` | category | ✅ Filter by category |
| products | `idx_products_name` | name | ✅ Sort/display |
| suppliers | `idx_suppliers_name` | name | ✅ Sort/display |

### Missing Indexes

- `deliveries(batch_id)` — **Missing.** The `deliveries` table has a `batch_id UUID` column used for `deleteDeliveryBatch()` and grouping deliveries. There's no index on `batch_id`, so looking up all deliveries in a batch requires a full table scan. This will hurt performance as the table grows.
- `operational_funds(description)` — Low priority, but `funds.js` searches by `description = '1% Daily Revenue Cut'` to check if the daily cut was already recorded.

---

## 6. Query Pattern Analysis — JS vs Schema Alignment

### Sales Queries (`sales.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `recordSale` | `INSERT INTO sales (...) VALUES (...)` returning with join | ✅ All columns match | `tray_size` set to `null` for piece sales — matches schema constraint |
| `fetchSales` | `SELECT *, egg_sizes(name) ... ORDER BY created_at DESC` | ✅ | Correct join |
| `fetchTodaySales` | `SELECT *, egg_sizes(name) ... WHERE sale_date = today` | ✅ | Uses `getLocalDate()` (Asia/Manila) — correct for PHT |
| `deleteSale` | Manual inventory restore after DELETE | ⚠️ Client-side | See inventory sync concern below |
| `deleteSales` | Batch delete + aggregate restore map | ⚠️ Client-side | Same concern |

### Inventory Queries (`inventory.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `fetchInventory` | `SELECT *, egg_sizes(name, sort_order)` | ✅ | Correct join, ordered by sort_order |
| `updateInventory` | `UPDATE inventory SET quantity_on_hand = ?, updated_at = NOW()` | ✅ | Uses `.single()` which works with UNIQUE egg_size_id |

### Delivery Queries (`deliveries.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `recordDelivery` | `INSERT INTO deliveries (...) VALUES (...)` | ✅ | Maps `costPerTray` → `cost_per_egg` column — matches the naming convention |
| `recordDeliveryBatch` | `INSERT INTO deliveries (...) VALUES (multiple rows with batch_id)` | ✅ | UUID generated in JS with `crypto.randomUUID()` |
| `updateDeliveryPayment` | `UPDATE deliveries SET payment_status = ?, amount_paid = ?` | ❌ **Column `amount_paid` doesn't exist on `deliveries`** | The `deliveries` table schema has NO `amount_paid` column. This query will fail at runtime. |

### CRITICAL BUG: `updateDeliveryPayment` references `amount_paid` which doesn't exist on `deliveries`

In `deliveries.js` (line 77–89):
```js
await supabase
  .from('deliveries')
  .update({ 
    payment_status: paymentStatus, 
    amount_paid: parseFloat(amountPaid || 0) 
  })
```

The `deliveries` table (created in `migration_suppliers_deliveries.sql`) has columns: `id`, `supplier_id`, `egg_size_id`, `quantity`, `unit`, `tray_size`, `cost_per_egg`, `total_cost`, `payment_status`, `notes`, `delivery_date`, `batch_id`, `created_at`. There is **NO `amount_paid` column**.

The `product_deliveries` table DOES have `amount_paid` — it looks like this code was copy-pasted from `productDeliveries.js` without adjusting the column name.

**Impact:** This will throw a PostgreSQL error at runtime when a user tries to update delivery payment status with an amount.

### Expenses Queries (`expenses.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `recordExpense` | `INSERT INTO expenses (category, description, amount, expense_date)` | ✅ | Uses `getLocalDate()` — correct |
| `fetchExpenses` | `SELECT * ... ORDER BY expense_date DESC, created_at DESC` | ✅ | Paginated |

### Funds Queries (`funds.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `getDailyRevenueCutPreview` | `SELECT total_amount FROM sales WHERE sale_date = today` + `SELECT id FROM operational_funds WHERE fund_date = today AND description = '1% Daily Revenue Cut'` | ✅ | Two independent queries — correct |
| `recordDailyRevenueCut` | `INSERT INTO operational_funds (amount, description, fund_date)` | ✅ | Correct |
| `deleteDailyRevenueCut` | `DELETE FROM operational_funds WHERE fund_date = ? AND description = ?` | ✅ | Correct |
| `getOperationalBalance` | `SELECT amount FROM operational_funds` + `SELECT amount FROM expenses WHERE expense_date >= ?` | ✅ | Correct, but filters expenses from the start date — misses expenses before tracking start |

### Analytics Queries (`analytics.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `fetchSalesBySize` | `SELECT *, egg_sizes(name, sort_order) ... ORDER BY sale_date` | ✅ | Client-side aggregation by size |
| `fetchSalesByHour` | `SELECT sale_time, quantity, unit, tray_size` | ✅ | Minimal projection — efficient |
| `fetchSalesTrend` | `SELECT sale_date, quantity, unit, tray_size WHERE sale_date >= N days ago` | ✅ | Uses `getLocalDate()` for offset |
| `fetchCostsPerEgg` | `SELECT egg_size_id, cost_per_egg, tray_size FROM deliveries ORDER BY delivery_date DESC` | ✅ | Gets latest delivery per size |
| `fetchProfitMargins` | Complex multi-query (prices + deliveries) | ✅ | Client-side assembly |

### Products Queries (`products.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `addProduct` | `INSERT INTO products (name, category, unit, purchase_unit, ...)` | ❌ **Column name mismatch** | Inserts `unit` and `price` and `cost` — but the table columns are `unit_of_sale`, `selling_price`, `cost_price` |

### CRITICAL BUG: `addProduct` uses wrong column names for the `products` table

In `products.js` (lines 47–56):
```js
.insert({
  name,
  category: category || 'Others',
  unit: unitOfSale || 'piece',       // ❌ column is 'unit_of_sale'
  purchase_unit: purchaseUnit || 'piece',
  purchase_qty_per_unit: parseFloat(qtyPerPurchase) || 1,
  cost: costPrice,                    // ❌ column is 'cost_price'
  price: sellingPrice,                // ❌ column is 'selling_price'
  markup_percentage: markup,
})
```

The `products` table schema (from `migration_products.sql`):
- `unit_of_sale TEXT DEFAULT 'pcs'` — NOT `unit`
- `cost_price NUMERIC(10,2) DEFAULT 0` — NOT `cost`
- `selling_price NUMERIC(10,2) DEFAULT 0` — NOT `price`

Supabase's JS client will likely **ignore** unknown columns (or error, depending on server config). The `unit`, `cost`, and `price` fields would be silently dropped or cause a 400 error. This means:
- New products get **no unit_of_sale** (falls back to default 'pcs')
- New products get **no cost_price** (falls back to default 0)
- New products get **no selling_price** (falls back to default 0)

Also, `recordProductSale` in `productSales.js` (line 10–14) queries `products` for `price` column — but the column is `selling_price`. This query will return `undefined` for `productData.price`, causing `totalAmount` to always be 0.

### Product Sales Queries (`productSales.js`)

| Operation | Query | Schema Match | Issues |
|-----------|-------|-------------|--------|
| `recordProductSale` | `SELECT price FROM products WHERE id = ?` | ❌ **Column name mismatch** | Table has `selling_price`, not `price` |
| `fetchProductSales` | `SELECT *, products(name)` | ✅ | Correct |

---

## 7. Data Integrity Issues Summary

### Critical Bugs (Will Cause Runtime Errors)

1. **🔴 `deliveries.js:79-82` — `updateDeliveryPayment` writes to non-existent `amount_paid` column** on `deliveries` table. Copy-paste error from `productDeliveries.js`. Will throw Supabase 400 error.

2. **🔴 `products.js:50-53` — `addProduct` uses wrong column names** (`unit` → `unit_of_sale`, `cost` → `cost_price`, `price` → `selling_price`). New products will silently lose their pricing data.

3. **🔴 `productSales.js:11-12` — `recordProductSale` queries `products.price`** but the column is `products.selling_price`. Product sale amounts will always be 0.

4. **🔴 `migration_products_fix.sql:54` — Trigger references `NEW.cost` and `NEW.price`** but table has `cost_price` and `selling_price`. The markup trigger never fires correctly.

### High-Impact Gaps

5. **🟠 No delivery→inventory trigger or client-side update** — When eggs are delivered, inventory is never incremented. A business operator must manually add stock via the Inventory page.

6. **🟠 No `GREATEST(0, ...)` guard on egg sale/spoilage triggers** — Sale or spoilage of more eggs than available will drive inventory negative. Product trigger has this guard; egg triggers don't.

7. **🟠 No `batch_id` index on `deliveries`** — Batch operations (delete, group-display) require full table scan. Performance issue at scale.

8. **🟠 `spoilage.reason` and `expenses.category` have no CHECK constraints** — Any string value is accepted despite JS defining enums.

### Medium Issues

9. **🟡 `database_schema.sql` references non-existent tables** in its index creation section — creates `idx_deliveries_date` and `idx_operational_funds_date` before those tables exist. Safe due to `IF NOT EXISTS`, but confusing and indicates the schema was written as one monolithic script before migrations were separated.

10. **🟡 `reports.js` uses `.or()` for overnight shifts** — This works but the query pattern `sale_time.gte.X,sale_time.lte.Y` across date boundaries could be error-prone if date bounds aren't also properly handled. Time filter is applied on top of date filter, and overnight shifts span two dates. The date filter only covers one day.

11. **🟡 `deliveries.unit` allows 'piece' but business rules say tray-only** — The CHECK constraint accepts both values, but the `recordDeliveryBatch` JS code passes `unit` from the caller. A client bug could record piece-unit deliveries.

### Minor

12. **⚪ No `updated_at` auto-update trigger on `products`** — The table has `updated_at TIMESTAMPTZ`, but no `DEFAULT NOW()` is set for updates (only for inserts). The `before_product_update` trigger manually sets `NEW.updated_at = NOW()` in the markup function, but if that trigger is removed, `updated_at` stops updating.

13. **⚪ `customers` and `suppliers` tables are structurally identical** (name, phone, notes, created_at). Could have been a single `contacts` table with a `type` discriminator, but separate tables follow the simpler approach.

---

## 8. Recommendations

### Immediate Fixes

1. **Fix `deliveries.js`** — Remove `amount_paid` from the `updateDeliveryPayment` update payload:
   ```js
   .update({ payment_status: paymentStatus })
   // Remove: amount_paid: parseFloat(amountPaid || 0)
   ```
   Or add an `amount_paid` column to the `deliveries` table if this feature is needed.

2. **Fix `products.js`** — Use correct column names in `addProduct`:
   ```js
   unit_of_sale: unitOfSale || 'pcs',
   cost_price: costPrice,
   selling_price: sellingPrice,
   ```

3. **Fix `productSales.js`** — Query `selling_price` instead of `price`:
   ```js
   .select('selling_price')
   ...
   if (productData && productData.selling_price > 0) {
     totalAmount = parseFloat(quantity) * parseFloat(productData.selling_price);
   }
   ```

4. **Fix `migration_products_fix.sql`** — Change `NEW.cost`/`NEW.price` to `NEW.cost_price`/`NEW.selling_price` in the `calculate_markup_on_save` function.

### Short-Term Improvements

5. **Add `GREATEST(0, ...)` guard to sale and spoilage triggers** — prevents negative inventory from business logic errors.

6. **Add `batch_id` index to `deliveries`**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_deliveries_batch_id ON deliveries(batch_id);
   ```

7. **Add CHECK constraints for enumerated string columns** — `spoilage.reason`, `expenses.category`, `products.category`:
   ```sql
   ALTER TABLE spoilage ADD CONSTRAINT spoilage_reason_check 
     CHECK (reason IN ('Cracked', 'Broken', 'Expired', 'Damaged', 'Other', 'Unknown'));
   ```

8. **Add delivery→inventory update** — Either a trigger `AFTER INSERT ON deliveries` that increments inventory, or update `recordDelivery`/`recordDeliveryBatch` to call `updateInventory`.

### Architectural Considerations

9. **Consider consolidating schemas** — Having 7 separate migration files alongside `database_schema.sql` is confusing. Consider a single `schema.sql` file as source of truth, with numbered migrations for future changes.

10. **Add a composite index** on `sales(sale_date, sale_time)` for shift-report queries that filter by both date and time.

11. **Add a `delivery_inventory_sync` trigger** — When a delivery is inserted with `unit = 'tray'`, automatically add `quantity * tray_size` to `inventory.quantity_on_hand`:
    ```sql
    CREATE OR REPLACE FUNCTION update_inventory_on_delivery()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE inventory
      SET quantity_on_hand = quantity_on_hand + (NEW.quantity * NEW.tray_size),
          updated_at = NOW()
      WHERE egg_size_id = NEW.egg_size_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    ```

12. **Add FK from `sales`/`deliveries`/`spoilage` to `inventory`** — Optional but would enforce referential integrity. However, this would require inventory records to exist before sales could reference them (they already do — `inventory` is seeded from `egg_sizes`).

---

## 9. Cross-Reference: memory.md Alignment

The `memory.md` documentation is generally well-aligned with the actual schema, but a few discrepancies:

| Claim in memory.md | Actual Schema | Status |
|--------------------|--------------|--------|
| "deliveries.cost_per_egg stores cost PER TRAY" | ✅ Column exists, documentation is correct | ✅ |
| "Triggers: after_sale_insert, after_spoilage_insert" | ✅ Both exist | ✅ |
| "price_settings has UNIQUE egg_size_id" | ✅ Verified | ✅ |
| "sales table has total_amount" | ✅ Column exists | ✅ |
| "Products has unit_of_sale, cost_price, selling_price" | ✅ Column names correct (JS code is wrong) | ⚠️ |
| "RLS enabled but permissive" | ✅ All tables have permissive policies | ✅ |

---

## 10. File-by-File Summary

| File | Lines | Verdict |
|------|-------|---------|
| `database_schema.sql` | 178 | Solid base schema with a few out-of-place references |
| `migration_suppliers_deliveries.sql` | 46 | Clean, standalone, no issues |
| `migration_operational_expenses.sql` | 23 | Clean, minimal |
| `migration_pricing.sql` | 37 | Safe re-runnable, clearly retroactive |
| `migration_products.sql` | 150 | Comprehensive, correct column names |
| `migration_products_fix.sql` | 87 | **Bugged** — wrong column names in trigger |
| `migration_products_only_triggers.sql` | 59 | Correct column names (overrides fix migration) |
| `src/lib/products.js` | 83 | **Bugged** — wrong column names on insert + query |
| `src/lib/productSales.js` | 147 | **Bugged** — queries wrong column name |
| `src/lib/deliveries.js` | 97 | **Bugged** — writes to non-existent column |
| `src/lib/sales.js` | 156 | Clean, well-implemented manual inventory restore |
| `src/lib/inventory.js` | 21 | Clean |
| `src/lib/pricing.js` | 25 | Clean, uses upsert correctly |
| `src/lib/expenses.js` | 64 | Clean |
| `src/lib/funds.js` | 150 | Clean, well-documented |
| `src/lib/spoilage.js` | 60 | Clean |
| `src/lib/reports.js` | 31 | Clean, handles overnight shifts |
| `src/lib/analytics.js` | 152 | Clean, well-architected |
| `src/lib/export.js` | 98 | Clean, uses `Promise.allSettled` |

---

*End of debrief.*
