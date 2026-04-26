## Root cause (verified against production data)

I queried the database directly. The notes value the user is filtering for **does exist**:

```
SELECT count(*) FROM stock_transactions WHERE notes ILIKE '%23/07/2255n%';
→ 8 rows
```

But every one of those 8 rows has `company_id = NULL`. The report function does:

```sql
WHERE st.company_id = p_company_id
```

`NULL = anything` is never true, so those rows are silently filtered out **before** the notes filter ever runs. That's why no result appears regardless of what is typed in the notes box.

This is a project-wide data-integrity gap, not a UI bug:

```
stock_transactions
  total rows           : 2,021
  company_id IS NULL   : 1,114   ← 55%
  company_id NOT NULL  :   907
```

Every NULL row's parent `warehouse_items.company_id` IS populated, so the canonical company is always recoverable.

A secondary problem: there are **two overloads** of `report_stock_movement_ledger` in the database (a legacy 4-arg version and the current 6-arg version with notes filter). PostgREST has to disambiguate by argument set, which works today but is brittle and should be cleaned up.

## Solution

A single migration that:

### 1. Backfills the historical NULL company_ids

```sql
UPDATE stock_transactions st
SET company_id = wi.company_id
FROM warehouse_items wi
WHERE st.item_id = wi.id
  AND st.company_id IS NULL
  AND wi.company_id IS NOT NULL;
```

Safe, idempotent, reversible (only touches NULL rows).

### 2. Adds a BEFORE INSERT/UPDATE trigger to prevent regression

```sql
CREATE OR REPLACE FUNCTION public.fill_stock_transaction_company_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.item_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM warehouse_items WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER stock_transactions_fill_company_id
BEFORE INSERT OR UPDATE OF item_id, company_id ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION public.fill_stock_transaction_company_id();
```

This is the SAP / Oracle EBS pattern: **the transaction inherits its tenant scope from the master record it operates on**. No code changes required at the call sites — every existing INSERT path is automatically corrected.

### 3. Hardens the report function against any remaining NULLs (defence in depth)

Replace the strict equality with a coalesce-aware filter so a stray NULL row joined to a known item is still scoped correctly:

```sql
WHERE COALESCE(st.company_id, wi.company_id) = p_company_id
```

That guarantees the report is correct even if a future code path forgets to set `company_id`.

### 4. Drops the obsolete 4-arg overload

```sql
DROP FUNCTION IF EXISTS public.report_stock_movement_ledger(
  uuid, timestamptz, timestamptz, uuid
);
```

Removes PostgREST overload ambiguity. Only the 6-arg version (with notes filter) remains.

### 5. (Optional but recommended) Same hardening for the other two notes-filter reports

`report_cycle_count_variance` and `report_batch_traceability` join through their own parent records. I will mirror the COALESCE-pattern + drop-old-overload there too so notes filtering can never silently drop rows for the same class of reason.

## What is NOT changed

- No frontend changes. The UI parser, parameter shape, and RPC call signature stay exactly as they are — they were correct already.
- No RLS policy changes; backfill runs as the migration role.
- No change to the columns returned or to the report row shape.

## Verification after migration

I will re-run, with the same notes term, against the same company that owns those 8 rows:

```sql
SELECT count(*)
FROM report_stock_movement_ledger(
  '<company_id>'::uuid, NULL, NULL, NULL,
  'contains', ARRAY['23/07/2255n']
);
-- expected: 8
```

And without filter:

```sql
SELECT count(*) FROM report_stock_movement_ledger(
  '<company_id>'::uuid, NULL, NULL, NULL, 'contains', NULL
);
-- expected: previous count + 1,114 (or whatever subset belongs to that company)
```

## Files

- 1 new migration: `supabase/migrations/<ts>_fix_stock_txn_company_id_and_notes_filter.sql`
- No application code changes.
