## Fix: "Add by bin" shows no stock

`AddByBinDialog` queries `warehouse_bin_allocations.quantity`, but that column doesn't exist — the table uses `allocated_quantity` (and a generated `available_quantity`). PostgREST silently returns no usable rows, so the dialog always says "No stock in this bin."

### Change
`src/components/warehouse/material-issue/AddByBinDialog.tsx`
- Replace `quantity` in the select with `available_quantity, allocated_quantity`.
- Filter by `.gt('available_quantity', 0)` instead of `.gt('quantity', 0)` so we only stage what's actually issuable (allocated minus reserved).
- Map `bin_qty` from `r.available_quantity` (fallback to `allocated_quantity` if null).

No backend, RLS, or schema changes. Other entry methods are untouched.
