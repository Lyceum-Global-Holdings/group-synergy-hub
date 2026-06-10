# Allow `user` role to see items in all add-item pickers

## Root cause

The "user" role itself is not the gate — the gate is RLS on the item master. Current SELECT policies on `warehouse_items` and `warehouse_item_catalog` require **module-level** access (warehouse / procurement / finance / admin) via `has_warehouse_access()` etc. A user assigned the `user` app_role without the `warehouse` module granted to their role gets zero rows back, so every item picker (GRN, Material Issue, Material Return, Stock Transfer, Material Request, Bulk dialogs, `ItemSearchCombobox`, `PartialPieceItemPicker`, etc.) appears empty.

The view `warehouse_items_full` uses `security_invoker=true`, so it inherits the same restriction. Reference tables `item_categories` and `item_units` already allow any authenticated user — only the two item-master tables are the bottleneck.

## Approach (best solution)

Treat the **item master as shared reference data**: any authenticated user can `SELECT` it. Write paths (INSERT/UPDATE/DELETE) keep their current module/admin gating, and per-company **stock/inventory operations** (allocations, transactions, issues, GRNs) remain RLS-scoped as today. This removes the picker blank-list problem for the `user` role across every form in one place, without weakening write security or company isolation.

Why this is safe:
- Item master rows contain item code, name, UoM, category, tracking flags — not PII, pricing per-company sits on `warehouse_items` per-company fields which all authenticated staff already need for ordering/receiving anyway.
- Stock visibility (quantities per location/bin) is enforced by separate tables (`warehouse_bin_allocations`, `stock_transactions`, `warehouse_partial_pieces`) whose policies are untouched.
- Writes still require warehouse/manager/admin via existing policies.

## Migration

Replace the SELECT policies on the two tables:

```sql
-- warehouse_items: any authenticated user can read master
DROP POLICY "Warehouse users can view all items" ON public.warehouse_items;
CREATE POLICY "Authenticated users can view warehouse items"
  ON public.warehouse_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- warehouse_item_catalog: any authenticated user can read catalog
DROP POLICY "Authorized roles can view catalog" ON public.warehouse_item_catalog;
CREATE POLICY "Authenticated users can view catalog"
  ON public.warehouse_item_catalog FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
```

INSERT/UPDATE/DELETE policies remain unchanged, so a `user`-role account still cannot create/edit/delete master items.

## Verification

After the migration:
1. Sign in as a `user`-role account (no warehouse module grant).
2. Open Create GRN → item lines populate from PO; tracking flags load.
3. Open Create Material Issue → "Add by bin" and "Browse items" both list items.
4. Open Stock Transfer / Material Return / Material Request → item pickers populate.
5. Confirm the same account still cannot add or edit a master item (Inventory page actions disabled / blocked by RLS).

## Out of scope

No frontend changes. No changes to stock, bin allocation, or transaction RLS. No changes to write policies on the item master.
