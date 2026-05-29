## Add "Hide zero-stock" toggle to Bin Allocations

Add a quick filter that hides bin allocations whose available quantity is 0, so users can focus on bins that actually hold pickable stock.

### UX

- Add a `Switch` (shadcn) next to the search input / bin filter in `BinAllocationsTab`, labeled **"Hide empty"** with helper tooltip "Hide allocations with 0 available stock".
- Default: **ON** (matches typical WMS behavior — operators rarely want to see empty bin rows). Persist user's choice in `localStorage` (`binAllocations.hideEmpty`) so it sticks across sessions.
- When ON, also reflect in the empty-state copy ("No bin allocations with available stock — toggle 'Hide empty' off to see all").

### Filter logic

In `filteredAllocations` (src/components/warehouse/BinAllocationsTab.tsx, ~line 160), add a predicate before the search check:

```ts
if (hideEmpty && Number(allocation.available_quantity ?? 0) <= 0) return false;
```

`available_quantity` is the DB generated column (allocated − reserved) — the canonical "pickable" number, consistent with the Available Quantity memory.

### Scope

- Single file: `src/components/warehouse/BinAllocationsTab.tsx`
- No DB / hook / type changes.
- No change to bin filter dropdown (it still lists every physical bin in scope, per WMS standard).

### Out of scope

- Server-side filtering (current list is already client-filtered; row counts are small enough).
- Hiding bins from the bin filter popover based on stock.
