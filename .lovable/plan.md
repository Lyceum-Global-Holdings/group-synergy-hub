

## Show Both Level 0 and Level 1 Categories in Item Form

### Current behavior
- Field is labeled **"Material Group (Level 1)"** and only shows top-level categories (those with no `parent_id`).
- Level 1 children (e.g. `[CLO-MEN-SHT] Shirts` under `[CLO] Clothing`) are not selectable.
- Other categories already exist in the dropdown as Level 1 because the data isn't strictly hierarchical — but visually nothing distinguishes parents from children.

### Goal
- Rename field to **"Category"** (per request — "material type should be category").
- Show **Level 0 (parents)** AND **Level 1 (direct children of a Level 0)**.
- Group visually so users can tell hierarchy at a glance.

### Implementation

**File:** `src/components/warehouse/SingleItemForm.tsx`

1. **Replace `topLevelCategories` memo** with a structured list that includes both levels:
   ```ts
   const categoryOptions = useMemo(() => {
     const level0 = categories.filter(c => !c.parent_id);
     const result: Array<{ category: ItemCategory; depth: 0 | 1 }> = [];
     level0
       .sort((a, b) => a.name.localeCompare(b.name))
       .forEach(parent => {
         result.push({ category: parent, depth: 0 });
         categories
           .filter(c => c.parent_id === parent.id)
           .sort((a, b) => a.name.localeCompare(b.name))
           .forEach(child => result.push({ category: child, depth: 1 }));
       });
     return result;
   }, [categories]);
   ```

2. **Update label and dropdown render** (line 408-422):
   - Label → `Category` (drop "(Level 1)" suffix and tooltip wording).
   - Render each item with indentation + a small muted prefix for children:
     ```tsx
     <SelectItem key={category.id} value={category.id}>
       <span className={depth === 1 ? 'pl-4 text-muted-foreground' : 'font-medium'}>
         {depth === 1 ? '└ ' : ''}
         {category.code ? `[${category.code}] ${category.name}` : category.name}
       </span>
     </SelectItem>
     ```

3. **Item code generation must keep working for both levels:**
   - Update `selectedCategory` lookup to search the full `categories` array (not just top-level), so a Level 1 selection still resolves to its own 3-letter `code`.
   - Change:
     ```ts
     const selectedCategory = useMemo(
       () => categories.find(c => c.id === formData.category_id),
       [categories, formData.category_id]
     );
     ```
   - This preserves the existing `INV-{CAT}-{NNN}` auto-code logic — Level 1 categories like `CLO-MEN-SHT` will produce `INV-CLO-MEN-SHT-001`. If you want Level 1 to fall back to its parent's mnemonic (cleaner SKUs), I'll add that as a follow-up — flag if preferred.

### What does NOT change
- Database schema, RLS, or category data.
- Bulk import flow (separate ticket).
- Other category pickers across the app.

### Files modified
| File | Change |
|---|---|
| `src/components/warehouse/SingleItemForm.tsx` | Rename label to "Category"; show Level 0 + Level 1 with indentation; widen `selectedCategory` lookup to all categories. |

