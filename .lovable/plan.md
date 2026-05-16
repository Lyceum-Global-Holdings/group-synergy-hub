
## Problem

In `/warehouse/inventory`, when a sub-location like **VEB** is selected, SKUs that are assigned to **two bins** only display **one**. The second bin is suppressed even though the assignment exists.

### Root cause

`list_warehouse_inventory` builds the `bins` JSON from `scoped_alloc`, which filters `warehouse_bin_allocations` with `a.allocated_quantity > 0`. Any bin row whose on-hand has dropped to zero — but where the **item-to-bin assignment is still active** — disappears from the breakdown.

Confirmed example — SKU `INV-ALU-000-0014` (Rubber Beading) at VEB:

| Bin | Alloc location | Allocated qty | Visible today |
|---|---|---|---|
| `NWS-VEB` | VEB | 100 | ✅ |
| `1-B-2-1` | VEB | 0 | ❌ (filtered out) |

This pattern repeats across dozens of VEB items (Cladding board, Lime bag, GI Pipe, Titanium top coat, etc.). Internationally (SAP EWM "fixed bin" / Oracle WMS "primary locator"), an assigned bin is part of the master regardless of current quantity; only the on-hand column should read zero.

## Fix

Single, targeted SQL migration — edit one function, no schema change.

### Update `public.list_warehouse_inventory`

Split bin-list assembly from item stock totals:

1. `scoped_alloc` (used for item-level totals and the in_stock/zero/low filter) — keep `allocated_quantity > 0`.
2. Add a new CTE `scoped_alloc_full` — same scope and company filter, **without** the `> 0` predicate — used only to render the `bins` JSON.
3. Aggregate the `bins` JSON from `scoped_alloc_full` so every assigned bin within scope renders, with `quantity`, `allocated_quantity`, `reserved_quantity` showing real values (often `0`).
4. Keep item-row visibility logic unchanged — items still need at least one non-zero allocation to appear under `in_stock`, etc.

```text
scoped_alloc        → drives current_stock / available / reserved / list filter
scoped_alloc_full   → drives bins jsonb (includes zero-qty assignments in scope)
```

### Acceptance

- Filter LFC → VEB on `/warehouse/inventory`.
- `INV-ALU-000-0014` (and the other affected SKUs) show **both** `NWS-VEB` and `1-B-2-1`, with `1-B-2-1` quantity = 0.
- Item-level totals, `in_stock` / `zero` / `low` filters, supplier/category/search filters are unchanged.
- No change to RLS, FIFO, ledger, or any write path.

### Out of scope

- The orphan allocations whose **physical bin** sits at LFC root but allocation row is tagged to VEB (`1-B-2-1`, `3-A-6-3`, etc.) — visible after this fix, but cleaning them up (deleting empty assignments or re-parenting the physical bin) is a separate data-hygiene task once the user can see them.
- Inventory module performance, sort, search, pagination.
- Stock movement chart (already removed).
