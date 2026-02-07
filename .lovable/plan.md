

# Plan: Include Parent Information in Location Report Downloads

## Problem
When downloading the location detail report as JPG or PDF, the **Parent** information (shown in the main table row) is not included in the captured content. The user sees "Parent: 10th Floor, Department: LGH" in the table but this data is missing from downloads.

## Current State

**What's being captured:**
```text
+------------------------------------------+
| LGH (Header)                      [JPG] [PDF]
| Assets: 419 | Value: Rs. 13.8M | Util: 100%
+------------------------------------------+
| Status | Condition | Value | Performance  |
| ...detail rows...                         |
+------------------------------------------+
```

**What's missing:**
- Parent location name (e.g., "10th Floor")
- Report type context (Location/Sub-Location/Department)

## Solution

Enhance the captured header section to include:
1. **Report Type Label** (e.g., "Department Report")
2. **Parent Location Name** (e.g., "Parent: 10th Floor")
3. **Full Summary Row Data** mirroring the main table

### Updated Header Layout

```text
+--------------------------------------------------------------+
| DEPARTMENT REPORT                              [JPG] [PDF]   |
| Parent: 10th Floor                                           |
| Department: LGH                                              |
+--------------------------------------------------------------+
| Assets     | Value          | Active    | Utilization        |
| 419        | Rs. 13,875,320 | 419       | 100%               |
+--------------------------------------------------------------+
| Status | Condition | Value | Performance                     |
| ...detail rows...                                            |
+--------------------------------------------------------------+
```

---

## Implementation

### File to Modify
`src/components/warehouse/LocationReportAnalytics.tsx`

### Changes

**1. Update the header section** (around lines 1314-1344) to include:

```tsx
{/* Header with location name and download button */}
<div className="flex items-center justify-between border-b pb-3">
  <div>
    {/* Report Type Badge */}
    <Badge variant="outline" className="mb-2">
      {reportType === "location" 
        ? "Location Report" 
        : reportType === "sublocation" 
        ? "Sub-Location Report" 
        : "Department Report"}
    </Badge>
    
    {/* Parent Name (for sublocation/department) */}
    {item.parentName && (
      <p className="text-sm text-muted-foreground">
        Parent: {item.parentName}
      </p>
    )}
    
    {/* Location Name */}
    <h3 className="text-lg font-semibold">{item.name}</h3>
  </div>
  <div className="flex gap-2">
    {/* JPG and PDF buttons - unchanged */}
  </div>
</div>

{/* Summary KPIs row - NEW */}
<div className="grid grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg">
  <div className="text-center">
    <p className="text-xs text-muted-foreground">Assets</p>
    <p className="text-xl font-bold">{item.assetCount}</p>
  </div>
  <div className="text-center">
    <p className="text-xs text-muted-foreground">Total Value</p>
    <p className="text-xl font-bold">Rs. {item.totalValue.toLocaleString()}</p>
  </div>
  <div className="text-center">
    <p className="text-xs text-muted-foreground">Active</p>
    <Badge variant="default" className="text-lg px-3 py-1">{item.activeCount}</Badge>
  </div>
  <div className="text-center">
    <p className="text-xs text-muted-foreground">Utilization</p>
    <Badge 
      variant={item.utilizationRate > 70 ? "default" : item.utilizationRate > 40 ? "secondary" : "destructive"}
      className="text-lg px-3 py-1"
    >
      {item.utilizationRate.toFixed(0)}%
    </Badge>
  </div>
</div>
```

---

## Visual Comparison

### Before Download (Missing Data)
```text
+--------------------------------+
| LGH                            |
| Assets: 419 | Value | Util     |
+--------------------------------+
| Detail content...              |
```

### After Download (Complete Data)
```text
+--------------------------------+
| DEPARTMENT REPORT              |
| Parent: 10th Floor             |
| LGH                            |
+--------------------------------+
| Assets | Value    | Active | % |
| 419    | Rs.13.8M | 419    |100|
+--------------------------------+
| Detail content...              |
```

---

## Benefits

1. **Complete Context**: Downloads now include parent hierarchy
2. **Report Type Clarity**: Badge shows what type of report (Location/Sub-Location/Department)
3. **Summary KPIs**: Prominent display of key metrics matching the main table row
4. **Professional Output**: Well-structured header for both JPG and PDF exports

