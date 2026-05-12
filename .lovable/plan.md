## Goal

Move the **Inventory** view out of the `Item & Bin Master` tabbed page and surface it as its own sub-module under **Warehouse** in the left sidebar. This aligns with international WMS conventions (e.g., SAP EWM, Oracle WMS, ISO/GS1), which treat **Item Master (master data)** and **Inventory / On-Hand Stock (transactional)** as distinct functional areas.

## Target structure

Warehouse module sidebar (new order, master data first, then operations):

```text
Warehouse
├── Item & Bin Master        (master data: items, bins, categories, units)
├── Inventory                ← NEW top-level sub-module (on-hand stock view)
├── Goods Receipt Note
├── Putaway / Bin Transfer
├── Pick / Pack / Dispatch
├── Material Issue / Return
├── Stock Transfer
├── Cycle Count
├── Stock Adjustment
├── Stock Audit              (promoted alongside Inventory — see note)
├── Delivery Order
├── Inventory Valuation
├── Asset Management
├── Tool Management
└── Batch Management
```

## Changes

1. **New route + page** — `src/pages/warehouse/Inventory.tsx`
   - Renders the existing `ItemMasterTab` (which is the inventory/on-hand list, despite its legacy name) as a full page with its own H1 ("Inventory") and description.
   - Keeps `useRealtimeStockUpdates()` hook.
   - "Go to Audit" CTA links to `/warehouse/stock-audit` (new) instead of switching tabs.

2. **Register route** — `src/App.tsx`
   - Add lazy route `/warehouse/inventory` → `Inventory.tsx`.
   - Add `/warehouse/stock-audit` → new `StockAudit.tsx` page wrapping `StockAuditTab` (so the cross-link from Inventory keeps working without re-introducing tabs).

3. **Sidebar / module registry** — `src/constants/moduleConfig.ts`
   - Insert two new sub-modules in the `warehouse` block immediately after `item-bin-master`:
     - `{ key: 'inventory', name: 'Inventory', description: 'On-hand stock by item, location and bin', url: '/warehouse/inventory' }`
     - `{ key: 'stock-audit', name: 'Stock Audit', description: 'Reconcile on-hand vs ledger', url: '/warehouse/stock-audit' }`

4. **Remove `Inventory` and `Stock Audit` tabs from `ItemBinMaster.tsx`**
   - Drop the `inventory` and `audit` `TabsTrigger`/`TabsContent` blocks.
   - Reduce `TabsList` from `grid-cols-7` to `grid-cols-5`.
   - Update page title/description to reflect master-data-only scope ("Item & Bin Master — Manage item catalog, storage bins, categories, and units").
   - Update `ItemMasterDefinitionTab` props: `onNavigateToInventory` now uses `useNavigate()` to push `/warehouse/inventory`; `onNavigateToBins` keeps tab switch.

5. **Module access seeding** — no DB migration required. New sub-module keys (`inventory`, `stock-audit`) are added to `moduleConfig`; existing companies with full Warehouse access continue to see all sub-modules via the existing `getAllEnabledSubModules` flow. Companies with partial access will need an admin to enable the new keys via Module Allocation (standard pattern, no code change).

## Why this layout (international standards)

- **SAP / Oracle / NetSuite WMS**: separate "Item Master" (definition) from "Inventory / Stock Overview" (quantity by location).
- **GS1 / ISO 9001**: master data and transactional stock are distinct domains for traceability and audit.
- **Existing project memory** (`mem://architecture/module-registration-config`): all new system modules must be registered in `moduleConfig.ts` — followed.

## Out of scope

- No business-logic changes to inventory queries, RPCs, or RLS.
- No rename of the underlying `ItemMasterTab` component file (kept to minimise diff; only its mounting point changes). Can be renamed in a follow-up.
- No changes to `PublicBinAllocation` or procurement deep links to `/warehouse/item-bin-master`.
