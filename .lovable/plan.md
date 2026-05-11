## Bin-Item QR Code Generation

Generate a scannable QR code for every (item × bin × location) allocation in `warehouse_bin_allocations`, following international standards (ISO/IEC 18004 QR Code + GS1 Digital Link URI syntax) and reusing the existing public-asset QR pattern.

### What you get

1. **Per-row "QR" button** on `ItemBinMaster` — opens a dialog with the rendered QR + Download PNG + Print 2×1″ label.
2. **"Bulk QR" button** with filters (location, bin, item, status) — generates a multi-page PDF of 2×1″ labels (one per allocation) and an A4 grid PNG sheet.
3. **Public scan target** `https://stores.lgh.lk/b/{allocation_id}` — opens a no-login page showing item code/name, bin code, location, company, current allocated qty, last-updated time. Sensitive fields (cost, supplier, customers) are never exposed.

### Standards applied

- **ISO/IEC 18004** QR Code, error-correction level **M** (15%), quiet zone 4 modules, byte mode UTF-8 — same as existing `AssetQRCode`.
- **GS1 Digital Link URI Syntax v1.4** — payload is a resolvable HTTPS URL so it works in any standard QR scanner, GS1 scanner, or camera app (no custom-app required).
- **GS1 Application Identifiers** embedded as query parameters for offline readability:
  - `01` = item GTIN (falls back to internal `item_code` when no GTIN is registered)
  - `254` = bin code (GLN extension)
  - `91` = company internal code
  - Example: `https://stores.lgh.lk/b/{uuid}?01={item_code}&254={bin_code}&91={company_code}`
- **Print spec**: 2″×1″ landscape label at 300 DPI (matches existing asset labels for printer compatibility).

### Technical sections

**Database (1 migration)**

- `public.get_public_bin_allocation_qr(p_id uuid) returns jsonb` — `SECURITY DEFINER`, `search_path = public`, returns only safe fields by joining `warehouse_bin_allocations → warehouse_items → warehouse_bins → warehouse_locations → companies`. `GRANT EXECUTE TO anon, authenticated`. Mirrors the existing `Public Asset QR` pattern from memory.
- Index `idx_warehouse_bin_allocations_company_bin (company_id, bin_id)` to keep bulk queries fast.

**Frontend**

- `src/utils/binQRPayload.ts` — builds the GS1 Digital Link URL.
- `src/utils/bulkBinQRCodePdf.ts` — mirrors `bulkQRCodePdf.ts`; renders QR + 3-line label (item code, bin code, location code) per page.
- `src/utils/bulkBinQRCodePng.ts` — A4 grid sheet (4 cols × 10 rows) for sticker paper.
- `src/components/warehouse/BinItemQRCode.tsx` — single-allocation dialog (download/print).
- `src/components/warehouse/BulkBinQRDialog.tsx` — filter form + preview + generate.
- `src/pages/warehouse/ItemBinMaster.tsx` — add per-row QR action and top-bar "Bulk QR" button.
- `src/pages/PublicBinAllocation.tsx` + route `/b/:id` in `src/App.tsx` (public, no `ProtectedRoute`). Calls the new RPC via the anon Supabase client.

**Hook**

- `src/hooks/warehouse/useBulkBinQR.ts` — fetches allocations honoring filters, batches in 1000-row pages (per memory `warehouse-data-batching-limit`).

### Out of scope (ask later if needed)

- ZPL/EPL native printer streams (current PDF works on any printer).
- Real GS1 GTIN registration / company prefix licensing — we fall back to internal codes.
- Cycle-count scanning workflow (QR is read-only resolver here).

### Verification

- Scan generated QR with iPhone/Android camera → opens public page with correct item/bin/location.
- Bulk PDF for 50 allocations renders 50 pages, each with sharp QR (no blur at 100% print).
- Public page returns 404 for non-existent UUID and never leaks cross-tenant data.
