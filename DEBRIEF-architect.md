# M&E Fresh Eggs — Architect Debrief

**Date:** 2026-07-11  
**Agent:** architect  
**Scope:** Full codebase review — data layer, Supabase query patterns, API client architecture, state management, error handling, data flow from DB to UI.

---

## 1. Architecture Overview

### 1.1 Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | React 19 | Latest stable |
| **Bundler** | Vite 8 | Fast dev, manual chunk splitting |
| **Routing** | React Router v7 | `lazy()` + `Suspense` for all routes |
| **State** | Local `useState` only | No context, no Redux, no Zustand |
| **Backend** | Supabase (PostgreSQL) | REST client via `@supabase/supabase-js` |
| **Charts** | Recharts 3 | 6 chart tabs in Analytics |
| **PWA** | vite-plugin-pwa + Workbox | NetworkFirst caching for Supabase API |
| **Deploy** | GitHub Actions → GitHub Pages | Production base: `/M-EFresheggs/` |
| **Test** | Vitest | One test file (`formatters.test.js`) |

### 1.2 Structural Pattern

```
Components (UI + state)  →  lib/ (pure async data access)  →  supabaseClient
```

This is a **pure data-access-layer pattern**: every `lib/` module is a flat collection of exported async functions. No ORM, no service layer, no middleware chain. Components call these functions directly in `useEffect` or event handlers.

### 1.3 Route Architecture (App.jsx)

All 18 routes are lazy-loaded via `React.lazy()` + `Suspense`. Each route is wrapped in `<ErrorBoundary>`. Three legacy redirects exist (`/expenses` → `/expenses-funds`, `/operational-expenses` → `/expenses-funds`).

**Notable:** `ErrorBoundary` wraps each route individually rather than the entire `<Routes>` block. This is correct — one broken page doesn't crash the whole app — but the Toast system lives *outside* `<Suspense>` at the Layout level, ensuring notifications survive page crashes.

---

## 2. Data Layer Deep Dive

### 2.1 supabaseClient.js

Standard Supabase singleton initialization. Two issues:
- **Fallback placeholders**: If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, it creates a client pointing to `'https://placeholder.supabase.co'` with `'placeholder-key'`. This will produce confusing opaque errors at runtime rather than failing fast.
- **No validation**: A warning is logged to console (invisible in production PWA) but no error is thrown. The app will mount and render with broken queries.

### 2.2 api.js — The Barrel File

`api.js` is a **re-export barrel** — every public function from every domain module is re-exported here. This means:
- Components import from `'../lib/api'` and get everything
- No tree-shaking boundaries between domains
- No facade/adapter — the barrel is purely mechanical

**17 domain modules** re-exported through this barrel. Every component that needs data imports from this single module.

### 2.3 Domain CRUD Pattern (Inventory, Sales, Pricing, etc.)

Every domain module follows an identical pattern:

```javascript
import { supabase } from './supabaseClient';

export async function fetchXxx(params) {
  let query = supabase
    .from('table_name')
    .select('*, joined_table(name)')
    .order('field', { ascending: false });

  if (startDate) query = query.gte('date_field', startDate);
  if (endDate) query = query.lte('date_field', endDate);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}
```

**Key characteristics:**
1. **Throw-on-error**: Every function throws if Supabase returns an error. No graceful error handling at the data layer.
2. **No retry logic** (except `withRetry` in `errors.js` which is never imported by any domain module)
3. **Consistent signature**: All fetch functions accept `{ startDate, endDate, limit, offset }` destructured params
4. **Joins via Supabase**: Foreign key relations are resolved client-side using Supabase's GraphQL-style `.select('*, table(name)')` syntax
5. **Pagination via `.range()`**: Offset-based pagination (`offset` to `offset + limit - 1`)
6. **No transactions**: Multi-step operations (e.g., recording a sale + price lookup) are sequential `await` calls, not wrapped in a Supabase transaction

### 2.4 Sale Domain — The Most Complex

`sales.js` has the richest logic:

- **`recordSale()`**: Fetches current price first, calculates total, then inserts the sale record. The Supabase trigger `after_sale_insert` auto-deducts inventory.
- **`deleteSale()`**: Reverse operation — fetches the sale, deletes it, then manually restores inventory (+ egg count back). **No trigger for delete** — the restore is manual.
- **`deleteSales()`**: Bulk version with aggregated restore map keyed by `egg_size_id`. Restores inventory in a loop (sequential N queries).
- **Price fetch on record**: Each `recordSale()` call does 2 round-trips (price lookup + insert). This could be optimized with a single RPC call.

### 2.5 Delete Patterns — Two Approaches

**Pattern A — Single delete with inventory restore** (sales, productSales):
1. Fetch the record
2. Delete the record
3. Fetch current inventory
4. Update inventory (add back)

**Pattern B — Straight delete** (expenses, spoilage, customers, suppliers):
1. Just delete

Pattern A is used when the delete UNDOES a side effect (inventory deduction). Pattern B is used when no side effect exists OR when the trigger is insert-only.

**Pattern A has a race condition window**: Between deleting the sale (step 2) and restoring inventory (step 4), another concurrent operation could modify the same inventory row, causing incorrect final quantity.

### 2.6 Product Sales — Similar But Different

`productSales.js` follows the same pattern as `sales.js` but:
- Inventory is stored directly on `products.quantity_on_hand` (no separate table)
- Manual restore on delete (no trigger)
- Uses `parseFloat()` for quantity (eggs use integers, products use decimals)

### 2.7 Deliveries — Batch Operations

`deliveries.js` supports both single and batch insertion. Key design:
- `batch_id` (UUID) groups multiple rows from one delivery
- `recordDeliveryBatch()` generates a `crypto.randomUUID()` client-side
- Payment updates go to individual records, not batch-level
- Cost field `cost_per_egg` stores **cost per tray** (misleading column name documented in memory.md)

### 2.8 Funds & Daily Revenue Cut

`funds.js` is the only module with **business-specific logic**:
- `getDailyRevenueCutPreview()` — reads today's sales, calculates 1%, checks if already recorded
- `recordDailyRevenueCut()` — idempotency guard (rejects if already recorded)
- `getOperationalBalance()` — parallel fetch of all funds and expenses since `2026-06-19`
- `deleteDailyRevenueCut()` — date+description targeted delete

This module is the closest thing to a service layer — it contains business rules, not just CRUD.

### 2.9 Analytics — Client-Side Aggregation

`analytics.js` fetches raw data and leaves ALL aggregation to the client:
- `fetchSalesBySize()` — fetches all raw records, Analytics.jsx aggregates by size
- `fetchSalesByHour()` — fetches raw time records, Analytics.jsx aggregates by hour
- `fetchSalesTrend()` — fetches raw records, Analytics.jsx aggregates by day
- `fetchProfitMargins()` — fetches prices + deliveries, then computes margins client-side

This works for small datasets but won't scale. No server-side aggregation via SQL/Supabase functions.

### 2.10 Export — Everything at Once

`exportAllData()` fetches ALL 12+ tables simultaneously via `Promise.allSettled()`. Each table read is NOT paginated — for a business with years of data, this could be an unbounded fetch.

---

## 3. State Management Analysis

### 3.1 Local State Only

The entire app uses `useState()` in each component. There is:
- **No React Context** (except ToastContainer's callback registration pattern)
- **No Redux/Zustand/Jotai**
- **No custom hooks for shared state**
- **No persisted/cached state** (each mount re-fetches everything)

This means:
- Dashboard fetches the same data as SalesLog, even if both are mounted
- Every navigation triggers a complete re-fetch of that page's data
- No cache layer between components and Supabase

### 3.2 Data Loading Pattern

Every data-loading component follows this pattern:

```javascript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => { loadData(); }, []);

async function loadData() {
  try {
    setLoading(true);
    setError(null);
    const result = await fetchDomainData();
    setData(result);
  } catch (err) {
    console.error('...', err);
    setError(err);
  } finally {
    setLoading(false);
  }
}
```

Strengths: Simple, predictable, easy to reason about.
Weaknesses: No cache, no optimistic updates, every component manages its own loading/error state.

### 3.3 Custom Hooks

**`useTableState.js`** (100 lines):
- Pure client-side search, sort, selection, pagination
- ALL data must be loaded in memory first — no server-side search/sort
- Sort comparison handles numbers and strings separately (good practice)
- Page state is managed but data is ALWAYS the full set — pagination is merely visual slicing
- The `hasMore` flag is set by the caller, not derived from the hook itself

**`useConfirmDialog.js`** (26 lines):
- Simple open/close state for the ConfirmDialog component
- Only wraps a `useState(null)` with `openConfirm`/`closeConfirm` callbacks

### 3.4 Toast System — Clever Pattern

Toast uses a **callback registration pattern** instead of React Context:

1. `ToastContainer` mounts → calls `setToastHandler(addToast)` to register itself
2. `toastFn.js` stores the handler in a module-level variable
3. Any module calls `toast(message, type, action)` → the registered handler is invoked
4. `ToastContainer` unmounts → calls `setToastHandler(null)` to deregister

This avoids context imports in every data module. The trade-off: stale closure if the handler changes without re-registration, but the `useCallback` dependency array prevents this.

---

## 4. Error Handling Analysis

### 4.1 Error Classification

`errors.js` provides:
- **`isNetworkError(error)`** — pattern-matches error message against 9 network error patterns
- **`getUserFriendlyError(error)`** — maps error strings to user-facing messages (network, auth, notFound, server, validation, timeout)
- **`withRetry(fn, options)`** — exponential backoff retry (2 retries, 1s base delay) for network errors only

### 4.2 Error Usage Gap

Despite these utilities being well-designed:
- **No domain module imports errors.js** — every `lib/` function does `if (error) throw error` with no transformation
- **Only Dashboard.jsx and ExpensesFunds.jsx** use `getUserFriendlyError()` in their UI
- **No component uses `withRetry()`** — the retry utility exists but is never wired in
- Most components just do `console.error(...)` + `toast('Failed to load...', 'error')` — losing the specific error context

### 4.3 Error Boundary

A class-based `ErrorBoundary` wraps every route. Features:
- `getUserFriendlyError()` integration for message display
- Optional `showDetails` prop for dev mode (stack trace)
- "Try Again" button that resets error state
- Configurable `fallbackMessage` prop

The `showDetails` feature is **never passed as true** in App.jsx routes — all error boundaries use defaults.

---

## 5. Data Flow Diagrams

### 5.1 Sale Recording Flow

```
User clicks "Record Sale"
  → NewEggSale.jsx / SalesLog.jsx (form)
    → Client-side stock validation (salesUtils.validateStock)
    → recordSale({ eggSizeId, quantity, unit, traySize })
      → supabase.from('price_settings').select().eq('egg_size_id')  [fetch current price]
      → Calculate totalAmount (qty × price, client-side)
      → supabase.from('sales').insert() ... .select('*, egg_sizes(name)')  [insert sale]
        → [PostgreSQL TRIGGER: after_sale_insert]
          → UPDATE inventory SET quantity_on_hand -= egg_count
      → Returns inserted sale record with egg size name
  → Toast "Sale recorded!" with Undo button
  → reloadData()
```

### 5.2 Sale Delete (Undo) Flow

```
User clicks "Undo"
  → deleteSale(id)
    → supabase.from('sales').select('*').eq('id')  [fetch original sale]
    → supabase.from('sales').delete().eq('id')  [delete sale record]
    → Calculate egg count from sale (trays × tray_size or pieces)
    → supabase.from('inventory').select('quantity_on_hand').eq('egg_size_id')  [fetch current]
    → supabase.from('inventory').update({ quantity_on_hand: current + restored })  [restore]
  → Toast "Sale undone"
  → reloadData()
```

### 5.3 Dashboard Load Flow

```
Dashboard mounts + every 30s
  → loadData()
    → Promise.all([11 parallel queries]):
      1. fetchInventory()              → inventory with egg size names
      2. fetchTodaySales()             → today's sales with egg size names
      3. fetchTodayExpenses()          → today's expenses
      4. fetchInventoryValue()         → inventory × price per piece (client-side calc)
      5. fetchDeliveries(today)         → today's deliveries
      6. fetchCostsPerEgg()             → latest delivery cost per size
      7. getOperationalBalance()        → total funds - total expenses
      8. fetchSales(yesterday)          → yesterday's sales (for comparison)
      9. fetchSalesTrend(7)             → 7-day sales data
      10. fetchProducts()               → product catalog (for count + stock value)
      11. fetchTodayProductSales()      → today's product sales
    → Client-side aggregation:
      - Revenue, profit, COGS, margin
      - Best seller, sparkline, stock levels
      → setAllStates()
```

### 5.4 Expenses Flow with Funds

```
ExpensesFunds.jsx loads
  → loadAll()
    → Promise.all([
      getOperationalBalance(),         → total funds - total expenses
      fetchOperationalFunds(),          → all fund entries
      getDailyRevenueCutPreview(),     → today's cut status
    ])
    → fetchExpenses({ dateStart, dateEnd, limit: 50 })
  → Filtering pipeline:
    raw expenses → filter by category → useTableState(search + sort) → render
```

---

## 6. Database Schema Analysis

### 6.1 Tables (12 total)

| Table | Purpose | Key Columns | Notes |
|-------|---------|-------------|-------|
| `egg_sizes` | Lookup | id, name, sort_order | Seeded 7 sizes |
| `inventory` | Egg stock | egg_size_id (UNIQUE), quantity_on_hand | One row per size |
| `price_settings` | Selling prices | egg_size_id (UNIQUE), price_per_piece, price_per_tray | One row per size, upsert pattern |
| `sales` | Egg sales | egg_size_id, quantity, unit, total_amount, sale_date, sale_time | Trigger auto-deducts inventory |
| `expenses` | Business expenses | category, amount, expense_date | Categorical |
| `spoilage` | Egg wastage | egg_size_id, quantity, reason, spoilage_date | Trigger auto-deducts inventory |
| `deliveries` | Supplier deliveries | supplier_id, egg_size_id, cost_per_egg, batch_id | cost_per_egg = cost PER TRAY |
| `customers` | Directory | name, phone, notes | Simple CRUD |
| `suppliers` | Directory | name, phone, notes | Simple CRUD |
| `products` | Non-egg goods | name, cost, price, quantity_on_hand, markup | Dual-unit pricing |
| `product_sales` | Product sales | product_id, quantity, total_amount | No trigger, manual inventory |
| `product_deliveries` | Product deliveries | product_id, supplier_id, cost | Payment status per record |
| `operational_funds` | Capital | amount, description, fund_date | Running balance via client-side calc |

### 6.2 Triggers (2)

- **`after_sale_insert`**: Deducts `sales.quantity × sales.tray_size` from `inventory.quantity_on_hand`
- **`after_spoilage_insert`**: Deducts `spoilage.quantity` from `inventory.quantity_on_hand`

**Critical gap**: No trigger on DELETE. When a sale is deleted, inventory restore is done **manually** in `deleteSale()` JavaScript. If a sale is deleted directly in SQL or through the Supabase dashboard, inventory is silently wrong.

### 6.3 RLS

All tables use `FOR ALL USING (true) WITH CHECK (true)` — completely permissive. RLS is enabled but does nothing. This is documented as intentional for a single-user app.

### 6.4 Indexes

9 indexes on foreign keys and date columns. Well-chosen for the query patterns used.

---

## 7. Strengths

1. **Consistent module structure**: Every domain module follows the same pattern — easy to onboard new developers.
2. **Barrel export pattern**: Single import point (`../lib/api`) keeps imports clean.
3. **Self-healing toast undo**: Sale, expense, and daily cut actions all support undo with proper reverse logic.
4. **Client-side stock validation**: SalesLog and Spoilage check available stock before submitting, preventing useless round-trips.
5. **Error boundary per route**: Granular isolation — one crash doesn't kill the whole app.
6. **Parallel data loading**: Dashboard fires 11 queries concurrently with `Promise.all()`, minimizing waterfall latency.
7. **Batch UUIDs for deliveries**: Multi-size deliveries are naturally grouped without requiring a separate batch table.
8. **Idempotency guard on daily cut**: Checks `alreadyRecorded` before inserting — prevents double recording.
9. **PWA cache strategy**: NetworkFirst for Supabase API ensures offline resilience for cached data.
10. **Manual chunk splitting**: Sensible vendor splits (react, charts, UI, DB) for optimal caching.

---

## 8. Weaknesses & Risks

### 8.1 No Centralized State Management (Severity: Medium)

Every component is an island — no cache sharing, no optimistic updates, no stale-while-revalidate. The Dashboard re-fetches all 11 queries every 30 seconds, even if the user is looking at another tab. On a slow connection, every page navigation triggers a full load spinner.

**Risk**: As the app grows, the number of parallel queries per page will increase latency. The current approach doesn't scale to more complex dashboards.

### 8.2 No Auth Layer (Severity: Low/Medium)

The app uses Supabase anon key with permissive RLS. There's no user authentication. This is documented as intentional (single-user), but:
- Anyone with the anon key can read/write all data
- The anon key is in the client-side `.env` file bundled into the PWA
- There's no audit trail of who made changes

### 8.3 Race Condition in Delete+Inventory Restore (Severity: Medium)

`deleteSale()` and `deleteSales()` have a window between record deletion and inventory restoration. Consider:
1. Sale A (5 eggs, size Large) is deleted → sale deleted ✓
2. Sale B (3 eggs, size Large) is recorded → trigger deducts 3 from inventory
3. Step 1's restore runs → adds 5 back to now-reduced inventory → final = actual + 2

This is unlikely in a single-user app but becomes a real bug if two tabs are open or if undo is spammed.

### 8.4 Manual Inventory Sync on Delete (Severity: Low)

Every sale/product delete manually restores inventory in JavaScript. This is fragile because:
- It depends on the JS restoring the exact same egg count
- It doesn't run if the delete happens via Supabase dashboard
- It's repeated in two places (`deleteSale` and `deleteSales`) with nearly identical logic

**Better approach**: A PostgreSQL trigger `after_sale_delete` that reverses `after_sale_insert`.

### 8.5 No Server-Side Aggregation (Severity: Low)

Analytics, Reports, and Profits pages fetch raw records and aggregate client-side. This works for current data volumes but will become slow as the business grows. The Profits page, for example, could fetch thousands of sales records just to calculate a single daily total.

### 8.6 Infinite Fetch in Export (Severity: Low)

`exportAllData()` fetches ALL rows without pagination. For a business with 2+ years of data, this could be thousands of records per table (12 tables). No progress indication, no streaming, no chunking.

### 8.7 Misleading Column Name (Severity: Low)

`deliveries.cost_per_egg` stores cost PER TRAY, not per egg. Documented in memory.md but the column name will confuse anyone reading the schema directly.

### 8.8 Error Classification Not Wired (Severity: Low)

`errors.js` provides excellent error classification and retry logic, but no domain module or component (except Dashboard) uses it. Every component does `console.error` + generic toast. The retry mechanism is not used anywhere.

### 8.9 Unbounded "Load More" Pagination (Severity: Low)

Several lists use `Load More` pagination (page size 50). There's no upper limit — a user could click Load More 100 times and load 5000 records into the DOM. No virtual scrolling.

### 8.10 Client-Side Date Handling (Severity: Low)

`getLocalDate()` uses `toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })` which depends on the browser having the Asia/Manila timezone database. Some older browsers or unusual environments might not have this, producing incorrect dates.

---

## 9. Architectural Recommendations

### Short-term (low effort, high impact)

1. **Add DELETE triggers**: Create `after_sale_delete` and `after_spoilage_delete` PostgreSQL triggers that reverse the insert triggers. This eliminates the race condition and manual inventory restore code.

2. **Wire `withRetry` into domain modules**: Add retry wrapper to all `fetch*` functions in domain modules. Currently exists but unused.

3. **Add `getUserFriendlyError` to all error handlers**: Replace `console.error + generic toast` with classified error messages across all components.

### Medium-term (moderate effort)

4. **Add a lightweight cache layer**: Use a simple in-memory cache (Map with TTL) for frequently accessed read data (egg sizes, price settings). The Dashboard fetches price data on every 30s refresh but it changes rarely.

5. **Implement server-side pagination with search**: Replace client-side search/sort in `useTableState` with Supabase query parameters for large datasets.

6. **Add pagination to export**: Chunk the export to avoid unbounded fetches, or add a progress indicator.

### Long-term (high effort)

7. **Consider React Context or Zustand for shared state**: Dashboard data (inventory, prices) is fetched independently by Dashboard, SalesLog, and Spoilage. A shared store could significantly reduce redundant fetches.

8. **Add server-side aggregation**: Move analytics/report aggregation to PostgreSQL functions or a Supabase RPC. Reduces data transfer and client computation.

---

## 10. Transferable Patterns

Saved to `~/.hermes/subagents/architect/memory/`:

- **`pattern-barrel-without-service.md`**: The barrel re-export pattern works well for small apps but creates coupling as the app grows. Each domain module is a direct Supabase adapter, not a service with business logic.
- **`pattern-callback-toast.md`**: The `toastFn.js` callback registration pattern is a clean alternative to React Context for cross-cutting concerns. Avoids context imports in data modules.
- **`pattern-manual-inventory-restore.md`**: When DB triggers handle inserts but not deletes, the JS restore logic must mirror the trigger perfectly. This is fragile and should be a trigger on both sides.
- **`pattern-permissive-rls-intentional.md`**: Documented, intentional permissive RLS for single-user apps. The key is that it's documented as intentional, not an oversight.
- **`pattern-local-state-all-the-way.md`**: All-state-in-components works for apps with <25 components and no cross-cutting state dependencies. The absence of context/state library is a deliberate simplicity choice.

---

## 11. Files Read

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/supabaseClient.js` | 15 | DB client init |
| `src/lib/api.js` | 60 | Barrel re-exports |
| `src/lib/sales.js` | 157 | Sales CRUD + inventory restore |
| `src/lib/productSales.js` | 148 | Product sales CRUD |
| `src/lib/inventory.js` | 22 | Inventory CRUD |
| `src/lib/pricing.js` | 26 | Price settings upsert |
| `src/lib/expenses.js` | 65 | Expense CRUD |
| `src/lib/spoilage.js` | 61 | Spoilage CRUD |
| `src/lib/customers.js` | 31 | Customer CRUD |
| `src/lib/suppliers.js` | 31 | Supplier CRUD |
| `src/lib/deliveries.js` | 98 | Delivery + batch CRUD |
| `src/lib/products.js` | 84 | Product CRUD + pricing helpers |
| `src/lib/productDeliveries.js` | 65 | Product delivery CRUD |
| `src/lib/funds.js` | 151 | Operational funds + daily cut |
| `src/lib/analytics.js` | 153 | Analytics queries + margin calc |
| `src/lib/reports.js` | 32 | Shift-based report query |
| `src/lib/export.js` | 99 | All-data export + inventory value |
| `src/lib/salesUtils.js` | 101 | Sale calculations, validation |
| `src/lib/eggSizes.js` | 22 | Egg size lookup |
| `src/lib/utils.js` | 42 | Date, egg count, currency formatting |
| `src/lib/toastFn.js` | 10 | Toast handler registration |
| `src/lib/errors.js` | 74 | Error classification + retry |
| `src/lib/formatters.js` | 61 | Date/time/quantity formatting |
| `src/lib/formatters.test.js` | 242 | Unit tests |
| `src/hooks/useTableState.js` | 101 | Search/sort/select/pagination hook |
| `src/hooks/useConfirmDialog.js` | 27 | Confirm dialog state hook |
| `src/App.jsx` | 69 | Router + layout + suspense |
| `src/main.jsx` | 11 | Entry point |
| `src/components/Dashboard.jsx` | 1310 | Dashboard (heaviest component) |
| `src/components/ExpensesFunds.jsx` | 1093 | Expenses + funds page |
| `src/components/Layout.jsx` | 657 | App shell + navigation |
| `src/components/Toast.jsx` | 110 | Toast notification system |
| `src/components/ErrorBoundary.jsx` | 124 | Error boundary |
| `src/components/ConfirmDialog.jsx` | 113 | Confirmation modal |
| `src/components/…` | — | 16 other components (same patterns) |
| `database_schema.sql` | 179 | Full PostgreSQL schema |
| `vite.config.js` | 68 | Build + PWA config |
| `package.json` | — | Dependencies |
| `memory.md` | 1046 | Project documentation |
| `BRIEFING.md` | 131 | Crew briefing |
