

## Fix "Import from Item Master" not showing tools — wrong column name + multi-tenant scoping

### Root cause (verified against DB)

`src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` queries `warehouse_items` selecting a column called **`item_name`**, but the actual column is **`name`** (verified via `information_schema.columns`). The Supabase request returns an error and the dialog falls through to the empty state ("No Item Master items found…") regardless of how many tool-categorized items exist.

Secondary issues exposed by the same investigation (against international standards):

1. **Multi-tenant scope hides legitimate data**. Tools-categorized items currently exist only under `Lyceum Nugegoda Quarters` (9 items under `TOO-HND`). When the user is on a different selected company in the header (e.g. `NCG Warehouse Solutions`), the dialog correctly returns 0 — but the user is not told *why*. SAP MM "Material → Equipment" promotion is always **plant-scoped**, so the behavior is correct, but the UX must communicate it.
2. **No error surfacing** — the query's `error` is thrown into React Query but never shown in-dialog. WCAG 3.3.1 (Error Identification) requires the user to see the error.
3. **Sort/search uses the broken field name**, so even after the fix the sort column must be corrected.

### International standards being applied

- **SAP MM Material Master**: the canonical name field in inventory is `name` / `description`, not `item_name`. Promotion to Equipment Master must read this exact field.
- **ISO 55000 §6.2.5** — single source of truth: don't introduce an alias for the same attribute.
- **WCAG 2.2 SC 3.3.1 / 3.3.3** — Error Identification and Error Suggestion: surface the underlying query error and tell the user what to do.
- **NN/g empty-state guideline** — distinguish "no data exists" from "no data for current filter/company"; offer the next action.

### Solution

#### 1) Fix the query (the actual bug)

In `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`:

- Replace the selected column `item_name` with `name`.
- Update the `CandidateItem` interface: rename `item_name` → `name`.
- Update the row mapper: `item_name: row.item_name` → `name: row.name`.
- Update `.order("item_name", …)` → `.order("name", …)`.
- Update all UI references to `item.item_name` (table cell, search-includes filter, `aria-label`, payload `name:`) to `item.name`.

This single fix restores the candidate list.

#### 2) Surface query errors (WCAG 3.3.1)

- Destructure `error` from the `useQuery` call.
- Render an inline destructive alert above the table when `error` is present, showing `error.message`. Use the existing `Alert`/`AlertDescription` components from `@/components/ui/alert`.

#### 3) Improve empty-state messaging (NN/g)

Replace the single empty state with two distinct messages:

- **No tool categories configured** (when `toolCategoryIds.length === 0`): "Hand Tools / Power Tools categories are not set up. Ask an administrator to add categories under codes `TOO-HND` or `TOO-PWR`."
- **No items in this company** (when categories exist but `items.length === 0`): "No Item Master items in **{company name}** are categorized under Hand Tools or Power Tools. Switch company in the header, or add items under those categories first."
- **All filtered out** (when `items.length > 0` but `filteredItems.length === 0`): keep the existing message but add a "Clear filters" button.

#### 4) Defensive: also include sub-sub-categories (SAP MM hierarchy)

Today `getToolCategoryIds` returns root + level-1 children. The DB shows level-2 codes like `TOO-HND-HAM` (Hammers), which are children of `TOO-HND`. These ARE included via the level-1 sweep — verified — so no logic change needed. Add a code comment confirming the depth assumption so future categories at level 3+ are handled deliberately.

#### 5) Reset query cache on close

After `resetState()`, also call React Query's `removeQueries({ queryKey: ['warehouse-items-tool-candidates'] })` so reopening the dialog after a category change shows fresh data (matches project Core rule "Caching: staleTime 0, refetchOnMount: 'always'").

### Out of scope

- No DB schema changes — `warehouse_items.name` is canonical and stays.
- No changes to `toolCategories.ts`, `useWarehouseTools`, or RLS.
- No changes to `BulkToolImportDialog` (CSV path uses different column resolution).

### Verification

1. With company `Lyceum Nugegoda Quarters` selected, open Tool Management → Add Tool → Import from Item Master → 9 candidate rows visible (TOO-HND items).
2. With `NCG Warehouse Solutions` selected, open the same dialog → explicit empty-state message naming the company, not the generic "no items found".
3. Force a query error (e.g. wrong category id) → red alert shown inline; dialog stays open.
4. Filter by category → row count badge updates; "Clear filters" appears when count is 0.
5. Select rows, set quantities, click Import → selected items become tools; dialog closes; cache invalidated.

### Files to modify

- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` — column rename, error alert, refined empty states, cache reset.
- `src/features/tools/lib/toolCategories.ts` — add a clarifying comment (no logic change).

