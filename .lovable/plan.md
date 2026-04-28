Plan to fix decimal quantities when importing an item from the catalog:

1. Update the catalog import dialog quantity state
   - Change `quantity` handling in `src/components/warehouse/AddFromCatalogDialog.tsx` from a numeric state that is coerced on every keystroke to a string state, matching the working `SingleItemForm` pattern.
   - This prevents the input from immediately converting `1.` or `1.5` back to `1` while the user is typing.

2. Apply the standard 3-decimal quantity input settings
   - Import and use the existing `QTY_STEP` and `QTY_MIN` constants from `src/lib/quantityInput.ts`.
   - Set the Initial Quantity input to:
     - `step={QTY_STEP}` (`0.001`)
     - `min={QTY_MIN}` (`0`)
     - `inputMode="decimal"`
     - a decimal-friendly placeholder like `e.g. 12.500`
   - Add the same helper text used elsewhere: decimals supported up to 3 places.

3. Parse and validate only on submit
   - Convert the string input to a number using `parseQty`/`parseFloat` inside the import mutation.
   - Reject empty, invalid, zero, or negative quantities with a clear validation error.
   - Use the parsed quantity for:
     - `warehouse_items.current_stock`
     - `warehouse_bin_allocations.allocated_quantity`
     - disabled-state validation for the submit button

4. Keep behavior consistent after import/close
   - Reset the quantity field to a sensible default such as `1` when the dialog closes.
   - Preserve the existing catalog item selection, bin allocation, cache invalidation, and company-scoped write behavior.

Technical root cause:

```text
Current code:
quantity state is number
onChange => Math.max(1, parseInt(e.target.value) || 1)

Effect:
Typing 1.5 becomes parseInt("1.5") = 1,
so decimal input is impossible.
```

The fix is frontend-only because the earlier quantity migration already widened the database columns to 3 decimal precision.