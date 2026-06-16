# Material Returns Linked to Material Issue Notes (MIN → MRN)

Align Material Return Notes (MRN) with international warehouse standards (SAP MIGO 262 / 122, ISO 9001 §8.5.1): every internal return must reference an approved issue, items are inherited from that issue, and return quantity per line cannot exceed `issued − already_returned`.

## UX flow in `CreateMaterialReturnDialog`

1. **Return Type** is the first field.
   - `Internal Return` → requires linking a MIN.
   - `Supplier Return` → keeps current free-form flow (out of scope here).
2. When `Internal Return` is selected, show a **Source Material Issue (MIN)** combobox:
   - Lists approved / issued MINs for the current company + location (status in `approved`, `issued`, `partially_received`, `completed`).
   - Shows `MIN number · issue date · issued_to`.
3. On MIN select:
   - Auto-fill `reference_type = material_issue`, `reference_id = min.id`, and prefill `returned_by` from `issued_to` (editable).
   - Fetch lines from `material_issue_items` joined with `warehouse_items_full` for code/name + already-returned aggregate from `material_return_items` (grouped by `item_id` for MRNs whose `reference_id = min.id`).
   - Populate the items grid (read-only item picker, with: item code, item name, UoM, qty issued, already returned, **qty to return** (default 0, max = issued − returned), condition, unit cost prefilled from the issue line, notes).
   - Disable the manual "Add Item" button while a MIN is linked (returns must come from the issued lines).
4. Inline validation: per-row qty must be `> 0` and `≤ remaining`; submit disabled until at least one row has qty > 0 and all rows are within limits.
5. Existing SRN number, SRN document, reason, notes, dual-quantity (secondary UoM) fields are retained.

For `Supplier Return`, the current free-form item picker remains unchanged.

## Server-side guard (defense in depth)

Add a `BEFORE INSERT/UPDATE` trigger on `material_return_items` that, when the parent `material_return_notes.reference_type = 'material_issue'`, enforces:
`sum(quantity_returned for this item on this MIN) ≤ sum(quantity_issued for this item on this MIN)`.

This protects against any client bypass and matches SAP's "return with reference" behaviour.

## Files

- Edit `src/components/warehouse/CreateMaterialReturnDialog.tsx` — add MIN selector, fetch issue lines + prior returns, render locked item rows with remaining-qty validation, submit using the loaded lines.
- New small hook `src/hooks/useIssuableMaterialIssues.ts` — lists MINs eligible as return sources for the current company/location.
- New helper inside the dialog (or `src/hooks/useMinReturnableLines.ts`) — returns `{ item_id, item_code, item_name, uom, qty_issued, qty_returned, remaining, unit_cost }` for a given MIN.
- New migration: trigger function `enforce_material_return_within_issued()` + trigger on `material_return_items`.

## Out of scope

- Approval workflow for MRNs (separate request).
- Stock-on-hand updates on MRN approval (existing logic untouched).
- Supplier-return flow changes.
