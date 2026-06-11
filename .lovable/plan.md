## Root cause

The GRN item picker is powered by the `list_warehouse_catalog` SECURITY DEFINER RPC. Its access gate hard-codes module checks:

```
has_warehouse_access OR has_procurement_access OR has_finance_access OR has_manager_access
```

Users in the `user` role can reach the GRN screen (the front-end module config grants them GRN access) but fail every one of those helper checks, so the RPC short-circuits and returns no rows — empty item dropdown.

This contradicts the table's own RLS, which already allows any authenticated user to read the catalog:

```
Policy "Authenticated users can view catalog"  USING (auth.uid() IS NOT NULL)
```

Item-master visibility for receiving/issuing is the SAP MM / Oracle EBS / NetSuite convention: master data is broadly readable by any operational user; only transactional/stock data is permission-gated.

## Fix

Replace the access gate in `list_warehouse_catalog` so it mirrors the table's RLS — accept any authenticated user. Module/role checks stay where they belong: on the screens that *write* catalog data and on the stock/transactional tables.

Concretely, the migration `CREATE OR REPLACE`s the function and changes only the gate block:

```sql
IF v_uid IS NULL THEN
  RETURN;
END IF;
```

Body, ordering, paging, search ranking, and return columns are unchanged. No client changes — the picker already calls this RPC.

## Out of scope

- Catalog *write* paths (create/edit/delete) keep their existing role checks.
- Per-company `warehouse_items` quantities and `warehouse_bin_allocations` continue to be gated by `can_access_company` / company RLS — non-admin users will only see stock for companies they belong to. Only the global item master becomes visible.
- No change to GRN approval / bin-allocation flow.
