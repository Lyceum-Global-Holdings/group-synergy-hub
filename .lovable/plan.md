

## Fix Batch Detail Tracking in Batch Management

### Problem
Batch records exist in `item_batches` but tracking details are incomplete across the system:
1. GRN item queries omit `batch_number`, `manufacturing_date`, `expiry_date` — so GRN details don't show batch info
2. GRN details dialog has no batch columns in the items table
3. Batch details dialog shows no issue/consumption history (no `batch_issue_details` query)
4. Batch records don't link back to their source GRN

### Plan

**1. Add batch fields to GRN item queries** — `src/hooks/useGoodsReceiptNotes.ts`
- In `useGoodsReceiptNotes` and `useGrnById`, add `batch_number, manufacturing_date, expiry_date` to the `grn_items(...)` select

**2. Show batch info in GRN details** — `src/components/warehouse/GrnDetailsDialog.tsx`
- Add `Batch #`, `Mfg Date`, `Expiry` columns to the items table in the "Items" tab
- Only show these columns when at least one item has batch data

**3. Add issue history to batch details** — `src/components/warehouse/BatchDetailsDialog.tsx`
- Query `batch_issue_details` for the selected batch, joining `material_issue_items(material_issues(issue_number, issue_date, issued_to))`
- Display a "Consumption History" section showing: issue number, date, quantity consumed, issued to
- This gives full traceability from batch → which issues consumed it

**4. Add GRN source link to batch details** — `src/components/warehouse/BatchDetailsDialog.tsx`
- Use the existing `grn_item_id` on the batch to fetch the parent GRN number
- Display "Source GRN" in the batch info section

### Files to Edit
- `src/hooks/useGoodsReceiptNotes.ts` — add 3 fields to grn_items select (2 queries)
- `src/components/warehouse/GrnDetailsDialog.tsx` — add batch columns to items table
- `src/components/warehouse/BatchDetailsDialog.tsx` — add consumption history section + GRN source

