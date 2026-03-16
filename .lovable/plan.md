

# Fix: Import from Catalog dialog UI alignment

## Problem

Looking at the screenshot, the item list rows lack visual structure — no "Select" badge is visible, items appear as plain text blocks without clear separation or interactive affordance. The dialog width (`sm:max-w-lg` = 512px) may be too narrow for the content, causing the badge to be pushed off or hidden.

## Changes

### File: `src/components/warehouse/AddFromCatalogDialog.tsx`

1. **Widen dialog**: Change `sm:max-w-lg` to `sm:max-w-2xl` (~672px) so item names, codes, and the Select badge all fit comfortably.

2. **Improve item row structure**: Add a subtle border/background on hover, ensure the Select badge is always visible by giving it a distinct color, and add consistent padding:
   - Add `rounded-md` to each button for cleaner row separation
   - Change from `divide-y` on the container to individual row styling with `border-b last:border-b-0`
   - Make the Badge more visible: use `variant="secondary"` or add a colored background

3. **Improve secondary text**: Show item code in a slightly styled mono badge-like container for better visual hierarchy:
   ```
   <span className="font-mono bg-muted px-1 rounded">{item.item_code}</span>
   ```

4. **Add hover cursor**: Add `cursor-pointer` to buttons.

These are small CSS/class changes to the existing JSX structure (lines 281-299, line 254).

