## Goal

Add an Excel-like bulk **Item Master** creation grid inside the **Item Master** tab (`ItemMasterDefinitionTab` on `/warehouse/item-bin-master`), with paste-from-Excel support and an **auto-classifier** that suggests **Category** and **UoM** from item names using international standards (UNSPSC for category families, UN/CEFACT Recommendation 20 for UoM codes). **Item code is auto-generated but editable** per row.

## Where it plugs in

`src/components/warehouse/ItemMasterDefinitionTab.tsx` toolbar — new button **"Bulk create items"** placed next to the existing **"Add Item"** button (around line 333).

Writes to `warehouse_item_catalog` only (true master). Stock / location / bin allocation stays in the Inventory "Bulk add from catalog" flow.

## UX

Bottom sheet, same shell pattern as `BulkCatalogToInventoryDialog`:

```text
┌─ Toolbar ──────────────────────────────────────────────────────────────┐
│ [+ Add 10 rows] [📋 Paste names] [✨ Auto-classify all]   ✓ N valid    │
├─ Grid ─────────────────────────────────────────────────────────────────┤
│ # │ Name* │ Description │ Category* │ UoM* │ Brand │ Item code │ Status│
└────────────────────────────────────────────────────────────────────────┘
```

- **Paste names** dialog: textarea, one item per line; or paste TSV (name⇥description⇥brand…) directly into the grid (first column = name).
- On paste / on blur of Name → row auto-fills Category + UoM via the classifier with a ✨ "suggested" hint. User can override from a searchable select.
- **Item code** column:
  - Auto-generated as soon as Category is set, using existing `allocateAutoCodes` logic — format `INV-{CAT}-{NNN}` per `mem://architecture/item-code-generation-standards`.
  - **Editable text input** — the user can overwrite the suggested code at any time.
  - A small **"Auto"** badge is shown when the value matches the auto-generated suggestion; the badge disappears once the user edits it (becomes "Custom"). A 🔄 reset icon restores the auto value.
  - When Category changes after a manual edit, the user's custom code is preserved (no surprise overwrite); the reset icon stays available.
  - Live validation: format check, in-tenant duplicate check against `warehouse_item_catalog`, plus dedupe against other rows in the grid. Errors shown inline on the row.
  - On submit, blank or still-auto cells are finalised through `allocateAutoCodes` so concurrent rows get unique sequence numbers.
- Inline validation: name required, category required, UoM required, item code unique. Row status badges (Pending / Valid / Invalid / Imported).
- Submit calls existing `bulkCreateItemsAsync` from `useWarehouseItemCatalog`. No new RPC, no schema change.
- On success, invalidate via `useInvalidateWarehouseStock`.

## Auto-classifier (international standards)

Pure client-side, deterministic, zero-network — `src/lib/itemMaster/autoClassify.ts`.

1. **UoM detection — UN/CEFACT Recommendation 20**
   - Regex pass: `8W`, `230V`, `1.5mm`, `10kg`, `500ml`, `2m`, `pack of 10`, `box`, `roll`, `pair`, `set`, `pcs/nos/each`.
   - Map to UN/CEFACT codes: `EA`/`H87` (each/piece), `MTR` (metre), `KGM` (kilogram), `LTR` (litre), `MMT` (millimetre), `PR` (pair), `SET` (set), `BX` (box), `RO` (roll), `PK` (pack), `GRM` (gram).
   - Resolve to closest tenant UoM via `useItemUnits` (case-insensitive `abbreviation` match); fallback `PCS`/`EA`.

2. **Category detection — UNSPSC-aligned keyword dictionary**
   - Keyword → UNSPSC family seed table for construction / MEP / IT / consumables / safety / hardware (e.g. `led|ceiling|recessed|bulb|switch|socket|breaker|cable|conduit` → *Electrical & Lighting* / UNSPSC 39).
   - Tokenise the name, score against keyword sets, pick highest-scoring family.
   - Resolve to a real tenant `item_categories` row by case-insensitive name match. If none exists, surface the suggested UNSPSC family name as a row warning and leave Category empty — **no silent category creation** (respects `mem://architecture/item-category-depth-cap`).

3. **Confidence display**
   - High (UoM token hit + ≥2 category keywords): solid ✨.
   - Low (single weak token): muted ✨ with tooltip "suggested — please confirm".
   - None: blank, user picks.

4. **Unit tests** (`src/lib/itemMaster/__tests__/autoClassify.test.ts`)
   - "LED ceiling recessed 8W" → *Electrical & Lighting*, *EA*, high.
   - "PVC conduit 25mm 3m" → *MTR*, *Electrical*.
   - "Portland cement 50kg" → *KGM*, *Construction materials*.
   - "Thinner 1L" → *LTR*.
   - Gibberish → empty, no crash.

## File plan

New
- `src/components/warehouse/bulk-item-master/BulkItemMasterDialog.tsx` — sheet + grid.
- `src/components/warehouse/bulk-item-master/PasteNamesDialog.tsx` — textarea paste.
- `src/components/warehouse/bulk-item-master/useBulkItemMaster.ts` — row state, validation, auto-code preview + manual override + reset, submit via `bulkCreateItemsAsync`.
- `src/components/warehouse/bulk-item-master/types.ts`.
- `src/lib/itemMaster/autoClassify.ts` — classifier (UNSPSC keyword dict + UN/CEFACT UoM map).
- `src/lib/itemMaster/__tests__/autoClassify.test.ts`.

Edited
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` — add **Bulk create items** button next to **Add Item** and mount the dialog (lazy-loaded).

Memory
- `mem://features/warehouse/bulk-item-master` — grid lives in Item Master, classifier rules (UNSPSC + UN/CEFACT), item code auto-generated via `allocateAutoCodes` but **manually editable** per row with Auto/Custom badge and reset, never auto-create categories.

## Out of scope

- No DB migration, no new RPC, no schema change.
- No automatic category creation; suggestions only.
- No backend AI call — classifier is offline / deterministic.
- Stock / location / bin allocation stays in the Inventory "Bulk add from catalog" flow.

## Deliverable

5 new files, 1 edited component, 1 memory entry, 1 test file. Zero schema changes.