

## Auto-Generate Item Codes During Bulk Upload (Aligned with Single-Item Standard)

### Problem
The bulk CSV importer (`BulkItemImportDialog.tsx`) **requires** `item_code` in every row (line 206-211: "Item code is required"). Single-item creation (`SingleItemForm` / `CreateItemDialog`) auto-generates codes via `useNextWarehouseItemCode` using the format `INV-{CAT3}-{NNN}` (per `mem://architecture/item-code-generation-standards` and the 3-letter ISO 7372 / SAP MM mnemonic standard).

This inconsistency means bulk uploads fail when the column is blank.

### International Standards Alignment
- **GS1 SKU Identification** — every item must have a unique, deterministic identifier
- **ISO 8000-110** (Master Data Quality) — codes must follow a documented, repeatable pattern
- **ISO 7372 / SAP MM** — already used for the 3-letter category mnemonic
- **Existing project standard** — `INV-{CAT}-{NNN}` zero-padded 3-digit sequence, scoped per `(category, company_id)`

### Solution

Make `item_code` **optional** in the CSV. When blank, auto-generate using the same standard as the single-item form, with **batch-aware sequencing** to prevent collisions within a single upload.

### Files Modified

**1. `src/utils/itemCodeGenerator.ts`** *(new)* — extract reusable generator
```ts
// Given category code, company_id, and the count already taken in this batch,
// query the DB once for the current max sequence, then return codes
// INV-{CAT}-{NNN} starting from max+1.
export async function allocateItemCodes(
  categoryCode: string,
  companyId: string,
  count: number
): Promise<string[]>
```
- Single DB query per category per batch (efficient for large CSVs)
- Returns `count` sequential codes
- Reuses the exact prefix logic from `useNextWarehouseItemCode`

**2. `src/components/warehouse/BulkItemImportDialog.tsx`**
- **CSV template**: mark `item_code` column as *optional* in the description; sample row leaves it blank
- **Parser (line 204-211)**: if `item_code` blank, set a flag `needsCode: true` instead of pushing an error
- **Pre-import allocation step** (new, before line 433 `bulkCreateItemsAsync`):
  1. Group rows needing codes by `(category_id, company_id)`
  2. For each group, resolve category → 3-letter `code`, call `allocateItemCodes(catCode, companyId, groupCount)`
  3. Assign returned codes back to the corresponding rows
  4. Re-run duplicate check (CSV-internal + DB) on the now-fully-populated set
- **Validation guard**: if a row has no `category_id` AND no `item_code`, raise a clear error: *"Item code is required when category is missing — provide one or set a valid category for auto-generation"*
- **Preview table**: show generated codes with a small "Auto" badge so users can verify before clicking Import

**3. UX touches in the dialog header**
- Add an info Alert: *"Leave `item_code` blank to auto-generate codes following the standard `INV-{CATEGORY}-{SEQUENCE}` (GS1 / ISO 8000-110)."*

### Why this approach
- **Zero schema change** — purely client-side; no DB trigger needed (and avoids the recursive-auth pitfall of `SECURITY DEFINER` triggers on a multi-tenant table)
- **Deterministic & predictable** — codes match exactly what the single-item form would produce
- **Batch-safe** — sequence is allocated once per category per upload, no race conditions within the batch
- **Backward compatible** — users who *do* provide `item_code` in the CSV retain full control
- **Standards-compliant** — follows the documented `INV-{CAT}-{NNN}` pattern already in `mem://architecture/item-code-generation-standards`

### Edge Cases Handled
| Scenario | Behavior |
|---|---|
| Row has `item_code` and `category` | Use provided code (current behavior) |
| Row has `category` only | Auto-generate `INV-{CAT}-{NNN}` |
| Row has neither | Hard error with clear message |
| Two rows same category, both blank | Get sequential codes (e.g. `-005`, `-006`) |
| Race vs. another user uploading | Final DB unique constraint catches it; user sees existing duplicate error message |

### Files
| File | Change |
|---|---|
| `src/utils/itemCodeGenerator.ts` | NEW — batch-aware code allocator |
| `src/components/warehouse/BulkItemImportDialog.tsx` | Make `item_code` optional, allocate codes pre-import, add info alert + Auto badge |

