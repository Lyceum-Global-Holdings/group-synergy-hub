

## Bin management for Tool Management + standalone per-location tool inventory

### Outcome

Tools become bin-aware physical assets, just like Item Master items:

1. Each tool can be allocated across one or more **bins** (`warehouse_bins`) inside a location.
2. The Tools Inventory tab is **automatically scoped to the selected location** from the global header `LocationSelector` — switching the global location reveals a fully independent tool inventory for that site.
3. Issues / returns deduct and add stock to a specific bin (not just the tool master), preserving FIFO-style traceability.
4. All existing tool workflows (issue, return, adjustment, import) keep working with sensible defaults.

### Standards applied

- **GS1 Logistics Label / WMS bin storage standards** — every physical inventory unit has a *storage location address* (location → bin). Tools are equipment-class inventory and follow the same rule.
- **ISO 55000 §6.2.6** — equipment must be traceable to a physical site for audit and maintenance scheduling.
- **SAP EWM "Storage Bin" model** — quantity at the master record = sum of quantities at bins; bin-level allocations are the single source of stock truth.
- **Project memory `warehouse-bin-allocation-uniqueness`** — strict one-bin-per-item rule reused for tools.
- **Project memory `global-location-context-and-filtering`** — the header `LocationSelector` is the canonical scope; new modules must honour it.
- **WCAG 2.2 SC 3.3.1 / 3.3.3** — clear errors when a bin has insufficient quantity.

### Data model

New table `tool_bin_allocations` mirroring `warehouse_bin_allocations`:

```text
tool_bin_allocations
├─ id (uuid, pk)
├─ tool_id            uuid  → warehouse_tools(id)  ON DELETE CASCADE
├─ bin_id             uuid  → warehouse_bins(id)   ON DELETE RESTRICT
├─ allocated_quantity numeric NOT NULL DEFAULT 0
├─ reserved_quantity  numeric NOT NULL DEFAULT 0
├─ available_quantity numeric GENERATED (allocated - reserved) STORED
├─ company_id         uuid
├─ created_by, created_at, updated_at
└─ UNIQUE (tool_id, bin_id)            -- one bin per tool, per memory rule
```

RLS: same shape as `warehouse_bin_allocations` — SELECT scoped via `can_access_company(company_id)`, INSERT/UPDATE/DELETE for authenticated users with company access; DELETE additionally requires admin (mirrors the just-shipped tool delete policy).

Trigger `sync_tool_total_from_bins`:
- AFTER INSERT/UPDATE/DELETE on `tool_bin_allocations`
- Recomputes `warehouse_tools.total_quantity = SUM(allocated_quantity)` and keeps `available_quantity = total_quantity - issued_quantity`.

Trigger `validate_tool_bin_location`:
- BEFORE INSERT/UPDATE on `tool_bin_allocations`
- Ensures the chosen bin's `location_id` matches the tool's `location_id` (or sets `warehouse_tools.location_id` if currently NULL).

Optional new column on `tool_issues`: `bin_id uuid → warehouse_bins(id) ON DELETE SET NULL` so issues record exactly which bin a unit came from. Existing issues remain valid (NULL = legacy / unallocated).

### Server-side stock movement

Update existing flow (or add) `issue_tool_from_bin(p_tool_id, p_bin_id, p_qty, …)` SECURITY DEFINER function:

1. Lock `tool_bin_allocations` row → check `available_quantity >= p_qty` else raise.
2. Decrement `allocated_quantity` on the source bin.
3. Insert `tool_issues` row with `bin_id`.
4. Increment `warehouse_tools.issued_quantity`.

Return flow: `return_tool_to_bin(p_issue_id, p_bin_id, p_qty, …)` — opposite direction; bin defaults to the issue's source bin but can be overridden.

### Client layer

#### 1) Global location scoping in the inventory tab

`useWarehouseTools` becomes location-aware:

- Read `globalLocationId` from `useLocationFilter()`.
- Append `.eq('location_id', globalLocationId)` to the query when set; when "All locations" is selected, fall back to current behaviour.
- Add `globalLocationId` to the React Query key so caches are per-site.
- Tools without a `location_id` (legacy) appear under "All locations" only — surfaced with a small "Unassigned" badge so admins can fix them.

The Tools Inventory tab gains a small breadcrumb header: **"Showing tools at: {location.name}"** mirroring the construction module's pattern, plus a "Show all locations" link that clears `globalLocationId`.

#### 2) New "Bin Allocations" sub-section per tool

In `ToolsInventoryTab`, expand row → new **Bin Allocations** panel listing `bin_code | bin name | allocated | reserved | available | actions`. Columns and styling reuse `ItemDetailsDialog`'s allocations table for consistency.

Row actions on the panel:
- **Allocate to bin** → opens `AllocateToolToBinDialog` (new): pick a bin filtered to the tool's location, enter qty.
- **Move between bins** → opens `MoveToolBetweenBinsDialog` (new): from-bin / to-bin / qty. Same-location only (validated by trigger).
- **Remove allocation** (admin only, qty must be 0).

#### 3) Issue / Return dialogs

`IssueToolDialog`, `BulkIssueToolDialog`:
- After picking a tool, render a **Bin** selector populated from `tool_bin_allocations` for that tool (sorted by `available_quantity DESC` — simple "most-available-first" allocation; FIFO is out of scope for v1 since tools aren't typically batch-tracked).
- Quantity max = selected bin's `available_quantity`.
- Bin is required when the tool has any allocations; falls back to the legacy "no bin" path only for unallocated legacy tools (with an inline warning prompting allocation).

`ReturnToolDialog`, `BulkReturnToolDialog`:
- Bin defaults to the issue's source `bin_id`.
- Allow override (e.g. damaged tool returned to a "quarantine" bin).

#### 4) Create / Edit / Import flows

- `CreateToolDialog`: when `location_id` is set and `total_quantity > 0`, show optional "Initial bin allocation" field — if filled, the create transaction inserts both the tool master and the first `tool_bin_allocations` row atomically via a new `create_tool_with_initial_bin` RPC.
- `ImportFromItemMasterDialog`: when the source item has bin allocations, pre-fill the new tool's allocations pro-rata. When it doesn't, leave bin allocations empty (legacy path).
- `EditToolDialog`: changing `location_id` is blocked while `tool_bin_allocations` exist (raise via trigger) — UX shows a clear inline error suggesting "Move all stock to bins at the new location first."

#### 5) Realtime + cache

Subscribe to `tool_bin_allocations` changes in `useWarehouseTools` (mirrors `realtime-stock-synchronization` memory) and invalidate `['warehouse-tools', companyId, locationId]` on any change.

### UX safety rails

- Banner above the inventory table when `globalLocationId` is null: "Showing tools across all locations. Use the location selector to focus on one site."
- Empty state per location: "No tools at {location.name}. Create one or transfer from another site."
- Move-between-bins dialog disables the destination bin if it belongs to a different location.

### Out of scope (v1)

- Cross-location tool transfers (separate workflow; can reuse the upcoming pattern from construction transfers).
- Batch / serial tracking of tools.
- Bin-type-based allocation rules (e.g. "power tools only in cage bins").
- Migration of historical `tool_issues` to back-fill `bin_id` (legacy issues stay NULL).

### Verification

1. With "All locations" selected → all tools visible; warning banner shown.
2. Pick a location in the header → only that site's tools appear; counts in the badge update.
3. Open a tool → Bin Allocations panel shows existing allocations; Allocate to bin adds a row; tool's `total_quantity` recomputed by trigger.
4. Issue a tool → bin selector appears; selecting a bin with insufficient qty disables Submit; submitting decrements the bin and the tool master.
5. Return the tool → defaults to the issue's source bin; quantity restored.
6. Try to delete a bin allocation with `allocated_quantity > 0` as non-admin → blocked by RLS; as admin with qty 0 → succeeds.
7. Try to change a tool's `location_id` while allocations exist → blocked with clear message.
8. Cross-tenant: admin of Company A cannot read or write Company B's `tool_bin_allocations`.

### Files

**New migration**
- Create `tool_bin_allocations` table + RLS + triggers (`sync_tool_total_from_bins`, `validate_tool_bin_location`).
- Add `bin_id` to `tool_issues` (nullable, FK SET NULL).
- Add RPCs `issue_tool_from_bin`, `return_tool_to_bin`, `create_tool_with_initial_bin`.

**New files**
- `src/hooks/useToolBinAllocations.ts` — CRUD + realtime.
- `src/components/warehouse/tools/AllocateToolToBinDialog.tsx`
- `src/components/warehouse/tools/MoveToolBetweenBinsDialog.tsx`
- `src/components/warehouse/tools/ToolBinAllocationsPanel.tsx`

**Modified**
- `src/hooks/useWarehouseTools.ts` — location scoping + realtime on `tool_bin_allocations`.
- `src/hooks/useToolIssues.ts`, `src/hooks/useToolReturns.ts` — call new RPCs with `bin_id`.
- `src/components/warehouse/tools/ToolsInventoryTab.tsx` — location header, expand-row panel, banner.
- `src/components/warehouse/tools/IssueToolDialog.tsx`, `BulkIssueToolDialog.tsx` — bin selector.
- `src/components/warehouse/tools/ReturnToolDialog.tsx`, `BulkReturnToolDialog.tsx` — bin selector with default.
- `src/components/warehouse/tools/CreateToolDialog.tsx`, `EditToolDialog.tsx`, `ImportFromItemMasterDialog.tsx` — initial allocation hooks + location-change guard.
- `src/types/toolManagement.ts` — add `ToolBinAllocation` interface and `bin_id` on `ToolIssue`.

