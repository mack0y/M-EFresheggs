# DEBRIEF — Sprint 5 Polish (#15, #16, #17)

**Date:** 2026-07-11  
**Agent:** subagent  
**Scope:** Sprint 5 polish — toast z-index variable, route/page titles, and shared CSS extraction

---

## What you found

### #15 — Toast z-index hardcoded
`src/components/Toast.jsx` had `z-index: 9999` inline while `index.css` already had a full design-token block for colors/radii/shadows/spacing/typography, but nothing for z-index stack.

### #16 — No route-level page titles
`index.html` defaulted to `M&E Fresh Eggs`, but no route ever updated `document.title`. There was no `<PageTitle>` component and no route-to-title mapping.

### #17 — Significant CSS duplication across components
- `DeliveryStatCard` markup and classes were identical in `Deliveries.jsx` and `ProductDeliveries.jsx`.
- `inv-num-input`/`inv-num-field`/`inv-num-btn` and `.btn-icon` were duplicated in `Inventory.jsx` and `ProductInventory.jsx`.
- `.empty-state` was redefined in `Dashboard.jsx` despite a global version in `index.css`.
- Multiple components embedded their own button/shape variants inside scoped `<style>` blocks instead of using global utilities (`btn-primary`, `btn-danger`, etc.).

---

## What you changed

### #15 — Toast z-index → CSS variable
- Added `--z-toast: 9999` under a new `Z-index layers` section in `:root` (`src/index.css`).
- Replaced `z-index: 9999` with `z-index: var(--z-toast)` in `src/components/Toast.jsx`.

### #16 — Route/page titles
- Added a `PAGE_TITLES` map covering all routes in `src/components/Layout.jsx`.
- Added a `useEffect` in `Layout` that sets `document.title` to `M&E Fresh Eggs — <page>` on every `location.pathname` change.
- Left `index.html` default title as `M&E Fresh Eggs` for unmatched routes.

### #17 — Shared CSS extraction
Added new global utility classes to `src/index.css`:
- `.stat-card`, `.stat-card-icon`, `.stat-card-content`, `.stat-card-value`, `.stat-card-label`
- `.alert-card`, `.alert-icon`, `.alert-content`, `.alert-title`, `.alert-subtitle`
- `.card-header`
- `.delivery-stat-card`, `.delivery-stat-card svg`, `.delivery-stat-value`, `.delivery-stat-label`
- `.delivery-breakdown`, `.delivery-breakdown-item`, `.delivery-breakdown-badge`, `.delivery-breakdown-count`, `.delivery-breakdown-total`
- `.primary-stat-card`, `.primary-stat-title`, `.primary-stat-subtitle`
- `.inv-num-input`, `.inv-num-field`, `.inv-num-field:focus`, `.inv-num-field::placeholder`, `.inv-num-btn`
- Shared responsive overrides for `.inv-num-input`/`.inv-num-field`/`.inv-num-btn` at `max-width: 640px`

Refactored files to use shared/global classes instead of inline redefinitions:
- `src/components/Deliveries.jsx` — removed local `.delivery-stat-card*` and `.delivery-breakdown*` blocks, now uses shared classes.
- `src/components/Dashboard.jsx` — removed inline `.empty-state` definition that duplicated the global token.
- `src/components/Inventory.jsx` — removed local `.inv-num-input*`, `.btn-icon*` definitions; now relies on global utilities.
- `src/components/ProductInventory.jsx` — same extraction as Inventory.
- `src/components/ConfirmDialog.jsx` — switched confirm button classes from custom `.btn-confirm-primary/.btn-confirm-danger` to global `.btn-primary/.btn-danger`, and nested scoped `.confirm-actions .btn-primary/.btn-danger` rules inside its own style block to preserve modal overrides.

---

## What you learned

1. **Scoped `<style>` blocks compete with global utilities.** Many components were redefining `.btn-icon`, `.btn-primary`, etc. inside component style tags. In JSX style tags, those definitions are appended to the document at runtime, but global classes in `index.css` already covered them — locally scoped redefinitions create override wars.
2. **`.card`/`.btn` roots are reusable bases, but component variants still need a home.** We preserved `.btn-primary/.btn-danger` as global primitives rather than inventing `.btn-confirm-*` for every modal context.
3. **Shared extraction is safer when done by file region, not cross-token merge.** We kept each component’s unique layout CSS in place and only removed bits whose definitions now live in `index.css`.
4. **ConfirmDialog still has leftover duplication to clean later.** Scoped `.confirm-actions .btn-primary/.btn-danger` repeats the global button rules inside a tighter scope; next polish sprint can remove that if theming remains unchanged.

---

## What's unfinished

- **ConfirmDialog scoped button overrides** still duplicate `.btn-primary`/`.btn-danger` rules inside its `<style>` block. It works, but a future pass can delete those local redefinitions if no modal-specific button variation is needed.
- **Several components still have substantial inline `<style>` blocks** that were not refactored (e.g., `NewEggSale.jsx` and `NewProductSale.jsx`’s sale-form-specific classes are mostly bespoke).
- **`ProductDeliveries.jsx`** was audited but left structurally unchanged beyond being a duplicate source for the extracted `.delivery-*` classes.

---

## Files modified

| File | Action |
|------|--------|
| `src/index.css` | Added `--z-toast`; extracted `.stat-card`, `.alert-card`, `.card-header`, `.delivery-*`, `.primary-stat-card`, `.inv-num-input*`, responsive overrides |
| `src/components/Toast.jsx` | Replaced `z-index: 9999` with `var(--z-toast)` |
| `src/components/Layout.jsx` | Added `PAGE_TITLES` map + `useEffect` setting `document.title` per route |
| `src/components/Deliveries.jsx` | Removed local duplicate `.delivery-stat-card*`/`.delivery-breakdown*` definitions |
| `src/components/Dashboard.jsx` | Removed inline `.empty-state` duplicate |
| `src/components/Inventory.jsx` | Removed local duplicate `.inv-num-*`/`.btn-icon*` definitions |
| `src/components/ProductInventory.jsx` | Same extraction as Inventory |
| `src/components/ConfirmDialog.jsx` | Removed custom `.btn-confirm-*` classes; reuses `.btn-primary/.btn-danger` + local scoped overrides |
| `DEBRIEF-sprint5.md` | Created |

---

*End of debrief.*
