## Phase 9.2 — Tool Import: stop hiding 96.9% of the catalog behind a category filter

### What's actually happening

I queried the catalog and the picture is unambiguous:

| Active catalog rows | Categorized | Uncategorized (`category_id IS NULL`) |
|---|---|---|
| **14,904** | **467** (3.1%) | **14,437** (96.9%) |

The items the user listed:

- `T jak`, `Tile trowels`, `Ackro jak` → **already in `TOO-HND-GNR`**, so they DO show under "Suggested" / "Tools" scope today.
- `Mason Trowel` (×16 sizes), `Notch trowel - For Tile working`, `Plastering Trowel`, `Hand Rake | Trowel`, `Trowel | Plastic - Finishing`, `Manis Trowel`, etc. → all `category_id = NULL`. They are invisible under "Suggested" / "Tools" scope and only appear when the user manually switches to "All item master".

So the visible symptom — "items missing when importing" — is real, but the cause isn't the source query, the keyset, or the RPC. The cause is that the **default scope is "Suggested"**, which gates by tool category IDs, and **96.9% of the catalog has no category at all**. Importing tools currently requires the user to know they must change scope to "All item master" — which most users don't.

### Best solution

Two-part fix, no schema changes, no migration needed:

1. **Change the default scope to `"all"`** so the picker behaves like the Item Master tab itself: every active catalog row is reachable out of the box. The "Suggested" and "Tools" filters remain available as opt-in narrowing for power users with a well-curated catalog — but they are no longer the gatekeeper.

2. **Make the scope chooser self-explanatory** so users understand the trade-off:
   - Show row counts next to each scope tab in real time, fetched cheaply from the same RPC pattern. Example: `All item master (14,904) · Tools categories (467) · Suggested (467)`.
   - Add an inline hint when scope is `"tools"` or `"suggested"` and the count is dramatically lower than `"all"`: *"96% of your catalog has no category yet — switch to All item master to see every item."*

This is the right call architecturally:
- Matches `mem://architecture/tool-promotion-source-of-truth` — the catalog is the single source of truth, and visibility shouldn't depend on whether someone happened to assign a category.
- Matches the SAP MM "material → equipment" promotion pattern: any active material can be promoted to equipment; categorization is a curation aid, not a visibility gate.
- Matches the existing Item Master tab UX, which shows all 14,904 rows by default.

### Why not just backfill categories?

That was explicitly listed as out of scope in Phase 9, and it's the wrong fix:
- It would silently mask the design defect (the picker shouldn't depend on catalog curation completeness).
- 14,437 rows would need human review to assign correct categories — that's a multi-week curation project, not a code fix.
- A new bulk-imported batch tomorrow would re-introduce the same bug.

The right invariant is: **the picker must work correctly even when 100% of the catalog is uncategorized.** That means no category-based default gate.

### Changes

**`src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`**

1. Default `sourceScope` from `"suggested"` → `"all"` (line 98).
2. Reorder the scope tabs so "All item master" is first/leftmost (visual default).
3. Fetch lightweight counts for each scope using the existing RPC (one extra query — `p_limit = 1` is unsafe because we want the count, so use a small dedicated count RPC OR derive from the already-loaded `items` for the active scope and a single cheap `select count(*)` for the others). Simplest: add a second `useQuery` that calls a new minimal `get_tool_catalog_candidate_counts` RPC returning `{ all, tools, suggested }` in a single round trip.
4. Render the counts inside each `<TabsTrigger>` as a muted badge.
5. Add the inline hint `<Alert>` shown only when scope ≠ `"all"` AND `tools_count < all_count * 0.5`.
6. Update the dialog description to clarify the new default: *"Showing every active catalog item by default. Use the scope tabs to narrow to curated tool categories."*

**New migration: `get_tool_catalog_candidate_counts` RPC**

`SECURITY INVOKER`, returns one row:

```sql
get_tool_catalog_candidate_counts(
  p_target_company_id uuid DEFAULT NULL,
  p_tool_category_ids uuid[] DEFAULT NULL
) RETURNS TABLE (all_count bigint, tools_count bigint, suggested_count bigint)
```

One query, three `count(*) FILTER (...)` aggregates over `warehouse_item_catalog WHERE status='active'`, with the same per-target-company "already imported" exclusion logic as `get_tool_catalog_candidates`. Reuses the same indexes added in Phase 9 / 9.1, so it's <100 ms at 15k rows.

**No changes** to:
- `get_tool_catalog_candidates` — already correct, just under-used.
- `toolCategories.ts` — recursive walk is correct.
- `warehouse_tools` schema — `catalog_item_id` provenance still works.
- The Item Master tab — unaffected.

### Memory

Update `mem://architecture/tool-promotion-source-of-truth.md` with one line:

> Default picker scope is "All item master", not "Suggested". Category-based scopes are opt-in narrowing only — they must never be the visibility gate, because the catalog is overwhelmingly uncategorized in production.

### Verification

1. Open Tool Management → Import from Item Master.
   - Default scope is "All item master".
   - Visible candidate count ≈ 14,904 minus already-imported (was ~467 before).
   - `Mason Trowel`, `Notch trowel - For Tile working`, `Plastering Trowel`, `Hand Rake | Trowel`, etc. all appear without changing scope.

2. Search for `trowel` → all 21+ trowel variants visible (was 0 under default scope before).

3. Switch to "Tools categories" → count drops to ~467, hint appears: *"96% of your catalog has no category yet — switch to All item master to see every item."*

4. `T jak`, `Tile trowels`, `Ackro jak` still appear under "Suggested" / "Tools" scopes (regression check).

5. Import flow unchanged: `catalog_item_id` provenance still set, duplicate prevention still works per-target-company.

6. Performance: dialog opens in <1.5 s with 14,904-row default scope (Phase 9.1 indexes already in place).

7. `supabase--linter` clean.

### Out of scope

- Backfilling category assignments on the 14,437 uncategorized catalog rows (separate curation effort).
- Auto-suggesting categories based on item name keywords (ML / fuzzy match).
- Changing the Item Master tab default behavior (already correct).
