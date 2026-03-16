
Fix the catalog dialog by changing the row layout, not just the scroll container.

What’s actually causing the overflow
- The shared `ScrollArea` already has horizontal clipping.
- The dialog still overflows because each item row is a single horizontal flex line:
  - left side text
  - right side fixed “Select” badge
  - metadata line is also forced into one row with `flex items-center ... truncate`
- With long names/brands/categories, the row’s intrinsic width becomes wider than the dialog, so the content appears to spill out of the frame.

Implementation plan

1. Tighten the dialog frame itself
- Update `AddFromCatalogDialog.tsx` so `DialogContent` uses a responsive width like:
  - `w-[95vw] max-w-2xl overflow-hidden`
- This ensures the modal content is clipped to its own frame on all screen sizes.

2. Make the list section stretch cleanly inside the frame
- Keep the `ScrollArea` as the bordered container.
- Ensure the list wrapper uses full width:
  - `w-full`
- Keep the list visually contained with `overflow-hidden`.

3. Rebuild each item row to wrap instead of forcing one horizontal line
- Replace the current single-row `flex items-start justify-between` button layout with a stacked/mobile-safe structure.
- Use a row like:
  - outer button: `w-full block text-left ... overflow-hidden`
  - inner wrapper: `flex w-full items-start gap-3`
  - text column: `flex-1 min-w-0`
  - action badge: `shrink-0 self-start`
- Most importantly, allow the metadata section to wrap:
  - change from `flex items-center gap-2 truncate`
  - to something like `flex flex-wrap items-center gap-x-2 gap-y-1`
- Remove overuse of `truncate` on the whole metadata row and use:
  - title: `break-words` or `line-clamp-2`
  - metadata chips/text: `break-words`

4. Force long content onto line breaks
- Let long item names wrap within the text column instead of stretching the row.
- Let brand/category/code details wrap onto the next line.
- If needed, put the “Select” badge on its own line on smaller widths while keeping it right-aligned on larger widths.

Suggested structural target
```text
[ Item name that can wrap to 2 lines................ ] [Select]
[ CODE ]  [Brand text wraps]  [Category text wraps...........]
```

5. Keep the frame visually aligned
- Ensure the bordered list container, row borders, and right-side badge all remain inside the same width.
- Add `box-border` / `w-full` where needed so padding and borders do not exceed the parent width.

Files to update
- `src/components/warehouse/AddFromCatalogDialog.tsx`

Concrete changes I would make
- `DialogContent`: add `w-[95vw] max-w-2xl overflow-hidden`
- `ScrollArea`: keep `h-[400px] border rounded-md overflow-hidden`
- list wrapper: change to `div className="w-full overflow-hidden"`
- row button:
  - from horizontal single-line flex container
  - to `w-full block overflow-hidden px-4 py-3 ...`
- inner row content:
  - add `flex w-full items-start gap-3`
  - keep text column `flex-1 min-w-0`
  - keep badge `shrink-0`
- item name:
  - replace `truncate` with wrapping-friendly class
- metadata line:
  - replace `truncate` + single-line flex with `flex flex-wrap ...`
  - allow chips/text to break cleanly

Expected result
- The list will fully align to the dialog frame.
- No content will spill past the right border.
- Long names/brands/categories will wrap onto new lines instead of widening the row.
- The list will visually “stretch to the frame” while staying contained inside it.
