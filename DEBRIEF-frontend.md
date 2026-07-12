# DEBRIEF-frontend.md — M-EFresheggs Frontend Architecture Review

**Date:** 2026-07-11  
**Agent:** frontend-reviewer subagent  
**Scope:** Full component audit — 22 components, routing, state management, UI patterns, mobile responsiveness, form handling, error boundaries, PWA setup, UX

---

## 1. Component Architecture

### 1.1 Component Inventory (22 components in `src/components/`)

| Category | Components | Purpose |
|----------|------------|---------|
| **Shell** | `Layout.jsx` | App shell, sidebar, mobile bottom nav, dark mode, keyboard shortcuts, FAB |
| **Dashboard** | `Dashboard.jsx` | Real-time stats, revenue/profit, stock alerts, sales/delivery feeds, sparkline |
| **Egg Inventory** | `Inventory.jsx` | Add/remove stock by tray/pieces (7 sizes), confirmation dialogs |
| **Pricing** | `PriceSettings.jsx` | Per-piece & per-tray pricing per egg size |
| **Egg Sales** | `SalesLog.jsx`, `NewEggSale.jsx` | Sales history with filter/sort/search/pagination/bulk delete/undo + sale recording form |
| **Egg Spoilage** | `Spoilage.jsx` | Wastage tracking by size/reason, cost calc, bulk delete with inventory restore |
| **Financial** | `ExpensesFunds.jsx`, `Profits.jsx`, `Reports.jsx` | Combined expenses/operational funds, profit dashboard (period filter), shift-based reports + CSV export |
| **Analytics** | `Analytics.jsx` | 6 chart tabs (Recharts): By Size, By Time, Trend, Revenue, Distribution (Pie), Margins |
| **Customers** | `Customers.jsx` | Contact directory (name, phone, notes), add/remove with confirm |
| **Suppliers** | `Suppliers.jsx` | Contact directory (name, phone, notes), add/remove with confirm |
| **Egg Deliveries** | `Deliveries.jsx` | Multi-size batch form (shared batch_id), grouped expandable list, payment status, bulk delete |
| **Product Catalog** | `Products.jsx` | Card grid, add/edit modal, dual-mode pricing (markup % ↔ direct price), search/filter |
| **Product Sales** | `ProductSales.jsx`, `NewProductSale.jsx` | Product sales recording, date filters, bulk delete, undo, stock validation |
| **Product Deliveries** | `ProductDeliveries.jsx` | Supplier deliveries for products, payment status, cost preview, search |
| **Product Inventory** | `ProductInventory.jsx` | Add/remove product stock (mirrors Inventory pattern) |
| **Shared UI** | `ConfirmDialog.jsx`, `Toast.jsx`, `ErrorBoundary.jsx` | Reusable modal, toast system (undo support), class-based error boundary |

### 1.2 Structural Patterns

- **Inline CSS per component**: Each component defines its own `<style>` block (CSS custom properties from `index.css` used as design tokens). No CSS Modules, no CSS-in-JS lib.
- **Lazy-loaded routes**: All 18 page components use `React.lazy()` + `<Suspense>` in `App.jsx` — initial bundle ~242 kB (75% reduction from pre-split).
- **ErrorBoundary per route**: Every lazy route wrapped in `<ErrorBoundary>` in `App.jsx` — crashes isolated to single page.
- **ToastContainer at Layout root**: Single global notification stack managed by `ToastContainer` + `toast()` helper from `toastFn.js`.

---

## 2. Routing (`src/App.jsx`)

### 2.1 Route Map (18 routes)

| Path | Component | Lazy? | ErrorBoundary? |
|------|-----------|-------|----------------|
| `/` | Dashboard | ✅ | ✅ |
| `/inventory` | Inventory | ✅ | ✅ |
| `/prices` | PriceSettings | ✅ | ✅ |
| `/sales` | SalesLog | ✅ | ✅ |
| `/sales/new` | NewEggSale | ✅ | ✅ |
| `/analytics` | Analytics | ✅ | ✅ |
| `/expenses-funds` | ExpensesFunds | ✅ | ✅ |
| `/spoilage` | Spoilage | ✅ | ✅ |
| `/customers` | Customers | ✅ | ✅ |
| `/suppliers` | Suppliers | ✅ | ✅ |
| `/deliveries` | Deliveries | ✅ | ✅ |
| `/products` | Products | ✅ | ✅ |
| `/product-inventory` | ProductInventory | ✅ | ✅ |
| `/product-sales` | ProductSales | ✅ | ✅ |
| `/product-sales/new` | NewProductSale | ✅ | ✅ |
| `/product-deliveries` | ProductDeliveries | ✅ | ✅ |
| `/reports` | Reports | ✅ | ✅ |
| `/profits` | Profits | ✅ | ✅ |
| `/expenses` → `/expenses-funds` | Redirect | — | — |
| `/operational-expenses` → `/expenses-funds` | Redirect | — | — |
| `*` → `/` | Redirect | — | — |

### 2.2 Router Config
- `BrowserRouter` with `basename` set to `/M-EFresheggs/` in production (GitHub Pages)
- `Suspense` fallback = skeleton loader (`PageLoading` component)
- `ToastContainer` rendered once at Layout level

---

## 3. State Management Per Page

### 3.1 Local State Pattern (Consistent Across All Pages)

Every page component follows this pattern:
```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
// Form state
const [form, setForm] = useState({...});
// UI state
const [showForm, setShowForm] = useState(false);
const [submitting, setSubmitting] = useState(false);
// Table state (search, sort, pagination, selection)
const [searchQuery, setSearchQuery] = useState('');
const [sortField, setSortField] = useState('created_at');
const [sortDir, setSortDir] = useState('desc');
const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(false);
const [selectedIds, setSelectedIds] = useState([]);
// Confirm dialog state
const [confirmItem, setConfirmItem] = useState(null);
```

### 3.2 Shared Hooks for Cross-Cutting State

| Hook | File | Used By | Purpose |
|------|------|---------|---------|
| `useTableState` | `src/hooks/useTableState.js` | ExpensesFunds | Search, sort, selection, pagination logic |
| `useConfirmDialog` | `src/hooks/useConfirmDialog.js` | Customers, Suppliers, ProductDeliveries | Encapsulates confirm dialog open/close/target |

### 3.3 Data Fetching

- **API layer**: All data via `src/lib/api.js` (barrel re-export of 12 domain modules)
- **Pattern**: `useEffect` → `loadData()` → `Promise.all([...])` for parallel fetches
- **Loading**: Boolean `loading` state + skeleton placeholders
- **Error**: `error` state → renders `.error-banner` with retry button
- **Auto-refresh**: Dashboard only (`setInterval(loadData, 30000)`)
- **Pagination**: Offset-based via `.range(offset, offset+limit-1)` — 50 items/page, "Load More" button

### 3.4 Module-Level Refs for Undo (Cross-Closure Fix)

```jsx
// SalesLog.jsx line 18, ProductSales.jsx line 16, Spoilage.jsx line 30
const undoSalesData = { current: null }; // or lastSpoilageRef = useRef(null)
```
Used to capture deleted records for toast "Undo" action without stale closure bugs.

---

## 4. UI Patterns & Design System

### 4.1 Design Tokens (`src/index.css`)

**CSS Custom Properties** (v2 design system):
- **Colors**: Brand (green `#2E7D32` / `#66BB6A`), semantic (success/warning/danger/info), surfaces, text
- **Dark mode**: `[data-theme="dark"]` selector overrides all tokens
- **Shadows**: `--shadow-xs` through `--shadow-xl` + `--shadow-glow` for focus
- **Radii**: `--radius-xs` (6px) → `--radius-full` (9999px)
- **Spacing**: `--space-xs` (0.25rem) → `--space-2xl` (2rem)
- **Transitions**: `--transition-fast/base/slow/spring`
- **Animations**: `fadeIn`, `slideUp`, `scaleIn`, `shimmer`, `spin`

### 4.2 Reusable CSS Classes (Global in `index.css`)

| Class | Purpose |
|-------|---------|
| `.card` | Base card: bg, border, radius, shadow, hover elevation |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`, `.btn-block`, `.btn-icon` | Button variants |
| `.input`, `.select`, `.input-group` | Form fields |
| `.badge`, `.badge-success/warning/danger/info` | Status badges |
| `.grid-2/3/4` | Responsive grids (1col @ <640px, 2col @ 640-900px, 3/4col @ >900px) |
| `.skeleton` | Loading shimmer |
| `.page-header-row` | Title + subtitle + action button, flex-wrap |
| `.filter-tabs`, `.filter-tab`, `.filter-tab.active` | Preset filter buttons |
| `.bulk-actions` | Selection bar (green accent) |
| `.sortable` | Clickable column headers |
| `.search-input-wrapper`, `.search-icon` | Search input with leading icon |
| `.empty-state` | Centered icon + text + action button |
| `.error-banner` | Red alert banner with retry |

### 4.3 Component-Level Patterns

- **Staggered entrance**: `style={{ animationDelay: \`${i * 0.05}s\` }}` on mapped items
- **Status badges**: Green (In Stock), Yellow (Low ≤50), Red (Out) — consistent across Inventory, Dashboard, NewEggSale
- **Quantity display**: `formatInventory(qty)` → `"2 trays + 15 pcs"` or `"15 pcs"`
- **Undo toast**: 5s duration, action button, auto-dismiss after action
- **ConfirmDialog**: Scale-in animation, backdrop blur, click-outside-to-cancel, variant (primary/danger) styling

---

## 5. Mobile Responsiveness (Mobile-First, 375px+)

### 5.1 Layout Modes

| Breakpoint | Layout |
|------------|--------|
| **Desktop (≥768px)** | Fixed 260px sidebar, main content fills rest |
| **Mobile (<768px)** | Fixed top header (hamburger, logo, dark toggle) + fixed bottom nav (5 tabs + More) + slide-out sidebar (overlay) |

### 5.2 Bottom Nav (5 quick tabs)

`Home` `/` → `Stock` `/inventory` → `Eggs` `/sales` → `Costs` `/expenses-funds` → `Stats` `/analytics`

### 5.3 Responsive Table → Card Transformation

All list pages use CSS grid for desktop, stacked cards for mobile:

```css
/* Desktop: grid table headers */
.ps-col-headers { display: flex; }

/* Mobile: hide headers, card layout */
@media (max-width: 640px) {
  .ps-col-headers { display: none; }
  .ps-sale-row { flex-wrap: wrap; }
  .ps-sale-left { width: 100%; }
  .ps-sale-right { width: 100%; justify-content: space-between; }
}
```

### 5.4 Specific Mobile Optimizations

| Page | Mobile Adaptations |
|------|-------------------|
| **Inventory** | Input fields `min-width: 60px`, action labels shrink, card padding reduced |
| **PriceSettings** | Save button full-width under inputs, price badges truncate |
| **SalesLog** | 5-col grid → 2-col cards (size+amount top, qty+eggs bottom), stacked filter bar |
| **ExpensesFunds** | 4-col grid → 2-col cards, stats stack |
| **Spoilage** | 4-col grid → card layout, stats stack |
| **Customers/Suppliers** | 4-col grid → card layout |
| **Deliveries** | 7-col grid → card layout with payment badge, stats stack |
| **Analytics** | Chart tabs wrap, PieChart uses % radii (70%/35%) |
| **Reports** | 2-col controls, shift tabs wrap, table has horizontal scroll |
| **Forms** | `min-height: 48px` touch targets, inputs 16px font (no zoom on iOS) |
| **Safe area** | `env(safe-area-inset-bottom)` on bottom nav, `viewport-fit=cover` in HTML |

---

## 6. Form Handling

### 6.1 Controlled Inputs Everywhere

```jsx
<input
  value={form.field}
  onChange={e => setForm({...form, field: e.target.value})}
/>
```

### 6.2 Validation Patterns

| Type | Pattern |
|------|---------|
| **Required** | `required` attr + `if (!form.field) { toast('...', 'error'); return; }` |
| **Numeric** | `parseFloat()` + `isNaN()` check + `> 0` |
| **Inventory check** | Client-side before submit: `if (totalEggs > stock) { toast('Not enough stock', 'error'); return; }` |
| **Date** | `type="date"` with `getLocalDate()` (PHT timezone-aware) |

### 6.3 Submission Flow

1. User clicks "Record Sale" / "Add" → `handleSubmit(e)`
2. Client validation → if fail, toast error, return
3. Set `confirmItem` → opens `ConfirmDialog`
4. User confirms → `executeSale()/executeAdjust()`:
   - `setSubmitting(true)`
   - `await apiCall()`
   - `toast('Success!', 'success', { label: 'Undo', onClick: ... })`
   - `loadData()` to refresh
   - Navigate away (for NewEggSale/NewProductSale)
5. Error → `toast(getUserFriendlyError(err), 'error')`

### 6.4 Quick-Quantity Chips

```jsx
// salesUtils.js exports
QUICK_QTY_CHIPS = { piece: [1,5,10,30], tray: [1,2,5,10] }
```
Rendered as `+1`, `+5`, `+10`, `+30` buttons in sale forms — tap to increment quantity.

### 6.5 Dual-Mode Pricing (Products.jsx)

- **Markup % mode**: Enter cost + markup % → selling price auto-calculated
- **Direct Price mode**: Enter cost + selling price → markup % auto-calculated
- Toggle buttons switch mode, live preview shows profit/margin

---

## 7. Error Boundaries & Error Handling

### 7.1 ErrorBoundary (`ErrorBoundary.jsx`)

- **Class component** (required for `getDerivedStateFromError`)
- Catches render errors in wrapped subtree
- Shows friendly card with retry button, optional details `<details>`
- Wraps **every lazy route** in `App.jsx`
- Uses design system tokens (works in dark mode)

### 7.2 Error Handling Utilities (`src/lib/errors.js`)

| Function | Purpose |
|----------|---------|
| `isNetworkError(error)` | Detects fetch/network failures by message patterns |
| `getUserFriendlyError(error)` | Maps Supabase/fetch errors to user messages (network, auth, not found, timeout, validation, unknown) |
| `withRetry(fn, {maxRetries, baseDelay, onRetry})` | Exponential backoff retry wrapper (network errors only) |

### 7.3 Toast Error Display

```jsx
toast(getUserFriendlyError(err), 'error'); // Red toast with ✕ icon
```

### 7.4 Error Banner Pattern (Every Page)

```jsx
{error && !loading && (
  <div className="error-banner">
    <AlertTriangle />
    <div className="error-banner-content">
      <strong>Failed to load X</strong>
      <p>{getUserFriendlyError(error)}</p>
    </div>
    <button className="btn btn-sm btn-secondary" onClick={loadData}>
      <RefreshCw /> Retry
    </button>
  </div>
)}
```

---

## 8. PWA Setup (`vite.config.js`)

### 8.1 Plugin: `vite-plugin-pwa` (Workbox)

```js
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['logo.png', 'icons/icon.svg'],
  manifest: {
    name: 'M&E Fresh Eggs',
    short_name: 'M&E Eggs',
    description: 'Egg inventory, sales, expenses & delivery tracker',
    theme_color: '#2E7D32',
    background_color: '#F5F7F0',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '.',
    scope: '/M-EFresheggs/',
    icons: [
      { src: 'logo.png', sizes: 'any', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\/npohyeqnaltpqzmmlmej\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
      },
    }],
  },
})
```

### 8.2 HTML Meta Tags (`index.html`)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#2E7D32" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="M&E Eggs" />
<link rel="apple-touch-icon" href="%BASE_URL%logo.png" />
```

### 8.3 Dark Mode Flash Prevention

```html
<script>
  (function() {
    var theme = localStorage.getItem('theme');
    if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```
Runs **before React mounts** — matches `Layout.jsx` initialization logic.

---

## 9. Overall User Experience

### 9.1 Strengths

| Area | Highlights |
|------|------------|
| **Information Density** | Dashboard packs 12+ metrics + feeds without feeling cluttered |
| **Speed** | Code-split lazy routes (242 kB initial), parallel data fetching, 30s auto-refresh only on Dashboard |
| **Undo Everywhere** | All destructive actions (delete sale, delete delivery, record expense, record spoilage, add fund, daily cut) have 5s undo toast |
| **Client-Side Validation** | Prevents cryptic DB errors — "Not enough stock — only X eggs available" |
| **Keyboard Shortcuts** | `Ctrl+N` → primary action (Record Sale), `Escape` → close modal priority: sale modal → confirm dialog → page cancel button |
| **Accessibility** | All form fields have `id` + `name`, labels use `htmlFor`, `aria-label` on icon buttons, `focus-visible` outlines |
| **Empty States** | Helpful hints: "Click 'Record Sale' or press Ctrl+N", "Record cracked or damaged eggs to track waste" |
| **Consistent Patterns** | Every list page: stats → filter tabs → search → record count → bulk delete bar → grouped list → load more |
| **Print-Friendly Reports** | Clean table layout, `@media print` friendly, CSV export includes sales + spoilage + deliveries + customers |

### 9.2 Friction Points / Issues

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| **No global loading indicator** | Route transitions show skeleton only after chunk loads | Low | Could add `nprogress` or router-level loading |
| **Stale closure in some `loadMore`** | A few pages use `page` state directly in `loadMore` without functional update | Low | Works because `loadMore` called from UI, not effect |
| **`processReport()` called every render** | `Reports.jsx` line 249 | Low | Memoized in `useMemo` would be cleaner |
| **`Promise.resolve().then()` workaround** | Dashboard, Analytics, Profits, SalesLog | Medium | ESLint `react-hooks/set-state-in-effect` — defer setState to microtask |
| **Inline styles in component `<style>` blocks** | All 22 components | Medium | No CSS modularity, duplication of patterns (e.g., `.inv-num-input` appears in Inventory & ProductInventory) |
| **No virtualization** | Large lists (SalesLog, Deliveries) render all loaded items | Low | 50/page mitigates, but 500+ items could lag |
| **Date handling split** | `getLocalDate()` in `api.js` + `formatDate()` in `formatters.js` | Medium | Works but two sources of truth for "today" |
| **Toast z-index 9999** | `Toast.jsx` | Low | Works (above modals at 5000-6000) but magic number |
| **Dark mode toggle only in Layout** | No page-level dark mode control | Low | Works, but mobile header also has toggle (duplicate) |

### 9.3 Architecture Quirks

1. **API Layer Split**: `api.js` is a barrel re-export of 12 domain modules (`sales.js`, `inventory.js`, `pricing.js`, etc.) — clean separation, no circular deps
2. **Supabase Write Path**: REST anon key = read-only; writes go through **MCP SQL** (not shown in frontend) — frontend only calls RPC-like functions via `api.js`
3. **Triggers Do Heavy Lifting**: DB triggers auto-deduct inventory on sale/spoilage insert — frontend doesn't manage inventory sync
4. **Tray Size = 30 Constant**: `TRAY_SIZE` exported from `api.js` used everywhere — single source of truth
5. **Cost per Egg = Cost per Tray**: `deliveries.cost_per_egg` column stores per-tray cost — naming mismatch but calculations correct

---

## 10. Recommendations

### 10.1 High Impact (Do First)

1. **Extract shared component styles to CSS modules or a shared style utility** — eliminate duplicate `.inv-num-input`, `.form-grid`, `.card` variations across 8+ components
2. **Add `useMemo` for `processReport()` in Reports.jsx** — called every render, trivial to memoize
3. **Replace `Promise.resolve().then()` with `useEffect` + `setTimeout(..., 0)` or `flushSync`** — cleaner, avoids lint warning
4. **Virtualize long lists** — `react-window` for SalesLog/Deliveries when >200 items loaded

### 10.2 Medium Impact

5. **Consolidate date utilities** — single `dateUtils.js` with `getLocalDate`, `formatDate`, `formatDateShort`, `formatShiftTime`
6. **Create reusable `DataTable` component** — 7 pages reimplement sort/search/pagination/selection/expandable rows
7. **Add route-level loading spinner** — `react-router` `useNavigation()` or custom loader during lazy chunk fetch
8. **Toast system: extract z-index to CSS variable** — `--z-toast: 9999` in `index.css`

### 10.3 Low Impact / Polish

9. **Add `react-helmet` or meta tags per route** — page titles, descriptions for SEO/PWA
10. **Keyboard navigation for confirm dialog** — `Tab` trap, `Enter` = confirm, `Escape` = cancel (currently only overlay click)
11. **Skeleton count matches actual items** — some pages render fixed 5-6 skeletons regardless of page size
12. **Consistent empty state illustration** — mix of icons (ShoppingCart, Package, Egg, Truck, Users) — consider unified empty state component

---

## 11. Transferable Patterns (Saved to Agent Memory)

The following patterns were identified as reusable across projects and saved to `~/.hermes/subagents/frontend-reviewer/memory/`:

| Pattern | File | Description |
|---------|------|-------------|
| `dual-mode-pricing-form.md` | Products.jsx | Markup % ↔ Direct Price toggle with live auto-calculation |
| `undo-toast-pattern.md` | Toast.jsx + all pages | 5s undo toast with action button, module-level ref to avoid stale closures |
| `mobile-table-to-cards.md` | All list pages | CSS-only responsive table→card transformation via grid + `@media` |
| `confirm-dialog-hook.md` | useConfirmDialog.js | Reusable hook encapsulating confirm dialog state |
| `table-state-hook.md` | useTableState.js | Search, sort, selection, pagination in one hook |
| `error-boundary-per-route.md` | App.jsx | Every lazy route wrapped in class-based ErrorBoundary |
| `pwa-offline-first-supabase.md` | vite.config.js | Workbox NetworkFirst for Supabase API, 24hr cache |
| `client-side-inventory-validation.md` | NewEggSale, Spoilage | Pre-submit stock check prevents cryptic DB errors |
| `staggered-list-animation.md` | Inventory, Dashboard, etc | `animationDelay: ${i * 0.05}s` on mapped items |
| `quick-quantity-chips.md` | salesUtils.js + sale forms | +1/+5/+10/+30 tap targets for quantity input |

---

## 12. Summary

The M-EFresheggs frontend is a **well-architected, mobile-first PWA** with:

- ✅ **Clean component structure** (22 components, clear separation)
- ✅ **Code-split lazy routes** with ErrorBoundary isolation
- ✅ **Consistent state patterns** across all pages
- ✅ **Robust form handling** with client validation, confirm dialogs, undo toasts
- ✅ **Full mobile responsiveness** (table→card, bottom nav, safe areas, touch targets)
- ✅ **Design system v2** with CSS custom properties, dark mode, animations
- ✅ **PWA ready** (manifest, service worker, offline caching for Supabase)
- ✅ **Accessible** (ARIA, labels, focus management, keyboard shortcuts)
- ✅ **ESLint clean, zero vulnerabilities**

**Maintenance debt**: Inline style duplication, a few lint workarounds, no list virtualization. All fixable incrementally without architecture changes.

---

*End of DEBRIEF-frontend.md*