# Fix: GRN items not visible in details dialog

## Root cause
The parent `goods_receipt_notes` SELECT policy allows anyone with company access (`can_access_company(company_id)`) to view a GRN, but the child `grn_items` SELECT policy only allows the GRN's creator or an admin to view the line items:

```
USING (EXISTS (SELECT 1 FROM goods_receipt_notes grn
               WHERE grn.id = grn_items.grn_id
                 AND (grn.created_by = auth.uid() OR is_admin(auth.uid()))))
```

So a "user" (or any non-creator/non-admin) opening a GRN sees the header but an empty items table — exactly the reported symptom.

## Fix
Single SQL migration to relax the SELECT policy on `grn_items` to match the parent table (company-scoped), while keeping write policies untouched.

```sql
DROP POLICY "Users can view GRN items they have access to" ON public.grn_items;

CREATE POLICY "Users can view GRN items in their company"
  ON public.grn_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goods_receipt_notes grn
      WHERE grn.id = grn_items.grn_id
        AND can_access_company(grn.company_id)
    )
  );
```

No frontend changes. No changes to INSERT/UPDATE/DELETE policies — only the creator (on draft) or admins can still modify items.

## Verification
- As a "user"-role account with company access, open any submitted/approved GRN → Items tab now populates.
- As the same user, confirm they still cannot edit/delete items on a GRN they don't own.
