

## Add Item Description Under Name (Item Master & Inventory)

### Current State
- **Inventory tab** (`ItemMasterTab.tsx`): already displays description under the name (lines 671-678) ✓
- **Item Master tab** (`ItemMasterDefinitionTab.tsx`): only shows the item name on line 363, no description ✗

### Standards Alignment
Per **GS1 Master Data Standards** and **ISO 8000-110** (Master Data Quality), short item descriptions should accompany item names in catalog/inventory listings to ensure unambiguous identification of SKUs.

### Change

**File**: `src/components/warehouse/ItemMasterDefinitionTab.tsx`

Replace the single-line name cell (line 363):

```tsx
<TableCell className="font-medium">{item.name}</TableCell>
```

With a stacked layout that mirrors the Inventory tab pattern (consistency across tabs):

```tsx
<TableCell>
  <div className="space-y-0.5">
    <div className="font-medium">{item.name}</div>
    {item.description && (
      <div className="text-xs text-muted-foreground line-clamp-1">
        {item.description}
      </div>
    )}
  </div>
</TableCell>
```

### Why this approach
- **Consistency**: Matches the exact pattern already used in Inventory tab — same typography, spacing, truncation
- **Non-intrusive**: `line-clamp-1` prevents row-height bloat for long descriptions; full text still available in detail dialogs
- **Conditional render**: Only displays when description exists, no empty space for items without one
- **No data layer changes**: `description` is already part of the `CatalogItem` shape fetched by both tabs

### Files Modified
| File | Change |
|------|--------|
| `src/components/warehouse/ItemMasterDefinitionTab.tsx` | Stack description under name in the Name column cell |

