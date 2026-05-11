---
name: bin-allocation-qr
description: Per-allocation QR labels (item × bin × location) using GS1 Digital Link payload, public RPC resolver
type: feature
---

Each row in `warehouse_bin_allocations` can be turned into a printable QR label.

- Payload: `https://stores.lgh.lk/b/{allocation_id}?01={item_code}&254={bin_code}&91={location_code}` (GS1 Digital Link URI Syntax v1.4; AIs `01`, `254`, `91`).
- QR settings: ISO/IEC 18004, ECC level **M** (15%), margin 1–2, byte mode UTF-8 (matches existing `AssetQRCode` so labels print on the same 2"×1" stock).
- Public route `/b/:id` (no auth) calls SECURITY DEFINER RPC `public.get_public_bin_allocation_qr(p_id uuid)`. RPC returns ONLY: item code/name, bin code/name, location name/code, company name, allocated qty, available qty, updated_at. Never expose cost, supplier, notes.
- UI: `BinAllocationsTab` → per-row `QrCode` button opens `BinAllocationQRDialog` (download PNG / copy URL); top-bar "Bulk QR" button generates a multi-page PDF via `generateBulkBinQRCodePdf` over the currently filtered list.
- Index `idx_warehouse_bin_allocations_company_bin (company_id, bin_id)` keeps bulk fetches fast.
