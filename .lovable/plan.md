

## Make Inventory Category Filter Show Level 0 + Level 1

Apply the same hierarchy treatment used in the Add Item form to the Category filter dropdown on the Inventory tab (`ItemMasterDefinitionTab`).

### Current behavior
- Line 256–261: dropdown maps `categories.map(...)` flat — no hierarchy, no visual distinction between parents and children.
- Filter value is the category **name**; `selectedCategoryId` (line 115–118) resolves name → id.

### Goal
- Show **Level 0 (parents)** AND **Level 1 (direct children of a Level 0)**, sorted, indented, matching `SingleItemForm`.
- Switch the filter to use category **id** (more robust; avoids name-collision risk between parent/child).

### Implementation — `src/components/warehouse/ItemMasterDefinitionTab.tsx`

1. **Add a `categoryOptions` memo** (right after `categories` is destructured around line 94):
   ```ts
   const categoryOptions = useMemo(() => {
     const level0 = categories.filter(c => !c.parent_id);
     const result: Array<{ category: typeof categories[number]; depth: 0 | 1 }> = [];
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

2. **Switch filter value to id** — simpler and safer:
   - State already exists: `const [categoryFilter, setCategoryFilter] = useState('all');` — semantics change from name to id.
   - Replace the `selectedCategoryId` memo (line 115–118) with:
     ```ts
     const selectedCategoryId = categoryFilter; // 'all' or a category id
     ```

3. **Update the dropdown render** (line 256–261):
   ```tsx
   <Select value={categoryFilter} onValueChange={setCategoryFilter}>
     <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
     <SelectContent>
       <SelectItem value="all">All Categories</SelectItem>
       {categoryOptions.map(({ category, depth }) => (
         <SelectItem key={category.id} value={category.id}>
           <span className={depth === 1 ? 'pl-4 text-muted-foreground' : 'font-medium'}>
             {depth === 1 ? '└ ' : ''}
             {category.code ? `[${category.code}] ${category.name}` : category.name}
           </span>
         </SelectItem>
       ))}
     </SelectContent>
   </Select>
   ```

4. **Clear button** (line 280) — no change needed; already resets to `'all'`.

### What does NOT change
- `useItemCategories` hook, DB, RLS, or filter-fetching logic on the server.
- Status / Supplier filters.
- Other category pickers elsewhere.

### Files modified
| File | Change |
|---|---|
| `src/components/warehouse/ItemMasterDefinitionTab.tsx` | Add `categoryOptions` memo (Level 0 + Level 1, indented); switch category filter value from name → id; simplify `selectedCategoryId`. |

