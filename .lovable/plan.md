## Goal
Add a "Download PDF" action for Material Return Notes (MRN) that mirrors the existing MIN PDF layout, adapted for return-specific fields and aligned with international document standards (ISO 9001 traceability, SAP-style return note presentation).

## What gets built

### 1. New util: `src/utils/materialReturnPdfExport.ts`
Mirror of `src/utils/materialIssuePdfExport.ts`, adapted for MRN:

- **Header**: Company logo + name + address (left). Document title **"MATERIAL RETURN NOTE"** + MRN No + Return Date + Status (right). QR code encoding `MRN:${id}` for traceability.
- **Meta grid** (2 columns):
  - Returned By, Return Type (Internal / Supplier), Reason
  - Reference Type + Reference No (source MIN / PO)
  - Location, SRN No, Approved By, Approved Date
- **Line items table** with international return-note columns:
  `#`, `Item Code`, `Description`, `UOM`, `Qty Returned`, `Bin` (destination bin from new per-line bin feature), `Condition` (Good / Damaged / Expired), `Unit Cost`, `Total Value`.
  Footer row with grand total.
- **Notes** block.
- **Signature block** (4 columns): Returned By, Prepared By, Approved By, Warehouse Receiver — with name + date lines.
- **Document control footer** on every page: MRN number, generated-at UTC, generated-by, "Confidential — Internal Use · Source: Lyceum ERP · Page X of Y".
- Same fonts, colors, spacing, jsPDF + autoTable + qrcode dependencies as MIN — no new packages.

### 2. Wire the action into the UI

**`src/components/warehouse/MaterialReturnDetailsDialog.tsx`**
- Add a **"Download PDF"** button in the dialog header (next to existing Edit Draft / Close actions), available for any status (draft, approved, returned).
- On click: fetch the active company from `useCompany`, fetch MRN line items (already loaded in the dialog via `useMaterialReturnItems`), resolve approver display names via `profiles` lookup, then call `downloadMaterialReturnPdf(...)`.

**`src/pages/warehouse/MaterialIssueReturn.tsx`** (MRN tab table)
- Add a Download icon button in the Actions column for every MRN row (same pattern as the existing Edit button), so users can export without opening the dialog.

### 3. No DB / schema / RLS changes
All data needed (header, items with `bin_code`, approver IDs, company info) is already exposed by current hooks/RPCs. Pure frontend addition.

## Technical notes
- Filename: `MRN-{mrn_number}.pdf`.
- Currency formatting via existing `formatCurrency` helper, using the company's currency.
- Status badge in header uses uppercase plain text (matches MIN) — no colored chip in PDF.
- QR payload `MRN:{id}` keeps the same scheme as `MIN:{id}` so scanners route consistently.
- Reuses `urlToDataUrl` helper pattern (copy from MIN util) for logo loading.

## Out of scope
- No changes to MIN or GRN PDFs.
- No bulk/multi-MRN export.
- No e-signature embedding (deferred).
