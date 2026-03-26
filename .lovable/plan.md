

## Fix: Batch Records Not Properly Created on GRN

### Root Cause

The trigger `create_batches_on_grn_approval` **is working** — batch records are being created. However, the problem is:

1. **Batch details are empty**: The GRN form's batch fields (batch number, manufacturing date, expiry date) are hidden inside a small popover button that says "Enter" — users don't notice it or skip it
2. **No validation**: Batch-tracked items can be submitted without any batch details, resulting in auto-generated meaningless batch numbers like `BATCH-20260326-115055-00bfda61` with no dates
3. **Poor UX**: Per international standards (ISO 22000, GMP/GDP, IAS 2), batch-tracked items must have proper batch identification at goods receipt

### Solution (International Best Practice)

**Make batch details mandatory and visible for batch-tracked items**, following ISO/GMP receiving standards:

**1. Make batch fields inline and visible** — `CreateGrnDialog.tsx`
- For batch-tracked items, show batch number, manufacturing date, and expiry date as **dedicated table rows or inline fields** instead of hiding them in a popover
- Add a visual indicator (badge) showing the item requires batch tracking
- Add validation: prevent form submission if any batch-tracked item is missing a batch number

**2. Add validation on submit** — `CreateGrnDialog.tsx`
- Before submitting, check all batch-tracked items have a `batch_number`
- Show a clear error toast listing which items are missing batch details
- Optionally warn (not block) if manufacturing/expiry dates are missing

**3. Auto-suggest batch number format** — `CreateGrnDialog.tsx`
- Provide a "Generate" button that creates a standardized batch number: `{ITEM_CODE}-{YYYYMMDD}-{SEQ}` (following GMP batch numbering conventions)
- User can override with supplier's batch number

### Files to Edit
- `src/components/warehouse/CreateGrnDialog.tsx` — make batch fields inline, add validation, add auto-generate button

### Technical Notes
- No database changes needed — trigger and schema are correct
- The trigger's COALESCE fallback for auto-generating batch numbers is kept as a safety net
- Expiry date validation: warn if expiry is in the past or within 30 days

