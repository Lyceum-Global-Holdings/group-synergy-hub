

## Standardize Auto-Generated Item Codes to Max 13 Characters

Align all auto-generated item codes with **GS1 GTIN-13** length (13 chars max) — the most widely used international barcode/material identifier standard, also recommended by SAP S/4HANA migrations and ISO/IEC 15459 (unique identification of transport units / items).

### Current state

| Module | Pattern | Example | Length | Compliant? |
|---|---|---|---|---|
| Warehouse | `INV-{CAT3}-{NNN}` | `INV-ELC-001` | 11 | ✅ Yes |
| Construction | `{CAT3}-{SUB3}-{NAME5}-{NNN}` | `MAC-HVY-EXCAV-001` | 17 | ❌ +4 over |

### Target — Construction (the only non-compliant generator)

New pattern: `{CAT3}-{SUB3}-{NAME2}-{NNN}` → e.g. `MAC-HVY-EX-001` = **14**… still over. We need to drop one separator.

**Final standard pattern: `{CAT3}{SUB3}-{NAME3}-{NNN}`** → `MACHVY-EXC-001` = **13 chars exactly.**

Breakdown (totals 13):
- `CAT3` (3) + `SUB3` (3) = 6-char compound group code (no internal separator)
- `-` (1)
- `NAME3` (3) — first 3 alphanumeric chars of cleaned item name, uppercase
- `-` (1)
- `NNN` (3) — zero-padded sequence

Examples:
- Heavy Excavator → `MACHVY-EXC-001`
- Power Drill (tools/power) → `TOLPWR-DRL-001`
- PPE Helmet (safety/ppe) → `SAFPPE-HLM-001`
- Cup Lock Standard (scaffolding/cup_lock) → `SCACPL-STN-001`

### Why these tradeoffs

- **Drop color from code** (already removed in current logic — keep that).
- **Compress NAME from 5→3 chars**: 3 chars + sequence still uniquely identifies up to 999 items per (category, sub-category, name-prefix) bucket — far more than typical site inventory needs. Collisions across different item names sharing the same 3-letter prefix are absorbed by the sequence number, which is already scoped per composite prefix in `useNextItemCode`.
- **Merge CAT+SUB into one 6-char block**: visually still reads as a group (`MACHVY`, `TOLPWR`) and matches SAP MM "Material Group" + sub-group flat encoding seen in S/4HANA short-code configurations.
- **Hyphen-delimited 3 segments**: GTIN-13 is 13 numeric, but for human-readable internal codes ISO/IEC 15459 explicitly allows alphanumeric within the 13-char budget. Hyphens improve scan-readability and are accepted by Code-128 / Code-39 barcodes.

### Sequence safety

Sequence stays at 3 digits (001–999). If a bucket ever exceeds 999, the existing `useNextItemCode` logic would silently roll into 4 digits (`1000`) and break the 13-char limit. Add a guard:

- When `nextNumber > 999`, throw a clear error: *"Sequence overflow for prefix MACHVY-EXC. Create a new item name to start a new sequence."* — surfaces the issue immediately in the toast rather than producing a 14-char code.
- This is the SAP-style "number range exhausted" pattern.

### Files modified

| File | Change |
|---|---|
| `src/types/construction-inventory.ts` | `abbreviateItemName(name)` — slice changes from `5` to `3`. Update inline comment. |
| `src/hooks/construction/useNextItemCode.ts` | Build composite prefix as `${catPrefix}${subCatCode}` (no hyphen between cat & sub) + `-${nameAbbr}`. Update regex accordingly. Add overflow guard: if `nextNumber > 999`, throw `Error("Sequence range exhausted for prefix …")`. Keep `staleTime: 0`. |
| `src/components/construction/inventory/AddItemDialog.tsx` | No code change needed — consumes `nextItemCode` as-is. |
| Memory: `mem://architecture/item-code-generation-standards` | Update construction pattern to `{CAT3}{SUB3}-{NAME3}-{NNN}` (13-char GS1-aligned standard) and note 999/bucket sequence cap. |

### What does NOT change

- **Existing item codes** in the database (no migration / rename). Old 17-char codes remain valid and untouched — uniqueness is per `(item_code, company_id)` so legacy + new codes coexist.
- Warehouse generator (`useNextWarehouseItemCode`) — already 11 chars, compliant.
- DB schema, RLS, item creation flow, manual override during edit.
- Sub-category codes, category prefixes, color options.

### Standards alignment

- **GS1 GTIN-13** — 13-character item identifier ceiling (global retail/logistics standard).
- **ISO/IEC 15459** — unique identification of items, allows alphanumeric.
- **SAP MM / S/4HANA** Material Group + short-code Material Number convention.
- Project memory: `item-code-generation-standards`, `item-code-multi-tenant-uniqueness`, `warehouse-category-code-mnemonic-standard`.

