## Goal

Refactor the inventory module so the physical model follows a clean, internationally-standard WMS hierarchy and stock is unambiguously traceable end-to-end:

```text
All Companies (Org / Holding)
  └── Company (legal entity, e.g. Lyceum Global Holdings, VeBuild)
        └── Warehouse / Location (Tier‑1 physical site, e.g. LNNB, LSS, Lyceum Fulfilment Centre)
              └── Sub-location / Zone / Floor (Tier‑2, e.g. 7th Floor, VEB, LNQ‑5F)
                    └── Bin / Storage Position (atomic storage unit)
```

Bins can be attached **directly to a Warehouse OR to a Sub-location**. Stock allocations always carry the physical `location_id` of the node the bin currently sits at — already the rule we standardised on. This plan tightens the model, fixes orphan rows, and adds a visualization + management surface under Warehouse Management.

This follows the GS1/WMS standard "Site → Zone → Location → Bin" pattern (SAP EWM, Oracle WMS, Manhattan, Blue Yonder all use the same shape).

---

## Problems found during exploration

1. **Cross-company hierarchy leaks.** Several sub-locations sit under a parent warehouse from a *different* company (e.g. VeBuild sub-locations under an NCG-owned parent; LGH 7th–10th floors with `company_id = NULL`).
2. **Orphan locations.** ~10 `warehouse_locations` rows have `company_id IS NULL`, so RLS/visibility is inconsistent.
3. **No enforced hierarchy depth.** Nothing prevents a sub-location being parented under another sub-location, so a 3rd level could sneak in.
4. **No first-class concept of "Organisation"** above company. Today the UI groups by company only; the user wants an "All Companies" root view.
5. **Bin → location relationship is ambiguous.** Bins reference one `location_id` that may be a warehouse or a sub-location; there is no validated rule and no UI affordance to pick the right level.
6. **No visual hierarchy explorer.** Admins cannot see the full Org → Company → Warehouse → Sub-location → Bin graph in one place.

---

## Solution

### 1. Data model tightening (no destructive changes)

`warehouse_locations`
- Constrain `type ∈ ('warehouse','sublocation')` (rename `'location' → 'warehouse'` in a backfill).
- Enforce: `type='warehouse' ⇒ parent_id IS NULL`; `type='sublocation' ⇒ parent_id IS NOT NULL AND parent.type='warehouse'` (trigger).
- Enforce `company_id` matches parent's `company_id` when parent exists (trigger).
- Backfill all `company_id IS NULL` rows by inferring from parent or from the dominant company of bins/allocations attached to them; flag the rest for the admin to resolve in the new UI.

`warehouse_bins`
- Keep single `location_id` (can point to a warehouse or a sublocation).
- Add generated/maintained `root_warehouse_id` (resolve to top-level warehouse) — already partially present as `root_location_id`; standardise the name and the trigger that maintains it.
- Validate: `bins.company_id = warehouse_locations.company_id` of its `location_id`.

`warehouse_bin_allocations`
- Already carries `location_id` (physical node). Keep as source of truth (matches existing memory rule).
- Add FK check trigger: `allocation.location_id` must be `bin.location_id` OR a descendant of `bin.location_id` (so a warehouse-level bin can hold sub-located stock if needed, but never the other way around).

### 2. Helper functions (Postgres)

- `get_location_hierarchy(_company_id uuid DEFAULT NULL)` — returns the full tree as JSON for the visualization.
- `get_location_ancestors(_location_id uuid)` and existing `get_location_subtree_ids` — already exist, reuse.
- `validate_location_hierarchy()` trigger — enforces depth + company match.

### 3. UI: "Warehouse Network" page under Warehouse Management

New route: `/warehouse/network` (registered in `moduleConfig.ts`).

Two views, toggleable:

**a. Tree explorer (default)**

```text
▾ All Companies
   ▾ Lyceum Global Holdings
      ▾ LNNB (Warehouse · 12 bins · 1,240 SKUs)
         ├─ 4th Floor (Sub · 3 bins)
         ├─ 5th Floor (Sub · 4 bins)
         └─ 7th Floor (Sub · 5 bins)
      ▸ Lyceum Fulfilment Centre
   ▸ VeBuild
   ▸ NCG Warehouse Solutions
```

- Each node shows: bin count, SKU count, total qty, status pill.
- Inline actions per node: **Add sub-location**, **Add bin (here)**, **Edit**, **View stock**.
- "Add bin (here)" lets the admin attach a bin to either the warehouse level or the sub-location level — same dialog, level inferred from the selected node.

**b. Graph view (interconnectivity diagram)**

- React Flow (already in lockfile) diagram rendering the same tree as nodes + edges, colour-coded by company, with edge labels showing bin counts. Pan/zoom, export PNG.
- Single source of truth = `get_location_hierarchy` RPC.

### 4. Bin creation/allocation UX

- `CreateBinDialog`: location picker becomes a 3-step cascading selector — **Company → Warehouse → (optional) Sub-location**. If sub-location is left blank, the bin attaches to the warehouse. Validation prevents mismatched company.
- `CreateBinAllocationDialog` & GRN allocation: location selector defaults to the bin's `location_id` and only allows descendants of it.
- `BulkBinScopeDialog`: same cascading selector, applies to a multi-select of bins.

### 5. Inventory views

- `ItemMasterTab` location filter becomes the same cascading **Company → Warehouse → Sub-location** picker, wired to the existing `globalLocationId` context.
- `list_warehouse_inventory` RPC already filters by physical location subtree — no behavioural change needed, just ensure the new sub-locations created via the network page flow through.

### 6. Backfill / data repair (one-off migration)

- Set `company_id` on orphan locations from parent or from majority bin owner.
- Renormalize `type='location' → 'warehouse'`.
- Re-parent any cross-company sub-locations to a same-company warehouse (interactive — surfaced as warnings in the new Network page, not silently moved).
- Recompute `warehouse_bins.root_warehouse_id`.

### 7. Out of scope (explicit)

- No change to stock math, ledger triggers, GRN approvals, or RLS rules already locked down by recent migrations.
- No change to bin barcode / QR formats.

---

## Deliverables

1. Migration: hierarchy constraints, triggers, backfill, `get_location_hierarchy` RPC.
2. New route `/warehouse/network` with tree + React Flow graph views.
3. Refactored bin/allocation dialogs with cascading Company → Warehouse → Sub-location picker (shared component `LocationHierarchyPicker`).
4. Updated `moduleConfig.ts` registration + sidebar entry under Warehouse Management.
5. Admin "Unassigned locations" panel inside Network page to resolve orphans.

## Technical notes

- Use existing `useRealtimeChannel` bus to live-refresh the Network page on location/bin changes.
- React Flow already installed; no new deps.
- Keep the picker as a single reusable component so GRN, transfers, audits, and item master all use one control.
- All new RPCs `SECURITY INVOKER`, company-scoped via existing RLS.

## Open question

Do you want the "Organisation / All Companies" root to be a real DB entity (a `organisations` table with companies as children) or stay as a virtual grouping in the UI only? The latter is faster and matches current scope; the former is needed only if you plan multiple holdings later.
