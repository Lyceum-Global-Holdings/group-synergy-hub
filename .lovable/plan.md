## Material Issue Note PDF – Plan

Add a "Download PDF" action that generates a professional, internationally-formatted Material Issue Note (MIN) document with company branding.

### Where it appears
- **Primary**: `MaterialIssueDetailsDialog` header — new "Download PDF" button next to status badge.
- **Secondary**: Row action in the MIN list on `/warehouse/material-issue` (`MaterialIssueReturn.tsx`).

### Document layout (ISO-style goods issue voucher)
Based on ISO 9001 traceable document conventions + SAP/Oracle MIGO-201 layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ [LOGO]   Company Legal Name                  MATERIAL ISSUE   │
│          Registered Address                       NOTE        │
│          Tax / Reg No · Phone · Email      MIN No: MIN-000123 │
│                                            Date:   2026-06-10 │
├───────────────────────────────────────────────────────────────┤
│ Issued To: ____________   Department: ____   EPF: ______      │
│ Location:  ____________   Job/PR No:  ____   Req Date: ___    │
│ Purpose:   ____________________________________________       │
├───────────────────────────────────────────────────────────────┤
│ # │ Item Code │ Description │ UOM │ Req Qty │ Issued │ Recvd │
│───┼───────────┼─────────────┼─────┼─────────┼────────┼───────│
│ ...line items...                                              │
├───────────────────────────────────────────────────────────────┤
│ Notes: ...                                                    │
├───────────────────────────────────────────────────────────────┤
│ Requested by      HOD Approval     Mgmt Approval   Received  │
│ ___________       _____________    _____________   ________  │
│ Name / Date       Name / Date      Name / Date     Name/Date │
├───────────────────────────────────────────────────────────────┤
│ MIN-000123 · Page 1/1 · Generated 2026-06-10 14:22 by user   │
│ Confidential – Internal Use · Source: Lyceum ERP             │
└───────────────────────────────────────────────────────────────┘
```

Standards followed:
- ISO 8601 dates (`YYYY-MM-DD`), 24-hour timestamps
- Document control footer (number, page x/y, generator, timestamp) on every page
- Four-signature block (Requester / HOD / Management / Receiver) for audit trail
- A4 portrait, 32pt margins, helvetica
- Currency / cost columns hidden (issue notes are non-monetary)
- QR code top-right encoding the MIN ID for traceability

### Technical implementation

**New file**: `src/utils/materialIssuePdfExport.ts`
- Exports `generateMaterialIssuePdf(issue, items, company, currentUser)` returning a `jsPDF` doc and `save()` helper.
- Uses already-bundled `jspdf` + `jspdf-autotable` (same stack as `src/lib/reports/pdfRenderer.ts`).
- Logo loaded from `company.logo_url` via `fetch → blob → dataURL`, sized to 60×60 px, with text fallback if missing/fails.
- Generates QR via existing `qrcode` lib (already in project) for `MIN:{id}` payload.

**New hook**: `src/hooks/useMaterialIssuePdf.ts`
- `downloadMaterialIssuePdf(issueId)` — fetches MIN, items, company (with logo) and approver display names via existing supabase queries, then invokes the generator. Shows toast on error.

**UI wiring**:
- `MaterialIssueDetailsDialog.tsx`: add Download icon button in `DialogHeader`, calls the hook with current `issue`/`items` already in state (no refetch needed).
- `MaterialIssueReturn.tsx`: add "Download PDF" item in the row's actions menu.

### Out of scope
- Email/share workflow (download only).
- Editable templates per company.
- Multi-language. (English only; future-ready via a template object.)
