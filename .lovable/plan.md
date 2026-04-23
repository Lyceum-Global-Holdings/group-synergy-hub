

## Tool Master — Import from Item Master + Hierarchical Tool Categories

Bring Tool Management in line with the rest of the warehouse module: source tools from Item Master items already categorized as **Hand Tools** or **Power Tools** (and their Level 1 children), and use the same Level 0 + Level 1 category dropdown pattern used in the Item form / Inventory filter.

### What's wrong today

1. `CreateToolDialog`, `EditToolDialog`, `BulkToolImportDialog` all read categories from **`asset_categories`** — the wrong table. Hand Tools / Power Tools live in **`item_categories`** (TOO-HND, TOO-PWR + children).
2. Category dropdowns are flat — no parent/child distinction.
3. There is no way to import an existing Item Master item into Tool Master. Tools must be created from scratch, duplicating data already in `warehouse_items`.
4. `ToolsInventoryTab` builds the category filter from in-memory tool data only — no hierarchy.

### Goal

- **Categories**: Tools use `item_categories`, restricted to the **Tools subtree** (TOO-HND, TOO-PWR + their Level 1 children). Dropdown shows Level 0 + Level 1 with indentation, matching `SingleItemForm` / `ItemMasterDefinitionTab`.
- **New flow**: "Import from Item Master" — pick existing `warehouse_items` whose category is in the Tools subtree, convert them into `warehouse_tools` rows in one click. International standard pattern (SAP MM "Material → Equipment" promotion).
- Single Add and Bulk CSV Add remain available; CSV category lookup also uses `item_categories`.

### Implementation

#### 1. DB migration — point tools at item_categories

```sql
ALTER TABLE warehouse_tools
  DROP CONSTRAINT warehouse_tools_category_id_fkey,
  ADD  CONSTRAINT warehouse_tools_category_id_fkey
       FOREIGN KEY (category_id) REFERENCES item_categories(id) ON DELETE SET NULL;
```
- Existing 9 Hand-Tool rows already reference `item_categories` IDs (verified via DB), so no data backfill needed.
- Update generated types after migration.

#### 2. Shared helper — Tools subtree resolver

New file `src/features/tools/lib/toolCategories.ts`:
```ts
// Returns Level 0 (TOO-HND, TOO-PWR) + their Level 1 children, flattened with depth
export function buildToolCategoryOptions(categories: ItemCategory[]) {
  const ROOT_CODES = ['TOO-HND', 'TOO-PWR'];
  const roots = categories.filter(c => ROOT_CODES.includes(c.code ?? ''));
  const result: Array<{ category: ItemCategory; depth: 0 | 1 }> = [];
  roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(root => {
    result.push({ category: root, depth: 0 });
    categories
      .filter(c => c.parent_id === root.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(child => result.push({ category: child, depth: 1 }));
  });
  return result;
}
export function isToolCategoryId(id: string, categories: ItemCategory[]) {
  return buildToolCategoryOptions(categories).some(o => o.category.id === id);
}
```

#### 3. Replace `asset_categories` queries with `useItemCategories` + Tools filter

In `CreateToolDialog`, `EditToolDialog`, `BulkToolImportDialog`:
- Drop the `useQuery(['asset-categories'])` blocks.
- Use `const { allCategories } = useItemCategories(selectedCompany?.id)` (already exposes Level 0 + 1).
- Render dropdown via `buildToolCategoryOptions(allCategories)` with the indentation/`└` style:
  ```tsx
  {options.map(({ category, depth }) => (
    <SelectItem key={category.id} value={category.id}>
      <span className={depth === 1 ? 'pl-4 text-muted-foreground' : 'font-medium'}>
        {depth === 1 ? '└ ' : ''}{category.code ? `[${category.code}] ` : ''}{category.name}
      </span>
    </SelectItem>
  ))}
  ```
- For the bulk-import CSV, lookup is `option.category.name === row.category` (case-insensitive) over the same Tools subtree, with a clear error message: *"Category 'X' is not a Tools category. Allowed: Hand Tools, Power Tools, or their sub-categories."* Update the template's example rows accordingly (`Hammers`, `Drills`, etc.).

#### 4. New "Import from Item Master" dialog

New file `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` (modeled on `AddFromCatalogDialog`):
- Lists `warehouse_items` for the selected company whose `category_id` is in the Tools subtree.
- Columns: checkbox, item code, name, category (with hierarchy badge), unit, current stock, suggested initial qty.
- Search box + category filter (same Level 0/1 dropdown).
- Hides items already promoted into `warehouse_tools` (match by `item_code` within company).
- On confirm: bulk-insert `warehouse_tools` rows with:
  ```ts
  {
    tool_code: item.item_code,            // reuse existing code
    name: item.item_name,
    description: item.description,
    category_id: item.category_id,         // already a tool category
    unit_id: item.unit_id,
    location_id: defaultLocation,          // from header location context
    total_quantity: form.initial_qty,      // user-set per row, default = current_stock
    available_quantity: form.initial_qty,
    issued_quantity: 0,
    condition: 'good',
    unit_cost: item.unit_cost,
    company_id: selectedCompany.id,
  }
  ```
- Uses `useWarehouseTools().createBulkTools` (already exists).

#### 5. Wire into `ToolManagement` page header

Update the **Add Tool** dropdown:
```text
Add Tool ▾
├── Add Single Tool
├── Import from Item Master   ← new (primary action, top of menu)
└── Bulk Import from CSV
```

#### 6. `ToolsInventoryTab` filter

Switch the category filter to use the same `buildToolCategoryOptions` (id-based, indented) — value is category id, not name. Removes the in-memory uniqueness hack and matches `ItemMasterDefinitionTab` behavior.

### Files

| File | Change |
|---|---|
| `supabase/migrations/<ts>_warehouse_tools_item_categories_fk.sql` | Repoint FK to `item_categories` |
| `src/integrations/supabase/types.ts` | Regenerate after migration |
| `src/features/tools/lib/toolCategories.ts` | New — `buildToolCategoryOptions`, `isToolCategoryId` |
| `src/components/warehouse/tools/CreateToolDialog.tsx` | Use item_categories + hierarchical dropdown |
| `src/components/warehouse/tools/EditToolDialog.tsx` | Same |
| `src/components/warehouse/tools/BulkToolImportDialog.tsx` | Same + update template + Tools-subtree CSV validation |
| `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx` | New — promote Item Master items to tools |
| `src/components/warehouse/tools/ToolsInventoryTab.tsx` | Hierarchical, id-based category filter |
| `src/pages/warehouse/ToolManagement.tsx` | Add "Import from Item Master" menu entry + state |

### What does NOT change
- `warehouse_tools` data, RLS, issue/return/adjustment flows.
- Item Master / catalog logic.
- Brand, design tokens, layout.

### Standards alignment
- **SAP MM** Material → Equipment promotion pattern (reuse master data, don't duplicate).
- **ISO 55000** asset master data principles — single source of truth per tool.
- Project memory: `item-code-multi-tenant-uniqueness`, `warehouse-category-code-mnemonic-standard`, `shared-foundational-components`, `form-data-normalization`.

