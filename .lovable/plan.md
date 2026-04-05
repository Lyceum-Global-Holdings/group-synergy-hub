

## Auto-Generate Warehouse Item Codes: `INV-{Category}-XXX`

### Format
Following SAP MM material numbering standards, item codes will be auto-generated as:

```text
INV-ELC-001
INV-PLM-002
INV-RAW-015
```

- **INV** — Fixed prefix identifying warehouse inventory items
- **Category code** — 3-letter Level 1 category mnemonic (e.g., `ELC`, `PLM`, `RAW`)
- **XXX** — 3-digit zero-padded sequence number, auto-incremented per category within the company

### How it works
1. When the user selects a **Material Group (Level 1)** category, the system queries existing items in that company with the same `INV-{CAT}-` prefix
2. It finds the highest existing sequence number and increments by 1
3. The item code field is auto-filled and made **read-only** during creation (editable during edit for corrections)
4. If no category is selected yet, the field shows a placeholder "Select category to auto-generate"

### Changes

**1. Create `src/hooks/warehouse/useNextWarehouseItemCode.ts`**
- New hook that takes `categoryCode` and `companyId`
- Queries `warehouse_items` table for items matching `INV-{categoryCode}-%` pattern within the company
- Extracts max sequence number and returns next code
- Uses `@tanstack/react-query` with `staleTime: 0` for freshness

**2. Edit `src/components/warehouse/SingleItemForm.tsx`**
- Import and use the new hook, passing the selected category's `code` field
- Add `useEffect` to auto-fill `item_code` when the hook returns a value
- Make `item_code` input `readOnly` when creating (not editing)
- Add helper text: "Auto-generated (INV-{Category}-Sequence)"

**3. Edit `src/components/warehouse/CreateItemDialog.tsx`**
- Same changes as SingleItemForm: import hook, auto-fill, read-only field

### Files
1. `src/hooks/warehouse/useNextWarehouseItemCode.ts` — new
2. `src/components/warehouse/SingleItemForm.tsx` — edit
3. `src/components/warehouse/CreateItemDialog.tsx` — edit

