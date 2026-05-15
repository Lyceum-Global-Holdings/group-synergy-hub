# Fix: Bulk Delete in Inventory

## Why bulk delete appears broken today

The current `BulkInventoryDeleteDialog` only offers two paths:

1. **Mark Inactive** — for active or in-stock items.
2. **Permanently Delete** — only available for items that are **already Inactive AND inactive ≥ 30 days**.

Result: on a freshly selected set of items, the "Permanently Delete N…" button never appears, so users perceive bulk delete as broken. The 30-day cooling rule is also enforced server-side in `purge_inactive_inventory_item`, blocking any attempt by admins to clean up newly created or recently deactivated rows.

International ERP precedent (SAP MM06 *Flag for Deletion* → archive run, Oracle "Delete Items" concurrent program, ISO 9001 §7.5.3) only requires:

- A **zero-transactional-reference** check.
- An **immutable audit trail** of who deleted what and why.
- **Role-based authorization**.

The 30-day waiting period is an internal policy convenience, not a standard. We will keep it as a *soft* recommendation but unblock immediate purge when the item carries no historical references.

## Plan

### 1. Database (migration)

Update `purge_inactive_inventory_item` and `purge_inactive_inventory_items_bulk`:

- **Drop** the hard 30-day inactive requirement.
- **Drop** the "must already be Inactive" precondition. If an item is `active`/`discontinued`, the function flips it to `inactive` in the same transaction before deletion (still inside the audit snapshot).
- **Keep** all existing guards: admin/super_admin only, company access, ≥5-char reason, full zero-reference check across all 24 FK tables, `current_stock = 0`, snapshot to `security_audit_log`.
- Add a new helper RPC `check_inventory_purge_eligibility(p_item_ids uuid[])` that returns one row per item with `{ id, eligible, blocking_refs[], current_stock }` so the UI can classify selections accurately (instead of guessing from `status` + `updated_at`).

### 2. Frontend — `BulkInventoryDeleteDialog.tsx`

- On open, call `check_inventory_purge_eligibility` for the selected ids.
- Re-bucket results server-truthfully:
  - **Purgeable now** — `eligible = true` (zero stock, zero references). Admin sees a single "Permanently Delete N" flow with type-to-confirm `PERMANENTLY DELETE` + reason ≥ 5 chars.
  - **Must archive** — has stock or references. "Mark Inactive" preserves history (unchanged).
- Remove the misleading "Inactive too recent" bucket. Keep a small note when items are blocked by references, listing the top 2 blocking tables (e.g. *"3 items have stock_transactions and cannot be deleted"*).
- Keep a single confirmation step; no 30-day messaging.

### 3. Frontend — `DeleteItemConfirmationDialog.tsx`

- Same simplification for the single-item flow: if eligible (zero stock, zero refs, admin), show type-to-confirm purge directly. Otherwise offer "Mark Inactive". Drop the 30-day gate and the "must mark Inactive first" two-step.

### 4. Out of scope

- No changes to non-admin roles (still cannot purge).
- No cascade deletion of historical transactions — items with refs still cannot be purged.
- No restore: purge remains permanent (snapshot only).
- The unrelated React DevTools "Maximum call stack size exceeded" warning is not addressed here.

## Files

- New migration: relax `purge_inactive_inventory_item`, `purge_inactive_inventory_items_bulk`; add `check_inventory_purge_eligibility`.
- `src/hooks/warehouse/usePurgeInactiveItem.ts` — add `useCheckPurgeEligibility` query.
- `src/components/warehouse/BulkInventoryDeleteDialog.tsx` — re-bucket via RPC, remove 30-day UI.
- `src/components/warehouse/DeleteItemConfirmationDialog.tsx` — single-step purge for eligible items.
