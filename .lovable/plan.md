
# Plan: Add Category and Sub-Category Filters to Location Reports

## Overview
Add Category and Sub-category filter dropdowns to the Location Reports analytics component. These filters will work alongside the existing location, sub-location, and status filters.

## Current State
| Filter | Exists | Status |
|--------|--------|--------|
| Location | Yes | Working |
| Sub-Location | Yes | Working (cascading) |
| Status | Yes | Working |
| Category | No | **Missing** |
| Sub-Category | No | **Missing** |

The component already receives `categories` prop but doesn't use it for filtering.

## Changes Required

### File: `src/components/warehouse/LocationReportAnalytics.tsx`

#### 1. Add State Variables (after line 103)
```typescript
const [selectedCategory, setSelectedCategory] = useState<string>("all");
const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
```

#### 2. Add Category/Subcategory Memos
Derive main categories (no parent_id) and subcategories (filtered by selected category):
```typescript
const mainCategories = useMemo(
  () => categories.filter((cat) => !cat.parent_id),
  [categories]
);

const filteredSubcategories = useMemo(() => {
  if (selectedCategory === "all") {
    return categories.filter((cat) => cat.parent_id);
  }
  return categories.filter((cat) => cat.parent_id === selectedCategory);
}, [categories, selectedCategory]);
```

#### 3. Update filteredAssets Logic (around line 141)
Add category and subcategory filtering:
```typescript
if (selectedCategory !== "all") {
  result = result.filter((a) => a.category_id === selectedCategory);
}

if (selectedSubcategory !== "all") {
  result = result.filter((a) => a.subcategory_id === selectedSubcategory);
}
```

#### 4. Add Handler Functions
```typescript
const handleCategoryChange = (value: string) => {
  setSelectedCategory(value);
  setSelectedSubcategory("all"); // Reset subcategory when category changes
};
```

#### 5. Add Filter Dropdowns in UI (after line 522, before Status filter)
Add two new Select components:

**Category Filter:**
```tsx
<div className="w-48">
  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
    <SelectTrigger>
      <SelectValue placeholder="All Categories" />
    </SelectTrigger>
    <SelectContent className="bg-background border shadow-md z-50">
      <SelectItem value="all">All Categories</SelectItem>
      {mainCategories.map((cat) => (
        <SelectItem key={cat.id} value={cat.id}>
          {cat.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Sub-Category Filter:**
```tsx
<div className="w-48">
  <Select
    value={selectedSubcategory}
    onValueChange={setSelectedSubcategory}
    disabled={selectedCategory === "all"}
  >
    <SelectTrigger>
      <SelectValue placeholder="All Sub-Categories" />
    </SelectTrigger>
    <SelectContent className="bg-background border shadow-md z-50">
      <SelectItem value="all">All Sub-Categories</SelectItem>
      {filteredSubcategories.map((cat) => (
        <SelectItem key={cat.id} value={cat.id}>
          {cat.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

#### 6. Add Folder Icon Import
```typescript
import { Folder } from "lucide-react"; // For category icon
```

---

## Filter Layout After Changes

```text
+------------------------------------------------------------------+
| Filters:                                                          |
| [Location v] [Sub-Location v] [Category v] [Sub-Category v] [Status v]
+------------------------------------------------------------------+
```

## Cascading Filter Logic

| Selection | Effect |
|-----------|--------|
| Category = "All" | Sub-Category filter disabled |
| Category selected | Sub-Category shows only children of selected category |
| Category changed | Sub-Category resets to "All" |

## Data Flow

```text
User selects Category
        |
        v
Sub-Category filter updates (shows only related subcategories)
        |
        v
filteredAssets recalculated
        |
        v
Analytics data updates (charts, KPIs, tables)
```

## Files Modified

| File | Changes |
|------|---------|
| `src/components/warehouse/LocationReportAnalytics.tsx` | Add state, memos, handlers, and UI for category/subcategory filters |

## Summary of Changes
1. Add 2 new state variables for category selection
2. Add 2 useMemo hooks for derived category data
3. Update filteredAssets to include category filtering
4. Add handler function for cascading reset
5. Add 2 new Select dropdowns in the filters section
6. Ensure proper styling (bg-background, border, shadow-md, z-50)
