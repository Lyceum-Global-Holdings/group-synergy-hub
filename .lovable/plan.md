

# Use Location Codes in Stacked Bar Chart

## Change

Update the `subcategoryByLocation` data builder (line 564-574) to use `locationCode` instead of `name` for the bar chart X-axis labels, falling back to `name` when no code is available.

## File: `src/components/warehouse/LocationReportAnalytics.tsx`

### Line 566: Update the `name` field in `subcategoryByLocation`

Change:
```typescript
name: loc.name.length > 15 ? loc.name.substring(0, 15) + "..." : loc.name,
```

To:
```typescript
name: (loc.locationCode || loc.name).length > 15 
  ? (loc.locationCode || loc.name).substring(0, 15) + "..." 
  : (loc.locationCode || loc.name),
```

This ensures the chart bars display the location code (e.g., "LYC-KUR") when available, with a fallback to the full location name. The `fullName` field remains unchanged for tooltip display.

