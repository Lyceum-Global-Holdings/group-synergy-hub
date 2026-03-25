

## Build 3-Way Matching Function

### Overview
Build a fully functional 3-way matching system that compares **Purchase Orders**, **Goods Receipt Notes (GRNs)**, and **Supplier Invoices** at line-item level, detecting quantity and price discrepancies and enabling approval or exception workflows.

### Existing Schema (no migrations needed)
The database already supports this:
- `supplier_invoices` has `po_id`, `grn_id`, and `three_way_match_status` columns
- `po_items` has `quantity_ordered`, `unit_price`, `item_name`, `item_code`
- `grn_items` has `quantity_received`, `unit_price`, linked via `po_item_id`
- `supplier_invoice_lines` has `quantity`, `unit_price`, linked via `invoice_id`

### Implementation Plan

**1. Create `useThreeWayMatch` hook** (`src/hooks/useThreeWayMatch.ts`)
- Fetch supplier invoices that have a `po_id` set, joining PO details, GRN details, and their respective line items
- Compute match status per invoice by comparing:
  - PO item qty/price vs GRN item qty/price (quantity received matches ordered)
  - PO item qty/price vs Invoice line qty/price (billed matches ordered)
  - Allow configurable tolerance (e.g., 2% price variance, 0 qty variance)
- Return match results with discrepancy details per line item
- Provide mutations: `approveMatch` (sets `three_way_match_status` to 'matched'), `flagException`, `rejectMatch`
- Dashboard stats query: count by `three_way_match_status`

**2. Rebuild `ThreeWayMatch.tsx` page** (`src/pages/procurement/ThreeWayMatch.tsx`)
- **KPI Cards**: Live counts from DB (Pending, Matched, Exception, Failed)
- **Tabs**: Pending / Matched / Exceptions / Failed -- each showing a DataTable of invoices
- **Table columns**: Invoice #, PO #, GRN #, Supplier, PO Amount, GRN Amount, Invoice Amount, Variance %, Status, Actions
- **Match Detail Dialog**: Clicking a row opens a side-by-side comparison showing:
  - Left column: PO line items (item, qty ordered, unit price)
  - Middle column: GRN line items (qty received, unit price)
  - Right column: Invoice lines (qty billed, unit price)
  - Color-coded cells: green (match), amber (within tolerance), red (mismatch)
  - Action buttons: Approve Match, Flag Exception, Reject
- **Auto-Match button**: Runs matching logic on all pending invoices with linked PO+GRN, auto-approves perfect matches

**3. Create `ThreeWayMatchDetail` component** (`src/components/procurement/ThreeWayMatchDetail.tsx`)
- Three-column comparison table with variance calculations
- Visual indicators (icons + colors) for match/mismatch per line
- Summary row showing totals and overall match percentage
- Notes field for exception reasoning

### Technical Details

**Match Logic** (in hook):
```
For each supplier_invoice with po_id:
  1. Fetch po_items for that PO
  2. Fetch grn_items where grn_id = invoice.grn_id (or grn.po_id = invoice.po_id)
  3. Match lines by item_code or po_item_id
  4. Compare: qty_ordered vs qty_received vs qty_billed
  5. Compare: po_unit_price vs grn_unit_price vs invoice_unit_price
  6. If all lines match within tolerance → "matched"
  7. If any line has variance → "exception"  
  8. If no GRN or PO found → "unmatched"
```

**Files to create:**
- `src/hooks/useThreeWayMatch.ts`
- `src/components/procurement/ThreeWayMatchDetail.tsx`

**Files to edit:**
- `src/pages/procurement/ThreeWayMatch.tsx` (full rebuild)

