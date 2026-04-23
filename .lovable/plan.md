

## Allow tools to import from the general Item Master across any company / location

### Outcome

The "Import from Item Master" dialog in Tool Management can pull from the **entire** Item Master — not just `TOO-*` categories — across **all companies the user can access** and any location/sub-location, while still defaulting to the safest scope (current company + tool categories) so existing workflows are unchanged.

### Standards applied

- **SAP MM → PM "Material to Equipment" promotion**: any inventory material may be promoted to equipment; categorization is a *recommendation*, not a hard gate.
- **ISO 55000 §6.2.5 (single source of truth)**: the catalog is the master; tools are a *view/role* of the same master record.
- **ISO 27001 A.9.4 (least privilege)**: cross-company reads must respect existing access (`useAccessibleCompanyIds` / `can_access_company`).
- **WCAG 2.2 SC 3.2.3 (consistent navigation)** and **NN/g progressive disclosure**: scope widens via explicit user choice, never silently.

### Solution

#### 1) Two-axis scope selector at the top of the dialog

Replace the single hard filter with two independent controls:

- **Category scope** (segmented control):
  - `Tool categories` (default) — current behavior, `TOO-HND` / `TOO-PWR` subtree.
  - `All categories` — no `category_id` filter.
- **Company scope** (segmented control):
  - `Current company` (default) — `selectedCompany.id` only.
  - `All my companies` — every id from `useAccessibleCompanyIds()`.

Both controls are part of the React Query `queryKey` so caches don't collide. Defaults preserve today's behavior; widening is one click.

#### 2) Optional location / sub-location filter

Add a **Location** dropdown (single-select, includes "Any location") sourced from the existing global location context. When set, the query adds `.eq('location_id', locationId)`. When "Any" is selected the filter is omitted. This satisfies the request to support any location or sub-location without forcing a choice.

> Note: location filtering reads `warehouse_items.location_id` if present; for items without a location it remains visible under "Any location".

#### 3) Query rewrite

In `ImportFromItemMasterDialog.tsx`:

- Pull `useAccessibleCompanyIds()` already used elsewhere in the construction module.
- Build the Supabase query dynamically:
  - Always select `id, item_code, name, description, category_id, company_id, unit_of_measurement, location_id`.
  - `companyScope === 'current'` → `.eq('company_id', selectedCompany.id)`; else `.in('company_id', accessibleCompanyIds)`.
  - `categoryScope === 'tools'` → `.in('category_id', toolCategoryIds)`; else no category filter.
  - `locationId` set → `.eq('location_id', locationId)`.
  - `.order('name', { ascending: true })` and apply the existing 1000-row batching helper to bypass PostgREST limits (per project memory `warehouse-data-batching-limit`).

#### 4) New columns in the candidate table

Add **Company** and **Category** columns so users can disambiguate identically named items across companies. Render company name from the existing `companies` lookup and category name from the existing categories cache. Make both columns sortable.

#### 5) Per-row target company on import

When `companyScope === 'all my companies'`, the user may be importing items that belong to companies *other than* the currently selected one. The "promote to tool" payload must use **the source item's `company_id`**, not the header's selected company, so tool records land in the correct tenant. Add a small inline read-only "Target company" indicator per row to make this transparent.

#### 6) UX safety rails

- A subtle banner explains: "Showing items beyond Tool categories — verify each before promoting." appears only when `categoryScope === 'all'`.
- A second banner appears when `companyScope === 'all my companies'`: "Tools will be created in each item's source company."
- Empty states (already refined in the prior plan) gain a third variant: "No items match this scope — try widening category or company."
- Error alert from previous plan stays.

#### 7) Cache & memory

- `queryKey: ['warehouse-items-tool-candidates', companyScope, categoryScope, locationId, selectedCompany?.id]`.
- On dialog close, `removeQueries` for the whole key prefix.
- No new project memory needed; behavior is governed by existing `construction-inventory-visibility-scoping` and `multi-company-visibility-logic` memories.

### Out of scope

- No DB schema changes. No RLS changes — `warehouse_items` SELECT policies already enforce company access; this plan only widens client-side filters within what RLS allows.
- No changes to `useWarehouseTools` create logic beyond passing the source item's `company_id`.
- No changes to bulk CSV import.

### Files to modify

- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` — scope controls, location filter, dynamic query, new columns, per-row target company, banners.
- (read-only reuse) `src/hooks/construction/useAccessibleCompanyIds.ts`, `src/features/tools/lib/toolCategories.ts`, existing location context hook, batching helper.

### Verification

1. Default open → identical to today (current company + tool categories).
2. Switch category scope to **All categories** → full Item Master for current company appears with banner.
3. Switch company scope to **All my companies** → items from every accessible company appear; Company column populated; second banner visible.
4. Pick a location → list narrows; "Any location" restores full set.
5. Promote a row from another company → new tool record is created under that source company (verified by querying `warehouse_tools` filtered on the source company id).
6. Close + reopen dialog → cache cleared, fresh fetch.

