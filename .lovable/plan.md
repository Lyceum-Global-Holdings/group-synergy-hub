## Goal
Auto-generate batch (lot) codes when receiving stock via GRN, following international standards so the codes are globally unique, traceable, and GS1-compatible.

## Standard chosen
**GS1 Application Identifier (10) — Batch/Lot Number**
- Up to 20 chars, alphanumeric (A–Z, 0–9, plus `-` `/` `.`)
- Must be unique within a given GTIN/item
- Recommended structure also aligns with **ISO 22005** (traceability) and **FDA 21 CFR 211.130** (lot identification): supplier + date + sequence

### Format
```
LOT-{ITEMCODE}-{YYJJJ}-{NNNN}
```
- `LOT` — fixed prefix (clear human label)
- `ITEMCODE` — item's `item_code` (already GS1-derived, e.g. `INV-RAW-001`); collapsed to alphanumeric
- `YYJJJ` — 2-digit year + Julian day (ISO 8601 ordinal date, 5 chars, sortable, compact)
- `NNNN` — zero-padded daily sequence per (company, item, day)

Example: `LOT-INVRAW001-26134-0007` (24 chars total — within GS1 20-char limit when item code is short; we trim ITEMCODE to keep total ≤ 20 when needed by hashing the tail).

### Why this format
- **Unique per item** (satisfies GS1 AI 10 rule).
- **Sortable & human-readable** (date embedded).
- **Deterministic regeneration impossible** without server — prevents collisions across concurrent GRNs.
- **Audit-friendly** — date and sequence are visible.

## Implementation

### 1. Database (migration)
Create `generate_batch_number(_company_id uuid, _item_id uuid, _item_code text)` RPC:
- `SECURITY DEFINER`, `search_path = public`
- Computes `YYJJJ` from `now()` at company timezone (fallback UTC)
- Locks per (company_id, item_id, day) using advisory lock to serialize sequence allocation
- Reads max existing `NNNN` from `warehouse_batches.batch_code` matching prefix → returns next
- If `ITEMCODE` would push total > 20 chars, truncates to 8 + 3-char base36 hash

Add unique index:
```sql
create unique index if not exists warehouse_batches_company_item_code_uk
  on public.warehouse_batches (company_id, item_id, batch_code);
```
(no-op if it already exists; verify column names against current schema before applying).

### 2. GRN dialog (`CreateGrnDialog.tsx`)
- Replace local `generateBatchNumber()` with an async call to the new RPC.
- Auto-fill `batch_number` on row add for batch-tracked items (so user sees it immediately, can override).
- Keep the "regenerate" button but route it through the RPC.
- Read-only styling + tooltip: "Auto-generated GS1-compatible lot code. Edit only if supplier provides their own."

### 3. GRN approval (`useGoodsReceiptNotes.ts`)
- On approval, if `batch_number` is still empty for a batch-tracked item, call RPC server-side fallback before insert into `warehouse_batches` / `stock_transactions`.
- Persist supplier-provided lot codes verbatim (don't overwrite user input).

### 4. Validation
- Client regex: `^[A-Z0-9./-]{1,20}$` (GS1 AI 10 character set).
- Show inline error if user-edited code violates the rule.

## Out of scope
- Migrating existing batch codes (legacy codes remain as-is).
- Printing GS1-128 / DataMatrix labels with AI (10) — separate label-printing work.
- Per-supplier lot-code overrides workflow.

## Files to touch
- New migration: `generate_batch_number` RPC + unique index
- `src/components/warehouse/CreateGrnDialog.tsx` — async generator, auto-fill, validation
- `src/hooks/useGoodsReceiptNotes.ts` — server-side fallback on approval
- New: `src/hooks/useGenerateBatchNumber.ts` (mutation wrapper, mirrors `useSrnNumber.ts`)
