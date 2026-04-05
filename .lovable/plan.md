

## Add Comprehensive Standard Categories to Import Dialog

### Current State
The `standardCategories.ts` file has 3 industry templates: **Apparel**, **Construction**, **Stationery**. The user wants all standard warehouse categories covered based on international standards (UNSPSC / ISO 22742).

### Categories to Add (9 new industry templates)

1. **Manufacturing** — Raw materials, chemicals, packaging materials, MRO supplies
2. **IT & Electronics** — Hardware, networking, peripherals, cables, components
3. **Automotive** — Parts, fluids, tires, accessories, body parts
4. **Food & Beverage** — Dry goods, refrigerated, frozen, beverages, packaging
5. **Healthcare & Pharma** — Medicines, medical devices, lab supplies, PPE, consumables
6. **Hospitality** — Linen, amenities, kitchen supplies, cleaning, furniture
7. **Agriculture** — Seeds, fertilizers, pesticides, tools, irrigation, animal feed
8. **Logistics & Packaging** — Boxes, pallets, tape, stretch wrap, labels, containers
9. **General Warehouse** — Cleaning supplies, maintenance, safety, office consumables, fuel

Each template follows the same 3-level hierarchy (category → subcategory → sub-subcategory) with ISO 7372-aligned 3-letter codes.

### UI Changes

**`ImportCategoriesDialog.tsx`**:
- Change `TabsList` from `grid-cols-3` to a scrollable horizontal layout to accommodate 12 tabs
- Add icons for each new industry (using existing Lucide icons)
- No other dialog changes needed — the existing rendering logic handles any number of templates

### Files to Edit
1. `src/constants/standardCategories.ts` — Add 9 new industry templates (~400 new categories total)
2. `src/components/warehouse/ImportCategoriesDialog.tsx` — Update tab layout to scroll horizontally, add icons for new industries

