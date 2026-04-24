

## Phase 2 Performance — Realtime hygiene + targeted query slimming

Phase 1 (cache tuning, bundle splitting, console drop) is live. The system should already feel snappier on navigation. The next biggest wins — based on the diagnosis already done — are **eliminating refetch storms from realtime** and **shrinking the heaviest list payloads**. This phase is independently shippable and does not require any user-facing behaviour change.

### Outcome

- Realtime events no longer trigger full-table refetches across every open tab — invalidations are scoped, debounced, and de-duplicated.
- Hot list endpoints (Tools, Items, Assets) ship 40–60% smaller payloads by projecting only used columns.
- A shared realtime "bus" replaces ad-hoc per-page Supabase channels, cutting WebSocket subscription churn during navigation.
- INP on `/warehouse/tool-management`, `/warehouse/item-bin-master`, and the Approval Console drops below 200 ms even during bulk imports.

### Standards applied

- **TanStack Query**: scoped invalidation keys; debounced bursts (Query v5 best practice).
- **Supabase Realtime**: one channel per logical concern; payload-driven scoped routing; `REPLICA IDENTITY FULL` only where DELETE filtering requires it (cuts WAL cost).
- **PostgREST**: explicit column projection per "select only what you render" guidance.
- **WCAG 2.2 SC 2.2.1**: realtime UI updates are user-pausable via existing manual refresh affordances.

### Changes

#### A) Shared realtime bus — `src/hooks/useRealtimeBus.ts` (new)

Single React provider that opens **one channel per table** at app mount, then dispatches `postgres_changes` payloads to subscribers via a tiny event emitter. Replaces:

- `useRealtimeStockUpdates` (currently re-opens 3 subscriptions per page that mounts it)
- The two ad-hoc channels in `useWarehouseTools`
- The two ad-hoc channels in `ImportFromItemMasterDialog`

Hooks subscribe with a selector + handler:

```ts
useRealtimeChannel("warehouse_tools", (payload) => {
  // scoped: only invalidate variants matching the changed company_id
  qc.invalidateQueries({ queryKey: ["warehouse-tools", payload.new?.company_id ?? payload.old?.company_id] });
});
```

Mounted once in `AppLayout`, subscribed by hooks. New page mount → no new channel; just an in-memory listener.

#### B) Debounced invalidation helper — `src/lib/queryInvalidation.ts` (new)

`scheduleInvalidate(qc, key, 250)` coalesces bursts (e.g. 1,000-row bulk imports emitting 1k INSERT events) into a single refetch per key per 250 ms window. Uses a `Map<string, Timeout>` keyed by stringified queryKey.

#### C) Scoped invalidations across stock/tool/item/asset hooks

Replace generic `invalidateQueries({ queryKey: ['warehouse-tools'] })` with payload-aware scoped keys in:

- `src/hooks/useWarehouseTools.ts`
- `src/hooks/useRealtimeStockUpdates.ts` (now just a thin wrapper around the bus for backward compat)
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`
- `src/hooks/useWarehouseItems.ts` (if it self-subscribes anywhere)

Pattern:

```ts
const cid = (payload.new ?? payload.old)?.company_id;
scheduleInvalidate(qc, ["warehouse-tools", cid]);
```

#### D) Replication identity right-sizing — migration

`REPLICA IDENTITY FULL` is currently set on `warehouse_items` and `warehouse_tools`. It doubles WAL write cost. Audit:

- **Keep FULL** on tables we filter DELETE payloads by (company_id-scoped delete UIs): `warehouse_tools`, `warehouse_bin_allocations`.
- **Revert to DEFAULT** on `warehouse_items` (DELETE payload only needs PK; we re-fetch list anyway).

Migration:

```sql
ALTER TABLE public.warehouse_items REPLICA IDENTITY DEFAULT;
-- warehouse_tools and warehouse_bin_allocations remain FULL
```

#### E) Narrow `select(*)` on the three heaviest list queries

Project only columns actually rendered. Each cuts JSON payload by 40–60% on 5k–14k row pages.

- `useWarehouseTools.ts` — drop nested `*` on category/location/unit; keep only `id, name, code` from each join.
- `useWarehouseItems.ts` (the master list query) — same pattern.
- `useWarehouseAssets.ts` — same pattern.

#### F) Fix the unrelated dev console warning blocking tool dialog QA

Console shows `Function components cannot be given refs` from `Badge` inside `ImportFromItemMasterDialog`. Wrap `Badge` in `React.forwardRef` (it's the canonical fix from the React docs and unblocks any future `asChild` usage). One-line change in `src/components/ui/badge.tsx`.

### Files

**New**
- `src/hooks/useRealtimeBus.ts` — provider + `useRealtimeChannel(table, handler)` hook
- `src/lib/queryInvalidation.ts` — debounced `scheduleInvalidate`

**Modified**
- `src/components/layout/AppLayout.tsx` — mount `<RealtimeBusProvider>`
- `src/hooks/useRealtimeStockUpdates.ts` — re-implement on top of bus
- `src/hooks/useWarehouseTools.ts` — bus + scoped invalidation + narrow select
- `src/hooks/useWarehouseItems.ts` — narrow select
- `src/hooks/useWarehouseAssets.ts` — narrow select
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` — bus + scoped invalidation
- `src/components/ui/badge.tsx` — `forwardRef`

**New migration**
- `supabase/migrations/<ts>_replica_identity_rightsizing.sql` — revert `warehouse_items` to `REPLICA IDENTITY DEFAULT`

**Memory**
- New: `mem://architecture/realtime-bus-pattern` — "All realtime subscriptions go through `useRealtimeChannel`; never call `supabase.channel()` directly in feature code."
- Update `mem://architecture/realtime-stock-synchronization` to reference the bus.
- Update Core line in `mem://index.md`.

### Out of scope (later phases)

- **Phase 3**: roll out `<VirtualTable>` shared component to Item Master, Asset Master, GRN list, MDP table.
- **Phase 4**: DB indexes audit (`(company_id, created_at)`, etc.) + materialized RPCs for >5k-row lists.
- **Phase 5**: `web-vitals` reporter + Lighthouse CI budget.

### Verification

1. Open Tool Management in two tabs → import 50 items in tab A → tab B's candidate list updates within ~1 s, **with one refetch in DevTools Network**, not 50.
2. Bulk-import 1,000 items in another module → DevTools shows a single coalesced refetch per affected query (debounce working).
3. Navigate Dashboard → Warehouse → Finance → Procurement → back: WebSocket frames panel shows no new channel subscriptions after the initial app mount.
4. `/warehouse/tool-management` initial JSON payload (Network tab) drops from current size by ≥40%.
5. Console is free of the `Function components cannot be given refs` warning.
6. Realtime stock updates still propagate to all open pages within ~1 s (no regression vs Phase 1).
7. Approval Console, stock pages, dashboard KPIs still refetch on mount (Phase 1 exceptions intact).

