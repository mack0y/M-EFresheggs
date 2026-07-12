# M&E Fresh Eggs — Crew Briefing

## Project Identity
- **Repo:** `M-EFresheggs` by mack0y
- **Live:** https://mack0y.github.io/M-EFresheggs/
- **Purpose:** Mobile-first PWA for small-scale egg retail — inventory, sales, expenses, spoilage, pricing, suppliers, deliveries, customers, analytics, reports, profits

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Bundler | Vite 8 |
| Routing | React Router v7 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Backend | Supabase (PostgreSQL) |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | GitHub Actions → GitHub Pages |
| Test | Vitest |

## Project Structure
```
M-EFresheggs/
├── src/
│   ├── App.jsx                    — Router setup (all routes)
│   ├── main.jsx                   — Entry point
│   ├── index.css                  — Global styles
│   ├── components/                — 22 UI pages/panels
│   │   ├── Dashboard.jsx          — Today's revenue, profit, stock, sparkline
│   │   ├── Inventory.jsx          — Add/remove stock by trays/pieces (7 sizes)
│   │   ├── PriceSettings.jsx      — Per-piece and per-tray pricing
│   │   ├── SalesLog.jsx           — Sales history, filter, sort, search
│   │   ├── NewEggSale.jsx         — Record egg sale form
│   │   ├── NewProductSale.jsx     — Record product sale form
│   │   ├── ExpensesFunds.jsx      — Operational expenses with running balance
│   │   ├── Spoilage.jsx           — Egg wastage by size + reason
│   │   ├── Customers.jsx          — Contact directory
│   │   ├── Suppliers.jsx          — Contact directory
│   │   ├── Deliveries.jsx         — Batch multi-size delivery records
│   │   ├── Products.jsx           — Product management
│   │   ├── ProductDeliveries.jsx  — Product delivery tracking
│   │   ├── ProductInventory.jsx   — Product stock management
│   │   ├── ProductSales.jsx       — Product sales tracking
│   │   ├── Analytics.jsx          — 6 chart views
│   │   ├── Reports.jsx            — Shift-based reports + CSV export
│   │   ├── Profits.jsx            — Per-size profit breakdown
│   │   ├── Layout.jsx             — App shell / navigation
│   │   ├── ConfirmDialog.jsx      — Reusable confirmation modal
│   │   ├── ErrorBoundary.jsx      — Error boundary wrapper
│   │   └── Toast.jsx              — Toast notification system
│   ├── lib/                       — Data layer (one module per domain)
│   │   ├── supabaseClient.js      — Supabase client init
│   │   ├── api.js                 — Generic Supabase query helpers
│   │   ├── sales.js               — Sales CRUD
│   │   ├── salesUtils.js          — Sales calculation utilities
│   │   ├── inventory.js           — Inventory CRUD
│   │   ├── pricing.js             — Price settings CRUD
│   │   ├── expenses.js            — Expenses CRUD
│   │   ├── funds.js               — Operational funds CRUD
│   │   ├── spoilage.js            — Spoilage CRUD
│   │   ├── customers.js           — Customers CRUD
│   │   ├── suppliers.js           — Suppliers CRUD
│   │   ├── deliveries.js          — Deliveries CRUD
│   │   ├── products.js            — Products CRUD
│   │   ├── productSales.js        — Product sales CRUD
│   │   ├── productDeliveries.js   — Product delivery CRUD
│   │   ├── eggSizes.js            — Egg size lookups
│   │   ├── reports.js             — Report generation queries
│   │   ├── analytics.js           — Analytics query logic
│   │   ├── export.js              — CSV export utility
│   │   ├── formatters.js          — Number/date formatting
│   │   ├── formatters.test.js     — Formatter unit tests
│   │   ├── errors.js              — Error handling utilities
│   │   ├── toastFn.js             — Toast helper
│   │   └── utils.js               — General utilities
│   └── hooks/
│       ├── useConfirmDialog.js    — Confirm dialog hook
│       └── useTableState.js       — Table sorting/pagination hook
├── database_schema.sql            — Full PostgreSQL schema
├── migration_*.sql                — DB migrations
├── vite.config.js                 — Vite + PWA config
├── eslint.config.js               — ESLint flat config
├── index.html                     — HTML entry point
├── package.json                   — Dependencies & scripts
├── .env.example                   — Env var template
├── memory.md                      — Full project documentation (source of truth)
├── HERMES_BOOTSTRAP.md            — Hermes agent setup instructions
└── README.md                      — Project overview
```

## Database (Supabase PostgreSQL — 9+ tables)
- **egg_sizes** — lookup: Peewee(1), Pullet(2), Small(3), Medium(4), Large(5), Extra Large(6), Jumbo(7)
- **inventory** — stock levels by egg size (trays + pieces)
- **price_settings** — selling prices per size (per piece, per tray)
- **sales** — individual sale records with egg_size_id, quantity, amount
- **expenses** — business expense records by category
- **spoilage** — egg wastage records with reason + auto-calculated cost
- **customers** — customer contact directory
- **suppliers** — supplier directory (Lilanie Fernandez-Robert ID=1, renren ID=2)
- **deliveries** — batch delivery records by supplier (cost_per_egg = cost PER TRAY)
- **products** — non-egg products
- **product_sales** — product sales tracking
- **product_deliveries** — product delivery tracking
- **operational_funds** — running balance of operational funds

TRAY_SIZE = 30 (1 tray = 30 eggs)

## Key Business Rules
- **Sales:** Only record when message starts with `-sale`
- **Date/Timezone:** PHT (UTC+8). All DB date handling must offset from UTC
- **Supabase Access:** REST anon key = read-only. Writes go through MCP SQL
- **Cost in deliveries:** `cost_per_egg` field = cost PER TRAY (30 eggs), not per egg
- **1% Daily Revenue Cut:** End-of-day operation adds 1% of day's sales to operational funds

## Scripts (npm)
| Script | Command |
|--------|---------|
| dev | `vite` |
| build | `vite build` |
| preview | `vite preview` |
| lint | `eslint .` |
| test | `vitest run` |
| test:watch | `vitest` |

## What We Need From The Crew
**Phase 1 — Understand the full codebase.** Read every file. Map the data flow from Supabase through the API layer to each component. Understand how sales/inventory/expenses interact. Identify any existing issues or architectural quirks.

**Phase 2 — Debrief.** Write DEBRIEF-<name>.md with findings. Save reusable patterns to your memory/ directory.

**Phase 3 — Stand by for adjustments.** Don't make any code changes yet. We'll decide together after the full understanding is documented.
