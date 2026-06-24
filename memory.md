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
    │   └── salesUtils.js       # Sale calculations, validation, grouping, quick qty chips
    └── components/
        ├── Layout.jsx          # Sidebar nav + mobile bottom nav + keyboard shortcuts + version badge
        ├── Dashboard.jsx       # Auto-refresh (30s), stat cards, stock alerts, today's feed
        ├── Inventory.jsx       # Add/remove stock by trays or pieces
        ├── SalesLog.jsx        # Search, sort, bulk delete, pagination, date filter, modal form
        ├── PriceSettings.jsx   # Per-piece & per-tray prices per egg size
        ├── Profits.jsx         # Revenue → Expenses → COGS = Net Profit with per-size breakdown
        ├── Analytics.jsx       # 6 chart tabs (by size, hour, trend, revenue, pie, margins)
        ├── Reports.jsx         # Shift-based reports, CSV export, Backup (JSON), deliveries
        ├── Expenses.jsx        # Search, sort, bulk delete, pagination, undo toast
        ├── Spoilage.jsx        # Search, sort, bulk delete, pagination, undo toast
        ├── Customers.jsx       # Customer directory
        ├── Suppliers.jsx       # Supplier directory
        ├── Deliveries.jsx      # Multi-size batch form, search, bulk delete, pagination, undo
        ├── OperationalExpenses.jsx  # Track funds added to the business, running balance
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
- **`after_sale_insert`** — Automatically deducts inventory when a sale is recorded. Converts trays to egg count (qty × tray_size) before deducting.
- **`after_spoilage_insert`** — Automatically deducts inventory when spoilage is recorded.

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
| `/expenses` | Expenses | Record expenses by category, filter & view breakdown |
| `/operational-expenses` | OperationalExpenses | Track funds added to business, running balance (Total Funds − Expenses) |
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
- Fixed sidebar (260px) with logo, 13 nav items in 5 labeled sections, and dark mode toggle
- Nav sections: OVERVIEW, STOCK & SALES, FINANCIAL, DIRECTORY, REPORTS
- Main content area fills remaining width

### Mobile (<768px)
- **Fixed top header** with hamburger menu, logo, and dark mode toggle button
- **Bottom navigation bar** with 5 quick-access tabs (Home, Stock, Sales, Costs, Stats) + More button
- Slide-out sidebar triggered by hamburger or More button
- Backdrop blur overlay on sidebar open
- Frosted glass effect on header and bottom nav (`backdrop-filter: blur(12px)`)
- Safe area inset support for iPhone notch (`env(safe-area-inset-bottom)`)

---

## Key Features

### Dashboard
- **Welcome greeting** with time-of-day emoji (🌅/☀️/🌙) and date
- **Quick Action Bar** — 4 color-coded shortcut buttons: Record Sale, Add Stock, Add Expense, New Delivery
- **Primary stat cards** — Today's Revenue (with ▲▼ % change vs yesterday), Net Profit (green/red based on positive/negative)
- **Insight cards row** — Best Seller Today (name, eggs, %), Profit Margin (%, green/red), 7-Day Sales Trend (SVG sparkline)
- **Secondary stat grid** — Total Stock, Stock Value, Eggs Sold, Operational Funds (with health progress bar), Expenses, Deliveries count, Delivery Cost
- **Low stock alert card** — Shows out-of-stock sizes count with "Restock immediately" message
- **Stock levels list** with trays/pieces breakdown, status badges, and quick-restock (+1 tray) buttons
- **Today's sales feed** with amounts and times
- **Today's deliveries feed** with supplier, egg size, quantity, cost, and payment status
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

### Utilities
- `getLocalDate(date?)` — Returns today's (or given date's) YYYY-MM-DD string using **local timezone** (not UTC). Uses `toLocaleDateString('en-CA')`.
- `fetchProfitMargins()` — Calculates profit margins per egg size by comparing average delivery cost vs selling price
- `exportAllData()` — Fetches all tables (sales, deliveries, expenses, spoilage, inventory, prices, suppliers, customers) as a single JSON object
- `APP_VERSION` — `import.meta.env.VITE_APP_VERSION || '1.0.0'`
- `EGG_SIZES` — ['Peewee', 'Pullet', 'Small', 'Medium', 'Large', 'Extra Large', 'Jumbo']
- `EXPENSE_CATEGORIES` — ['Feed', 'Labor', 'Utilities', 'Transport', 'Packaging', 'Maintenance', 'Misc']
- `SPOILAGE_REASONS` — ['Cracked', 'Broken', 'Expired', 'Damaged', 'Other']
- `TRAY_SIZE` — 30 (eggs per tray)
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
- New "Margins" tab in Analytics — shows margin summary cards (cost, selling price, profit per size) and grouped bar chart comparing cost vs selling price- Margins load once on mount (not time-dependent)
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
- Added "Operational" nav item under FINANCIAL section (Wallet icon)
- Added Floating Action Button (FAB) on mobile — quick access to Sales page
- Removed icon duplicate: TrendingUp used for both Profits and Analytics

### Operational Expenses Feature
- **New `/operational-expenses` route** — Track funds added to the business
- **New DB table `operational_funds`** — stores fund addition records
- **New API functions** — `fetchOperationalFunds`, `addOperationalFund`, `deleteOperationalFund`, `getOperationalBalance`
- **New component `OperationalExpenses.jsx`** — Balance cards (Total Funds, Total Expenses, Available), add form, fund list with delete
- **Dashboard** — Operational balance shown in secondary stat grid with health progress bar
- SQL migration: `migration_operational_expenses.sql`

### Sales Log Visual Size Cards
- **SalesLog.jsx** — Replaced egg size dropdown with visual card grid
- Cards show: size name, stock count, status badge (In Stock/Low/Out)
- Selected card: green border + checkmark badge
- Out-of-stock cards: grayed out, not clickable
- Quantity resets when switching sizes to prevent errors

### Profits Page Cleanup
- **Profits.jsx** — Removed Gross Profit summary card; only Net Profit remains

### Dashboard Enhancement Pass
- **Quick Action Bar** — 4 color-coded buttons: Record Sale (green), Add Stock (blue), Add Expense (red), New Delivery (teal)
- **Yesterday comparison** — Revenue card shows ▲▼ % change badge vs yesterday
- **Best Seller Today** — Insight card showing top-selling egg size with eggs and percentage
- **Profit Margin** — Insight card showing real-time margin % with green/red coloring
- **7-Day Sparkline** — SVG polyline chart showing daily sales trend with area fill
- **Operational health bar** — Progress bar on the opex card showing remaining funds vs total
- **Quick-restock buttons** — "+1 tray" button on each stock item in Dashboard stock list, calls updateInventory directly
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

# Last updated: June 2026
