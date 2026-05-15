## Goal

Add a controlled **"Permanently delete"** action that purges an inventory item from the database — but only after it has been marked **Inactive** and only when no historical references would be orphaned. This implements the standard two-step *archive → purge* lifecycle used by SAP MM (`MM06` deletion flag → archive run), Oracle Inventory (Inactive Date → purge concurrent program), and ISO 9001 §7.5.3 record-control rules.

## Background — what exists today

- `DeleteItemConfirmationDialog.tsx` already offers **Mark Inactive** vs **Force Delete** with a reference check via `useItemReferences`.
- `BulkInventoryDeleteDialog.tsx` zero-stock items go through `remove_item_from_inventory` — but that RPC only zeros stock and wipes allocations + ledger; it **does not delete the item row**.
- There is no path to actually remove an inactive item from `warehouse_items` / `warehouse_catalog`.
- Inactive items keep showing in inventory queries (filtered by status) and in pickers, cluttering masters indefinitely.

## What we'll build

### 1. New SQL: `purge_inactive_inventory_item(p_item_id, p_reason)`

Admin-only `SECURITY DEFINER` RPC with these guardrails (fail closed):

1. Caller must be `admin` or `super_admin` (via `has_role`).
2. Caller must have access to the item's `company_id` (`can_access_company`).
3. Item must currently be `status = 'inactive'` **and** at least 30 days in that state (configurable via a settings row; default 30 days — matches SAP archive retention default). *Rationale: prevents accidental same-day archive+purge.*
4. **Zero-reference check** across every FK that points to the item — `stock_transactions`, `warehouse_bin_allocations`, `warehouse_batches`, `partial_pieces`, `grn_items`, `purchase_order_items`, `material_demand_items`, `bom_components`, `production_orders`, `stock_audit_lines`, `cycle_count_lines`, `material_issue_items`, `stock_transfer_items`, `pick_pack_items`, `delivery_order_items`, `inventory_valuation_lines`, `warehouse_reservations`, `tool_assignments`, etc. If any row exists → raise with the table list (the UI surfaces it).
5. Delete from `warehouse_items` (and `warehouse_catalog` row if it has no other companies referencing it).
6. Insert an `audit_logs` entry: `action='purge_item'`, `entity_id`, `entity_code`, `reason`, `actor_id`, `company_id`, `payload` snapshot of the deleted row.

Companion RPC `purge_inactive_inventory_items_bulk(p_ids uuid[], p_reason text)` returns per-item `{id, status, message}` so the UI can show partial successes.

### 2. New hook: `usePurgeInactiveItem`

`src/hooks/warehouse/usePurgeInactiveItem.ts` — wraps both RPCs, invalidates `warehouse-inventory-page`, `warehouse-items-inventory`, `warehouse-items-catalog-ids`.

### 3. UI — Single item

Extend `DeleteItemConfirmationDialog.tsx`:

- When `item.status === 'inactive'` **and** caller is admin **and** `references.length === 0`, swap the existing "Force Delete" button for a clearer **"Permanently Delete"** flow:
  - Type-to-confirm input — user must type the `item_code` (NIST 800-53 / GitHub-style destructive-action pattern).
  - Required **reason** textarea (logged in `audit_logs`).
  - Calls `purge_inactive_inventory_item`.
- When `item.status !== 'inactive'`, show a banner: *"Items must be marked Inactive before they can be permanently deleted."* with a **Mark Inactive** shortcut.
- When references exist, keep the current "Cannot delete — referenced in N records" view and hide the permanent-delete option entirely.

### 4. UI — Bulk

Extend `BulkInventoryDeleteDialog.tsx` with a third bucket:

- `inactiveZeroStock` (status=inactive, current_stock=0, no references) → **Permanently delete** via bulk RPC.
- `withStock` → mark inactive (existing).
- `zeroStockActive` → mark inactive (changed from current "remove" call, which was misleading).

Add an admin-gated **"Purge selected inactive items"** action on the `ItemMasterTab` Inactive filter view.

### 5. Audit + telemetry

- Surface a row in `/admin/audit-logs` for every purge.
- Toast shows the count purged + count blocked-by-reference with a link to the audit log.

## Files

**New**
- `supabase/migrations/<ts>_purge_inactive_items.sql` — both RPCs + grants.
- `src/hooks/warehouse/usePurgeInactiveItem.ts`

**Modified**
- `src/components/warehouse/DeleteItemConfirmationDialog.tsx` — type-to-confirm + reason + admin gate.
- `src/components/warehouse/BulkInventoryDeleteDialog.tsx` — three-bucket flow.
- `src/components/warehouse/ItemMasterTab.tsx` — wire purge action when status filter = Inactive.
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` — same.

## International-standards mapping

| Concern | Standard | How we honour it |
|---|---|---|
| Archive-then-purge lifecycle | SAP MM `MM06`, Oracle Inv `INVPURGE` | Status must be Inactive ≥30d before purge |
| Audit trail for destructive actions | ISO 9001 §7.5.3, SOX §404, GxP §11.10(e) | Every purge writes to `audit_logs` with reason + actor + payload snapshot |
| Two-person / typed-confirmation | NIST 800-53 AC-3(2) | Type item_code + admin role required |
| No orphaned history | GS1 EPCIS traceability | Hard FK pre-check blocks purge if any movement exists |
| Privilege of destructive ops | Principle of Least Privilege | RPC is `SECURITY DEFINER`, gated to admin/super_admin |

## Out of scope

- Cascading delete of historical transactions (forbidden — destroys traceability).
- Auto-purge cron jobs.
- Restoring a purged item (true delete is permanent; users should rely on the audit-log payload snapshot if recovery is needed).
