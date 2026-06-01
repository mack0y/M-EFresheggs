# M&E Fresh Eggs — Egg Monitor App

## Project Overview

A mobile-first web application for tracking egg inventory, recording sales, managing pricing, viewing sales analytics, generating shift-based reports, and tracking expenses. Built for **M&E Fresh Eggs**, an egg retail business.

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
├── .env                    # Supabase credentials (gitignored)
├── package.json
├── vite.config.js
├── database_schema.sql     # Full schema including expenses, spoilage, customers
├── migration_pricing.sql   # Migration for pricing tables
├── memory.md               # This file
├── eslint.config.js
├── .github/workflows/deploy.yml
├── README.md
└── src/
    ├── main.jsx            # Entry point
    ├── App.jsx             # Router + Layout wrapper
    ├── index.css           # Design system v2 (CSS variables, utilities, animations)
    ├── lib/
    │   ├── supabaseClient.js   # Supabase connection
    │   ├── api.js              # All data operations + utilities
    │   └── errors.js           # User-friendly error messages
    └── components/
        ├── Layout.jsx          # Sidebar nav + mobile bottom nav bar
        ├── Dashboard.jsx       # Welcome greeting, stat cards, stock levels, alerts
        ├── Inventory.jsx       # Add/remove stock by trays or pieces
        ├── SalesLog.jsx        # Record & filter sales by date range
        ├── PriceSettings.jsx   # Set per-piece & per-tray prices
        ├── Analytics.jsx       # Charts (size, time, trend, revenue, distribution)
        ├── Reports.jsx         # Shift-based sales reports with CSV export
        ├── Expenses.jsx        # Expense tracking by category
        ├── Spoilage.jsx        # Egg wastage tracking
        ├── Customers.jsx       # Customer directory
        ├── Toast.jsx           # Global notification system (with SVG icons)
        ├── ConfirmDialog.jsx   # Reusable confirmation modal (with backdrop blur)
        └── ErrorBoundary.jsx   # Error boundary wrapper
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

### Triggers
- **`after_sale_insert`** — Automatically deducts inventory when a sale is recorded. Converts trays to egg count (qty × tray_size) before deducting.
- **`after_spoilage_insert`** — Automatically deducts inventory when spoilage is recorded.

### RLS Policies
All tables use permissive policies (`ALL USING true`) since this is a single-user app. Row Level Security is enabled but allows all operations.

---

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Welcome greeting, revenue/profit stats, stock levels, today's sales |
| `/inventory` | Inventory | Add/remove stock by trays or pieces per egg size |
| `/prices` | PriceSettings | Set per-piece and per-tray selling prices |
| `/sales` | SalesLog | Record sales, filter by date range (Today/This Week/Custom) |
| `/spoilage` | Spoilage | Track egg wastage by size, reason, with cost estimation |
| `/customers` | Customers | Customer directory (name, phone, notes) |
| `/expenses` | Expenses | Record expenses by category, filter & view breakdown |
| `/analytics` | Analytics | 5 chart views (by size, by hour, trend, revenue, distribution) |
| `/reports` | Reports | Shift-based sales reports with CSV export + revenue vs expenses |

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
- Fixed sidebar (260px) with logo, 9 nav items, and dark mode toggle
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
- **Primary stat cards** — Today's Revenue, Net Profit (green/red based on positive/negative)
- **Secondary stat grid** — Total Stock, Stock Value, Eggs Sold, Expenses
- **Low stock alert card** — Shows out-of-stock sizes count with "Restock immediately" message
- **Stock levels list** with trays/pieces breakdown and status badges
- **Today's sales feed** with amounts and times
- Loading skeletons for all data

### Inventory Management
- Each egg size card shows total stock in trays + pieces format (e.g., "2 trays + 15 pcs")
- **Add row:** Tray count input + piece count input with plus buttons
- **Remove row:** Piece count input + tray count input with minus buttons
- Confirmation dialog before any removal
- Clear partial removal toast: "Could only remove X — all remaining stock cleared"
- Quick stock status badges: In Stock (green), Low Stock ≤50 (yellow), Out of Stock (red)

### Sales Recording
- Select egg size, unit (piece/tray), and quantity
- Tray size selector (30 eggs)
- Auto-calculates total amount from current price settings
- **Client-side inventory validation** — shows "Not enough stock" error before DB failure
- Confirmation dialog before recording
- Date range filter (Today / This Week / Custom Range)
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

### Reports
- Date range pickers (From / To)
- Shift selector: Morning (6AM–2PM), Afternoon (2PM–10PM), Whole Day, Custom
- Report table: Egg Size, Trays, Pieces, Total Eggs, Revenue, Transactions
- Total row with properly converted trays (pieces always < 30)
- Summary cards: Total Eggs Sold, Revenue, Transactions, Trays Sold, Pieces Sold
- **Revenue vs Expenses** — net profit calculation with expense breakdown by category
- **CSV Export** button with sales, spoilage, and customer data
- Print-friendly layout

### Analytics
- 5 chart tabs using Recharts: By Size, By Time, Trend, Revenue, Distribution (Pie)
- **Responsive PieChart** using percentage-based radii (70%/35%)
- Date range selector: 7/30/90 days
- Summary stats: total revenue, total eggs sold, best-selling size, peak hour

### Dark Mode
- Toggle button in sidebar footer and mobile header
- Persists preference via `localStorage`
- Respects system `prefers-color-scheme` on first visit
- Full dark theme with `[data-theme="dark"]` selector
- Frosted glass effects preserved in dark mode

---

## Accessibility

All form fields across 8 components have proper `id` and `name` attributes:
- **Inventory.jsx** — Dynamic IDs per egg size (e.g., `inv-tray-add-{id}`)
- **SalesLog.jsx** — `sale-egg-size`, `sale-quantity`, `sale-filter-start/end`
- **Expenses.jsx** — `expense-category`, `expense-amount`, `expense-description`
- **Spoilage.jsx** — `spoilage-egg-size`, `spoilage-quantity`, `spoilage-reason`, `spoilage-date`
- **Customers.jsx** — `customer-name`, `customer-phone`, `customer-notes`
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
- `fetchSales({ limit, offset, startDate, endDate })` — Sales with date range + egg size names
- `fetchTodaySales()` — Today's sales only
- `fetchSalesReport({ startDate, endDate, startTime, endTime })` — Shift-based report data with egg size info

### Analytics
- `fetchSalesBySize(startDate, endDate)` — Sales in date range for size/revenue breakdown
- `fetchSalesByHour(startDate, endDate)` — Sale times filtered by date range
- `fetchSalesTrend(days)` — Daily sales for trend line

### Expenses
- `fetchExpenses({ startDate, endDate, limit })` — Filtered expense list
- `fetchTodayExpenses()` — Today's expenses
- `recordExpense({ category, description, amount })` — Record a new expense

### Spoilage
- `fetchSpoilage({ startDate, endDate, limit })` — Filtered spoilage list
- `recordSpoilage({ eggSizeId, quantity, reason, spoilageDate })` — Record spoilage
- `fetchSpoilageWithCost({ startDate, endDate, limit })` — Spoilage with cost estimation

### Customers
- `fetchCustomers()` — Get all customers sorted by name
- `addCustomer({ name, phone, notes })` — Add a customer
- `deleteCustomer(id)` — Remove a customer

### Utilities
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
- Global notification system via `toast(message, type)` function
- Auto-dismiss after 3 seconds
- Types: success (green with checkmark), error (red with X)
- SVG icons for visual clarity
- Spring animation entrance (`slideUp`)
- Positioned above bottom nav on mobile (`bottom: 5rem`)

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
- **Mobile-first design** — Larger fonts, touch-friendly buttons, responsive grid, optimized for 375px+ screens
- **CSS uses inline `<style>` blocks** within each component (no CSS modules)
- **Design system v2** lives in `src/index.css` with CSS custom properties
- **All form fields have `id` and `name` attributes** for accessibility
- **Client-side inventory validation** before sales and spoilage recording
- **ESLint clean** — 0 errors, 0 warnings

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

### UI/UX Overhaul
- Complete design system v2 with new CSS variables, shadows, transitions, radii
- Mobile bottom navigation bar with 5 quick tabs + More button
- Frosted glass effects on header and bottom nav
- Redesigned Dashboard with welcome greeting, primary/secondary stat cards, alert card
- Toast component: SVG icons, spring animations
- ConfirmDialog: backdrop blur, scale-in animation
- ErrorBoundary: updated to design system variables

### Accessibility Fixes
- Added `id` and `name` attributes to all 28 form fields across 8 components
- Added `htmlFor` on labels in PriceSettings

### Bug Fixes
- Inventory validation before sales/spoilage recording
- Improved partial removal toast messages
- Fixed Reports.jsx ESLint errors
- Fixed Dashboard alert subtitle text
- Responsive PieChart sizing
- PriceSettings error logging

# Last updated: Sat Jun  7 12:00:00 CST 2026
