# Fix "Temporarily unavailable" on /b/:id bin QR

## Root cause
The `/b/:id` scan calls edge function `public-bin-qr`, which calls the SECURITY DEFINER RPC `get_public_bin_allocation_qr`. Edge logs show:

```
ERROR public-bin-qr rpc failed { code: "42703", message: "column i.item_code does not exist" }
```

The RPC still joins `public.warehouse_items i` and selects `i.item_code`, `i.name`. Per the warehouse item master refactor (Stage 6b memory), those mirrored columns were dropped from `warehouse_items` and now live only on `warehouse_item_catalog`, exposed via the `warehouse_items_full` view. The RPC was missed in that migration.

## Fix
One DB migration replacing the RPC so it reads item master fields from `warehouse_items_full` (per the "Server-side SQL must read item master from warehouse_items_full" core rule). No edge function or frontend code changes — the contract and JSON shape are identical.

```sql
CREATE OR REPLACE FUNCTION public.get_public_bin_allocation_qr(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'item_code', i.item_code,
    'item_name', i.name,
    'bin_code', b.bin_code,
    'bin_name', b.name,
    'location_name', l.name,
    'location_code', l.location_code,
    'company_name', c.name,
    'allocated_quantity', a.allocated_quantity,
    'available_quantity', a.available_quantity,
    'updated_at', a.updated_at
  )
  FROM public.warehouse_bin_allocations a
  JOIN public.warehouse_items_full i ON i.id = a.warehouse_item_id
  JOIN public.warehouse_bins b ON b.id = a.bin_id
  LEFT JOIN public.warehouse_locations l ON l.id = b.location_id
  LEFT JOIN public.companies c ON c.id = a.company_id
  WHERE a.id = p_id
  LIMIT 1;
$$;
```

## Verification
- Re-curl `public-bin-qr?id=<real allocation id>` → expect 200 with populated `item_code` / `item_name`.
- Reload `https://stores.lgh.lk/b/<id>` on mobile → card renders instead of "Temporarily unavailable".

## Follow-up audit (same migration turn, read-only)
Grep other RPCs/views for `FROM warehouse_items\b` selecting `item_code`/`name` and flag any other stragglers, but only fix this one now unless others are also broken in production.
