

## Phase 2: Flesh Out Placeholder Modules

### Overview
Replace the 6 placeholder modules (Selling, Expenses, Inventory, Procurement, Quality, Automation) with full sub-tabbed implementations matching StoresONE's structure. This requires creating missing shared utilities and adapting each module to use existing hooks/components where available.

### Prerequisites: Missing Shared Utilities

**Create these first** (StoresONE has them, this project doesn't):

1. **`src/components/shared/DataTable.tsx`** -- Generic table component with row click support (used by Selling, Quality, Automation modules)
2. **`src/components/shared/StatusBadge.tsx`** -- Reusable status badge with color mapping
3. **`src/lib/exportUtils.ts`** -- `exportToExcel()` function for CSV/Excel exports
4. **`src/lib/formatters.ts`** -- `useFormatCurrency()` and `useFormatDate()` hooks wrapping existing `formatCurrency` from `utils.ts`

### Module Implementations

#### 1. Procurement Module (most hooks exist)
**Sub-tabs:** Purchase Requisitions, Purchase Orders, Goods Receipt Notes, Invoice Matching

- Reuse existing: `usePurchaseRequisitions`, `usePurchaseOrders`, `useGoodsReceiptNotes`
- Reuse existing dialogs: `CreatePrDialog`, `CreatePoDialog`, `PrDetailsDialog`, `PoDetailsDialog`
- Create: `GRNDetailsPanel` (simple sheet showing GRN details)
- Invoice Matching tab: KPI cards + placeholder for 3-way match interface

#### 2. Selling Module (partially available via usePickPack)
**Sub-tabs:** Sales Orders, Delivery Notes, Pick Lists

- Adapt `usePickPack().useSalesOrders()` for the orders tab
- Delivery Notes: reuse existing delivery order data from `useDeliveryOrders`
- Pick Lists: filter confirmed/picking orders from sales orders
- Create: `SalesOrderFormDialog` (simple dialog) or link to existing pick-pack workflow
- Details: reuse existing `SalesOrderDetailsDialog`

#### 3. Inventory Module (warehouse hooks available)
**Sub-tabs:** Items, Stock Levels, Batch/Serial Tracking, Inventory Ageing, Stock Reconciliation

- Items tab: use `useWarehouseItems` or `useWarehouseItemsPaged` for item listing
- Stock Levels: use `useWarehouseBinAllocations` for stock data
- Batch Tracking tab: create `BatchTrackingTab` using `useBatches`
- Ageing tab: create `InventoryAgeingTab` using `useInventoryValuation`
- Reconciliation tab: create `StockReconciliationTab` using `useStockAudit`

#### 4. Quality Module (construction quality hooks exist)
**Sub-tabs:** Quality Inspections, Inspection Templates

- Adapt `useQualityInspections` from `src/hooks/construction/useQualityInspections.ts`
- Inspections table with KPI cards (total, pending, accepted, rejected)
- Templates tab with template listing
- Create `InspectionDetailsPanel` (sheet with inspection details)

#### 5. Expenses Module (needs new hooks + tables)
**Sub-tabs:** Dashboard, All Expenses, Company Bills, Petty Cash, Staff Advances

- **Company Bills** tab can reuse existing AP invoice data from `useSupplierInvoices` (finance/ap)
- **Dashboard, Petty Cash, Staff Advances** require new database tables and hooks that don't exist yet
- Approach: Build the full UI structure with sub-tabs, KPI cards, and tables. Wire Company Bills to existing AP data. Other tabs show "Coming soon" empty states with proper UI structure (not just a placeholder card)

#### 6. Automation Module (partially available)
**Sub-tabs:** Job Dashboard, Recurring Invoices, Payment Reminders, Workflow Rules, Scheduled Tasks

- **Workflow Rules** tab: use existing `useApprovalWorkflow` hook with DataTable
- **Recurring Invoices, Payment Reminders, Job Dashboard, Scheduled Tasks**: Build UI structure. Job Dashboard shows card grid for future automation jobs. Other tabs show structured empty states.

### Files to Create (~25 files)

**Shared utilities (4):**
- `src/components/shared/DataTable.tsx`
- `src/components/shared/StatusBadge.tsx`
- `src/lib/exportUtils.ts`
- `src/lib/formatters.ts`

**Module rewrites (6):**
- `src/components/accounting/procurement/ProcurementModule.tsx`
- `src/components/accounting/selling/SellingModule.tsx`
- `src/components/accounting/inventory/InventoryModule.tsx`
- `src/components/accounting/quality/QualityModule.tsx`
- `src/components/accounting/expenses/ExpensesModule.tsx`
- `src/components/accounting/automation/AutomationModule.tsx`

**Supporting sub-tab components (~12):**
- `src/components/accounting/inventory/BatchTrackingTab.tsx`
- `src/components/accounting/inventory/InventoryAgeingTab.tsx`
- `src/components/accounting/inventory/StockReconciliationTab.tsx`
- `src/components/accounting/quality/InspectionDetailsPanel.tsx`
- `src/components/accounting/expenses/ExpensesByTypeChart.tsx`
- `src/components/accounting/expenses/TopCostCentersChart.tsx`
- `src/components/accounting/procurement/GRNDetailsPanel.tsx`

### What Won't Be Fully Functional Yet
- **Expenses**: Petty Cash and Staff Advances need new DB tables (petty_cash_funds, petty_cash_vouchers, staff_advances) -- will show structured empty states
- **Automation**: Job runner infrastructure needs edge functions -- will show UI structure with manual trigger placeholders
- **Selling**: Full sales order creation needs a dedicated sales workflow -- will link to existing pick-pack system

### Implementation Order
1. Shared utilities (DataTable, StatusBadge, exportUtils, formatters)
2. Procurement (most complete, good validation of shared components)
3. Selling (uses existing pick-pack data)
4. Inventory (uses existing warehouse data)
5. Quality (adapts construction hooks)
6. Expenses (mostly UI structure)
7. Automation (mostly UI structure)

