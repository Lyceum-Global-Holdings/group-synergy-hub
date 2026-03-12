

# Production Module - WIP Tracking with Stage-wise Cost Calculation

## Overview

A new **Production** module that tracks Work-in-Progress (WIP) across three sectors: Apparel, Food & Beverage, and Manufacturing. Each sector has configurable production stages. Production orders can be linked to Customer POs and BOMs, or created standalone. Material costs are auto-populated from BOM categories per stage but allow manual overrides.

---

## Database Schema (6 new tables)

```text
production_sectors          production_stage_templates     production_orders
┌──────────────────┐       ┌──────────────────────┐      ┌─────────────────────────┐
│ id (PK)          │       │ id (PK)              │      │ id (PK)                 │
│ company_id (FK)  │       │ sector_id (FK)       │      │ company_id (FK)         │
│ name             │──1:N──│ stage_name           │      │ order_number (auto)     │
│ code (APPAREL...)│       │ sequence_order       │      │ sector_id (FK)          │
│ is_active        │       │ bom_categories[]     │      │ cpo_id (FK, nullable)   │
│ created_at       │       │ description          │      │ bom_id (FK, nullable)   │
└──────────────────┘       │ is_active            │      │ product_name            │
                           └──────────────────────┘      │ style_no               │
                                                         │ target_qty             │
production_order_stages              │ status (planned/in_progress│
┌─────────────────────────┐          │   /completed/cancelled)    │
│ id (PK)                 │          │ start_date, due_date       │
│ order_id (FK)           │          │ created_by (FK)            │
│ stage_template_id (FK)  │          └─────────────────────────────┘
│ stage_name              │                     │
│ sequence_order          │                     │
│ status (pending/in_     │          production_stage_costs
│  progress/completed)    │──1:N──┌──────────────────────────┐
│ input_qty               │       │ id (PK)                  │
│ output_qty              │       │ stage_id (FK)            │
│ wastage_qty             │       │ item_name                │
│ started_at              │       │ bom_item_id (FK,nullable)│
│ completed_at            │       │ unit_cost                │
│ completed_by            │       │ quantity_used            │
│ notes                   │       │ total_cost               │
└─────────────────────────┘       │ source (bom/manual)      │
                                  │ unit_of_measure          │
                                  └──────────────────────────┘
```

**Key design decisions:**
- `production_stage_templates.bom_categories` is a JSONB array storing which BOM categories (e.g., `["fabric"]`) map to each stage. This drives auto-population of costs.
- Default seed data creates the three sectors with pre-configured stages.

## Default Sector/Stage Configuration

| Sector | Stages | BOM Category Mapping |
|--------|--------|---------------------|
| **Apparel** | Cutting → Sewing → Finishing → Packing | Cutting: `fabric` / Sewing: `sewing_trims` / Finishing: `embellishment` / Packing: `packing_trims` |
| **Food & Beverage** | Mixing → Processing → Packaging → QC | No BOM auto-mapping (manual) |
| **Manufacturing** | Fabrication → Assembly → Testing → Packaging | No BOM auto-mapping (manual) |

## Frontend Architecture

### New Files
- `src/pages/production/ProductionModule.tsx` — Main page with tabs
- `src/components/production/ProductionDashboard.tsx` — KPI cards & charts
- `src/components/production/ProductionOrdersList.tsx` — Orders table with filters
- `src/components/production/CreateProductionOrderDialog.tsx` — New order form
- `src/components/production/ProductionOrderDetail.tsx` — Stage tracker view
- `src/components/production/StageProgressCard.tsx` — Individual stage card with qty input & cost breakdown
- `src/components/production/StagePlannerDialog.tsx` — Configure stages for a sector
- `src/components/production/StageCostBreakdown.tsx` — Cost table per stage
- `src/hooks/useProduction.ts` — All Supabase queries and mutations
- `src/constants/productionSectors.ts` — Default sector/stage definitions

### Page Layout (Tabs)

1. **Dashboard** — WIP summary by sector, stage completion rates, cost analytics (Recharts)
2. **Production Orders** — Filterable table of all orders with status badges
3. **Stage Planner** — Configure which stages each sector uses (admin only)

### Create Production Order Flow

1. Select Sector → stages auto-populate from templates
2. Optionally link to Customer PO → auto-fill product, style, qty
3. Optionally link to BOM → auto-populate stage costs from BOM item categories
4. Manual cost overrides allowed at any stage

### Stage Tracking UI

Each stage rendered as a horizontal pipeline (stepper). Clicking a stage opens:
- Input/Output/Wastage quantity fields
- Material cost table (auto-filled from BOM or manual entry)
- Stage total cost = sum of material costs
- Status toggle: Pending → In Progress → Completed

### Cost Calculation Logic

When a BOM is linked:
1. Read `bom_items` for the linked BOM
2. Match each `bom_item.category` to the stage's `bom_categories` array
3. Pre-populate `production_stage_costs` with item_name, unit_cost, quantity, total_cost
4. User can edit quantities or add manual cost lines

### Navigation

Add "Production" as a new department in `AppSidebar.tsx` with a Factory icon, containing:
- Production Dashboard → `/production`

### Route

- `/production` → `ProductionModule`

## RLS Policies

All tables use `company_id` with the existing `can_access_company()` helper for row-level isolation, matching the pattern used across finance and other modules.

## Summary of Changes

| Area | Files |
|------|-------|
| Database | 1 migration (6 tables + seed data + RLS) |
| Pages | 1 new page |
| Components | ~8 new components |
| Hooks | 1 new hook file |
| Constants | 1 new constants file |
| Navigation | Edit `AppSidebar.tsx` + `App.tsx` |

