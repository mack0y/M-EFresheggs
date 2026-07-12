# DEBRIEF — Sprint 4 Coder

**Date:** 2026-07-11  
**Agent:** coder  
**Scope:** Frontend performance — memoize expensive calculations in Reports, Analytics, and Profits  
**Issue:** #13 — `processReport()` and related profit calculations run on every render, causing jank as data grows

---

## 1. What you found

### Reports.jsx (`src/components/Reports.jsx`)
- `processReport()` was called as a plain function on every render at line 249.
- `profitData` was computed via an IIFE on every render that depended on `processed`, `priceSettings`, `costsPerEgg`, and `reportExpenses`.
- `totalDeliveryCost` was computed via `.reduce()` on every render over `reportDeliveries` state.
- As report data/grows, these calculations become expensive and fire even when only unrelated UI state changes (e.g., tab switches, shift selector hover, etc.).

### Analytics.jsx (`src/components/Analytics.jsx`)
- Summary stats (`totalEggsSold`, `totalRevenue`, `bestSize`, `peakHour`) were computed inline via `.reduce()` on every render.
- While input arrays come from fetch results and only update on `days` change, any component re-render still recalculated all four aggregates.

### Profits.jsx (`src/components/Profits.jsx`)
- Profit derivation was a large IIFE over `sales`, `priceSettings`, `costsPerEgg`, and `expenses` executed on every render.
- This is the heaviest calculation: it iterates sales, then iterates `EGG_SIZES`, then performs margin math and multiple reduces. It is sensitive to every `setState` on this screen, including UI-only state like `expandedSize` and `viewFilter`.

---

## 2. What you changed

### Reports.jsx
- Imported `useMemo` from React.
- Memoized `processReport()` with dependency `[report]`.
- Memoized `totalDeliveryCost` with dependency `[reportDeliveries]`.
- Memoized `profitData` with dependencies `[processed, priceSettings, costsPerEgg, reportExpenses]`.
- Removed the immediate IIFE pattern in favor of proper `useMemo(...)`.

### Analytics.jsx
- Imported `useMemo` from React.
- Memoized `totalEggsSold` with dependency `[bySize]`.
- Memoized `totalRevenue` with dependency `[revenueBySize]`.
- Memoized `bestSize` with dependency `[bySize]`.
- Memoized `peakHour` with dependency `[byHour]`.

### Profits.jsx
- Imported `useMemo` from React.
- Memoized the entire `profitData` derivation with dependencies `[sales, priceSettings, costsPerEgg, expenses]`.
- Removed the immediate IIFE wrapper.

---

## 3. What you learned

1. **Expensive render-time derivations belong in `useMemo`.** The pattern of computing derived data inside the component body (plain function call or IIFE) causes recalculation whenever React re-renders, even if the underlying data hasn't changed.
2. **Don't under-memoize the dependency graph.** For `Reports.jsx`, `profitData` depends on more than `processed` alone. If you only memoized `processed` and left `profitData` as plain computation, state changes to `priceSettings`, `costsPerEgg`, or `reportExpenses` would still recompute it unnecessarily. Including all true inputs keeps correctness while still preventing extra recalculations.
3. **Don't over-memoize.** Only memoize derived state over raw inputs, not other derived state where the memoization chain would add cognitive load without measurable benefit.

---

## 4. What's unfinished

- **`Analytics.jsx`** already memoized the summary stats; there are no other obvious render-time derivations that cross more than one source of truth.
- **`Reports.jsx`** still contains render-time aggregation in `handleExportCSV()` but that only fires on explicit user action, so it's acceptable.
- **`Profits.jsx`** product sales summary card does an inline `.reduce()` for `productSales` revenue on line 307. This is small and only depends on `productSales`, so it can stay inline or be extracted into `useMemo` if needed later.

---

## 5. Files modified

| File | Action |
|------|--------|
| `src/components/Reports.jsx` | Added `useMemo` for `processReport`, `totalDeliveryCost`, and `profitData` |
| `src/components/Analytics.jsx` | Added `useMemo` for summary stats |
| `src/components/Profits.jsx` | Added `useMemo` for profit derivation |

No behavior changes; only memoization. No new files created.
