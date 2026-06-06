# M&E Fresh Eggs

A mobile-first progressive web app for tracking egg inventory, sales, expenses, spoilage, pricing, suppliers, deliveries, and customers. Built for small-scale egg retail operations.

**Live:** https://mack0y.github.io/M-EFresheggs/

## Features

- **Dashboard** — today's revenue, profit, stock levels, recent deliveries and sales at a glance
- **Inventory** — add/remove stock by trays or pieces across 7 egg sizes
- **Pricing** — set per-piece and per-tray selling prices per size
- **Sales Log** — record sales with stock validation, filter by date, sort and search
- **Expenses** — track costs by category (Feed, Labor, Transport, etc.)
- **Spoilage** — record egg wastage by size and reason with automatic cost calculation
- **Customers & Suppliers** — contact directories
- **Deliveries** — batch record multi-size deliveries with cost and payment status tracking
- **Analytics** — 6 chart views: sales by size, hourly trends, revenue timeline, pie distribution, margin analysis
- **Reports** — shift-based reporting (Morning/Afternoon/Whole Day/Custom) with full financial breakdown and CSV export
- **Profits** — real-time profit dashboard with per-size breakdown

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Bundler | Vite 8 |
| Routing | React Router v7 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Backend | Supabase (PostgreSQL) |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | GitHub Actions → GitHub Pages |
| Mobile | Capacitor (Android APK) |

## Setup

```bash
# Clone
git clone https://github.com/mack0y/M-EFresheggs.git
cd M-EFresheggs

# Install
npm install

# Environment
cp .env.example .env
# Edit .env with your Supabase project URL and anon key

# Dev
npm run dev

# Build
npm run build
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. Supabase secrets are injected via GitHub Secrets.

## Database

PostgreSQL on Supabase with 9 tables: `egg_sizes`, `inventory`, `price_settings`, `sales`, `expenses`, `spoilage`, `customers`, `suppliers`, `deliveries`. Schema is in `database_schema.sql`.
