---
name: Item Master Unit Cost = Master Catalog
description: warehouse_item_catalog is the single source of truth for Unit Cost; GRN approval refreshes it plus last_purchase_* audit fields
type: feature
---

- `warehouse_item_catalog.unit_cost` is the master Unit Cost shown on `/warehouse/item-bin-master` (Item Master tab). Per-company `warehouse_items.unit_cost` is a cache, used only as a fallback in `list_warehouse_inventory`.
- On GRN approval/completion, trigger `sync_item_price_on_grn_approval` (defined in migration `20260623_item_master_unit_cost_source_of_truth`) updates:
  - `warehouse_item_catalog`: `unit_cost`, `last_purchase_price`, `last_purchase_date`, `last_purchase_supplier_id`, `last_purchase_grn_id`
  - `warehouse_items`: `unit_cost` (per-company, for FIFO valuation / PDFs / reconciliation)
  - `warehouse_item_price_history`: append-only audit row (idempotent on `grn_item_id`)
- `get_warehouse_catalog_page` and `list_warehouse_inventory` both return `last_purchase_price/date/supplier_name/grn_number` so UI tooltips show provenance ("Last purchase price · date · GRN · supplier").
- Do NOT write to `warehouse_items.unit_cost` from new code paths. Edit the master via the catalog ("Edit item" dialog). GRN approval is the canonical price refresh.
