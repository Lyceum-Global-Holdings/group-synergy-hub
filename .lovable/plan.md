
# Add Category-Colored Stacked Bars to Asset Count Chart

## What This Does

Transforms the "Asset Count by Location/Sub-Location/Department" bar chart from a single solid-color bar into a stacked bar chart where each segment represents a different category, each with its own color. This gives immediate visual insight into the category composition at each location.

## Changes

### File: `src/components/warehouse/LocationReportAnalytics.tsx`

**1. Add new chart data in the `useMemo` (around line 543, alongside `statusByLocation`):**

Collect all unique category names across the top 10 locations, then build a dataset where each location row has a key per category with its count:

```typescript
// Collect all unique categories across top locations
const allCategories = new Set<string>();
sortedByCount.slice(0, 10).forEach((loc) => {
  loc.categoryBreakdown.forEach((cat) => allCategories.add(cat.categoryName));
});
const categoryList = Array.from(allCategories).sort();

// Build stacked data: each location gets a key per category
const categoryByLocation = sortedByCount.slice(0, 10).map((loc) => {
  const row: Record<string, string | number> = {
    name: loc.name.length > 15 ? loc.name.substring(0, 15) + "..." : loc.name,
    fullName: loc.name,
  };
  categoryList.forEach((catName) => {
    const match = loc.categoryBreakdown.find((c) => c.categoryName === catName);
    row[catName] = match ? match.assetCount : 0;
  });
  return row;
});
```

Include `categoryByLocation` and `categoryList` in the returned analytics object.

**2. Replace the single `<Bar>` with multiple stacked `<Bar>` components (lines 1238-1261):**

Change the BarChart from a simple bar to a stacked bar:

```tsx
<BarChart data={analyticsData.categoryByLocation}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
  <XAxis ... />
  <YAxis stroke="hsl(var(--foreground))" />
  <Tooltip />
  <Legend />
  {analyticsData.categoryList.map((catName, index) => (
    <Bar
      key={catName}
      dataKey={catName}
      stackId="categories"
      fill={COLORS[index % COLORS.length]}
      name={catName}
    />
  ))}
</BarChart>
```

Each category gets its own color from the existing `COLORS` array and they stack on top of each other using `stackId="categories"`.

**3. Add `Legend` import (if not already imported from recharts).**

Verify that `Legend` is in the recharts import statement; add it if missing.

## Summary

- One file modified: `src/components/warehouse/LocationReportAnalytics.tsx`
- The asset count bar chart becomes a stacked bar chart with each category in a different color
- A legend is added below the chart showing category-to-color mapping
- Uses the existing `categoryBreakdown` data already computed per location -- no new data fetching needed
- Falls back gracefully: locations with no categories simply show no bar segments
