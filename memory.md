# M&E Fresh Eggs — Egg Monitor App

## Project Overview

A mobile-first web application for tracking egg inventory, recording sales, managing pricing, viewing sales analytics, generating shift-based reports, and tracking expenses. Built for **M&E Fresh Eggs**, an egg retail business.

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
| Build | `npm run build` → `dist/` |

---

## Project Structure

```
M-EFresheggs/
├── .env                    # Supabase credentials (gitignored)
├── package.json
├── vite.config.js
├── database_schema.sql     # Full schema including expenses table
├── migration_pricing.sql   # Migration for pricing tables
├── memory.md               # This file
├── eslint.config.js
├── .github/workflows/deploy.yml
├── README.md
└── src/
    ├── main.jsx            # Entry point
    ├── App.jsx             # Router + Layout wrapper
    ├── index.css           # Design system (CSS variables, utilities)
    ├── lib/
    │   ├── supabaseClient.js   # Supabase connection
    │   ├── api.js              # All data operations + utilities
    │   └── errors.js           # User-friendly error messages
    └── components/
        ├── Layout.jsx          # Sidebar nav, mobile-responsive
        ├── Dashboard.jsx       # Overview stats, stock levels, net profit
        ├── Inventory.jsx       # Add/remove stock by trays or pieces
        ├── SalesLog.jsx        # Record & filter sales by date range
        ├── PriceSettings.jsx   # Set per-piece & per-tray prices
        ├── Analytics.jsx       # Charts (size, time, trend, revenue, distribution)
        ├── Reports.jsx         # Shift-based sales reports with CSV export
        ├── Expenses.jsx        # Expense tracking by category
        ├── Toast.jsx           # Global notification system
        ├── ConfirmDialog.jsx   # Reusable confirmation modal
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

### Trigger
- **`after_sale_insert`** — Automatically deducts inventory when a sale is recorded. Converts trays to egg count (qty × tray_size) before deducting.

### RLS Policies
All tables use permissive policies (`ALL USING true`) since this is a single-user app. Row Level Security is enabled but allows all operations.

---

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Overview: stock levels, today's sales, revenue, expenses, net profit |
| `/inventory` | Inventory | Add/remove stock by trays or pieces per egg size |
| `/prices` | PriceSettings | Set per-piece and per-tray selling prices |
| `/sales` | SalesLog | Record sales, filter by date range (Today/This Week/Custom) |
| `/expenses` | Expenses | Record expenses by category, filter & view breakdown |
| `/analytics` | Analytics | 5 chart views (by size, by hour, trend, revenue, distribution) |
| `/reports` | Reports | Shift-based sales reports (Morning/Afternoon/Whole Day/Custom) with CSV export |

---

## Key Features

### Inventory Management
- Each egg size card shows total stock in trays + pieces format (e.g., "2 trays + 15 pcs")
- **Add row:** Tray count input + piece count input with plus buttons
- **Remove row:** Piece count input + tray count input with minus buttons
- Confirmation dialog before any removal
- Quick stock status badges: In Stock (green), Low Stock ≤50 (yellow), Out of Stock (red)

### Sales Recording
- Select egg size, unit (piece/tray), and quantity
- Tray size selector (30 eggs)
- Auto-calculates total amount from current price settings
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

### Dashboard
- Stat cards: Total Stock, Sold Today, Low Stock Items, Revenue Today, Expenses Today, Net Profit Today
- Stock levels list with trays/pieces breakdown per size
- Today's sales feed (latest 10)
- Error banners with retry button
- Loading skeletons

### Reports
- Date range pickers (From / To)
- Shift selector: Morning (6AM–2PM), Afternoon (2PM–10PM), Whole Day, Custom
- Report table: Egg Size, Trays, Pieces, Total Eggs, Revenue, Transactions
- Total row with properly converted trays (pieces always < 30)
- Summary cards: Total Eggs Sold, Revenue, Transactions, Trays Sold, Pieces Sold
- **CSV Export** button to download report as `.csv`
- Print-friendly layout

### Analytics
- 5 chart tabs using Recharts: By Size, By Time, Trend, Revenue, Distribution
- Date range selector: 7/30/90 days
- Summary stats: total revenue, total eggs sold, best-selling size, peak hour

---

## API Layer (`src/lib/api.js`)

### Inventory
- `fetchInventory()` — Gets all inventory with egg size names
- `updateInventory(eggSizeId, quantity)` — Sets exact quantity_on_hand

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

### Utilities
- `EGG_SIZES` — ['Peewee', 'Pullet', 'Small', 'Medium', 'Large', 'Extra Large', 'Jumbo']
- `EXPENSE_CATEGORIES` — ['Feed', 'Labor', 'Utilities', 'Transport', 'Packaging', 'Maintenance', 'Misc']
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
- Types: success (green), error (red)

### ConfirmDialog (`ConfirmDialog.jsx`)
- Reusable modal for confirming destructive or important actions
- Props: `open`, `title`, `message`, `confirmLabel`, `variant`, `icon`, `onConfirm`, `onCancel`

### ErrorBoundary (`ErrorBoundary.jsx`)
- Catches React rendering errors and shows a friendly fallback UI
- Wraps all routes in App.jsx

### Errors (`src/lib/errors.js`)
- `getUserFriendlyError(error)` — Converts Supabase/network errors to human-readable messages

---

## Color Scheme

**Brand colors:** Green & Yellow

| Role | Color | Hex |
|------|-------|-----|
| Primary | Green | `#2E7D32` |
| Primary hover | Darker green | `#1B5E20` |
| Primary light | Light green | `#E8F5E9` |
| Background | Cream yellow | `#FFFDE7` |
| Cards | White | `#FFFFFF` |
| Text | Dark green | `#1B2E1B` |
| Text secondary | Muted green | `#5A6B5A` |
| Text muted | Gray-green | `#8A9B8A` |
| Border | Light green | `#C8E6C9` |
| Accent | Golden yellow | `#F9A825` |
| Success | Green | `#2E7D32` |
| Warning | Deep yellow | `#F57F17` |
| Danger | Red | `#C62828` |

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

### 4. Build for Production
```bash
npm run build
# Output in dist/
npm run preview  # Preview the production build
```

---

## Development Notes

- **Tray size is fixed at 30 eggs**
- **No authentication** — Single-user app with permissive RLS policies
- **Mobile-first design** — Larger fonts, touch-friendly buttons, responsive grid, optimized for 375px+ screens
- **CSS uses inline `<style>` blocks** within each component (no CSS modules)
- **Design system** lives in `src/index.css` with CSS custom properties
- **Build with `npm run build`**, output goes to `dist/`
- **Supabase URL must be passed explicitly during build** if parent shell has stale env vars:

```bash
unset VITE_SUPABASE_URL
unset VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_URL="https://npohyeqnaltpqzmmlmej.supabase.co" VITE_SUPABASE_ANON_KEY="sb_publishable_QlM4RGEizMrdybxn75T2gA_CYIx7kGi" npx vite build
```

## Mobile Responsiveness

All pages are optimized for mobile viewing (375px+). Desktop layouts use responsive grid breakpoints at 640px and 900px.

| Page | Mobile Layout Strategy |
|------|----------------------|
| **Layout** | Hamburger menu with slide-out sidebar, fixed top header |
| **Dashboard** | Stat cards stack to single column, compact padding + smaller icons |
| **Inventory** | Input fields tighten to 60px min-width, action labels shrink, card padding reduced |
| **Pricing** | Save button goes full-width under inputs, price badges truncate with ellipsis |
| **Sales Log** | 5-column grid → 2-column card layout (size+amount top, qty+eggs bottom), stacked filter bar |
| **Expenses** | 4-column grid → 2-column card layout (date+category left, amount right, desc full-width), stats stack |
| **Analytics** | Chart tabs wrap naturally, pie chart outerRadius shrinks to 80 on mobile |
| **Reports** | 2-column controls grid, shift tabs wrap, table has horizontal scroll |

## New Features (Added)

### Spoilage Tracking (`/spoilage`)
- Record egg wastage by size, quantity, reason (Cracked/Broken/Expired/Damaged/Other)
- Stats: total spoiled eggs, spoiled today
- Reason breakdown with color-coded badges
- Date picker for recording past spoilage
- Mobile-responsive card layout

### Customer Directory (`/customers`)
- Manage customer contacts: name, phone, notes
- Add and remove customers
- Empty state with quick-add button
- Mobile-responsive layout

### Dark Mode
- Toggle button in sidebar footer
- Persists preference via `localStorage`
- Respects system `prefers-color-scheme` on first visit
- Full dark theme: adjusted colors for all elements (buttons, cards, tables, skeleton loaders, scrollbars)
- Applied via `data-theme` attribute on `<html>`

### Revenue vs Expenses (Reports)
- When generating a report, expenses for the same date range are fetched automatically
- Three summary cards: Total Revenue, Total Expenses, Net Profit
- Net profit is color-coded (green for positive, red for negative)
- Expense breakdown by category below

### Database
- `spoilage` table: tracks egg wastage by size, quantity, reason, date
- `customers` table: customer directory with name, phone, notes
- RLS policies and indexes for both new tables

# Last updated: Mon Jun  1 15:00:00 CST 2026
