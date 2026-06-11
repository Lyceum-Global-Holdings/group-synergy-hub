## Goal

Bring the Goods Receipt Note document up to the same professional standard as the Material Issue Note: branded header with company logo, company name and address, plus a real PDF export (not a `window.print()` fallback). Aligns with **ISO 9001 §8.6/8.7** (receipt evidence), **GS1 Logistics Label** practice (traceable QR), and **SAP MIGO** GR slip layout.

## Changes

### 1. New utility — `src/utils/goodsReceiptPdfExport.ts`
Mirror `materialIssuePdfExport.ts`:
- Async `downloadGrnPdf({ grn, company, generatedByName })`
- jsPDF (A4 portrait) + `jspdf-autotable` + `qrcode`
- **Header band:** company logo (left, 56pt), company name + address + code (middle), document title "GOODS RECEIPT NOTE", GRN No, GRN Date, Status (right), and a QR encoding `GRN:<id>` for traceability
- **Meta grid (2 cols):** GRN No · GRN Date · Status · PO Number · Supplier · Supplier Address · Invoice No · Invoice Date · Receiving Location · Currency
- **Line-items table** (autoTable): #, Item Code, Item Name, UOM, Qty Ordered, Qty Received, Unit Price, Total Cost, Quality
- **Totals block:** Total Items, Grand Total (right-aligned)
- **Rejection panel** (only when `status === 'rejected'`): reason label + ISO/GS1 reference + notes + rejected_by + rejected_date
- **4-column signature block:** Received By, Quality Checked By, Approved By, Supplier Rep
- **Footer on every page:** `GRN <number> · Generated <ISO ts> UTC by <user> · Confidential — Internal Use · Source: Lyceum ERP · Page X of Y`

### 2. `src/components/warehouse/GrnDocument.tsx`
- Accept `company` from `useCompany()` (no prop change required)
- Add branded on-screen header: logo (h-14), company name (bold), address, company code — left side; existing title block moves to the right
- Show rejection panel inline when `status === 'rejected'`
- `handleDownloadPDF` → call new `downloadGrnPdf(...)` instead of `window.print()`
- `handlePrint` unchanged (still uses CSS print)
- No changes to data fetching or business logic

### 3. No DB / type / hook changes

Strictly presentation + export.

## Out of scope

- No changes to GRN creation, approval, rejection workflow, stock movements, or bin allocations
- No bulk/batch PDF export
- No email delivery of the PDF
