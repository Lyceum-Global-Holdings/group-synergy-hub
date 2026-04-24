

## Phase 6 — Fix Tool Import freeze + close the perf gap

The Tool Management page hangs after "Import from Item Master" because the dialog refetches the **entire 14k-row `warehouse_items` catalog** through paginated PostgREST embed-joins on every realtime tick — which fires once per row of the bulk insert. The root cause is a pattern that was identified in Phase 4 (memory `list-rpc-pattern`) but not yet applied to this path.

### Outcome

- "Import from Item Master" dialog opens in <1 s on 14k items (was 8–15 s).
- After clicking "Import N as Tools", the dialog closes and the inventory list refreshes in <500 ms (was 10–30 s freeze, sometimes never recovers).
- No more refetch storm: a 100-tool bulk import triggers exactly **one** refetch of each affected list, not N.
- Console warning `Function components cannot be given refs` on `ToolsInventoryTab` is gone.

### Standards applied

- **PostgreSQL/Supabase**: `SECURITY INVOKER` RPC returning denormalized rows; one round-trip + one server-side `LEFT JOIN` (project memory `list-rpc-pattern`).
- **Composite index**: `(company_id, name)` on `warehouse_items` — covers the dialog's `WHERE company_id IN (...) ORDER BY name` plan in one index scan.
- **Realtime invalidation hygiene**: subscribe to a table **once** per logical owner; use `scheduleInvalidate` (debounce 250 ms) so a 100-row INSERT burst becomes one refetch (project memory `realtime-bus-pattern`).
- **React performance**: forward refs through wrapper components that participate in Radix `DropdownMenu` triggers (W3C WAI-ARIA APG menu pattern requires anchor refs).

### Changes

#### A) New RPC `get_tool_candidate_items` (migration)

`SECURITY INVOKER`, signature:

```sql
get_tool_candidate_items(
  p_company_ids   uuid[],
  p_category_ids  uuid[] DEFAULT NULL,   -- NULL = all categories
  p_location_id   uuid    DEFAULT NULL,  -- NULL = any
  p_limit         int     DEFAULT 20000
) RETURNS TABLE (
  id uuid, item_code text, name text, description text,
  category_id uuid, category_name text, category_code text,
  unit_id uuid, unit_abbreviation text,
  current_stock numeric, unit_cost numeric,
  company_id uuid, location_id uuid
)
```

One `SELECT … LEFT JOIN item_categories LEFT JOIN item_units WHERE company_id = ANY(p_company_ids) [AND category_id = ANY(p_category_ids)] [AND location_id = p_location_id] ORDER BY name LIMIT p_limit`. Replaces 14 PostgREST round-trips with one.

#### B) Composite index (migration)

```sql
CREATE INDEX IF NOT EXISTS idx_warehouse_items_company_name
  ON public.warehouse_items (company_id, name);
```

Covers the dialog query and the global Item Master sort.

#### C) Rewire `ImportFromItemMasterDialog`

- Replace the `while (true) { range(...) }` paginated embed-select with a single `supabase.rpc('get_tool_candidate_items', { ... })`.
- Drop the now-unused 1000-row pagination loop.
- Keep the `existingToolKeys` de-dup (client-side, cheap).
- **Remove the `useRealtimeChannel("warehouse_tools", ...)` subscription from this dialog** — `useWarehouseTools` already owns it. Keep only `useRealtimeChannel("warehouse_items", ...)`. This kills the duplicate invalidation path.

#### D) Stop the post-import refetch storm

- In `handleImport.onSuccess`, replace the two `invalidateQueries(...)` calls with `scheduleInvalidate(queryClient, [...])` (debounced) — coalesces with the realtime payloads that follow.
- Close the dialog **before** invalidating so the dialog's heavy `useQuery` is unmounted (and won't refetch) by the time invalidation runs.

#### E) Fix the `forwardRef` warning

`ToolsInventoryTab` is rendered inside a Radix `DropdownMenuTrigger` chain in the parent. Wrap the component in `React.forwardRef` (or hoist the trigger) so Radix can attach its anchor ref. WAI-ARIA APG requires the menu to track its anchor element; the warning is currently silent but breaks keyboard focus return on dialog close.

#### F) Defence: cap `useWarehouseTools` refetches

Bulk-tool INSERT fires N realtime payloads. Confirm `useWarehouseTools.onToolsChange` uses `scheduleInvalidate` (already does) — and add a 1-second debounce specifically for `warehouse_tools` bursts (override the default 250 ms) so a 100-row import is one refetch, not four.

### Files

**New migration**
- `supabase/migrations/<ts>_phase6_tool_candidate_rpc.sql` — index + `get_tool_candidate_items` RPC.

**Modified**
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` — RPC swap, drop duplicate realtime subscription, debounced invalidation, close-before-invalidate.
- `src/hooks/useWarehouseTools.ts` — bump `scheduleInvalidate` debounce to 1000 ms for `warehouse_tools` payloads.
- `src/components/warehouse/tools/ToolsInventoryTab.tsx` — wrap in `React.forwardRef` to silence the Radix warning.

**Memory**
- Update `mem://architecture/list-rpc-pattern` with one bullet: "Realtime invalidation must be owned by exactly one hook per table; consumer dialogs subscribe only to *related* tables."

### Out of scope

- Migrating `useWarehouseItems` / `useWarehouseAssets` to RPC (Phase 4 deferred this; current latency is acceptable post-index).
- Cursor pagination (only needed beyond ~50k items).
- Server-side search inside `get_tool_candidate_items` — the dialog filters client-side after the fetch and that's fine at 14k rows.

### Verification

1. Open `/warehouse/tool-management` → "Import from Item Master". Network tab shows **one** `rpc/get_tool_candidate_items` request, ~200–600 ms, payload ~2–4 MB for 14k rows. Dialog interactive in <1 s.
2. Select 50 items → click "Import 50 as Tools". Dialog closes immediately. Network tab shows **one** `warehouse_tools?` insert, then **one** `rpc/get_warehouse_tools_list` refetch within ~1 s. No subsequent re-fires of the candidate query.
3. Page does not freeze; main-thread profile shows no >500 ms long task during the import.
4. Console: zero `Function components cannot be given refs` warnings on `ToolsInventoryTab`.
5. `EXPLAIN ANALYZE` on `get_tool_candidate_items('{...}'::uuid[])` shows index scan on `idx_warehouse_items_company_name`, execution <150 ms at 14k rows.
6. `supabase--linter` reports no new warnings on the migration.
7. Existing duplicate-detection still works: items already promoted (same `(company_id, item_code)`) remain hidden from the candidate list.

