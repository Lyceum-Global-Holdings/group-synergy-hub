

## Auto-Generate 3-Letter Category Codes (ISO 7372 / UNSPSC Aligned)

### Standard
ISO 7372 Trade Data Element Directory and UNSPSC use **3-letter mnemonic abbreviations** for material group codes (e.g., `ELC` for Electronics, `PLB` for Plumbing, `RAW` for Raw Materials). SAP MM also uses 3-character material group keys.

### How Code Generation Works

When the user types a category name, the system auto-generates a 3-letter code:

1. **Primary rule**: First 3 consonants of the name, uppercased (e.g., "Electronics" → `ELC`, "Plumbing" → `PLM`, "Safety Equipment" → `SFT`)
2. **Fallback**: If fewer than 3 consonants, use first 3 letters (e.g., "Oil" → `OIL`)
3. **Collision handling**: If the generated code already exists among sibling categories, append/increment the last character (e.g., `ELC` taken → `ELD`)
4. **Editable override**: The field auto-fills but remains editable so users can manually set a preferred code
5. **Validation**: Enforces exactly 3 uppercase letters, shows error if not met

### Sub-category codes
Sub-categories inherit the parent code as a prefix: `ELC-CMP` (Electronics → Components). The sub-category gets its own 3-letter code appended with a hyphen.

### Files to Edit

**1. `src/components/warehouse/CreateCategoryDialog.tsx`**
- Add `generateCategoryCode(name, existingCodes)` helper function
- Add `useEffect` on `formData.name` changes to auto-generate code
- Add validation (3 uppercase letters, uniqueness check)
- Add tooltip explaining "Auto-generated ISO 7372 category code"
- For sub-categories, prepend parent code with hyphen separator

### No new files needed — all logic fits within the existing dialog component.

