# Show LNPE stock under NCG's LNPE bin, owned by Lyceum Nugegoda Quarters

## Goal (confirmed)

In the **NCG Warehouse Solutions** inventory view, the LNPE location's bin should display the in-scope stock with **owner = Lyceum Nugegoda Quarters** (LNQ company). This is the SAP EWM "Party Entitled to Dispose" pattern: NCG **operates** the bin, LNQ **owns** the stock inside it.

## Scope (only the LNPE bin)

Only the single `LNPE` bin (`dfce7a5b…`) at the `LNPE` location (`a7d67f4c…`) is touched. Specifically the 143 allocations currently owned by the LNQ company (the 6 377.5 units highlighted in your screenshot). The 286 NCG-owned rows in the same bin stay as they are. No other LNQ items, bins, or warehouses are affected.

## Approach — reparent the LNPE location node, re-tag owner only

One data migration, no schema change, no synthetic stock movements.

1. **Reparent LNPE under LNQ, change operator to NCG**
   - `warehouse_locations` row `a7d67f4c…` (LNPE):
     - `parent_id = 6508ac11…` (Lyceum Nugegoda Quarters)
     - `company_id = 1c918a89…` (NCG Warehouse Solutions) — NCG is the operator
     - `type = 'sublocation'`
     - `is_standalone_warehouse = false`

2. **Keep stock ownership = Lyceum Nugegoda Quarters**
   - LNPE bin (`dfce7a5b…`) stays `is_shared = true`.
   - The 143 in-scope `warehouse_bin_allocations` keep `company_id = 11a46626…` (LNQ).
   - The 127 `warehouse_items` rows tagged to the LNQ company at LNPE keep that owner. Shared-bin triggers already allow this layout (multi-owner stock at an NCG-operated bin).

3. **No transfer transactions, no new bin codes, no FIFO/batch re-link.**

## What the user will see after the migration

- Header **Company = NCG Warehouse Solutions**, **Location = LNPE** (or **LNQ** rolled up):
  - LNPE bin rows appear with **Owner / Company column = "Lyceum Nugegoda Quarters"** for the 143 in-scope rows, exactly like your screenshot but with the company label flipped to LNQ.
  - The 286 NCG-owned rows in the same bin still show "NCG Warehouse Solutions".
  - A "Shared bin" badge stays on the bin chip (existing UI from the multi-owner work).
- Header **Company = Lyceum Nugegoda Quarters**: the same 143 rows are still visible to LNQ, because they own that stock.

## Verification (read-only)

- `warehouse_locations`: LNPE is a child of LNQ, `company_id = NCG`.
- `list_warehouse_inventory` with NCG + LNPE filter returns both owners' rows, with `company_id` reflecting the true stock owner per row.
- `enforce_bin_allocation_location_parity` trigger passes (shared bin exemption).
- Sum of `quantity` per (item, owner) unchanged for both companies.

## Why this is the international-standard answer

This is the textbook SAP EWM / WMS pattern:
- **Storage Bin → Party Entitled to Dispose** decouples *operator of the bin* from *owner of the stock*.
- No phantom goods movements are posted to record a paperwork change of custody.
- Audit trail and FIFO/batch lineage stay intact.
- Equivalent to GS1 LIM / IFRS 15 "control vs custody" separation for third-party warehousing.

## Technical detail

```sql
UPDATE public.warehouse_locations
   SET parent_id               = '6508ac11-b2d1-47ea-aa9f-c4fadde44c28',
       company_id              = '1c918a89-2370-4c10-aa07-3da6e8305d7d',
       type                    = 'sublocation',
       is_standalone_warehouse = false,
       updated_at              = now()
 WHERE id = 'a7d67f4c-7b06-4ce1-904c-a6097c0641a1';
```

No code changes required — the multi-owner shared-bin RPCs, list endpoints, and badges already render owner ≠ operator correctly.
