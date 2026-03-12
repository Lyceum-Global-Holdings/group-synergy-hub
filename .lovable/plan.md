

# Daily Entry Cost Calculation

## Problem

Daily production entries track quantities (input, output, wastage) but don't calculate the associated costs. Users need to see the monetary impact of each day's production work.

## Approach: Derive Unit Cost from Stage Material Costs

Each stage already has material costs in `production_stage_costs` with a `total_cost`. The production order has a `target_qty`. We compute:

```
unit_cost = total_stage_material_cost / target_qty
```

Then for each daily entry:
- **Input Cost** = input_qty × unit_cost
- **Output Cost** = output_qty × unit_cost
- **Wastage Cost** = wastage_qty × unit_cost

This is a **frontend-only calculation** — no database changes needed. The costs are derived from existing data (stage costs + order target qty) and displayed alongside daily quantities.

## Changes

### 1. `StageProgressCard.tsx`
- Compute `unitCost = totalStageCost / order.target_qty` (the parent order's target qty needs to be passed down or accessed)
- Pass `unitCost` to `DailyEntryForm`, `DailyEntriesTable`, and display in the stage header

### 2. `DailyEntryForm.tsx`
- Accept `unitCost` prop
- Show live-calculated cost preview below the quantity fields: Input Cost, Output Cost, Wastage Cost
- Display total daily cost (input_cost + wastage_cost) as a summary before submission

### 3. `DailyEntriesTable.tsx`
- Accept `unitCost` prop
- Add three new columns: Input Cost, Output Cost, Wastage Cost (computed as qty × unitCost)
- Update the footer totals row to include cost totals

### 4. `DailyProductionSummary.tsx`
- Add cost KPI cards alongside quantity KPIs
- Show cost columns in the per-order breakdown table
- This requires fetching stage costs alongside daily entries — update `useDailySummary` to join `production_order_stages(production_stage_costs(*), order:production_orders(target_qty))`

### 5. `ProductionOrderDetail.tsx`
- Pass `order.target_qty` to `StageProgressCard` so it can compute unit cost

## Data Flow

```text
production_stage_costs (total) ──┐
                                 ├─► unit_cost = total / target_qty
production_orders.target_qty ────┘
                                      │
                daily_entry.input_qty × unit_cost  = input_cost
                daily_entry.output_qty × unit_cost = output_cost
                daily_entry.wastage_qty × unit_cost = wastage_cost
```

No migrations, no new tables — purely derived calculations displayed in the UI.

