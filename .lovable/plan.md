

## Fix: `column wi.quantity_in_stock does not exist`

### Root Cause
The trigger function `update_stock_on_grn_approval()` references `quantity_in_stock` on the `warehouse_items` table, but the actual column is `current_stock`.

### Fix
Create a migration to replace the function, changing `quantity_in_stock` to `current_stock`:

```sql
CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE warehouse_items wi
    SET 
      current_stock = COALESCE(wi.current_stock, 0) + COALESCE(gi.received_quantity, 0),
      updated_at = now()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
    AND wi.id = gi.warehouse_item_id;
  END IF;
  RETURN NEW;
END;
$function$;
```

### Files
- **New migration**: Fix `update_stock_on_grn_approval` trigger function column name

