## Problem

Bulk-generated QR labels show blank item code and item name (only the bin code "NGN" renders). Single-label QR works because it already reads from the catalog embed.

## Root cause

`src/components/warehouse/BinAllocationsTab.tsx` (lines 282–283) builds the bulk payload from the now-dropped mirrored columns:

```ts
item_code: a.warehouse_item?.item_code,
item_name: a.warehouse_item?.name,
```

Per the Stage 6b warehouse item master rule, item-master fields live only on `warehouse_item_catalog`. Everywhere else in this same file (sort comparator, table cells) already reads via `warehouse_item.catalog.item_code` / `catalog.name` with the legacy mirror as fallback — bulk print was missed.

## Fix

One-line edit in `BinAllocationsTab.tsx` `handleBulkPrint` to mirror the same fallback used by the table:

```ts
item_code:
  (a.warehouse_item as any)?.catalog?.item_code ??
  (a.warehouse_item as any)?.item_code ?? null,
item_name:
  (a.warehouse_item as any)?.catalog?.name ??
  (a.warehouse_item as any)?.name ?? null,
```

No changes to `bulkBinQRCodePdf.ts`, the GS1 payload builder, the RPC, or the QR layout. Single-label QR and on-screen table remain untouched.

## Verification

- Trigger "Bulk QR" on Bin Allocations and open the produced PDF — each label shows item code (top, monospace) and item name (below) alongside the bin code, matching the single-label `BinAllocationQRDialog` output.
- QR payload still encodes `01={item_code}` so scans resolve correctly.
