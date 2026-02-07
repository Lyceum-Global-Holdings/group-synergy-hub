

# Plan: Add Asset Master Items Table to Location Analytics

## Overview
Add a detailed analysis table in the **Location Reports** tab that shows asset distribution by **Asset Master items** for each location. This provides granular visibility into exactly which master items exist at each location, their quantities, values, and condition breakdowns.

## Current State

| Component | Current Behavior |
|-----------|------------------|
| Location Expanded View | Shows status/condition breakdown, category badges, subcategory analysis table |
| Missing | No breakdown by individual Asset Master items |

## Requirement
Add a new section showing Asset Master item-level analysis per location with:
- Asset Master name
- Brand
- Category
- Count at location
- Total value
- Condition breakdown (Good/Fair/Poor)

---

## Solution Architecture

### Data Flow

```text
warehouse_assets (asset_master_id)
         ↓
    Group by location_id + asset_master_id
         ↓
Asset Master Breakdown Table
```

### New Data Structure

```typescript
interface AssetMasterBreakdown {
  assetMasterId: string;
  assetMasterName: string;
  brand: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  assetCount: number;
  totalValue: number;
  goodCondition: number;
  fairCondition: number;
  poorCondition: number;
  needsRepair: number;
}

// Add to LocationAnalyticsData interface
interface LocationAnalyticsData {
  // ... existing fields ...
  assetMasterBreakdown: AssetMasterBreakdown[];
}
```

---

## UI Enhancement

### Enhanced Expanded Row Layout

```text
+------------------------------------------------------------------+
| Row 1: Status | Condition | Value | Performance (existing)       |
+------------------------------------------------------------------+
| Row 2: Main Category Breakdown (existing)                        |
+------------------------------------------------------------------+
| Row 3: Subcategory Analysis Table (existing)                     |
+------------------------------------------------------------------+
| Row 4: Subcategory Charts (existing)                             |
+------------------------------------------------------------------+
| Row 5: Asset Master Items Detail (NEW)                           |
| +--------------------------------------------------------------+ |
| | Asset Master Item | Brand | Category | Count | Value | Condition| |
| | High Back Chair   | Mova  | Furniture| 25    | 125K  | G:20 F:5 | |
| | Office Cupboard   | Alpha | Furniture| 15    | 200K  | G:12 F:3 | |
| | 4 Cluster Table   | Alpha | Furniture| 10    | 500K  | G:8 F:2  | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Table Columns

| Column | Description |
|--------|-------------|
| Item Name | Asset Master item name |
| Brand | Brand from asset master |
| Category | Parent category name |
| Subcategory | Subcategory name |
| Count | Number of assets at this location |
| Total Value | Sum of current values |
| Good | Count in good condition |
| Fair | Count in fair condition |
| Poor | Count in poor/needs repair condition |

---

## Implementation Details

### 1. Enhance Data Aggregation

Add asset master tracking in the aggregation loop:

```typescript
// Track asset master data per location
const locationAssetMasterData: Record<
  string,
  Record<
    string,
    {
      assetMasterName: string;
      brand: string | null;
      categoryId: string | null;
      subcategoryId: string | null;
      count: number;
      value: number;
      good: number;
      fair: number;
      poor: number;
      needsRepair: number;
    }
  >
> = {};

// Inside asset iteration
if (asset.asset_master_id) {
  if (!locationAssetMasterData[key]) locationAssetMasterData[key] = {};
  if (!locationAssetMasterData[key][asset.asset_master_id]) {
    locationAssetMasterData[key][asset.asset_master_id] = {
      assetMasterName: asset.name, // Asset name from warehouse_assets
      brand: asset.brand,
      categoryId: asset.category_id,
      subcategoryId: asset.subcategory_id,
      count: 0,
      value: 0,
      good: 0,
      fair: 0,
      poor: 0,
      needsRepair: 0,
    };
  }
  const amData = locationAssetMasterData[key][asset.asset_master_id];
  amData.count++;
  amData.value += asset.current_value || asset.purchase_price || 0;
  // ... condition tracking
}
```

### 2. Build Asset Master Breakdown

```typescript
// After aggregation
Object.keys(groupedData).forEach((locId) => {
  if (locationAssetMasterData[locId]) {
    groupedData[locId].assetMasterBreakdown = Object.entries(
      locationAssetMasterData[locId]
    )
      .map(([amId, amData]) => {
        const cat = categoryMap.get(amData.categoryId || "");
        const subcat = categoryMap.get(amData.subcategoryId || "");
        return {
          assetMasterId: amId,
          assetMasterName: amData.assetMasterName,
          brand: amData.brand,
          categoryName: cat?.name || null,
          subcategoryName: subcat?.name || null,
          assetCount: amData.count,
          totalValue: amData.value,
          goodCondition: amData.good,
          fairCondition: amData.fair,
          poorCondition: amData.poor,
          needsRepair: amData.needsRepair,
        };
      })
      .sort((a, b) => b.assetCount - a.assetCount);
  }
});
```

### 3. Enhanced UI Section

Add new section in the expanded row after subcategory charts:

```tsx
{/* Row 5: Asset Master Items Detail */}
{item.assetMasterBreakdown.length > 0 && (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
      <Package className="h-3 w-3" />
      Asset Master Items Detail
    </p>
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs py-2">Item Name</TableHead>
            <TableHead className="text-xs py-2">Brand</TableHead>
            <TableHead className="text-xs py-2">Category</TableHead>
            <TableHead className="text-xs py-2">Subcategory</TableHead>
            <TableHead className="text-xs py-2 text-right">Count</TableHead>
            <TableHead className="text-xs py-2 text-right">Value</TableHead>
            <TableHead className="text-xs py-2 text-right text-success">Good</TableHead>
            <TableHead className="text-xs py-2 text-right text-warning">Fair</TableHead>
            <TableHead className="text-xs py-2 text-right text-destructive">Poor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {item.assetMasterBreakdown.slice(0, 15).map((am) => (
            <TableRow key={am.assetMasterId} className="text-xs">
              <TableCell className="py-1.5 font-medium">{am.assetMasterName}</TableCell>
              <TableCell className="py-1.5 text-muted-foreground">{am.brand || "—"}</TableCell>
              <TableCell className="py-1.5 text-muted-foreground">{am.categoryName || "—"}</TableCell>
              <TableCell className="py-1.5 text-muted-foreground">{am.subcategoryName || "—"}</TableCell>
              <TableCell className="py-1.5 text-right">{am.assetCount}</TableCell>
              <TableCell className="py-1.5 text-right">Rs. {am.totalValue.toLocaleString()}</TableCell>
              <TableCell className="py-1.5 text-right text-success">{am.goodCondition}</TableCell>
              <TableCell className="py-1.5 text-right text-warning">{am.fairCondition}</TableCell>
              <TableCell className="py-1.5 text-right text-destructive">{am.poorCondition + am.needsRepair}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {item.assetMasterBreakdown.length > 15 && (
        <div className="text-xs text-muted-foreground text-center py-2 border-t">
          +{item.assetMasterBreakdown.length - 15} more items
        </div>
      )}
    </div>
  </div>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/warehouse/LocationReportAnalytics.tsx` | Add AssetMasterBreakdown interface, enhance aggregation logic, add detail table UI |
| `src/utils/locationReportPdfExport.ts` | Include Asset Master breakdown in PDF export |

---

## Visual Comparison

### Before
```text
Expanded Location Row:
├── Status Breakdown
├── Condition Breakdown
├── Value Metrics
├── Performance
├── Main Category Breakdown (badges)
├── Subcategory Analysis (table)
└── Subcategory Charts (bar charts)
```

### After
```text
Expanded Location Row:
├── Status Breakdown
├── Condition Breakdown
├── Value Metrics
├── Performance
├── Main Category Breakdown (badges)
├── Subcategory Analysis (table)
├── Subcategory Charts (bar charts)
└── Asset Master Items Detail (NEW table)  ← NEW
```

---

## Benefits

1. **Granular Visibility**: See exactly which Asset Master items are at each location
2. **Inventory Control**: Quickly identify item distribution across locations
3. **Condition Tracking**: Monitor asset health by master item per location
4. **Value Analysis**: Understand value concentration by specific items
5. **Consistent with Architecture**: Uses existing `asset_master_id` relationship in `warehouse_assets`

---

## Technical Notes

- Uses existing `asset_master_id` field from `warehouse_assets` table
- Aggregates from asset-level data (no additional database queries needed)
- Groups by asset master ID with name from first matching asset
- Sorted by asset count (highest first) for relevance
- Shows top 15 items with expandable indicator for more

