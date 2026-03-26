

## Fix: `column gi.received_quantity does not exist`

### Root Cause
The migration just applied references `gi.received_quantity` but the actual column in `grn_items` is `quantity_received`.

### Fix
Create a new migration to replace the trigger function with the correct column name:

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
      current_stock = COALESCE(wi.current_stock, 0) + COALESCE(gi.quantity_received, 0),
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
- **New migration**: Fix column reference from `received_quantity` to `quantity_received`

