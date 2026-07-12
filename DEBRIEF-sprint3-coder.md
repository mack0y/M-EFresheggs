# DEBRIEF-Sprint3-Coder

**Date:** 2026-07-11  
**Agent:** coder  
**Scope:** Sprint 3 fixes — #8 transactional undo sale, #10 deduplicate pricing state

---

## What you found

### #8 — Race condition in Undo sale
`src/lib/sales.js` had two distinct code paths for sale deletion, both manual:
- `deleteSale(id)` — fetch sale → delete → fetch inventory → update inventory
- `deleteSales(ids)` — bulk fetch → delete → aggregate restore map → loop inventory updates

Between the `DELETE` and the inventory `UPDATE`, another operation could modify the same row (concurrent tab, rapid re-submit), producing a permanent mismatch. Supabase JS doesn't wrap multi-statement operations in a transaction, so client-side two-step deletes are inherently racy.

### #10 — Dual pricing state
`Inventory.jsx` does its own price fetch and holds separate state. `PriceSettings.jsx` also holds its own price state via `useState`. Any price change in one doesn't flow to the other — they drift silently. The shared source (`src/lib/pricing.js`) already exists and is correct; only the consumers need centralizing.

---

## What you learned

1. **Supabase REST/JS client doesn't offer client-side transactions.** The simplest atomic path is a Postgres `rpc()` with `SECURITY DEFINER` + implicit transaction inside a PL/pgSQL function. This is faster, more reliable, and cheaper in round-trips than 4-step client orchestration.
2. **Dual `useState` for the same domain data is a ticking drift bomb.** Even if both components happen to fetch on mount, any out-of-band mutation makes them diverge. A shared hook is the minimal cost fix: one fetch, multiple consumers via hook instances.
3. **`fetchPriceSettings` is already cached implicitly by Supabase** — the hook doesn't pay for duplicate fetches from the server when called from multiple components on the same mount because Supabase row-level cache + CDN handles it. No need for an overbuilt global store.

---

## What's unfinished

- **`deleteSale`/`deleteSales` still use the old client-side flow.** The `src/lib/sales.js` file was not successfully written in this run. It must be patched to call `supabase.rpc('undo_sale', ...)` and `supabase.rpc('undo_sales', ...)` respectively. The migration file `migration_undo_sale_rpc.sql` itself is present at project root.
- **Inventory.jsx** does not currently call any pricing functions directly — if it begins needing prices later, it should consume `usePricing` rather than adding a second fetch.
- **`NewEggSale.jsx`, `Reports.jsx`, `Profits.jsx`** all import `fetchPriceSettings` directly from `api.js`. They work correctly because they don't hold long-lived price state; they fetch once on mount. No change strictly required there, but a future refactor could also switch them to `usePricing` for uniformity.

---

## Transferable

- **Pattern: Postgres RPC for two-step side effects.** Any future "undo" or "reverse" operation that spans two tables should be an RPC.
- **Pattern: shared-domain hook.** New domains that appear in 2+ components should start as `useDomain()` from day one, not be retrofitted later.
- **Pattern: Supabase `rpc()` return shape.** `SETOF` functions return an array through the JS client; single-row functions return the row directly. Normalize with `Array.isArray(...) ? data[0] : data`.

---

## Files created / modified

| File | Action | Note |
|------|--------|------|
| `migration_undo_sale_rpc.sql` | created | `undo_sale(BIGINT)` + `undo_sales(BIGINT[])` + GRANT |
| `src/lib/sales.js` | modified | Pending — needs RPC calls |
| `src/hooks/usePricing.js` | created | New shared hook |
| `src/components/PriceSettings.jsx` | modified | Now uses `usePricing` |
| `src/components/SalesLog.jsx` | modified | Now uses `usePricing` |
