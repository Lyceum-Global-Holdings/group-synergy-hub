

# Fix: Sub-Location Report Not Showing Data

## Root Cause

In `LocationReportAnalytics.tsx`, when the user switches between Location/Sub-Location/Department tabs, filter state values (`selectedLocation`, `selectedSublocation`) persist even though their corresponding dropdown UI elements become hidden.

For example:
1. User goes to **Department** tab, selects "LNNB" location and "8th Floor" sublocation
2. User switches to **Sub-Location** tab
3. The sublocation dropdown disappears (it only renders for Department tab, line 892)
4. But `selectedSublocation` is still set to "8th Floor" in React state
5. The `filteredAssets` (line 310-311) still applies `sublocation_id === selectedSublocation`, drastically reducing the dataset
6. Result: "No Data Available"

## Fix

### File: `src/components/warehouse/LocationReportAnalytics.tsx`

**Change 1: Reset filters when report type (tab) changes**

Update the `setReportType` handler in the `Tabs` `onValueChange` (line 855) to reset all dependent filters when switching tabs:

```typescript
onValueChange={(value) => {
  setReportType(value as ReportType);
  setSelectedLocation("all");
  setSelectedSublocation("all");
  setSelectedStatus("all");
  setExpandedRows(new Set());
}}
```

This ensures that when switching between Location, Sub-Location, and Department tabs, all filters reset to "all" so hidden filters cannot silently restrict the data.

**Change 2: Add sublocation filter for the Sub-Location tab**

Currently the sublocation filter dropdown only shows for the Department tab (line 892). For better UX, also show a sublocation filter when `reportType === "sublocation"` so users can drill into a specific sub-location:

```typescript
{(reportType === "sublocation" || reportType === "department") && (
  <div className="w-48">
    <Select value={selectedSublocation} onValueChange={handleSublocationChange}
      disabled={selectedLocation === "all"}>
      ...sublocation options...
    </Select>
  </div>
)}
```

This makes the filtering behavior consistent and visible -- users can see and control the sublocation filter rather than it being a hidden state.

## Summary

- Reset all filter state when switching tabs to prevent hidden filters from restricting data
- Show the sublocation filter dropdown on the Sub-Location tab for better usability
- One file modified: `src/components/warehouse/LocationReportAnalytics.tsx`
