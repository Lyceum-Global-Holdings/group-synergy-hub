

# Auto-Generate Item Codes from Item Name, Category, Sub-Category, and Color

## Current State
- Item codes use a simple pattern: `{CATEGORY_PREFIX}-{SEQ}` (e.g., `MAC-001`, `TOL-002`)
- The `construction_item_master` table has **no `sub_category` or `color` columns**
- Categories: machines, tools, safety, equipment, scaffolding, others
- Sections (civil, mep, aluminium, mechanical, carpenter) exist but aren't used in codes

## Proposed Item Code Format (Industrial Standard)

**Pattern:** `{CAT}-{SUBCAT}-{NAME}-{COLOR}-{SEQ}`

Example: `MAC-EXC-CATERP-YLW-001`
- **CAT** (3 chars): Category prefix (MAC, TOL, SAF, EQP, SCA, OTH)
- **SUBCAT** (3 chars): First 3 letters of sub-category, uppercased
- **NAME** (3-6 chars): Abbreviated item name (first consonants or first chars)
- **COLOR** (3 chars): Abbreviated color code (RED, BLU, YLW, BLK, WHT, GRN, etc.)
- **SEQ** (3 digits): Auto-incremented sequence per unique prefix combination

Example codes:
- Excavator, Machines, Heavy, Yellow → `MAC-HVY-EXCAV-YLW-001`
- Safety Helmet, Safety, PPE, White → `SAF-PPE-SAFHE-WHT-001`
- Drill Machine, Tools, Power, Red → `TOL-PWR-DRILL-RED-001`

## Changes Required

### 1. Database Migration
- Add `sub_category` (text, nullable) column to `construction_item_master`
- Add `color` (text, nullable) column to `construction_item_master`
- Create a Postgres function `generate_construction_item_code(category, sub_category, item_name, color, company_id)` that:
  - Builds the prefix from the 4 components
  - Queries for existing max sequence with that prefix
  - Returns the next code

### 2. Update Types (`src/types/construction-inventory.ts`)
- Add `sub_category: string | null` and `color: string | null` to `ConstructionItemMaster` interface
- Add sub-category constants per category (e.g., machines → Heavy, Light, Lifting; tools → Power, Hand, Measuring; safety → PPE, Fire, Signage; etc.)
- Add standard color options (Red, Blue, Yellow, Black, White, Green, Orange, Grey, Silver, Multi)

### 3. Update Add Item Dialog (`src/components/construction/inventory/AddItemDialog.tsx`)
- Add `sub_category` select field (options filtered by selected category)
- Add `color` select/input field
- Make `item_code` auto-generated on the fly as user fills in category, sub-category, item name, and color
- Item code field remains **read-only** (displayed but not editable)

### 4. Update `useNextItemCode` Hook (`src/hooks/construction/useNextItemCode.ts`)
- Change signature to accept `(category, subCategory, itemName, color)` instead of just `category`
- Build composite prefix from all 4 components
- Query existing codes with that prefix pattern to determine next sequence number
- Only activate query when all required fields are filled

### 5. Update Item Master Views
- Display sub-category and color columns in `ItemMasterView.tsx` table
- Add sub-category and color as filter options

## Files to Modify

| File | Change |
|------|--------|
| New migration SQL | Add `sub_category` and `color` columns |
| `src/types/construction-inventory.ts` | Add fields, sub-category constants, color constants |
| `src/hooks/construction/useNextItemCode.ts` | Accept all 4 inputs, build composite code |
| `src/components/construction/inventory/AddItemDialog.tsx` | Add sub-category and color fields, wire up auto-code |
| `src/components/construction/inventory/ItemMasterView.tsx` | Display new columns |

