
# Show Subcategories in Stacked Bar Chart

## Change

Update the stacked bar chart to use **subcategories** instead of categories. Each bar segment will represent a different subcategory with its own color.

## File: `src/components/warehouse/LocationReportAnalytics.tsx`

### 1. Replace category collection with subcategory collection (lines 553-571)

Change the data preparation logic to iterate over `subcategoryBreakdown` instead of `categoryBreakdown`:

```typescript
// Collect all unique subcategories across top locations for stacked bar chart
const allSubcategories = new Set<string>();
sortedByCount.slice(0, 10).forEach((loc) => {
  loc.subcategoryBreakdown.forEach((sub) => allSubcategories.add(sub.subcategoryName));
});
const subcategoryList = Array.from(allSubcategories).sort();

// Build stacked data: each location gets a key per subcategory
const subcategoryByLocation = sortedByCount.slice(0, 10).map((loc) => {
  const row: Record<string, string | number> = {
    name: loc.name.length > 15 ? loc.name.substring(0, 15) + "..." : loc.name,
    fullName: loc.name,
  };
  subcategoryList.forEach((subName) => {
    const match = loc.subcategoryBreakdown.find((s) => s.subcategoryName === subName);
    row[subName] = match ? match.assetCount : 0;
  });
  return row;
});
```

### 2. Update returned analytics object (lines 598-599)

Replace `categoryByLocation` / `categoryList` with `subcategoryByLocation` / `subcategoryList`.

### 3. Update the BarChart component (around line 1259)

Change `data={analyticsData.categoryByLocation}` to `data={analyticsData.subcategoryByLocation}` and map over `analyticsData.subcategoryList` instead of `categoryList`.

## Result

Each bar will be composed of stacked segments -- one per subcategory -- with distinct colors and a legend identifying them all.
