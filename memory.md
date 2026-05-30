# M&E Fresh Eggs — Egg Monitor App

## Project Overview

A mobile-first web application for tracking egg inventory, recording sales, managing pricing, and viewing sales analytics. Built for **M&E Fresh Eggs**, an egg retail business.

**Live URL:** http://localhost:5173 (dev)
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
| Build | npm run build → `dist/` |
| Deployment target | GitHub Pages (base: `/egg-monitoring/`) |

---

## Project Structure

```
egg-monitoring/
├── .env                    # Supabase credentials (gitignored)
├── .env.example            # Template for .env
├── package.json
├── vite.config.js          # Vite + React, base: /egg-monitoring/
├── database_schema.sql     # Full schema (run once on new project)
├── migration_pricing.sql   # Migration to add pricing tables
├── memory.md               # This file
├── me.png                  # Original logo image (not used in UI)
├── public/
│   └── logo.png            # Logo image (copied from me.png, not currently used)
└── src/
    ├── main.jsx            # Entry point
    ├── App.jsx             # Router + Layout wrapper
    ├── index.css           # Design system (CSS variables, utilities)
    ├── lib/
    │   ├── supabaseClient.js   # Supabase connection
    │   └── api.js              # All data operations + utilities
    └── components/
        ├── Layout.jsx          # Sidebar nav, mobile-responsive
        ├── Dashboard.jsx       # Overview stats & stock levels
        ├── Inventory.jsx       # Manage stock per egg size
        ├── SalesLog.jsx        # Record & filter sales
        ├── Analytics.jsx       # 5 chart views (size, time, trend, pie, revenue)
        ├── PriceSettings.jsx   # Set per-piece & per-tray prices
        ├── Toast.jsx           # Notification system
        └── SetupGuide.jsx      # Supabase setup guide
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

#### `price_settings` — Pricing per egg size (added via migration)
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

### Trigger
- **`after_sale_insert`** — Automatically deducts inventory when a sale is recorded. Converts trays to egg count (qty × tray_size) before deducting.

### RLS Policies
All tables use permissive policies (`ALL USING true`) since this is a single-user app. Row Level Security is enabled but allows all operations.

---

## API Layer (`src/lib/api.js`)

### Inventory
- `fetchInventory()` — Gets all inventory with egg size names (sorted)
- `updateInventory(eggSizeId, quantity)` — Sets exact quantity_on_hand

### Pricing
- `fetchPriceSettings()` — Gets all prices with egg size names
- `updatePriceSetting(eggSizeId, pricePerPiece, pricePerTray)` — Upserts by egg_size_id

### Sales
- `recordSale({ eggSizeId, quantity, unit, traySize })` — Records sale AND calculates total_amount from current price_settings. Also triggers automatic inventory deduction via Supabase trigger.
- `fetchSales({ limit, offset })` — Recent sales with egg size names
- `fetchTodaySales()` — Today's sales only

### Analytics
- `fetchSalesBySize(startDate, endDate)` — Sales in date range, used for size/revenue breakdown
- `fetchSalesByHour()` — All sale times, used for hourly distribution
- `fetchSalesTrend(days)` — Sales grouped by date for trend line

### Utilities
- `EGG_SIZES` — Constant array: ['Peewee', 'Pullet', 'Small', 'Medium', 'Large', 'Extra Large', 'Jumbo']
- `TRAY_SIZE` — 30 (eggs per tray)
- `getEggCount(sale)` — Converts a sale record to total egg count (handles trays vs pieces)
- `toTraysAndPieces(totalEggs)` — Returns `{ trays, pieces }` object
- `formatInventory(totalEggs)` — Returns string like "2 trays + 22 pcs" or "15 pcs"
- `formatPeso(amount)` — Returns string like "₱1,234.50"

---

## Components

### Layout (`Layout.jsx`)
- Responsive sidebar navigation
- Mobile: hamburger menu with overlay, fixed header
- Desktop: fixed sidebar (260px), sticky
- Branding: 🥚 **M&E Fresh Eggs** in header and sidebar
- Nav items: Dashboard, Inventory, Pricing, Sales Log, Analytics

### Dashboard (`Dashboard.jsx`)
- Stat cards: Total Stock, Sold Today, Low Stock Items, Revenue Today, Egg Sizes
- Stock levels list (shows trays + pieces via `formatInventory`)
- Today's sales feed (latest 10)
- Quick links to Inventory and Sales pages
- Handles loading (skeleton) and error states

### Inventory (`Inventory.jsx`)
- Lists all egg sizes with current stock
- Shows total count bold + breakdown below (e.g., "2 trays + 22 pcs")
- Actions per row:
  - **+Tray** — Quick add 30 eggs
  - **[input] [+] —** Type any number of pieces, press Enter or tap +
  - **[-] [input]** — Type any number to remove, press Enter or tap -
  - **-Tray** — Quick remove 30 eggs (disabled if stock < 30)
- Mobile-optimized with larger fonts and touch targets
- Stock status badges: In Stock (green), Low Stock ≤50 (yellow), Out of Stock (red)

### SalesLog (`SalesLog.jsx`)
- Record new sales with form: egg size, unit (piece/tray), quantity
- Tray size selector (30 eggs — the standard)
- Sales list with 4 columns: Size | Qty | Amount | When
- "When" column shows relative dates (Today, Yesterday, Apr 5) + time
- Filter tabs: All Sales, Today, Recent 20
- Stats bar: eggs sold today + revenue today
- Amount column auto-calculated from pricing at time of sale

### Analytics (`Analytics.jsx`)
- 5 chart tabs using Recharts:
  - **By Size** — Bar chart of eggs sold per size
  - **By Time** — Bar chart of sales volume by hour (5 AM–8 PM)
  - **Trend** — Line chart of daily sales over selected period
  - **Revenue** — Bar chart of revenue by egg size (shows ₱)
  - **Distribution** — Donut/pie chart of sales by size
- Summary stats: total revenue, total eggs sold, best-selling size, peak hour
- Date range selector: 7/30/90 days

### PriceSettings (`PriceSettings.jsx`)
- Lists all egg sizes with current prices as badges
- Per-piece and per-tray price inputs per size
- Save button per row (upserts to Supabase)
- Current prices displayed as badge: "Current: ₱8.00 / pc • ₱220.00 / tray"
- Helpful info card explaining how pricing works

### Toast (`Toast.jsx`)
- Global notification system via `toast()` function
- Auto-dismiss after 3 seconds
- Types: success (green), error (red)

---

## Color Scheme

**Brand colors:** Yellow & Green (updated from original brown theme)

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
3. For a fresh project, run the entire `database_schema.sql`
4. For existing projects, run `migration_pricing.sql` to add pricing tables

### 2. Environment Variables
Create `.env` file (see `.env.example`):
```
VITE_SUPABASE_URL=https://npohyeqnaltpqzmmlmej.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run Locally
```bash
cd "C:/Egg Monitoring"
npm install
npm run dev
# Opens at http://localhost:5173
```

### 4. Build for Production
```bash
npm run build
# Output in dist/
```

---

## Key User Flows

### Recording a Sale
1. Go to **Sales Log** → Tap **New Sale**
2. Select egg size, unit (piece/tray), quantity
3. Tap **Record Sale**
4. App auto-calculates total from current price_settings
5. Supabase trigger auto-deducts from inventory

### Managing Inventory
1. Go to **Inventory**
2. Use **+Tray** / **-Tray** for ±30 eggs
3. Or type any number in the input fields and press Enter or tap +/- button
4. Stock updates instantly in Supabase

### Setting Prices
1. Go to **Pricing**
2. Enter per-piece and per-tray prices for each size
3. Tap **Save** per row
4. Prices persist and are used for future sale calculations

### Viewing Analytics
1. Go to **Analytics**
2. Select date range (7/30/90 days)
3. Switch between chart tabs: By Size, By Time, Trend, Revenue, Distribution
4. Revenue chart shows which sizes earn the most

---

## Dependencies (`package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.6 | UI framework |
| react-dom | ^19.2.6 | DOM rendering |
| react-router-dom | ^7.16.0 | Client-side routing |
| @supabase/supabase-js | ^2.106.2 | Database client |
| lucide-react | ^1.17.0 | Icons |
| recharts | ^3.8.1 | Charts |
| vite | ^8.0.12 | Build tool |
| @vitejs/plugin-react | ^6.0.1 | React plugin for Vite |

---

## Development Notes

- **Tray size is fixed at 30 eggs** (only size used by the business)
- **No authentication** — Single-user app with permissive RLS policies
- **Mobile-first design** — Larger fonts, touch-friendly buttons, responsive grid
- **CSS uses inline `<style>` blocks** within each component (no CSS modules)
- **Design system** lives in `src/index.css` with CSS custom properties
- **Build with `npm run build`**, output goes to `dist/`
- **GitHub Pages base path** is set to `/egg-monitoring/` in `vite.config.js`
# Last updated: Sat May 30 12:19:22 CST 2026
# Last deployment trigger: Sat May 30 12:28:06 CST 2026
