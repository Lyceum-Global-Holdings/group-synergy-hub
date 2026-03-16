

# Fix: Import from Catalog dialog UI alignment issues

## Problem Analysis

Looking at the screenshot and code, the UI alignment issues are:

1. **Text overflow**: Item information (name, code, brand, category) is being truncated/cut off on the right side
2. **Badge alignment**: The "Select" badge on the right is not properly aligned and may be causing overflow
3. **Flex container issues**: The item row uses `flex items-center justify-between gap-2` but the left content div needs better truncation handling
4. **Missing flex-shrink control**: The left content area and badge need proper sizing constraints

## Root Cause

The item row (lines 285-297) has layout issues:
- The left content div has `min-w-0` (good for truncation) but the parent button doesn't have proper flex constraints
- The badge has `shrink-0` which prevents it from shrinking, but the text area isn't growing properly
- The text content inside uses `truncate` but the parent flex container isn't properly constrained

## Plan

### Update `src/components/warehouse/AddFromCatalogDialog.tsx`

**Line 285-297: Fix the item row layout**
- Change button to use `flex items-start` instead of `items-center` for better vertical alignment
- Add `flex-1` to the left content div so it takes available space
- Ensure proper spacing between content and badge
- Add `max-w-full` constraint to prevent overflow
- Keep the truncation classes but ensure the flex parent allows them to work

**Line 288-295: Improve text layout**
- Add `space-y-0.5` to the content div for better vertical spacing
- Ensure the secondary line with code/brand/category can wrap if needed (replace inline spans with flex layout)

**Line 273: Increase ScrollArea height** 
- Change from `h-[300px]` to `h-[400px]` for better UX with 14k items

## Technical Changes

```typescript
// Before (line 285-297):
<button className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center justify-between gap-2">
  <div className="min-w-0">
    <div className="font-medium text-sm truncate">{item.name}</div>
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      <span className="font-mono">{item.item_code}</span>
      {item.brand && <span>• {item.brand}</span>}
      <span>• {categoryName(item.category_id)}</span>
    </div>
  </div>
  <Badge variant="outline" className="shrink-0 text-[10px]">Select</Badge>
</button>

// After:
<button className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start justify-between gap-3">
  <div className="flex-1 min-w-0 space-y-0.5">
    <div className="font-medium text-sm truncate">{item.name}</div>
    <div className="text-xs text-muted-foreground truncate">
      <span className="font-mono">{item.item_code}</span>
      {item.brand && <span> • {item.brand}</span>}
      <span> • {categoryName(item.category_id)}</span>
    </div>
  </div>
  <Badge variant="outline" className="shrink-0 text-[10px] mt-0.5">Select</Badge>
</button>
```

Changes:
- Button: `items-center` → `items-start`, `gap-2` → `gap-3`
- Left div: add `flex-1`, add `space-y-0.5`
- Secondary text line: add `truncate` class to entire div (instead of only to individual spans)
- Badge: add `mt-0.5` for optical alignment with top-aligned content
- Remove flex from secondary line, use inline spans with spaces to allow natural wrapping

