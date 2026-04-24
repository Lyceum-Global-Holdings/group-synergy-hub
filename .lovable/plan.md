
## Phase 9 — Fix Tool import visibility so all 14,891 Item Master items are available

### Root cause

The current “Import from Item Master” dialog is not actually reading from the same source as the Item Master tab.

There are 4 separate visibility defects:

1. **Wrong source table**
   - `ImportFromItemMasterDialog` calls `get_tool_candidate_items`, which reads from `public.warehouse_items`.
   - The Item Master count (14,891) comes from `public.warehouse_item_catalog`.
   - `warehouse_items` is only the company/location inventory layer, so catalog items that were never stocked, were zeroed out, or exist only in the global catalog never appear.

2. **Location filter is hiding source rows**
   - The dialog passes `p_location_id` into the candidate query.
   - That means the selected/global location is used as a **source visibility filter**, not just a destination/default assignment.
   - Result: many valid item-master rows disappear when they do not belong to the currently selected location.

3. **Tool category subtree is incomplete**
   - `getToolCategoryIds()` only includes tool roots + direct children.
   - The SQL filter is `i.category_id = ANY(p_category_ids)`, which matches exact IDs only.
   - Any tools assigned to deeper descendants are excluded.

4. **The current company/source-company model is mismatched**
   - Item Master is a global catalog concept, but the dialog is modeled like a company-scoped inventory picker.
   - “Current company / All my companies” makes sense for inventory rows, not for catalog rows.

### Best solution

Rebuild tool import on the **global catalog as the source of truth**, and treat company/location as **import targets**, not source filters.

This follows the existing architecture memory:
- `warehouse_item_catalog` = master data
- `warehouse_items` = company inventory
- tool promotion should come from the master layer, not the stock layer

### What to build

#### 1) Replace the source RPC with a catalog-based RPC
Create a new `SECURITY INVOKER` RPC, for example:

```sql
get_tool_catalog_candidates(
  p_search text DEFAULT NULL,
  p_category_ids uuid[] DEFAULT NULL,
  p_include_all_categories boolean DEFAULT false,
  p_target_company_id uuid DEFAULT NULL,
  p_target_location_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20000
)
```

It should:
- read from `warehouse_item_catalog`
- return flat denormalized rows with category/unit metadata
- filter by `status = 'active'` by default
- optionally join a **non-filtering** inventory snapshot from `warehouse_items` for the selected target company/location:
  - `inventory_item_id`
  - `current_stock`
  - `location_id`
- never exclude catalog rows just because inventory is missing

This preserves full visibility while still allowing “suggested initial qty” from real stock where it exists.

#### 2) Fix tool-category descendant resolution
Replace the current shallow tool-category helper with a recursive descendant collector.

Update `src/features/tools/lib/toolCategories.ts` so:
- tool roots are still code-driven (`TOO-HND`, `TOO-PWR`)
- all descendants at any depth are included
- the same recursive set is used both for UI options and for RPC filtering

This removes silent drops for leaf categories.

#### 3) Rework the dialog around source vs destination
Update `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`:

- **Source**
  - Source is always Item Master (`warehouse_item_catalog`)
  - Default scope should be **All item master** or **Suggested tools**, not inventory-only

- **Destination**
  - Replace “Company scope” with **Target company**
  - Keep **Destination location** as an assignment/default field only
  - Do not pass location as a source filter

- **Scope options**
  - `Suggested tools`
  - `Tool categories`
  - `All item master`

- **Counts**
  - Show:
    - total catalog rows
    - visible candidates
    - already imported into target company
  - Example: `14,891 total · 14,103 visible · 788 already imported`

- **Empty states**
  - Be explicit:
    - “No items match the search”
    - “No items remain because they are already imported into this company”
    - “Tool-category scope hides uncategorized items; switch to All item master”

#### 4) Strengthen duplicate prevention with provenance
Best-practice fix: add a nullable `catalog_item_id` to `warehouse_tools`.

Schema change:
- `warehouse_tools.catalog_item_id uuid references warehouse_item_catalog(id)`
- partial unique index on `(company_id, catalog_item_id)` where `catalog_item_id is not null`

Why:
- exact promotion provenance
- prevents double-import even if item code is edited later
- safer than code-only matching

Client logic:
- existing tools should be excluded by `catalog_item_id` first
- fallback to `(company_id, tool_code)` only for legacy rows with null provenance

#### 5) Preserve fast picker performance
Keep the Phase 6 performance standards:

- single RPC, flat rows
- async chunked dialog logic stays lightweight
- no paginated PostgREST loop
- virtualization remains for large candidate sets
- no duplicate realtime ownership in the dialog

If needed, add catalog indexes for the picker hot path:
- `(status, name)`
- trigram on `lower(name)` and `lower(item_code)` for search

#### 6) Align import payload semantics
When importing selected rows:

- `tool_code` = catalog `item_code`
- `catalog_item_id` = catalog row id
- `company_id` = selected target company
- `location_id` = selected destination location (optional)
- `total_quantity`:
  - default from inventory snapshot if present for the selected target company/location
  - otherwise `0`

This is the correct SAP-style split:
- material master defines the tool candidate
- stock layer only suggests quantity, not visibility

### Files to change

**New migration**
- new migration for:
  - `get_tool_catalog_candidates` RPC
  - `warehouse_tools.catalog_item_id`
  - partial unique index on `(company_id, catalog_item_id)`
  - optional search indexes on `warehouse_item_catalog`

**Modify**
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`
- `src/features/tools/lib/toolCategories.ts`
- `src/hooks/useWarehouseTools.ts` if duplicate exclusion data needs catalog provenance
- `src/integrations/supabase/types.ts` will regenerate from schema

### Out of scope
- bulk backfilling category assignments in the catalog
- ML classification of tools
- changing Item Master itself; it is already using the correct catalog source

### Verification

1. Open Tool Management → Import from Item Master.
   - Candidate count reflects the full catalog, not inventory-only.
   - Total is near the Item Master count (14,891 minus already-imported rows for target company).

2. Select a location in the global header.
   - Candidate count does **not** collapse.
   - Location only affects import destination/default quantity snapshot.

3. Switch to `Tool categories`.
   - Deep descendant tool categories still appear.

4. Switch to `All item master`.
   - All active catalog rows are searchable.

5. Search for known missing item codes.
   - They appear even if they were never present in `warehouse_items`.

6. Import an item twice into the same company.
   - Second import is prevented by `catalog_item_id` uniqueness.

7. Import the same catalog item into a different company.
   - Allowed, because uniqueness is per target company.

### Technical notes

- This is primarily a **data-source correctness** issue, not a rendering issue.
- The correct architectural boundary is:
  - `warehouse_item_catalog` = authoritative Item Master source
  - `warehouse_items` = optional stock context
  - `warehouse_tools` = promoted operational entity with provenance back to catalog
- The current implementation optimized the wrong source path; this phase fixes correctness first while preserving Phase 6 performance gains.
