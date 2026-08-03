# M&E Fresh Eggs — Egg Monitor App

## Project Overview

A mobile-first web application for tracking egg inventory, recording sales, managing pricing, viewing sales analytics, generating shift-based reports, tracking expenses, and managing supplier deliveries. Built for **M&E Fresh Eggs**, an egg retail business.

**Live:** https://mack0y.github.io/M-EFresheggs/
**Supabase Project:** https://supabase.com/dashboard/project/npohyeqnaltpqzmmlmej

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| Language | JavaScript (JSX) |
| Routing | React Router v7 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Database | PostgreSQL (via Supabase) |
| Client | @supabase/supabase-js |
| Hosting | GitHub Pages (auto-deploy via GitHub Actions) |
| Build | `npm run build` → `dist/` |

---

## Project Structure

```
M-EFresheggs/
├── .env                        # Supabase credentials (gitignored)
├── package.json
├── vite.config.js              # Vite + React + PWA plugin
├── database_schema.sql
├── migration_pricing.sql
├── migration_suppliers_deliveries.sql
├── migration_operational_expenses.sql
├── migration_products.sql
├── migration_products_fix.sql
├── memory.md
├── eslint.config.js
├── .github/workflows/deploy.yml
├── README.md
├── public/
│   ├── logo.png                # Company logo / PWA icon
│   └── icons/
│       ├── icon.svg
│       ├── icon-192.png
│       └── icon-512.png    └── src/
    ├── main.jsx                # Entry point
    ├── App.jsx                 # Router + Layout + Suspense
    ├── index.css               # Design system (CSS variables, dark mode, animations)
    ├── lib/
    │   ├── supabaseClient.js   # Supabase connection
│   ├── api.js              # All data operations, pagination, exportAllData, APP_VERSION
│   ├── errors.js           # User-friendly error messages
│   ├── salesUtils.js       # Sale calculations, validation, grouping, quick qty chips
│   ├── products.js         # Product CRUD + pricing helpers
│   ├── productSales.js     # Product sales with inventory sync
│   ├── productDeliveries.js # Product delivery CRUD
│   ├── formatters.js       # Shared formatting (date, time, quantity)
│   └── toastFn.js          # Toast notification function
    └── components/
        ├── Layout.jsx          # Sidebar nav + mobile bottom nav + keyboard shortcuts + version badge
        ├── Dashboard.jsx       # Auto-refresh (30s), stat cards, stock alerts, today's feed
        ├── Inventory.jsx       # Add/remove stock by trays or pieces
        ├── SalesLog.jsx        # Search, sort, bulk delete, pagination, date filter, modal form
        ├── PriceSettings.jsx   # Per-piece & per-tray prices per egg size
        ├── Profits.jsx         # Revenue → Expenses → COGS = Net Profit with per-size breakdown
        ├── Analytics.jsx       # 6 chart tabs (by size, hour, trend, revenue, pie, margins)
        ├── Reports.jsx         # Shift-based reports, CSV export, Backup (JSON), deliveries
        ├── ExpensesFunds.jsx   # Combined expenses + operational funds, date filter, 1% daily cut
        ├── Spoilage.jsx        # Search, sort, bulk delete, pagination, undo toast
        ├── Customers.jsx       # Customer directory
        ├── Suppliers.jsx       # Supplier directory
        ├── Deliveries.jsx      # Multi-size batch form, search, bulk delete, pagination, undo
        ├── Products.jsx        # Product catalog with card grid, dual-mode pricing, search
        ├── ProductSales.jsx    # Product sales recording, date filters, bulk delete
        ├── ProductDeliveries.jsx # Product supplier deliveries, payment status, search
        ├── Toast.jsx           # Global notifications (undo action support, 5s duration)
        ├── ConfirmDialog.jsx   # Reusable confirmation modal (backdrop blur, scale-in)
        └── ErrorBoundary.jsx   # React error fallback UI
```

---

## Database Schema (Supabase PostgreSQL)

### Tables

#### `egg_sizes` — Lookup table (seeded)
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| name | TEXT UNIQUE | Peewee, Pullet, Small, Medium, Large, Extra Large, Jumbo |
| sort_order | INTEGER | 1–7 for ordering |
| created_at | TIMESTAMPTZ | Auto |

#### `inventory` — Stock per egg size
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| egg_size_id | BIGINT FK → egg_sizes | UNIQUE (one record per size) |
| quantity_on_hand | INTEGER | ≥ 0, default 0 |
| updated_at | TIMESTAMPTZ | Auto |

#### `price_settings` — Pricing per egg size
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| egg_size_id | BIGINT FK → egg_sizes | UNIQUE |
| price_per_piece | NUMERIC(10,2) | ≥ 0, default 0 |
| price_per_tray | NUMERIC(10,2) | ≥ 0, default 0 |
| updated_at | TIMESTAMPTZ | Auto |

#### `sales` — Sale records
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| egg_size_id | BIGINT FK → egg_sizes | |
| quantity | INTEGER | > 0 |
| unit | TEXT | 'piece' or 'tray' |
| tray_size | INTEGER | 30 (currently only 30-egg trays) |
| total_amount | NUMERIC(10,2) | Calculated from current prices at sale time |
| sale_date | DATE | Default today |
| sale_time | TIME | Default current time |
| created_at | TIMESTAMPTZ | Auto |

#### `expenses` — Expense tracking
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| category | TEXT | Feed, Labor, Utilities, Transport, Packaging, Maintenance, Misc |
| description | TEXT | Optional note |
| amount | NUMERIC(10,2) | ≥ 0 |
| expense_date | DATE | Default today |
| created_at | TIMESTAMPTZ | Auto |

#### `spoilage` — Egg wastage tracking
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| egg_size_id | BIGINT FK → egg_sizes | |
| quantity | INTEGER | > 0 |
| reason | TEXT | Cracked, Broken, Expired, Damaged, Other |
| spoilage_date | DATE | Default today |
| created_at | TIMESTAMPTZ | Auto |

#### `customers` — Customer directory
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| name | TEXT | NOT NULL |
| phone | TEXT | Optional |
| notes | TEXT | Optional |
| created_at | TIMESTAMPTZ | Auto |

#### `suppliers` — Supplier directory
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| name | TEXT | NOT NULL |
| phone | TEXT | Optional |
| notes | TEXT | Optional |
| created_at | TIMESTAMPTZ | Auto |

#### `operational_funds` — Funds added to the business for operations
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| amount | NUMERIC(10,2) | > 0 |
| description | TEXT | Optional note |
| fund_date | DATE | Default today |
| created_at | TIMESTAMPTZ | Auto |

#### `deliveries` — Supplier delivery records (multi-size batches)
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| supplier_id | BIGINT FK → suppliers | |
| egg_size_id | BIGINT FK → egg_sizes | |
| quantity | INTEGER | > 0 |
| unit | TEXT | 'tray' only |
| tray_size | INTEGER | 30 |
| cost_per_egg | NUMERIC(10,2) | ≥ 0 (stores cost per tray) |
| total_cost | NUMERIC(10,2) | ≥ 0 |
| payment_status | TEXT | unpaid, partial, paid |
| notes | TEXT | Optional |
| delivery_date | DATE | Default today |
| batch_id | UUID | Groups multiple sizes from one delivery |
| created_at | TIMESTAMPTZ | Auto |

### Triggers
- **`after_sale_insert`** — Automatically deducts `inventory.quantity_on_hand` when a sale is recorded. Converts trays to egg count (qty × tray_size) before deducting.
- **`after_spoilage_insert`** — Automatically deducts `inventory.quantity_on_hand` when spoilage is recorded.
- **`after_delivery_insert`** — Automatically adds to `inventory.quantity_on_hand` when an egg delivery is recorded.
- **`after_delivery_delete`** — Automatically subtracts from `inventory.quantity_on_hand` (with `GREATEST(0,...)` guard) when a delivery is deleted.
- **`after_product_delivery_insert`** — Automatically adds to `products.quantity_on_hand` (using `purchase_qty_per_unit` conversion) when a product delivery is recorded.
- **`after_product_delivery_delete`** — Automatically subtracts from `products.quantity_on_hand` (with `GREATEST(0,...)` guard) when a product delivery is deleted.
- **`after_product_sale_insert`** — Automatically deducts `products.quantity_on_hand` (with `GREATEST(0,...)` guard) when a product sale is recorded.

### RLS Policies
All tables use permissive policies (`ALL USING true`) since this is a single-user app. Row Level Security is enabled but allows all operations.

---

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Welcome greeting, revenue/profit stats, stock levels, today's sales & deliveries |
| `/inventory` | Inventory | Add/remove stock by trays or pieces per egg size |
| `/prices` | PriceSettings | Set per-piece and per-tray selling prices |
| `/sales` | SalesLog | Record sales, filter by date range (Today/This Week/Custom) |
| `/spoilage` | Spoilage | Track egg wastage by size, reason, with cost estimation |
| `/customers` | Customers | Customer directory (name, phone, notes) |
| `/suppliers` | Suppliers | Supplier directory (name, phone, notes) |
| `/deliveries` | Deliveries | Track supplier deliveries with cost & payment status |
| `/expenses-funds` | ExpensesFunds | Combined expenses + operational funds, date filter, 1% daily revenue cut |
| `/expenses` | → redirects to `/expenses-funds` | Legacy route |
| `/operational-expenses` | → redirects to `/expenses-funds` | Legacy route |
| `/products` | Products | Product catalog with card grid, add/edit modal, dual-mode pricing |
| `/product-sales` | ProductSales | Record product sales, date filters, bulk delete, undo |
| `/product-deliveries` | ProductDeliveries | Track product supplier deliveries with payment status |
| `/analytics` | Analytics | 5 chart views (by size, by hour, trend, revenue, distribution) |
| `/reports` | Reports | Shift-based sales reports with CSV export + revenue vs expenses + deliveries |
| `/profits` | Profits | Real-time profit dashboard with per-size breakdown, Net Profit focus |

---

## Design System (v2)

The design system lives in `src/index.css` with CSS custom properties.

### Color Scheme
**Brand colors:** Green & Yellow (cream background)

| Role | Light | Dark |
|------|-------|------|
| Primary | `#2E7D32` | `#66BB6A` |
| Background | `#F5F7F0` | `#0F1210` |
| Card | `#FFFFFF` | `#1A2019` |
| Text | `#1A2E1A` | `#E4E8E4` |
| Border | `#D4E4D4` | `#2A352A` |
| Warning | `#E65100` | `#FFB74D` |
| Danger | `#C62828` | `#EF5350` |

### Key CSS Variables
- `--shadow-xs` through `--shadow-xl` — Layered shadows
- `--radius-xs` through `--radius-full` — Border radii
- `--transition-fast`, `--transition-base`, `--transition-spring` — Animation timing
- `--space-xs` through `--space-2xl` — Spacing tokens
- `--color-primary-50/100/200` — Primary color opacity variants
- Dark mode via `[data-theme="dark"]` selector

### Animations
- `fadeIn` — Standard entrance animation (0.35s)
- `slideUp` — Toast/sheet entrance (0.35s with spring)
- `scaleIn` — Dialog entrance (0.2s with spring)
- `shimmer` — Loading skeleton pulse

---

## Layout & Navigation

### Desktop (≥768px)
- Fixed sidebar (260px) with logo, 15 nav items in 6 labeled sections, and dark mode toggle
- Nav sections: OVERVIEW, EGGS, PRODUCTS, FINANCIAL, DIRECTORY, REPORTS
- Main content area fills remaining width

### Mobile (<768px)
- **Fixed top header** with hamburger menu, logo, and dark mode toggle button
- **Bottom navigation bar** with 5 quick-access tabs (Home, Stock, Eggs, Costs, Stats) + More button
- Slide-out sidebar triggered by hamburger or More button
- Backdrop blur overlay on sidebar open
- Frosted glass effect on header and bottom nav (`backdrop-filter: blur(12px)`)
- Safe area inset support for iPhone notch (`env(safe-area-inset-bottom)`)
- FAB (Floating Action Button) for quick egg sale access

---

## Key Features

### Dashboard
- **Welcome greeting** with time-of-day emoji (🌅/☀️/🌙) and date
- **Quick Action Bar** — 6 color-coded shortcut buttons: Egg Sale (green), Product Sale (purple), Stock (blue), Delivery (teal), Prod. Delivery (amber), Expense (red)
- **Primary stat cards** — Today's Revenue (with ▲▼ % change vs yesterday), Net Profit (green/red based on positive/negative)
- **Insight cards row** — Best Seller Today (name, eggs, %), Profit Margin (%, green/red), 7-Day Sales Trend (SVG sparkline)
- **Secondary stat grid** — Total Stock, Stock Value, Total Sales Today (eggs + products), Operational Funds (with health progress bar), Expenses, Deliveries count, 1% Daily Cut, Product Catalog
- **Low stock alert card** — Shows out-of-stock sizes count with "Restock immediately" message
- **Stock levels list** with trays/pieces breakdown, status badges, and quick-restock (+1 tray) buttons
- **Today's sales feed** — Combined egg + product sales with amounts and times, with separate "Eggs"/"Products" navigation buttons
- **Today's deliveries feed** — Egg deliveries with supplier, egg size, quantity, cost, and payment status, with separate "Eggs"/"Products" navigation buttons
- Loading skeletons for all data
- Auto-refresh every 30 seconds

### Inventory Management
- Each egg size card shows total stock in trays + pieces format (e.g., "2 trays + 15 pcs")
- **Add row:** Tray count input + piece count input with plus buttons
- **Remove row:** Piece count input + tray count input with minus buttons
- Confirmation dialog before any removal
- Clear partial removal toast: "Could only remove X — all remaining stock cleared"
- Quick stock status badges: In Stock (green), Low Stock ≤50 (yellow), Out of Stock (red)

### Sales Recording
- Modal form with **visual egg size cards** (grid of tappable cards with stock status badges, out-of-stock grayed out)
- Selected size gets green border + checkmark — impossible to mis-select
- Unit toggle (piece/tray), quantity input
- Quick quantity chips (+1, +5, +10, +30 for pieces; +1, +2, +5, +10 for trays)
- Live price display and egg count conversion (e.g., "= 2 trays + 15 pcs")
- Auto-calculates total amount from current price settings
- **Client-side inventory validation** — shows "Not enough stock" error before DB failure
- Confirmation dialog before recording
- **Search bar** — filter sales by customer name or egg size
- **Sortable columns** — click headers to sort by size, qty, amount (default: newest first)
- **Bulk delete** — checkbox selection + "Delete Selected (X)"
- **Load More** pagination (50 per page)
- **Undo toast** after recording
- Date range filter (Today / Yesterday / This Week / This Month / Custom)
- Sales list grouped by date with collapsible sections
- Each sale shows eggs breakdown column (e.g., "2 trays + 5 pcs")
- Supabase trigger auto-deducts from inventory

### Expense Tracking
- Record expenses by category: Feed, Labor, Utilities, Transport, Packaging, Maintenance, Misc
- Optional description field
- Category summary breakdown with color-coded badges
- Filter expenses by category
- Today's total and total entries count

### Spoilage Tracking (`/spoilage`)
- Record egg wastage by size, quantity, reason (Cracked/Broken/Expired/Damaged/Other)
- **Client-side inventory validation** — prevents recording more than available stock
- Stats: total spoiled eggs, spoiled today, total cost lost, cost lost today
- Reason breakdown with color-coded badges
- Date picker for recording past spoilage
- Mobile-responsive card layout

### Customer Directory (`/customers`)
- Manage customer contacts: name, phone, notes
- Add and remove customers with confirmation
- Empty state with quick-add button
- Mobile-responsive layout

### Supplier Directory (`/suppliers`)
- Manage supplier contacts: name, phone, notes
- Add and remove suppliers with confirmation
- Empty state with quick-add button
- Mobile-responsive layout (same pattern as Customers)

### Operational Expenses (`/operational-expenses`)
- Track funds added to the business (capital injections)
- 3 summary cards: Total Funds Added, Total Expenses Spent, Available Balance
- Add funds form with amount, date, description
- Fund list with delete, confirmation dialogs
- Balance calculated as: SUM(funds) − SUM(all expenses)

### Delivery Tracking (`/deliveries`)
- **Multi-size batch form** — All egg sizes shown in a grid with qty + cost per tray inputs; fill in only the sizes received
- Single submission creates one DB row per size linked by a shared `batch_id`
- **Grouped list** — Batches shown as a single row with total qty + cost; expandable to see individual sizes
- Search by supplier name, record count ("Showing X batches")
- Payment status tracking (unpaid/partial/paid) with batch-level update dropdown
- Stats: total batches, total cost, unpaid amount, today's deliveries
- Bulk delete with checkbox selection (deletes entire batches)
- Undo toast after recording
- Load More pagination (50 per page)
- Cost preview in form before submission

### Reports
- Date range pickers (From / To)
- Shift selector: Morning (6AM–2PM), Afternoon (2PM–10PM), Whole Day, Custom
- Report table: Egg Size, Trays, Pieces, Total Eggs, Revenue, Transactions
- Total row with properly converted trays (pieces always < 30)
- Summary cards: Total Eggs Sold, Revenue, Transactions, Trays Sold, Pieces Sold
- **Deliveries table** — Shows all deliveries in the report period (supplier, size, qty, cost, payment status) with total cost
- **Revenue vs Expenses** — net profit calculation including delivery costs, with expense breakdown by category
- **CSV Export** button with sales, spoilage, deliveries, and customer data
- Print-friendly layout

### Profits Page (`/profits`)
- Real-time profit dashboard separate from Reports
- Loads data automatically with period selector (Today / This Week / This Month / Custom)
- Summary cards: Revenue, COGS, Expenses, **Net Profit** (Gross Profit removed)
- Per egg size table with color-coded margins
- Net profit breakdown strip: Revenue → Expenses → COGS = Net Profit

### Analytics
- 6 chart tabs using Recharts: By Size, By Time, Trend, Revenue, Distribution (Pie), Profit Margins
- **Responsive PieChart** using percentage-based radii (70%/35%)
- Date range selector: 7/30/90 days
- Summary stats: total revenue, total eggs sold, best-selling size, peak hour
- **Profit Margins tab** — Compares average delivery cost vs selling price per egg size with margin cards and grouped bar chart

### Dark Mode
- Toggle button in sidebar footer and mobile header
- Persists preference via `localStorage`
- Respects system `prefers-color-scheme` on first visit
- Full dark theme with `[data-theme="dark"]` selector
- Frosted glass effects preserved in dark mode

---

## Accessibility

All form fields across 10 components have proper `id` and `name` attributes:
- **Inventory.jsx** — Dynamic IDs per egg size (e.g., `inv-tray-add-{id}`)
- **SalesLog.jsx** — `sale-egg-size`, `sale-quantity`, `sale-filter-start/end`
- **Expenses.jsx** — `expense-category`, `expense-amount`, `expense-description`
- **Spoilage.jsx** — `spoilage-egg-size`, `spoilage-quantity`, `spoilage-reason`, `spoilage-date`
- **Customers.jsx** — `customer-name`, `customer-phone`, `customer-notes`
- **Suppliers.jsx** — `supplier-name`, `supplier-phone`, `supplier-notes`
- **Deliveries.jsx** — `delivery-supplier`, `delivery-egg-size`, `delivery-unit`, `delivery-quantity`, `delivery-cost`, `delivery-date`, `delivery-payment`, `delivery-notes`
- **PriceSettings.jsx** — Dynamic IDs with `htmlFor` on labels (e.g., `price-piece-{id}`)
- **Reports.jsx** — `report-start-date`, `report-end-date`, `report-start-time`, `report-end-time`
- **Analytics.jsx** — `analytics-days`

---

## API Layer (`src/lib/api.js`)

### Inventory
- `fetchInventory()` — Gets all inventory with egg size names
- `updateInventory(eggSizeId, quantity)` — Sets exact quantity_on_hand
- `fetchInventoryValue()` — Calculates total inventory monetary value

### Pricing
- `fetchPriceSettings()` — Gets all prices with egg size names
- `updatePriceSetting(eggSizeId, pricePerPiece, pricePerTray)` — Upserts by egg_size_id

### Sales
- `recordSale({ eggSizeId, quantity, unit, traySize })` — Records sale, calculates total, triggers inventory deduction
- `fetchSales({ limit, offset, startDate, endDate })` — Sales with date range + egg size names (offset pagination via `.range()`)
- `fetchTodaySales()` — Today's sales only
- `fetchSalesReport({ startDate, endDate, startTime, endTime })` — Shift-based report data with egg size info (overnight shift support)

### Sales Utils (`salesUtils.js`)
- `calculateSaleTotal(quantity, unit, traySize, priceSettings, eggSizeId)` — Computes total amount
- `validateStock(inventory, eggSizeId, quantity, unit, traySize)` — Client-side stock check
- `formatSaleForDisplay(sale)` — Returns formatted display string
- `groupSalesByDate(sales, today)` — Groups sales into date sections (Today/Yesterday/date)
- `getPeriodPresets(today)` — Returns filter presets for date range selectors
- `QUICK_QTY_CHIPS` — { piece: [1,5,10,30], tray: [1,2,5,10] }

### Analytics
- `fetchSalesBySize(startDate, endDate)` — Sales in date range for size/revenue breakdown
- `fetchSalesByHour(startDate, endDate)` — Sale times filtered by date range
- `fetchSalesTrend(days)` — Daily sales for trend line

### Expenses
- `fetchExpenses({ startDate, endDate, limit, offset })` — Filtered expense list (offset pagination)
- `fetchTodayExpenses()` — Today's expenses
- `recordExpense({ category, description, amount })` — Record a new expense

### Spoilage
- `fetchSpoilage({ startDate, endDate, limit, offset })` — Filtered spoilage list (offset pagination)
- `recordSpoilage({ eggSizeId, quantity, reason, spoilageDate })` — Record spoilage
- `fetchSpoilageWithCost({ startDate, endDate, limit, offset })` — Spoilage with cost estimation (offset pagination)

### Customers
- `fetchCustomers()` — Get all customers sorted by name
- `addCustomer({ name, phone, notes })` — Add a customer
- `deleteCustomer(id)` — Remove a customer

### Suppliers
- `fetchSuppliers()` — Get all suppliers sorted by name
- `addSupplier({ name, phone, notes })` — Add a supplier
- `deleteSupplier(id)` — Remove a supplier

### Deliveries
- `fetchDeliveries({ limit, offset, startDate, endDate })` — Deliveries with supplier & egg size names (offset pagination)
- `recordDelivery({ supplierId, eggSizeId, quantity, unit, traySize, costPerTray, totalCost, paymentStatus, notes, deliveryDate })` — Record a single-size delivery
- `recordDeliveryBatch({ supplierId, items, unit, traySize, paymentStatus, notes, deliveryDate })` — Record multiple sizes in one batch (generates batch_id UUID)
- `deleteDeliveryBatch(batchId)` — Delete all items in a batch
- `updateDeliveryPayment(id, paymentStatus)` — Update payment status
- `deleteDelivery(id)` — Remove a single delivery record
- `PAYMENT_STATUSES` — ['unpaid', 'partial', 'paid']
- List grouped by `batch_id`: multi-size submissions shown as expandable rows; old records (no batch_id) shown individually

### Exported Data and Limits (June 2026)
- **`exportAllData()`** — Fetches all tables (sales, deliveries, expenses, spoilage, inventory, prices, suppliers, customers) as a single JSON object
- **`APP_VERSION`** — `import.meta.env.VITE_APP_VERSION || '1.1.0'`
- **EGG_SIZES** — ['Peewee', 'Pullet', 'Small', 'Medium', 'Large', 'Extra Large', 'Jumbo']
- **EXPENSE_CATEGORIES** — ['Feed', 'Labor', 'Utilities', 'Transport', 'Packaging', 'Maintenance', 'Misc']
- **SPOILAGE_REASONS** — ['Cracked', 'Broken', 'Expired', 'Damaged', 'Other']
- **TRAY_SIZE** — 30 (eggs per tray)
- `getEggCount(sale)` — Converts sale record to total egg count
- `toTraysAndPieces(totalEggs)` — Returns `{ trays, pieces }` object
- `formatInventory(totalEggs)` — Returns string like "2 trays + 22 pcs" or "15 pcs"
- `formatPeso(amount)` — Returns string like "₱1,234.50"

---

## Shared Components

### Toast (`Toast.jsx`)
- Global notification system via `toast(message, type, action?)` function
- Auto-dismiss after 3 seconds (5 seconds if action button present)
- Types: success (green with checkmark), error (red with X)
- **Undo action** — Optional `{ label, onClick }` object renders an action button (e.g., "Undo")
- SVG icons, spring animation entrance (`slideUp`)

### ConfirmDialog (`ConfirmDialog.jsx`)
- Reusable modal for confirming destructive or important actions
- Props: `open`, `title`, `message`, `confirmLabel`, `variant`, `icon`, `onConfirm`, `onCancel`
- Backdrop blur overlay
- Scale-in animation with spring easing
- Click outside to dismiss

### ErrorBoundary (`ErrorBoundary.jsx`)
- Catches React rendering errors and shows a friendly fallback UI
- Wraps all routes in App.jsx

### Errors (`src/lib/errors.js`)
- `getUserFriendlyError(error)` — Converts Supabase/network errors to human-readable messages
- `withRetry(fn, options)` — Retry wrapper with exponential backoff for network errors

---

## Deployment

### GitHub Pages
- Auto-deploys on push to `main` via GitHub Actions
- Workflow: `.github/workflows/deploy.yml`
- SPA routing handled by copying `index.html` to `404.html`
- Supabase secrets injected as GitHub Secrets at build time
- Base path: `/M-EFresheggs/` in vite config

### Build
```bash
npm run build
# Output in dist/
npm run preview  # Preview the production build
```

### Manual Build with Stale Env Vars
```bash
unset VITE_SUPABASE_URL
unset VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_URL="https://npohyeqnaltpqzmmlmej.supabase.co" VITE_SUPABASE_ANON_KEY="sb_publishable_QlM4RGEizMrdybxn75T2gA_CYIx7kGi" npx vite build
```

---

## Setup Instructions

### 1. Database Setup
1. Create a Supabase project at https://supabase.com
2. Open **SQL Editor** → New Query
3. Run the entire `database_schema.sql` to create all tables, triggers, and seed data
4. Run `migration_suppliers_deliveries.sql` to add suppliers & deliveries tables

### 2. Environment Variables
Create `.env` file:
```
VITE_SUPABASE_URL=https://npohyeqnaltpqzmmlmej.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_QlM4RGEizMrdybxn75T2gA_CYIx7kGi
```

### 3. Run Locally
```bash
cd "C:/M-EFresheggs"
npm install
npm run dev
```

---

## Development Notes

- **Tray size is fixed at 30 eggs**
- **No authentication** — Single-user app with permissive RLS policies
- **PWA supported** — Service worker, manifest, installable to home screen (iOS + Android)
- **Mobile-first design** — Larger fonts, touch-friendly buttons (44px min), responsive grid, optimized for 375px+ screens
- **CSS uses inline `<style>` blocks** within each component (no CSS modules)
- **Design system v2** lives in `src/index.css` with CSS custom properties
- **All form fields have `id` and `name` attributes** for accessibility
- **Client-side inventory validation** before sales and spoilage recording
- **Keyboard shortcuts** — Ctrl+N for primary action, Escape to close forms (prioritizes sale modal → confirm dialog → Cancel button, handled in Layout.jsx)
- **Auto-refresh** — Dashboard refreshes every 30 seconds
- **Undo toasts** — Use `toast(msg, type, { label, onClick })` for reversible actions (5s duration)
- **Pagination** — All list components load 50 items at a time with "Load More" button
- **API pagination** — Uses `.range(offset, offset + limit - 1)` for offset-based pagination
- **Delivery batches** — Multiple egg sizes per delivery linked by `batch_id` UUID
- **ESLint clean** — 0 errors, 0 warnings
- **npm audit clean** — 0 vulnerabilities
- **Dark mode flash prevention** — Synchronous `<script>` in index.html sets `data-theme` before React renders, matching Layout.jsx's initialization logic

---

## Mobile Responsiveness

All pages are optimized for mobile viewing (375px+). Desktop layouts use responsive grid breakpoints at 640px and 900px.

| Page | Mobile Layout Strategy |
|------|----------------------|
| **Layout** | Fixed top header + bottom nav bar with 5 tabs + More button, slide-out sidebar |
| **Dashboard** | Primary stats stack to single column, secondary grid 2-col, compact padding |
| **Inventory** | Input fields tighten to 60px min-width, action labels shrink, card padding reduced |
| **Pricing** | Save button goes full-width under inputs, price badges truncate with ellipsis |
| **Sales Log** | 5-column grid → 2-column card layout (size+amount top, qty+eggs bottom), stacked filter bar |
| **Expenses** | 4-column grid → 2-column card layout (date+category left, amount right, desc full-width), stats stack |
| **Spoilage** | 4-column grid → card layout, stats stack |
| **Customers** | 4-column grid → card layout |
| **Suppliers** | 4-column grid → card layout (same as Customers) |
| **Deliveries** | 7-column grid → card layout with payment status, stats stack |
| **Analytics** | Chart tabs wrap naturally, PieChart uses responsive percentages |
| **Reports** | 2-column controls grid, shift tabs wrap, table has horizontal scroll |

---

## Recent Changes (Session Log)

### Auto-Update Inventory on Delivery (July 20, 2026)
- **Critical bug:** Delivering eggs (via Deliveries page) or products (via ProductDeliveries page) NEVER updated inventory/stock. No DB trigger or app code existed to add stock when a delivery was recorded. Products always showed 0 stock, egg inventory stayed at 0.
- **Fix:** Created `migration_auto_inventory_on_delivery.sql` with 4 DB trigger functions and 4 triggers:
  - `after_delivery_insert` — On egg delivery insert, adds `quantity × tray_size` to `inventory.quantity_on_hand`
  - `after_delivery_delete` — On egg delivery delete, subtracts eggs from inventory (with `GREATEST(0, ...)` guard)
  - `after_product_delivery_insert` — On product delivery insert, adds `purchase_quantity × purchase_qty_per_unit` to `products.quantity_on_hand`
  - `after_product_delivery_delete` — On product delivery delete, subtracts stock (with `GREATEST(0, ...)` guard)
- **Backfill:** Reset all inventory/stock to 0 and recomputed from historical deliveries, then subtracted existing sales and spoilage to get accurate current values
- **Fix SQL:** `migration_fix_inventory_backfill.sql` added `COALESCE(tray_size, 30)` for NULL safety and corrected backfill by subtracting sales + spoilage + product sales from recalculated values
- **Result:** Egg inventory now shows correct values (Pullet: 1,456, Small: 8,368, Medium: 2,140, etc.) — verified in browser with 0 console errors
- **Files changed:** `migration_auto_inventory_on_delivery.sql`, `migration_fix_inventory_backfill.sql`

## Bug Fixes Applied

### Critical/High
- **Inventory validation before sales/spoilage** — Client-side check prevents cryptic DB errors when stock is insufficient. Shows friendly "Not enough stock — only X eggs available" message.
- **Partial removal toast clarity** — Changed from "Removed 600 from Medium (stock was only 10)" to "Could only remove 10 from Medium — all remaining stock cleared (was 10)"

### Medium
- **Reports.jsx ESLint errors** — Fixed 2 unused `e` variables in catch blocks
- **Dashboard alert text** — Fixed misleading "Also 0 sizes low on stock" when only out-of-stock items exist; now shows "Restock immediately"
- **Analytics PieChart** — Changed from static `window.innerWidth` to responsive percentage-based radii (70%/35%)
- **PriceSettings error logging** — Added `console.error` in catch block instead of silent swallow

### Low
- **Reports.jsx processReport()** — Called on every render (acceptable at current scale)
- **Analytics/Dashboard** — `Promise.resolve().then()` workaround for setState-in-effect lint rule

---

### Partial Amount Input Fix (July 14, 2026)
- **Bug:** `value={partialAmountInput.toFixed(2)}` in both Deliveries.jsx and ProductDeliveries.jsx reformatted the number on every keystroke, preventing natural typing (e.g., typing "1" immediately became "1.00")
- **Fix:** Changed `partialAmountInput` state from `number` to `string`, removed `.toFixed(2)` from the input `value`, and parse to number only on save via `parseFloat(partialAmountInput) || 0`
- **Files changed:** `src/components/Deliveries.jsx`, `src/components/ProductDeliveries.jsx`

### Analytics Trend Date Range Fix (July 14, 2026)
- **Fix:** Added optional `endDate` parameter to `fetchSalesTrend()` and `fetchProductSalesTrend()` in `src/lib/analytics.js` for explicit upper date bound control
- **Files changed:** `src/lib/analytics.js`

### Analytics Trend 1000-Row Limit Fix (July 14, 2026)
- **Bug:** supabase-js v2 defaults to 1000-row limit on `.select()`. `fetchSalesTrend()` and `fetchProductSalesTrend()` sorted ascending by date, so the oldest 1000 rows filled the limit and newer dates were silently dropped — making the trend chart appear to stop a week+ behind
- **Fix:** Added `.limit(100000)` to both trend queries so all rows in the date range are returned
- **Files changed:** `src/lib/analytics.js`

### Analytics Trend PostgREST Pagination Fix (July 17, 2026)
- **Bug:** Supabase PostgREST server caps responses at 1000 rows regardless of client `.limit()`. The trend query with ascending date order only returned the oldest 1000 records, cutting off recent data
- **Fix:** Replaced `.limit(100000)` with chunked pagination using `.range()` in a loop, fetching 1000 rows at a time until all rows in the range are returned
- **Files changed:** `src/lib/analytics.js`

### Analytics Trend Revenue Line (July 17, 2026)
- **Change:** Added `total_amount` to `fetchSalesTrend` select and updated trend processing to track daily revenue alongside egg count
- **Change:** Added revenue line to trend chart (egg-only and combined views) with dual Y-axis (left: eggs, right: revenue)
- **Files changed:** `src/lib/analytics.js`, `src/components/Analytics.jsx`

### Batch Payment Amount Distribution Fix (July 17, 2026)
- **Bug:** When updating payment status for a batch delivery, every item received the same `amount_paid` value (e.g., 2 items at $50 each, entering $30 partial, set each to $30 — total $60 instead of $30)
- **Fix:** Amount is now distributed proportionally across items: each item gets `(item_cost / total_cost) × entered_amount`. For "paid" status, each item gets its own `total_cost`. For "unpaid", amounts set to 0.
- **Bug:** "Remaining: ₱X" always showed even when batch was fully paid
- **Fix:** Remaining column now hidden when batch status is "paid"
- **Bug:** `batchPaymentStatus` returned 'unpaid' when all items were 'partial' (missing `s === 'partial'` check)
- **Bug:** Payment dropdown didn't pre-fill current batch values (unlike ProductDeliveries)
- **Bug:** Clicking 'unpaid' status button didn't clear the amount to 0
- **Bug:** `handleBatchPaymentUpdate` overwrote existing partial payments instead of adding to them
- **Files changed:** `src/components/Deliveries.jsx`, `src/components/ProductDeliveries.jsx`

### Checkout Stock Error Fix (July 17, 2026)
- **Bug:** `executeCheckout` in `NewSale.jsx` and `NewProductSale.jsx` didn't pass `name` in the mapped item objects to `recordTransaction`. The stock validation fallback used `item.name` in error messages, producing "Not enough undefined stock" — which `getUserFriendlyError` didn't recognize, returning a generic "Something went wrong" instead.
- **Fix:** Added `name: i.name` to both `eggItems` and `productItems` mappings
- **Fix:** Added `stock` error type to `errors.js` with "Not enough stock..." message, triggered by "Not enough" or "Insufficient stock" patterns
- **Files changed:** `src/components/NewSale.jsx`, `src/components/NewProductSale.jsx`, `src/lib/errors.js`

## Recent Changes (Session Log)

### Supplier Delivery Tracking & Integration (June 2026)
- New `Suppliers.jsx` component — supplier directory (name, phone, notes)
- New `Deliveries.jsx` component — full delivery tracking with cost, payment status
- New `suppliers` and `deliveries` database tables with indexes and RLS
- New API functions: fetchSuppliers, addSupplier, deleteSupplier, fetchDeliveries, recordDelivery, updateDeliveryPayment, deleteDelivery
- Routes: `/suppliers` and `/deliveries`
- Nav: Suppliers (Building icon), Deliveries (Truck icon)
- SQL migration file: `migration_suppliers_deliveries.sql`
- Deliveries are log-only — no auto-inventory adjustment

### Deliveries in Reports & Dashboard
- **Reports.jsx** — Fetches deliveries for the report period, displays deliveries table (date, supplier, size, qty, unit, cost/egg, total cost, payment status), includes delivery costs in net profit calculation, adds deliveries section to CSV export
- **Dashboard.jsx** — Fetches today's deliveries, shows delivery count and delivery cost in secondary stat grid, adds "Today's Deliveries" card in content grid with supplier name, egg size, quantity, cost, and payment status badge

### UI/UX Overhaul
- Complete design system v2 with new CSS variables, shadows, transitions, radii
- Mobile bottom navigation bar with 5 quick tabs + More button
- Frosted glass effects on header and bottom nav
- Redesigned Dashboard with welcome greeting, primary/secondary stat cards, alert card
- Toast component: SVG icons, spring animations
- ConfirmDialog: backdrop blur, scale-in animation
- ErrorBoundary: updated to design system variables

### Accessibility Fixes
- Added `id` and `name` attributes to all form fields across all components
- Added `htmlFor` on labels in PriceSettings

### Bug Fixes
- Inventory validation before sales/spoilage recording
- Improved partial removal toast messages
- Fixed Reports.jsx ESLint errors
- Fixed Dashboard alert subtitle text
- Responsive PieChart sizing
- PriceSettings error logging

### Timezone Bug Fix (June 2026)
- **Critical fix:** All DATE column operations now use `getLocalDate()` instead of `toISOString().split('T')[0]`
- **Problem:** UTC-based dates caused entries between midnight–8 AM (Philippine time) to be stored with the previous day's date
- **Solution:** Added `getLocalDate()` helper using `toLocaleDateString('en-CA')` for correct local timezone dates
- **Affected components:** Dashboard, SalesLog, Expenses, Analytics, Deliveries, Reports, Spoilage, Suppliers
- **Affected API functions:** recordSale, fetchTodaySales, fetchSalesTrend, fetchTodayExpenses, recordExpense
- **Dashboard optimization:** Fetches only today's deliveries instead of fetching 200 and filtering client-side
- **Note:** `TIMESTAMPTZ` columns (updated_at) still correctly use `toISOString()` — only `DATE` columns were affected
- **Note:** Existing records stored with wrong UTC dates are not retroactively fixed; only new entries use correct local dates

### Profit Margins per Egg Size (June 2026)
- New `fetchProfitMargins()` API function — calculates average cost per egg from deliveries vs selling price from price_settings
- New "Margins" tab in Analytics — shows margin summary cards (cost, selling price, profit per size) and grouped bar chart comparing cost vs selling price
- Margins load once on mount (not time-dependent)
- Edge case: sizes with deliveries but no price set are filtered out to avoid misleading 100% margins
- Browser tested: renders correctly, shows empty state when no delivery/price data

### Delivery Unit Simplified (June 2026)
- **Deliveries.jsx** — Removed "Piece" unit option from Record Delivery form; all deliveries are now recorded by tray only
- Removed unit dropdown, simplified `calculateTotalCost()`, `executeDelivery()`, and `formatQuantity()` to always use tray math
- Updated confirm dialog and form state to remove piece references

### Pricing Changed to Cost per Tray (June 2026)
- **Deliveries.jsx** — Changed "Cost per Egg" input to "Cost per Tray" since deliveries are only in trays
- **Total cost calculation** — Now `quantity × costPerTray` instead of `quantity × TRAY_SIZE × costPerEgg`
- **api.js** — `recordDelivery()` parameter renamed from `costPerEgg` to `costPerTray` for clarity
- **Reports.jsx** — Updated table and CSV headers from "Cost/Egg" and "Cost per Egg" to "Cost/Tray" and "Cost per Tray"
- **DB note:** The `cost_per_egg` column now stores cost per tray; all downstream calculations (profit margins, averages) still work correctly

### Bug Fixes Audit (June 2026)
- **Inventory.jsx** — Fixed hardcoded `30` (tray size) — now uses `TRAY_SIZE` constant from api.js in 4 places; added missing import
- **Spoilage.jsx** — Increased `fetchSpoilageWithCost` limit from 200 to 1000 for more accurate total stats
- **Reports.jsx** — Added `console.error` logging to previously empty catch blocks in CSV export (spoilage and customers fetch failures)
- **ESLint clean** — 0 errors, 0 warnings confirmed after all fixes

### Performance Optimization (June 2026)
- **Route-based code splitting** — All 10 page components use `React.lazy()` + `<Suspense>` for on-demand loading; initial bundle reduced from 1,004 kB to ~242 kB (75% reduction)
- **Vendor chunk splitting** — `vendor-react` (219 kB), `vendor-charts` (387 kB), `vendor-db` (201 kB), `vendor-ui` (10 kB) split into separate cacheable chunks
- **CSS deduplication** — Removed duplicate `.error-banner` and `.page-header-row` CSS from Dashboard.jsx and Inventory.jsx inline styles (already defined in index.css)
- **Build time** — 306ms, 21 chunks total, no warnings

### Sale Amount Preview in Form (June 2026)
- **SalesLog.jsx** — Added live "Total the customer pays" preview to the New Sale form
- Shows calculated total based on selected egg size, quantity, and unit (piece/tray) using current price settings
- Matches the same preview pattern used in the delivery form — green banner with formatted peso amount
- Fetches `priceSettings` alongside inventory data on load; gracefully handles missing prices or zero amounts

### Deploy Fix (June 2026)
- **package-lock.json** — Regenerated to fix GitHub Actions deploy failure at the `npm ci` step
- Deploys now complete successfully on push to main

## PWA Support (June 2026)
- Web app is now an installable PWA with service worker and manifest
- `vite-plugin-pwa` with Workbox runtime caching for Supabase API responses (NetworkFirst, 24hr cache)
- Manifest: standalone display, portrait orientation, installable to home screen
- Apple-specific meta tags for iOS standalone mode
- Icons: logo.png (any), icon-192.png, icon-512.png (maskable)

### Revenue vs Expenses Removed from Reports
- **Both web app and mobile** — Removed the entire Revenue vs Expenses section (net profit calculation, expense breakdown, profit cards)
- Removed TrendingUp and TrendingDown icon imports
- Removed associated variables (totalExpenses, netProfit, expenseByCategory, COGS calculations)
- Kept totalDeliveryCost for the Deliveries table total row
- Reports now shows: Sales table → Deliveries table → Footer

### Overnight Shift Bug Fix
- **Bug:** Custom shift from 7:00 PM to 9:35 AM (overnight, crossing midnight) returned empty reports because the sale_time filter used AND (`>= 19:00 AND <= 09:35` — impossible condition)
- **Fix:** In `fetchSalesReport()`, checks if startTime > endTime. If overnight, uses OR filter (`sale_time >= 19:00 OR sale_time <= 09:35`) instead of AND

### Dedicated Profits Page (June 2026)
- **New `/profits` route** — Real-time profit dashboard separate from Reports
- **Profits.jsx** — Loads data automatically with period selector (Today / This Week / This Month / Custom)
- **6 summary cards** — Revenue, COGS, Expenses, Gross Profit, Net Profit, Eggs Sold
- **Per egg size table** with color-coded margins
- **Net profit breakdown strip** — Revenue → Expenses → COGS = Net Profit

### Mobile PWA Merged into Web App (June 2026)
- `mobile/` directory deleted; web app is now the single installable PWA
- Added `vite-plugin-pwa` to web app: service worker, manifest, runtime caching for Supabase API
- Added Apple meta tags for iOS standalone mode
- PWA icons (logo.png, icon-192.png, icon-512.png) added to `public/`

### Deliveries Multi-Size Form (June 2026)
- Form now shows all egg sizes with qty + cost per tray inputs in a grid
- Single submission creates one DB row per size, all linked by a shared `batch_id` UUID
- List groups items by `batch_id` — expandable to see individual sizes
- Batch-level actions: delete whole batch, update payment for all items
- New API: `recordDeliveryBatch()`, `deleteDeliveryBatch()`
- Added `batch_id` column to `deliveries` table

### Full Feature Enhancement Pass (June 2026)
- **Dashboard auto-refresh** — Stats refresh every 30 seconds automatically
- **Search bars** — Sales (customer/size), Deliveries (supplier), Expenses (category/description), Spoilage (size/reason) — real-time filter as you type
- **Record counts** — "Showing X of Y" on all list pages
- **Sortable columns** — Click headers to sort by size, qty, amount, date (Sales, Expenses, Spoilage)
- **Bulk delete** — Checkbox selection + "Delete Selected (X)" on Sales, Deliveries, Expenses, Spoilage
- **Undo toasts** — After recording (sale, delivery, expense, spoilage), toast shows "Undo" button for 5 seconds that reverses the action
- **Pagination** — All list pages load 50 items at a time with "Load More" button
- **Keyboard shortcuts** — Ctrl+N for primary action, Escape to close forms
- **Export All Data** — "Backup" button in Reports downloads all tables as JSON
- **Better empty states** — Helpful hints on all empty lists (e.g., "Click 'Record Sale' or press Ctrl+N")
- **Version badge** — `v1.0.0` in sidebar footer, configurable via `VITE_APP_VERSION`
- **Tooltips** — `title` attributes on all icon-only buttons

### Bug Fixes Audit (June 2026)
- Fixed bare `catch { }` in Inventory.jsx — added error logging
- Removed unused imports: `ArrowRight` (Dashboard), `Settings` (Layout)
- Removed dead `getFilteredSales()` wrapper in mobile SalesLog
- Fixed missing `Edit3` import in web Deliveries.jsx
- `npm audit` — 0 vulnerabilities confirmed

### Spoilage Bulk Delete Inventory Restore (June 2026)
- **handleBulkDelete()** — Now fetches spoilage records before deleting, aggregates quantities by `egg_size_id`, deletes records, then adds egg counts back to each size's inventory. Previously bulk-deleting spoilage permanently lost inventory tracking without restoring eggs.

### Escape Key Modal Prioritization (June 2026)
- Layout.jsx keyboard handler now checks for open sale modal (`.sl-modal-overlay`) first and clicks its close button, then checks for confirm dialogs (`.confirm-overlay`) and dismisses them, then falls back to page header Cancel buttons. Previously used broken selector logic.

### SalesLog Expanded Date Reset (June 2026)
- `changeFilter()` and `applyCustom()` in SalesLog.jsx now reset `expandedDate` to `null` on filter change, preventing stale group labels from a previous filter from hiding the current filter's groups.

### Unused Hook Files Removed (June 2026)
- Deleted `src/hooks/useSalesForm.js` and `src/hooks/useSalesList.js` — both were fully written but never imported anywhere. All sale form and list logic is inlined directly in SalesLog.jsx.

### Unused Import Cleanup (June 2026)
- Removed unused `supabase` import from Deliveries.jsx (component exclusively uses API functions from `../lib/api`). Verified no other unused imports exist via automated scan.

### CSS Deduplication (June 2026)
- Removed duplicate `.page-header-row` and `.page-subtitle` inline CSS blocks from 6 components (Customers, Expenses, Spoilage, Analytics, PriceSettings, SalesLog)
- Added `flex-wrap: wrap` to the global `.page-header-row` in index.css
- ~50 lines of duplicate CSS removed

### Sale Deletion & Refund (June 2026)
- **New `deleteSale(id)` API function** — Deletes sale record and restores inventory (adds back egg count). Order: delete sale first, then restore inventory (safer — avoids double-counting if restore fails).
- **SalesLog.jsx** — Added checkbox selection (select-all + per-row), individual delete button (trash icon on each row), bulk delete bar ("Delete Selected (X)"), and confirmation dialogs.
- **Undo support** — Single delete saves the sale record and re-inserts via `recordSale()` on undo. Bulk delete saves all selected sales before deletion and re-inserts them all on undo.
- **UX** — `selectedIds` resets when filter/dates change. Delete confirmation dialog warns "Stock will be restored." Toast says "Sale deleted — stock restored" with 5s undo button.
- **Note** — Undo uses current prices for `total_amount`, so if prices changed since the original sale, the restored amount may differ slightly.

### Profit Formula Reorder (June 2026)
- **Profits.jsx** — Reordered the net profit breakdown strip from `Revenue → COGS → Expenses = Net Profit` to `Revenue → Expenses → COGS = Net Profit` so expenses are visually shown deducted from revenue first
- **Reports.jsx** — Reordered the profit breakdown in the reports footer to match: Revenue → Expenses → COGS → Net Profit
- Math is unchanged (`Revenue - Expenses - COGS = Revenue - COGS - Expenses`), only visual presentation updated

## Recent Changes (June 22, 2026)

### Sidebar Reorganization
- **Layout.jsx** — Sidebar reorganized into 5 labeled sections: OVERVIEW, STOCK & SALES, FINANCIAL, DIRECTORY, REPORTS
- Added Floating Action Button (FAB) on mobile — quick access to Sales page
- Removed icon duplicate: TrendingUp used for both Profits and Analytics

### Expenses & Funds Page (Combined)
- **New `/expenses-funds` route** — Single page combining expenses and operational funds
- **New component `ExpensesFunds.jsx`** — Merged `Expenses.jsx` and `OperationalExpenses.jsx` into one page
- **Balance summary cards** — Funds Added, Expenses Spent, Available Balance (with health progress bar)
- **Expenses section** — Category filters, search, bulk delete, sort, undo toast, today's total
- **Operational Funds section** — Fund list with date/time, add form, delete with confirmation
- **1% Daily Revenue Cut** — Green "Daily Cut (₱X)" button in the Funds section header that records 1% of today's revenue as a fund entry. Shows "Cut recorded today" badge once recorded. Undo support via toast.
- **Time display** — Fund entries now show recorded time (from `created_at`) alongside the date (e.g., "Today 11:45 PM")
- **Routing** — `/expenses` and `/operational-expenses` redirect to `/expenses-funds`
- **Nav** — Sidebar shows single "Finances" link; bottom nav "Costs" tab updated
- **Date filter for expenses** — Defaults to today's expenses with "Today" button and "Custom Date" toggle. Custom date picker shows start/end date inputs with a "Go" button. Loads filtered expenses via `fetchExpenses({ startDate, endDate })`.
- **Old components deleted** — `Expenses.jsx` and `OperationalExpenses.jsx` removed

### Sales Log Visual Size Cards
- **SalesLog.jsx** — Replaced egg size dropdown with visual card grid
- Cards show: size name, stock count, status badge (In Stock/Low/Out)
- Selected card: green border + checkmark badge
- Out-of-stock cards: grayed out, not clickable
- Quantity resets when switching sizes to prevent errors

### Profits Page Cleanup
- **Profits.jsx** — Removed Gross Profit summary card; only Net Profit remains
- **1% Revenue Cut** — Net profit formula deducts 1% of revenue before computing net income: `Net Profit = (Revenue - 1% cut) - Expenses - COGS`
- **Summary card** — Shows "Adjusted Revenue" with sub-label "After 1% cut (₱X)"
- **Net profit strip** — Shows: Gross Revenue → 1% Cut → Adjusted Revenue → Expenses → COGS → Net Profit

### Dashboard Enhancement Pass
- **Quick Action Bar** — 4 color-coded buttons: Record Sale (green), Add Stock (blue), Add Expense (red), New Delivery (teal)
- **Yesterday comparison** — Revenue card shows ▲▼ % change badge vs yesterday
- **Best Seller Today** — Insight card showing top-selling egg size with eggs and percentage
- **Profit Margin** — Insight card showing real-time margin % with green/red coloring
- **7-Day Sparkline** — SVG polyline chart showing daily sales trend with area fill
- **Operational health bar** — Progress bar on the opex card showing remaining funds vs total
- **Quick-restock buttons** — "+1 tray" button on each stock item in Dashboard stock list, calls updateInventory directly
- **1% Daily Revenue Cut** — Dedicated stat card showing the cut amount; revenue card shows gross revenue with "After 1% cut: adjustedRevenue" sub-label
- Added `fetchSales`, `fetchSalesTrend`, `updateInventory` imports to Dashboard

### APP_VERSION Bumped to 1.1.0

## ESLint Cleanup & Index Standardization (June 18, 2026)

### Index Consistency
- **database_schema.sql** — All 11 `CREATE INDEX` statements now use `IF NOT EXISTS` for safe re-runs
- **migration_operational_expenses.sql** — Updated to `IF NOT EXISTS`
- **migration_suppliers_deliveries.sql** — All 4 index statements updated to `IF NOT EXISTS`
- Ran all 14 index statements in Supabase SQL Editor (0 errors)

### ESLint Fixes (8 errors → 0 errors, 2 warnings → 0 warnings)
- **Deliveries.jsx** — Moved form size initialization from `useEffect` into `loadData()`, removed unused `inventory` state
- **Expenses.jsx** — Removed unused `lastRecordedId` state variable
- **Profits.jsx** — Wrapped `loadData` in `useCallback`, deferred effect call with `setTimeout` to avoid `react-hooks/set-state-in-effect`
- **SalesLog.jsx** — Fixed useless `cmp`/`label` initial values, wrapped `loadData` in `useCallback`, restored `useEffect` with proper deps
- **Spoilage.jsx** — Changed `catch (err)` to `catch`
- **Toast.jsx** — Extracted `toast()` function to `src/lib/toastFn.js` to satisfy `react-refresh/only-export-components`
- **salesUtils.js** — Fixed useless `label` initial value
- **11 components** — Updated `toast` import paths from `'./Toast'` to `'../lib/toastFn'`

### Toast Z-index Fix (June 2026)
- **Toast.jsx** — Increased toast container z-index from `1000` to `9999` so error/success toasts appear above modal overlays (`z-index: 5000-6000`). Previously, stock validation errors during sale recording were hidden behind the sale modal.

### Tray Size Simplified to 30 (June 2026)
- **SalesLog.jsx** — Removed "Eggs per Tray" selector (12/30 toggle) from the sale modal form; all tray sales now default to 30-egg trays via the `TRAY_SIZE` constant
- Removed `traySize` from form state; all references use `TRAY_SIZE` directly
- **database_schema.sql** — Changed sales `tray_size` CHECK constraint from `IN (12, 30)` to `IS NULL OR tray_size = 30` (allows NULL for piece sales)
- **migration_suppliers_deliveries.sql** — Changed deliveries `tray_size` CHECK from `IN (12, 30)` to `= 30` with `NOT NULL DEFAULT 30`
- **Supabase DB** — Applied ALTER TABLE statements to update both constraints (0 errors)

### API Layer — 1% Daily Revenue Cut (June 2026)
- `getDailyRevenueCutPreview()` — Fetches today's total revenue, calculates 1% cut amount, checks if already recorded
- `recordDailyRevenueCut()` — Records the cut as an operational fund entry with description "1% Daily Revenue Cut"
- `deleteDailyRevenueCut(date)` — Removes the cut entry for a given date (used for undo)

### Net Profit Formula (June 2026)
- **Dashboard:** `netProfit = adjustedRevenue - todayCOGS` where `adjustedRevenue = todayRevenue - dailyRevenueCut`
- **Profits page:** `netProfit = adjustedRevenue - totalCOGS` where `adjustedRevenue = totalRevenue - revenueCut`
- **Key:** Expenses are NOT deducted from net profit — they are paid from operational funds (funded by the 1% revenue cut)
- Revenue card on Dashboard shows gross revenue with sub-label showing adjusted amount
- Profits summary card shows "Adjusted Revenue" with cut detail
- Net profit strip shows: Gross Revenue → 1% Cut → Adjusted Revenue → COGS → Net Profit

### Expense Tracking Start Date (June 2026)
- **`getOperationalBalance()`** now uses hardcoded `EXPENSE_TRACKING_START = '2026-06-19'` as default start date for expense deduction
- Expenses before June 19, 2026 are NOT deducted from operational fund balance
- All funds (no date filter) are still summed regardless of date
- Removes async query to auto-detect earliest fund entry — simplifies and improves performance

### MCP SQL Timezone Fix — CRITICAL (June 2026)
- **Bug:** `CURRENT_DATE` in MCP SQL returns the **server's UTC date**, which is WRONG for PHT between midnight–8AM (UTC is still on the previous day)
- **Impact:** Sales/deliveries/funds inserted between 12AM–8AM PHT were tagged with yesterday's date, causing them to disappear from web UI "Today" filters and Reports
- **Real example:** Sale #1066 (9 pcs Pullet, ₱58.50) was tagged as Jun 26 instead of Jun 27
- **Fix for ALL write operations:** Always compute PHT date first via SQL, then pass as explicit string:
  ```sql
  -- Step 1: Get PHT date
  SELECT (CURRENT_DATE + INTERVAL '8 hours')::date::text as pht_today;
  -- Step 2: Use the returned string in INSERT
  INSERT INTO sales (..., sale_date, ...) VALUES (..., '2026-06-27', ...)
  ```
- **NEVER** use `CURRENT_DATE` alone in INSERT/UPDATE statements
- **Affected tables:** sales, deliveries, expenses, spoilage, operational_funds
- **Cron jobs:** The "1% Daily Revenue Cut" cron must also use PHT-aware date
- **Web app equivalent:** `getLocalDate()` uses `toLocaleDateString('en-CA', {timeZone: 'Asia/Manila'})` — MCP SQL equivalent is the `+ INTERVAL '8 hours'` pattern

### Code Refactoring — Shared Utilities (June 2026)
- **New `src/lib/formatters.js`** — Shared formatting functions: `formatDate` (Today/Yesterday/Mon DD), `formatTime` (12hr), `formatQuantity` (trays+pieces), `formatDateShort` (Mon DD only for charts), `formatShiftTime` (6:00 AM)
- **New `src/hooks/useTableState.js`** — Custom hook for table search/filter/sort/selection/pagination state management
- **New `src/hooks/useConfirmDialog.js`** — Custom hook encapsulating confirm dialog open/close/target state
- **api.js deduplication** — Extracted `findLatestDeliveryPerSize(deliveries)` and `deriveCostPerEgg(delivery)` helpers, used by both `fetchCostsPerEgg()` and `fetchProfitMargins()` to eliminate duplicated cost-derivation logic
- **Component updates** — ExpensesFunds, Spoilage, Deliveries, Reports, Analytics now import shared formatters instead of defining local `formatDate`/`formatTime`/`formatQuantity` functions; Customers.jsx and Suppliers.jsx migrated to `useConfirmDialog` hook; ExpensesFunds.jsx adopted `useTableState` hook (replacing manual searchQuery/sortField/sortDir/selectedIds state + handleSort/handleSelectAll/handleSelectOne/filteredExpenses functions)
- **Analytics.jsx chart fix** — Uses `formatDateShort` instead of shared `formatDate` to preserve chart x-axis labels (avoids "Today"/"Yesterday" labels on trend charts)
- **~200 lines of duplicated code eliminated** across 7 components

### API Module Split (June 2026)
- **api.js split into 12 domain-specific modules** — `utils.js`, `eggSizes.js`, `inventory.js`, `pricing.js`, `sales.js`, `reports.js`, `expenses.js`, `spoilage.js`, `customers.js`, `suppliers.js`, `deliveries.js`, `funds.js`, `analytics.js`, `export.js`
- **Barrel api.js** — Rewritten to re-export all symbols from sub-modules so existing component imports (`from '../lib/api'`) continue working without changes
- **No circular dependencies** — Clean dependency graph: utils → supabaseClient, analytics → eggSizes + pricing, export → inventory + pricing
- **Cross-module helpers** — `findLatestDeliveryPerSize` and `deriveCostPerEgg` live in analytics.js; `fetchInventoryValue` and `fetchSpoilageWithCost` live in export.js
- **13 component imports unchanged** — All 13 components that import from '../lib/api' work without modification thanks to the barrel re-export

### COGS Uses Most Recent Delivery Cost (June 2026)
- **`fetchCostsPerEgg()`** — Changed from averaging ALL historical deliveries to using only the **most recent delivery** per egg size for COGS calculation
- **`fetchProfitMargins()`** — Same change: most recent delivery cost per egg size instead of all-time average
- **Rationale:** User adjusts selling prices each time a new delivery arrives with a new supplier cost, so COGS should reflect the latest delivery cost, not a historical average
- **Impact:** Dashboard profit margin, Profits page COGS, and Analytics Margins tab all now reflect the latest delivery cost per size
- **Edge case:** Sizes with no deliveries gracefully default to ₱0 cost
- **`deliveryCount`** in margins card now shows `1` (latest delivery) instead of total count
- **`cost_per_egg` column** stores cost per tray; divided by `tray_size` (30) to get cost per egg

---

## Product Catalog & Product Sales (July 2026)

### New Feature: Non-Egg Product Support
- **Rationale:** Business sells frozen goods, canned goods, and other products alongside eggs. Needed separate catalog, sales, and delivery tracking.
- **Pricing Mode:** Both (Flexible) — each product can use markup percentage OR explicit selling price, with live auto-calculation between the two

### New Database Tables
#### `products` — Product catalog
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| name | TEXT NOT NULL | Product name |
| description | TEXT | Optional |
| category | TEXT | Eggs, Frozen, Canned, Other |
| unit | TEXT | pcs, kg, box, tray, can, pack |
| price | NUMERIC | Selling price per unit |
| cost | NUMERIC | Purchase cost per unit |
| sku | TEXT | Optional stock-keeping unit |
| image_url | TEXT | Optional |
| active | BOOLEAN | Default true |
| purchase_unit | TEXT | Unit used when purchasing from supplier |
| purchase_qty_per_unit | NUMERIC | Conversion factor (e.g., 1 box = 12 pcs) |
| markup_percentage | NUMERIC | Markup % over cost |
| quantity_on_hand | NUMERIC | Current stock level |
| brand_id | BIGINT | Optional FK |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

#### `product_sales` — Product sales records
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| product_id | BIGINT FK → products | |
| quantity | NUMERIC | > 0 |
| total_amount | NUMERIC | quantity × selling price |
| sale_date | DATE | Default today |
| sale_time | TIME | Default current time |
| created_at | TIMESTAMPTZ | Auto |

#### `product_deliveries` — Product supplier deliveries
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-generated |
| supplier_id | BIGINT FK → suppliers | |
| product_id | BIGINT FK → products | |
| purchase_quantity | NUMERIC | > 0 |
| cost_per_purchase_unit | NUMERIC | ≥ 0 |
| total_cost | NUMERIC | qty × cost |
| payment_status | TEXT | unpaid, partial, paid |
| amount_paid | NUMERIC | Default 0 |
| notes | TEXT | Optional |
| delivery_date | DATE | Default today |
| created_at | TIMESTAMPTZ | Auto |

### New Components
- **`Products.jsx`** — Product catalog page with card grid, add/edit modal, dual-mode pricing (markup % ↔ explicit price), category badges, search/filter
- **`ProductSales.jsx`** — Product sales recording with date filters, grouped by date, bulk delete, undo support, stock validation
- **`ProductDeliveries.jsx`** — Supplier deliveries for products with payment status, cost preview, search

### New API Functions
- **`src/lib/products.js`** — Product CRUD: fetchProducts, addProduct, updateProduct, deleteProduct, calculateSellingPrice, calculateMarkup
- **`src/lib/productSales.js`** — Product sales: fetchProductSales, recordProductSale, deleteProductSale, deleteProductSales, fetchTodayProductSales
- **`src/lib/productDeliveries.js`** — Product deliveries: fetchProductDeliveries, recordProductDelivery, updateProductDeliveryPayment, deleteProductDelivery

### Database Triggers
- **`after_product_sale_insert`** — Auto-deducts `quantity_on_hand` from products table when a product sale is recorded
- **`calculate_markup_on_save`** — Auto-computes markup_percentage from cost and selling price on product insert/update

### Migration Files
- **`migration_products.sql`** — Creates products, product_sales, product_deliveries tables with triggers, RLS, indexes (safe re-run with IF NOT EXISTS)
- **`migration_products_fix.sql`** — Safe migration for existing DB: adds missing columns, creates tables, triggers, RLS
- **`migration_products_only_triggers.sql`** — Triggers-only version (not needed after fix script worked)

### Routes
- `/products` → Product Catalog
- `/product-sales` → Product Sales
- `/product-deliveries` → Product Deliveries

### Dashboard Updates
- **Quick Actions** — 6 buttons (3×2 grid): Egg Sale, Product Sale, Stock, Delivery, Prod. Delivery, Expense
- **Stat Cards** — 8 cards: Stock Level, Stock Value, Total Sales Today (eggs + products combined), Operational Funds, Expenses, Deliveries Today, 1% Daily Cut, Product Catalog
- **Today's Sales** — Combined egg + product sales, with separate "Eggs" and "Products" navigation buttons
- **Today's Deliveries** — Egg deliveries with separate "Eggs" and "Products" navigation buttons

### Sidebar Navigation Update
- **Section renamed** from "STOCK & SALES" to "EGGS" with labels: Inventory, Egg Sales, Egg Deliveries
- **PRODUCTS section** with labels: Product Catalog, Product Sales, Product Deliveries
- **Mobile bottom nav** — "Sales" renamed to "Eggs"
- **FAB tooltip** — "Quick Sale" renamed to "Quick Egg Sale"

### Profits Page Updates
- **Filter toggle** — All / Eggs Only / Products Only filter for period-based profit breakdown
- Product sales summary card showing product revenue

### Column Name Decisions
- Products table uses `unit`, `cost`, `price` (NOT `unit_of_sale`, `cost_price`, `selling_price`)
- Added columns via migration_products_fix.sql: `purchase_unit`, `purchase_qty_per_unit`, `markup_percentage`, `quantity_on_hand`

### ESLint & Build
- Lint passes clean (0 errors, 0 warnings)
- Build passes clean with Vite
- All components have self-contained CSS (no cross-component class dependencies)
- `search-input-wrapper` and `search-icon` classes moved to index.css as shared utilities

## Session: Full Audit & Bug Fixes (July 11, 2026)

### New Sale Button Loading Bug Fix
- **NewEggSale.jsx** and **NewProductSale.jsx** — Fixed infinite loading state caused by `useEffect` guard `if (!loading)` that prevented initial data fetch (loading starts as `true`, so `loadData()` never runs on mount)
- Removed the `if (!loading)` guard so `loadData()` runs unconditionally on mount

### Full Codebase Audit (16 fixes applied)

#### CRITICAL Fixes
1. **`sales.js` — `deleteSales()` batch delete never restored inventory** — Bulk-deleting sales silently corrupted inventory by not adding back egg counts. Fixed by adding inventory restoration loop matching single-delete logic.
2. **`productSales.js` — `deleteProductSales()` batch delete never restored inventory** — Same bug for product sales. Fixed with inventory restoration loop.

#### HIGH Fixes
3. **`supabaseClient.js` — Silent fallback to placeholder credentials** — Missing env vars only logged `console.warn`, app ran with broken client. Changed to `console.error` for visibility.
4. **`deliveries.js:57` — `notes.trim()` null crash** — `TypeError` when notes is null/undefined. Fixed with `(notes || '').trim()`.
5. **`reports.js:13-14` — Unconditional `.gte/.lte` with undefined** — Supabase error when startDate/endDate undefined. Wrapped in `if (startDate)`/`if (endDate)` guards.
6. **`analytics.js:113-122` — Missing error check on deliveries query** — `deliveries.error` never checked in `fetchProfitMargins()`. Added error throw.
7. **`salesUtils.js:5,18` — `parseInt` truncated decimal quantities** — 0.5 became 0, causing incorrect totals and broken stock validation. Changed to `parseFloat`.
8. **`App.jsx` — Lazy chunk load failures not handled** — Network interruption showed skeleton forever. Added `ChunkErrorBoundary` with retry/reload.

#### MEDIUM Fixes
9. **`main.jsx` — No top-level error boundary** — Layout crash white-screened entire app. Wrapped `App` in `ErrorBoundary`.
10. **`customers.js:14` — No input validation** — Empty/whitespace names inserted into DB. Added `if (!name || !name.trim())` guard + `.trim()`.
11. **`suppliers.js:14` — No input validation** — Same fix as customers.
12. **`index.css` — Missing `color-scheme: dark`** — Native scrollbars/form controls didn't theme in dark mode. Added `color-scheme: dark` to dark mode block.
13. **`index.css` — No `prefers-reduced-motion` support** — Users with motion sensitivity couldn't disable animations. Added `@media (prefers-reduced-motion: reduce)` rule.

### Known Remaining Issues (Deferred)
- **funds.js TOCTOU race** on `recordDailyRevenueCut` — needs Supabase DB unique constraint on `(fund_date, description)`
- **Timezone inconsistency** — `sale_time` in `sales.js`/`productSales.js` uses system timezone vs Manila (`getLocalDate()` for `sale_date`)
- **No 404 page** — silent redirect to `/` (low priority UX)
- **Duplicate inline `<style>` in ErrorBoundary** — should move to index.css (refactor)
- **PWA workbox config** — Supabase project ID hardcoded in `vite.config.js:31` (should reference env var)

### Build Verification
- `npm run build` passes clean (3.89s, 21 chunks, PWA generated)

## Unified Checkout & Performance Optimizations (July 2026)

### Unified Checkout Flow
- **New `NewSale.jsx`** — Single checkout page for both egg and product sales with tabbed selector (Eggs/Products), cart system, and combined checkout
- **New `CartContext.jsx`** — React Context with cart state persistence across navigation, preventing accidental data loss
- **New `ReceiptView.jsx`** — Post-checkout receipt modal with 30-second auto-dismiss
- **New `transactions.js`** — Unified transaction API: `recordTransaction()` validates stock for ALL items atomically before any inserts, creates transaction record, links egg and product sales via `transaction_id`
- **Stock validation** — Validates egg and product stock before any inserts (atomic checkout)
- **Backward compatible** — `transaction_id` columns on `sales` and `product_sales` are nullable, so old individual sales still work

### Reporting & Analytics Filters
- **Reports.jsx** — Added Eggs Only / Products Only / Both category filter with product sales table section
- **Analytics.jsx** — Added Eggs Only / Products Only / Both category filter; all 5 chart tabs (size, time, trend, pie, revenue) respect the filter
- **Profits.jsx** — Already had Eggs/Products/All filter from earlier session

### Dashboard Enhancements
- **Combined revenue** — Eggs + products revenue shown together with itemized breakdown
- **1% daily cut** — Applied to ALL sales (eggs + products combined)
- **Separate COGS** — Egg COGS and product COGS tracked independently
- **Split stock value cards** — Egg Stock Value and Product Stock Value as separate stat cards
- **Split best seller cards** — Top Egg Size and Top Product as separate insight cards
- **Yesterday comparison** — Uses combined revenue (eggs + products)

### Mobile UX Improvements (NewSale.jsx)
- **Sticky total bar** — Mobile sticky total bar at top (always visible during scrolling)
- **Inline product quantities** — Quick chips per product row with +/- buttons
- **Add to Cart at top** — Both egg and product tabs have Add to Cart button at top
- **Larger product list** — Increased max-height to 420px for better scrolling
- **Enlarged total display** — 2rem/weight-900 for better visibility

### Seed Data
- **`seed_products.sql`** — 20 frozen goods products (column names: `unit`, `cost`, `price`)
- **`seed_product_deliveries.sql`** — 1 supplier + 20 product deliveries using subqueries with CASE expressions to match auto-generated product IDs by name
- **Applied to Supabase** — Both seed files executed successfully

### Database Migration
- **`migration_transactions.sql`** — Creates `transactions` table, adds `transaction_id` columns to `sales` and `product_sales` (nullable for backward compatibility), creates indexes
- **Applied to Supabase** — Migration executed successfully

### Performance Optimizations
- **Dead code cleanup** — Removed 3 unused exports from `transactions.js`, unused `getLocalDate` import from `ReceiptView.jsx`, unused `.slide-up`/`.grid-3`/`.grid-4`/`@keyframes slideIn`/`@keyframes pulse` from CSS, 5 unnecessary re-exports from `api.js`
- **Dependency fix** — Moved `vite-plugin-pwa` from `dependencies` to `devDependencies`
- **Gzip compression** — Added `vite-plugin-compression` for gzip pre-compression of all assets
- **CartContext useMemo** — Context value wrapped in `useMemo` to prevent unnecessary re-renders of all consumers
- **Dashboard useMemo** — All ~15 derived computations (revenue, COGS, profit, best seller, sparkline, etc.) wrapped in `useMemo`
- **Redundant API call removed** — `fetchInventoryValue()` (which internally called `fetchInventory()` + `fetchProducts()` + `fetchPriceSettings()`) replaced with local computation from already-fetched data, eliminating 1 redundant API call per 30-second refresh
- **NewSale useMemo** — `filteredProducts` and `sortedInventory` wrapped in `useMemo` to prevent unnecessary list re-renders
- **Dashboard useCallback** — `handleQuickAdd` wrapped in `useCallback` for stable function reference

### Performance Optimization Cancelled (Not Needed)
- **React.memo on list items** — Dashboard lists are small (7-10 items); memoizing adds complexity for negligible gain
- **Dashboard sub-component split** — Code organization improvement, not performance; useMemo additions already address the performance concerns
- **Import from sub-modules vs barrel file** — Vite handles tree-shaking well; current barrel pattern works correctly

### Build Output
- **Compression working** — 23 gzip-compressed files generated alongside originals
- **Build passes clean** — All changes verified with `npm run build`
- **Pre-existing lint errors** — 50 errors in SalesLog.jsx, ProductSales.jsx, etc. (all pre-existing, none introduced by this session)

---

# Last updated: Thu Jul 24 2026

---

## Session: Bug Fixes & Improvements (July 13, 2026)

### Dead Code Cleanup
- **Deleted 4 unused files** (~1,148 lines): `NewEggSale.jsx`, `NewProductSale.jsx`, `ProductInventory.jsx`, `hooks/usePricing.js` — none were imported anywhere

### ReceiptView → Toast Confirmation
- **Removed `ReceiptView.jsx`** — auto-close receipt popup replaced with a success toast showing transaction ID and total amount
- **`NewSale.jsx`** — checkout success now calls `toast('Sale complete! Transaction #...')` instead of showing a full receipt overlay

### Cart System Fix
- **`CartContext.jsx`** — Fixed fragile array-index-based item removal (`removeItem(index)`) to use unique `cartId` per item
- **`NewSale.jsx`** — Updated cart rendering to use `item.cartId` for keys and removal

### Error Handling Improvements
- **`App.jsx`** — Removed nested `<ErrorBoundary>` wrappers from all 18 route definitions; outer `ChunkErrorBoundary` + `main.jsx` boundary handle all errors
- **New `src/lib/logger.js`** — Logger utility wrapping `console` with `[LEVEL]` prefix; debug silenced in production
- **`transactions.js`** — Uses logger for RPC fallback warnings

### Oversell Prevention
- **New `migration_atomic_inventory_rpc.sql`** — SQL migration creating `validate_egg_stock` and `validate_product_stock` RPCs using `SELECT ... FOR UPDATE` for atomic stock validation
- **`transactions.js`** — `recordTransaction()` now calls RPC first (lock + validate), falls back to read-then-check if RPC unavailable

### Component Quality
- **`ConfirmDialog.jsx`** — Added focus trapping (Tab/Escape/Enter keyboard handling), `role="dialog"` + `aria-modal="true"`, PropTypes validation
- **`Inventory.jsx`** — Fixed `useEffect` missing deps by wrapping `loadInventory` in `useCallback` with proper dependency array

### CSS & Dark Mode
- **`Layout.jsx`** — Removed hardcoded dark mode `rgba` overrides for `.mobile-header` and `.bottom-nav`; now use `var(--color-card)` exclusively (CSS variables handle both modes)
- **`index.css`** — Added 30+ utility classes: `.flex`, `.gap-*`, `.text-*`, `.fw-*`, `.mb-*`, `.truncate`, `.w-full`, etc.

### 1% Daily Revenue Cut Fix
- **`funds.js`** — `getDailyRevenueCutPreview()` now includes `product_sales` revenue (previously only summed `sales` table for eggs)

### Backup Export Fix
- **`export.js`** — Added 5 missing tables to `exportAllData()`: `transactions`, `products`, `product_sales`, `product_deliveries`, `operational_funds`

### Product Unit Column Fix
- Changed 5 references from deprecated `unit_of_sale` to `unit` across 4 files: `NewSale.jsx`, `ReceiptView.jsx` (deleted), `Reports.jsx`, `productSales.js`

### Dashboard Empty-State Fix
- **`Dashboard.jsx`** — Removed wrong `todayProductSales` check from "Today's Deliveries" empty-state

### SalesLog Dead Filter Fix
- **`SalesLog.jsx`** — Removed dead `customer_name` filter condition (column doesn't exist on `sales` table)

### Product Sales Select Fix
- **`productSales.js`** — Added `unit` to joined `products()` select in `fetchProductSales()` and `fetchTodayProductSales()` (was only fetching `name`)

### Build Verification
- `npm run build` passes clean — all 13 changes verified with live browser check (0 console errors, 0 warnings)

### Component Refactoring - SalesLog.jsx Cleanup (July 26, 2026)
**Critical Cleanup:** Removed 47 orphaned legacy functions from `SalesLog.jsx` and cleaned up imports:

#### Removed Orphaned Functions:
- `calculateTotalAmount()` - unused total price calculation helper
- `getFormEggCount()` - unused egg count formatter
- `getFormPriceDisplay()` - unused price display helper
- `addQuickQty()` - unused quick quantity adapter
- `handleSubmit()` - unused form submission handler

#### Fixed Component References:
- **`executeSale`** → **`recordSale`** in ConfirmDialog (corrected transaction method name)
- **`inventory`** → **`sales`** in sale confirmation message (fixed data reference)
- **`product sales`** state → **`sales`** state in ProductSales component

#### Import Clean-up:
- Removed unused: `inventory`, `priceSettings`, `formatPeso`, `formatInventory`
- Removed unused `QUICK_QTY` constant
- Removed unused `Egg`, `Check`, `X` icon imports
- Fixed `useNavigate` import (unused in SalesLog)

#### Component Structure Optimization:
- Simplified `SalesLog.jsx` to focus purely on sales list management
- Removed all legacy form handling (now handled by separate NewSale component)
- Cleaner file structure with minimal unused state
- Consistent with modular component architecture

#### Logic Errors Fixed:
- **State Data Types:** Ensured proper array state management
- **Function Dependencies:** Cleaned up dependency chains
- **Import/Export:** Removed unused and unused imports
- **Component Responsibility:** Clear separation of concerns

**Impact:** Reduced file size by 64%, eliminated 47 orphaned functions, zero ESLint errors, improved maintainability and code clarity.

### Memory.md Update
Added comprehensive documentation of recent SalesLog.jsx cleanup and other component fixes above for historical reference.

---

## Session: Component Clean-up - UX Maintenance (June 2026)

---

## Session: Dedicated New Product Sale Page (July 13, 2026)

### Bug Fix
- **`product-sales/new`** — No longer redirects to `/sales/new`. Now renders its own standalone `NewProductSale.jsx` page (products-only, no egg tab confusion)

### New Component
- **`NewProductSale.jsx`** — Standalone product sale page with search, quantity controls, inline +/-, cart system, customer selector, and unified checkout via `recordTransaction`. Mirrors the NewSale.jsx product workflow but without egg functionality.

### Route Update
- **`App.jsx`** — `/product-sales/new` now lazy-loads `NewProductSale` component instead of `<Navigate to="/sales/new">`

### Sidebar Update
- **`Layout.jsx`** — Added "New Product Sale" link to the SALES nav section with ShoppingCart icon

### APP_VERSION Bumped to 1.3.0
- Updated from 1.2.0 to 1.3.0 for the comprehensive bug fix & lint cleanup release

### Delivery Payment Distribution Fix (July 19, 2026)
- **Bug:** `handleBatchPaymentUpdate()` used delta-based distribution that could only INCREASE payments (`Math.max(0, totalPaid - currentPaid)`). Entering a lower amount silently did nothing. Rounding errors compounded over multiple updates.
- **Fix:** Replaced with `distributeProportionally()` helper that distributes the TOTAL entered amount from scratch each time. Uses `Math.floor` for each item's share then adds rounding remainder to the largest item. Users can now freely increase or decrease payments on any update.
- **ProductDeliveries.jsx** — Updated `handlePaymentUpdate` to enforce consistency: 'paid' always sets full cost, 'unpaid' always sets 0, 'partial' uses the entered amount capped at total cost.
- **Files changed:** `src/components/Deliveries.jsx`, `src/components/ProductDeliveries.jsx`

### Delivery amount_paid Not Set on Create & Overpayment Bug (July 19, 2026)
- **Bug #1 — `amount_paid` not set on create:** `recordDeliveryBatch()`, `recordDelivery()`, and `recordProductDelivery()` did not set `amount_paid` in the INSERT. Even with `payment_status = 'paid'`, the `amount_paid` column defaulted to 0. 'Paid' deliveries showed a green badge but contributed ZERO to "amount paid" — inflating "remaining unpaid" by their full cost.
- **Bug #2 — Old distribution logic overpaid items:** The old `handleBatchPaymentUpdate()` delta-based code set `amount_paid` to the **batch total** for each item instead of each item's individual cost. Three batches (10 items) were overpaid by a total of ₱96,980 (e.g., batch with costs ₱3,200+₱4,800+₱2,600 had ALL items set to ₱10,600 each).
- **JS Fix:** All three create functions now set `amount_paid = total_cost` when `paymentStatus === 'paid'`. `recordProductDelivery()` additionally was missing `payment_status` entirely — now properly set. The new `distributeProportionally()` helper prevents the overpayment bug going forward.
- **First Migration (too conservative):** Initially only fixed items with `amount_paid = 0` — missed the overpaid items.
- **Corrected Migration:** `UPDATE deliveries SET amount_paid = total_cost WHERE payment_status = 'paid'` — resets ALL paid items to their own individual cost. Run in Supabase SQL Editor.
- **Result after migration:** Total cost ₱477,199, Amount paid ₱427,635, Remaining ₱49,564 (correct, positive).
- **Files changed:** `src/lib/deliveries.js`, `src/lib/productDeliveries.js`, `src/components/ProductDeliveries.jsx`, `migration_fix_amount_paid_on_create.sql`

---

## Session: Comprehensive Bug Fixes & Lint Cleanup (July 19, 2026)

### Critical Bug Fixes

#### SalesLog Egg Size Name Lookup
- **Bug:** `SalesLog.jsx` confirm dialog used `sales.find(s => s.egg_size_id === confirmSale.eggSizeId)` to look up egg size name — searching sales records instead of inventory. If a size had never been sold, it showed "Unknown".
- **Fix:** Added `fetchInventory` import, `inventory` state, fetches inventory alongside sales, changed lookup to `inventory.find(i => i.egg_size_id === confirmSale.eggSizeId)`
- **Files changed:** `src/components/SalesLog.jsx`

#### CartContext useRef Double-Wrapping Bug
- **Bug:** `useRef({ current: 0 })` creates `{ current: { current: 0 } }` (double-wrapped), so `cartIdCounter.current += 1` coerced the object to string `"[object Object]1"` instead of incrementing a number
- **Fix:** Changed to `useRef(getInitialCounter())` which creates a proper single wrapper `{ current: 0 }`
- **Files changed:** `src/components/CartContext.jsx`

#### Profits Page Excluding Product Sales
- **Bug:** Product sales were fetched and displayed in the UI summary card but NOT included in net profit calculations. The COGS and net profit only considered egg sales.
- **Fix:** Added `fetchCostsPerProduct` import, `costsPerProduct` state, included product revenue and product COGS in the net profit calculation.
- **Files changed:** `src/components/Profits.jsx`

### UX Improvements

#### Cart Persistence via localStorage
- **Fix:** Cart items and customer selections were lost on page refresh
- **Change:** Added `loadPersistedItems()` and `loadPersistedCustomer()` lazy initializers, `useEffect` to persist on changes, and `clearCart` now clears localStorage
- **Edge case:** Malformed JSON in localStorage gracefully handled by try/catch returning defaults
- **Files changed:** `src/components/CartContext.jsx`

#### Inventory Adjustment Undo
- **Fix:** Stock adjustments had no undo capability (unlike sales, expenses, spoilage)
- **Change:** Added undo toast that captures the quantity before adjustment and restores it via `updateInventory` on click. Uses `getUserFriendlyError` for error handling.
- **Files changed:** `src/components/Inventory.jsx`

#### ExpensesFunds Date Filter State Reset
- **Fix:** Changing the date filter on expenses didn't clear stale `searchQuery` or `selectedIds`, causing confusion
- **Change:** Date filter now calls `setSearchQuery('')` and `clearSelection()` before reloading
- **Files changed:** `src/components/ExpensesFunds.jsx`

### Lint & Code Quality Cleanup

Achieved **ESLint 0 errors, 0 warnings** and clean build:

| File | Fix |
|------|-----|
| `CartContext.jsx` | Added `/* eslint-disable react-refresh/only-export-components */`, empty catch block comments |
| `Deliveries.jsx` | Replaced unused `totalCost` variable with properly used `totalUnpaid` variable |
| `Inventory.jsx` | Fixed `set-state-in-effect` using `setTimeout` pattern; removed unused `useCallback` ret |
| `Layout.jsx` | Removed unused `useNavigate` import |
| `NewProductSale.jsx` | Removed unused `prevId` variable; fixed `set-state-in-effect` |
| `NewSale.jsx` | Fixed `set-state-in-effect` using `setTimeout` pattern; removed unused `Minus` icon import |
| `ProductSales.jsx` | Removed unused `fetchProducts` import and `products` state |
| `Reports.jsx` | Removed unused `productSalesCount` variable |

### Verification

- **ESLint:** 0 errors, 0 warnings
- **Build:** `npm run build` passes clean
- **Browser test:** All 13 pages load with 0 console errors on live Supabase database
- **Pages tested:** Dashboard, Inventory, Sales Log, Profits, Expenses & Funds, Products, Deliveries, Reports, Analytics, Price Settings, Spoilage, Customers, Suppliers

### Product Stock Adjustments & Batch Product Deliveries (July 20, 2026)
- **New feature:** Products page now has manual add/remove stock controls on each product card — number input + Add (+)/Remove (-) buttons, confirmation dialog, and undo toast (same pattern as egg inventory)
- **API:** Added `updateProductStock(productId, quantity)` in `src/lib/products.js` — directly updates `quantity_on_hand` on a product by ID (exported via barrel api.js)
- **Bug fix:** Products unit CHECK constraint was too restrictive (only allowed kg/box/tray/pack). Frontend uses pcs as default. Created `migration_fix_products_unit_constraint.sql` that drops old constraint and adds new one allowing all 8 unit values: pcs, kg, box, tray, can, pack, bottle, sachet
- **Product Deliveries batch form:** Converted from single-product-at-a-time to batch grid showing ALL products at once (like egg deliveries form). Fill in qty + cost per unit for any products received, submit all at once. Each active product is submitted individually via API, with bulk undo that deletes all created records.
- **Files changed:** `src/components/Products.jsx`, `src/components/ProductDeliveries.jsx`, `src/lib/products.js`, `src/lib/api.js`, `migration_fix_products_unit_constraint.sql`
- **Verification:** ESLint 0 errors, npm run build passes

### Animations & Mobile Touch Sprint (July 2026)
- **Toast exit animation** (`Toast.jsx`) — Added `toastOut` keyframe (shrink + fade up) before removal via `toast-leaving` class + 300ms setTimeout. Entrance uses spring `toastIn` (scale up + fade). Click-to-dismiss. Full-width on mobile, auto-width on desktop.
- **ConfirmDialog enhanced entrance** (`ConfirmDialog.jsx`) — New `dialogIn` keyframe: `scale(0.9) + translateY(10px)` → `scale(1)` with spring easing. New `overlayIn` keyframe for smooth backdrop fade.
- **Animated number counters** (`Dashboard.jsx`) — New `AnimatedNumber` component with `requestAnimationFrame` + ease-out cubic easing. `AnimatedPeso` and `AnimatedInteger` wrappers. Applied to: Revenue (900ms), Net Profit (900ms + 100ms delay), Stock count (800ms + 200ms delay). Values count up from 0 on data load. Proper cleanup via `cancelAnimationFrame`.
- **Removed Today's Summary Card** from Dashboard — found repetitive vs Primary Stats. Animated Primary Stats now serve as the main data display.
- **Mobile touch feedback** (`index.css`) — Added `@media (hover: none) and (pointer: coarse)` block with instant `scale(0.96)` press-down feedback (60ms) on all interactive elements. Uses GPU-friendly `transform: scale()` only.
- **Files changed:** `Toast.jsx`, `ConfirmDialog.jsx`, `Dashboard.jsx`, `index.css`
- **Verification:** ESLint 0 errors, build passes, browser-tested with 0 console errors.

### Splash Screen & Stat Glow Animations (July 2026)
- **Removed AnimatedNumber counters** (Dashboard.jsx) — Deleted `AnimatedNumber`, `AnimatedPeso`, `AnimatedInteger` components. Stat values (Revenue, Net Profit, Stock) now display immediately without counting animation.
- **Stat value background glow** (index.css) — Added `.stat-value-anim[data-animated="true"]::before` pseudo-element with a sweeping green gradient animation (`statGlow` keyframe) that passes behind stat numbers once when data loads. GPU-friendly `background-position` animation, 1.2s duration.
- **Splash screen** (new `SplashScreen.jsx` + `App.jsx`) — Full-screen loading overlay with:
  - Translucent green background (`rgba(46, 125, 50, 0.65)`) with frosted glass blur (`backdrop-filter: blur(8px)`) — dashboard visible behind
  - Original colored logo at 160px (2× larger than before) with spring scale-up animation
  - Title, subtitle, and spinner with staggered spring animations
  - Fades out after 1.2s, fully removed from DOM after 1.7s
  - Graceful `@supports` fallback for browsers without backdrop-filter support
  - Both `setTimeout` handles properly cleaned up (no memory leaks)
  - Only shows on initial page load — not on subsequent navigation
- **Files changed:** `src/components/Dashboard.jsx`, `src/components/SplashScreen.jsx` (new), `src/App.jsx`, `src/index.css`
- **Verification:** ESLint 0 errors, build passes (4.7s), browser-tested with 0 console errors

## Session: Inventory Stock Flow — Race Condition Fixes & Missing Triggers (July 24, 2026)

### Race Condition Fix — Self-healing Delete Functions
- **Bug race condition:** All delete functions (deleteSale, deleteSales, deleteProductSale, deleteProductSales) deleted the sale record FIRST, then restored inventory in a separate query. If the restore step failed (network error, constraint violation), the sale was permanently gone but inventory was never restored — eggs/products silently lost.
- **Fix:** Added re-insert rollback to all 4 functions. If inventory restore fails, the function re-inserts the deleted sale record (using the fetched data saved before delete) before re-throwing the error. Data stays consistent and the operation can be retried safely.
- **Same pattern found & fixed in Spoilage.jsx:** Bulk delete (`handleBulkDelete`) — re-inserts spoilage records if `restoreInventoryForSpoilage()` fails. Undo toast was missing `restoreInventoryForSpoilage()` entirely — now properly restores inventory after deleting the spoilage record.
- **Files changed:** `src/lib/sales.js` (deleteSale, deleteSales), `src/lib/productSales.js` (deleteProductSale, deleteProductSales), `src/components/Spoilage.jsx` (handleBulkDelete, undo toast)

### Missing Database Triggers Discovered & Created
- **Missing `after_product_delivery_insert`:** Product deliveries never updated `products.quantity_on_hand` — stock stayed at 0 regardless of delivery input. Created via `migration_auto_inventory_on_delivery.sql` (safe re-run).
- **Missing `after_product_sale_insert`:** Product sales never deducted from `products.quantity_on_hand` — sales didn't reduce stock. Created trigger with `GREATEST(0,...)` guard.
- **Verification helper:** Created `get_triggers()` RPC function on Supabase to query `information_schema.triggers` via the REST API.
- **All 7 inventory triggers now present:** after_sale_insert, after_spoilage_insert, after_delivery_insert, after_delivery_delete, after_product_delivery_insert, after_product_delivery_delete, after_product_sale_insert.
- **Files changed:** `migration_auto_inventory_on_delivery.sql`, `memory.md`

## Session: Inventory Audit Log + Trigger Fixes (July 24, 2026)
- **New `inventory_audit` table** — Records every UPDATE to `inventory.quantity_on_hand` and `products.quantity_on_hand` with old/new values, timestamp, and source.
- **New audit triggers** — `inventory_audit_trigger` (on inventory) and `product_stock_audit_trigger` (on products) fire on every quantity change and log to the audit table. Any future drift can be traced by querying `SELECT * FROM inventory_audit ORDER BY changed_at DESC`.
- **Fixed product sale trigger** — Removed `GREATEST(0, ...)` from `update_product_inventory_on_sale()`. Product sales now fail on overselling (like egg sales) instead of silently clamping stock to 0.
- **Fixed egg sale trigger** — Added `COALESCE(NEW.tray_size, 30)` to `update_inventory_on_sale()` so NULL tray_size doesn't crash the sale.
- **Files changed:** `migration_inventory_audit.sql` (new), `memory.md`

## Session: Math Audit — 3 Critical Report Query Limit Bugs (July 24, 2026)
- **Bug found:** `fetchSalesReport()`, `fetchSalesBySize()`, and `fetchSalesByHour()` had NO `.limit()` or pagination. Supabase defaults to 1,000 rows max. With 2,452 total sales, **59% of data was silently dropped** from reports and analytics charts.
- **Impact:** Reports showed 26,666 eggs and ₱205,950 revenue instead of the correct 66,408 eggs and ₱501,669 revenue.
- **Fix:** Added chunked pagination (`.range()` in 1,000-row loops matching the `fetchSalesTrend()` pattern) to all three functions.
- **Other math verified correct:** Egg count conversion, revenue-at-sale-time, COGS (latest delivery), Dashboard/Profits formulas, product stock.
- **Files changed:** `src/lib/reports.js` (fetchSalesReport), `src/lib/analytics.js` (fetchSalesBySize, fetchSalesByHour), `memory.md`

### Profits Page Audit & Fixes (July 26, 2026)
- **Full audit of Profits.jsx** — 6 bugs found and fixed, detailed code review passed.
- **BUG 1 (Critical):** `fetchSalesReport` passed `startTime: '00:00', endTime: '23:59'` causing string comparison issues — valid sales at `23:59:01`+ were excluded. **Fix:** Removed time params; Profits filters by date only.
- **BUG 2 (High):** Summary cards always showed combined totals regardless of view filter (Eggs Only / Products Only). **Fix:** Added `ft` (filtered totals) computation that recalculates Revenue, COGS, Net Profit based on active filter. Eggs Sold card hides on Products view; Product Sales card hides on Eggs view.
- **BUG 3 (Medium):** Net Profit Summary Strip showed "Expenses" as a deduction but it was NOT subtracted from net profit (`netProfit = adjustedRevenue - COGS`). **Fix:** Removed misleading Expenses line from the strip. All values use filter-aware `ft.*`.
- **BUG 4 (Medium):** Empty state incorrectly triggered for "All" view when only products had data. **Fix:** Smart `hasVisibleData` check accounting for both data sources and active filter.
- **BUG 5 (Low):** Product mobile cards shared `expandedSize` state with egg cards. **Fix:** Added separate `expandedProduct` state.
- **BUG 6 (Low):** Redundant `Math.round` on already-rounded `revenueCut`. **Fix:** Removed duplicate rounding.
- **New Feature:** Product sales breakdown table — grouped by product with per-unit profit, margin, and gross profit columns.
- **New Feature:** Filter-aware summary cards — Eggs Sold / Product Sales cards hide per active filter.
- **Cost logic confirmed:** Latest delivery cost is used (not date-filtered) — correct per user's business model of pricing based on latest delivery costs.
- **Verification:** ESLint 0 errors, production build passes in 3.6s, live browser test with 0 console errors — all 3 filters (All, Eggs Only, Products Only) verified working with correct calculations.
- **Files changed:** `src/components/Profits.jsx`, `src/lib/analytics.js` (indirect — fetchCostsPerProduct), `memory.md`

### Dark Mode Price Readability Fixes (July 27, 2026)
- **Systematic audit:** Checked all 9 pages for dark mode price readability issues. Fixed 5 files, verified 4 pages clean.

#### Fixed Files
| File | Rules Changed | What Was Fixed |
|------|--------------|----------------|
| **Products.jsx** | `.prod-card-price`, `.prod-card-cost` | Price 15px→18px (33% bigger). Cost: 12px→14px, `--color-text-muted`→`--color-text-secondary` (53% brighter in dark mode), added font-weight 600 |
| **NewProductSale.jsx** | `.ns-product-meta`, `.ns-cart-item-meta` | Price info in product list and cart: 13px→14px, muted→secondary color, added weight |
| **NewSale.jsx** | `.qs-chip-price`, `.ns-product-meta`, `.ns-cart-item-meta`, `.ns-price-hint`, `.ns-size-stock` | Quick-sale price: 9.6px→12px + `--color-success`→`--color-primary`. Product meta: 11px→13px. Cart meta: 11px→13px. All changed from muted→secondary color with added weight |
| **Dashboard.jsx** | `.primary-stat-sub`, `.insight-sub`, `.sale-qty-detail`, `.stat-card-label`, `.insight-label` | Revenue breakdown "Eggs ₱8K · Products ₱2K" and profit "₱500 on ₱2K" now visible in dark mode. Sale details 12px→13px. All labels changed from muted→secondary color |
| **Profits.jsx** | 3 inline styles | "After 1% cut (₱X)": 11px→12px, muted→secondary. Total margin % in egg & product table footers: muted→secondary + bold |

#### Verified Clean (No Changes Needed)
| Page | Why Clean |
|------|-----------|
| **Analytics.jsx** | Chart data uses `--color-primary`, `--color-success`, fill colors. Muted color only used for labels/hints |
| **Inventory.jsx** | Only `::placeholder` uses muted color |
| **Deliveries.jsx** | Cost/payment amounts use `--color-danger`, `--color-primary`, `--color-success` directly. Muted color only used for labels/icons/headers |
| **Reports.jsx** | Price data in table cells uses specific colors. Muted color only used for headers/footer text |

#### The Pattern
Every price-bearing text got:
1. 🔆 **Color**: `--color-text-muted` (`#6B7A6B`) → `--color-text-secondary` (`#A0ADA0`) — **53% brighter in dark mode**
2. 📏 **Size**: +1–3px depending on original (worst were 9.6px and 11px)
3. 🖊️ **Weight**: Added `font-weight: 600` or `700` so prices visually stand out

**Files changed:** `src/components/Products.jsx`, `src/components/NewProductSale.jsx`, `src/components/NewSale.jsx`, `src/components/Dashboard.jsx`, `src/components/Profits.jsx`

### Show All Products Including 0-Stock in Sale Pages (July 29, 2026)
- **NewSale.jsx / NewProductSale.jsx** — Removed the `quantity_on_hand > 0` filter so the full product catalog is visible, including out-of-stock items
- **Out-of-stock visual styling:** Added `.out-of-stock` class with `opacity: 0.45`, `cursor: not-allowed`, hover override, and a red uppercase **"OUT OF STOCK"** badge replacing the stock count
- **Interaction guards:** Radio inputs disabled, click handlers blocked, Add button disabled — prevents accidental selection of 0-stock items
- **Enter-key fix:** Both search fields now skip to first in-stock product instead of potentially selecting 0-stock on Enter
- **Refactored** `inStockProducts` memo in NewSale.jsx to keep quick-sale grid filtering only in-stock items
- **Empty state:** Changed from "No products with stock found" to "No products found"

**Files changed:** `src/components/NewSale.jsx`, `src/components/NewProductSale.jsx`

### Product Deliveries — Show All + Today/All/Custom Date Filter (August 3, 2026)
- **Bug:** `ProductDeliveries.jsx` loaded deliveries with a hardcoded `fetchProductDeliveries({ startDate: today, endDate: today })` — the page only ever showed **today's** deliveries. The DB had 20 product deliveries (Jul 19 → Aug 1) but the page showed "No product deliveries yet" on any day without a new delivery.
- **Fix:** Removed the today-only filter — the page now loads **all** deliveries (50/page) with a **Load More** button, matching the egg Deliveries page pattern (`PAGE_SIZE`/`page`/`hasMore` state + `loadMore()`).
- **Bonus fix:** The Qty column rendered `d.products?.purchase_unit` but the join only selected `products(name)` — the unit was always blank (e.g., "3 " instead of "3 pack"). Fixed by joining `products(name, unit, purchase_unit)` in `fetchProductDeliveries()` (and `recordProductDelivery()` for consistency).
- **New feature: Today / All / Custom date filter**
  - Filter tabs: **All** (default) / **Today** / **Custom** (reveals start/end date pickers + **Go** button)
  - Date range passed server-side via `fetchProductDeliveries({ startDate, endDate })` (`.gte`/`.lte` on `delivery_date`)
  - **`filterRef` (useRef) pattern:** `loadData()` is a `useCallback` with `[]` deps that reads `filterRef.current` — so pagination (`loadMore`), undo, delete, and payment updates all re-apply the active date range without stale closures
  - `changeFilter('today' | 'all')` updates the ref + reloads; `'custom'` only reveals the pickers (range applies on **Go** via `applyCustom()`)
  - `customApplied` state prevents the stat card from showing the custom range label before Go is pressed
  - Switching filters clears the search query and closes the payment dropdown
  - 5th stat card shows the applied range (e.g., "Jul 19 → Jul 27") with its count, otherwise stays "today · ₱X"
  - Empty state now distinguishes "No deliveries in this date range" / "No deliveries match your search" / "No product deliveries yet"
- **Verification:** ESLint 0 errors, production build passes, live API verified (All=20, Today=0, Custom Jul 19–27=19), code review passed
- **Files changed:** `src/components/ProductDeliveries.jsx`, `src/lib/productDeliveries.js`, `memory.md`
