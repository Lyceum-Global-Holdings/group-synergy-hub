
Goal: eliminate the `warehouse_items_item_code_company_id_key` crash during bulk import by catching all same-company `item_code` conflicts before any DB insert.

What I found
- The failure happens in `BulkItemImportContent.tsx` during `bulkCreateItemsAsync(...)` (confirmed by console trace).
- Current validation checks DB conflicts for `new` rows, but it does not fully prevent insert-time collisions inside the import batch itself.
- This is why preview can still look valid, but import fails atomically with a unique-constraint error.

Implementation plan

1) Reintroduce strict CSV `item_code` collision validation (same company)
- File: `src/components/warehouse/BulkItemImportContent.tsx`
- Add normalized code helper (`trim + lowercase`) and build per-company code maps during parse.
- Detect duplicate `item_code` values within the CSV for the target company and mark later rows as `error` (same behavior pattern already used for duplicate names/SKUs).
- Keep current behavior of allowing the first valid row and skipping conflicting later rows.

2) Strengthen DB conflict checks with deterministic indexing
- In parse flow, precompute `targetCompanyItems` once (outside per-row loop) and build a `Set` for existing codes.
- Validate `new` rows against this set (same-company only), consistently using normalized code values.
- Keep name-based global detection logic as-is for existing item matching, but make code conflict checks strictly company-scoped.

3) Add a final pre-import safety gate before `bulkCreateItemsAsync`
- In `handleImport`, before insert:
  - Re-check `newItems` for duplicate normalized `item_code` values.
  - Re-check `newItems` against current selected-company DB codes.
- If conflicts exist, do not call insert; update row errors in `parsedData`, set those rows to `error`, and show a clear toast like “X item codes conflict in this company”.

4) Improve user-facing error mapping (fallback protection)
- File: `src/hooks/useWarehouseItems.ts`
- Extend constraint parsing to include `warehouse_items_item_code_company_id_key` so users see a friendly message instead of raw Postgres text if a conflict ever slips through.

Technical details
- Primary file: `src/components/warehouse/BulkItemImportContent.tsx`
  - Add normalized keying (`code + companyId`) for all code uniqueness checks.
  - Add lightweight preflight guard in `handleImport` to prevent atomic insert failure.
- Secondary file: `src/hooks/useWarehouseItems.ts`
  - Add explicit message mapping for `warehouse_items_item_code_company_id_key`.
- No DB schema/RLS migration needed.

Acceptance checks
- Import CSV with two new rows sharing same `item_code` in selected company:
  - Preview shows one as error, import proceeds without DB crash.
- Import CSV where `item_code` already exists in selected company:
  - Row marked error, no insert crash.
- Import CSV with valid unique codes:
  - Successful import and confirmation summary remains intact.
