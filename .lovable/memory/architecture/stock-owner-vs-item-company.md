---
name: Stock Owner vs Item Master Company
description: Stock Owner = warehouse_bin_allocations.company_id (SAP EWM party of ownership); Item Master Company = warehouse_items.company_id. Always surface as separate, never-merged columns.
type: architecture
---

Two distinct concepts that must never be merged in inventory UI:

- **Item Master Company** — `warehouse_items.company_id`. Who maintains the catalog row for that company. Shown as the "Company" column.
- **Stock Owner** — `warehouse_bin_allocations.company_id`. Legal entity that owns physical units at a bin/location (SAP EWM "Stock Owner" / Oracle WMS "Inventory Owner" / ISO 19440 party of ownership). With shared bins (`warehouse_bins.is_shared`) one bin can hold stock for multiple owners simultaneously.

The `list_warehouse_inventory` RPC accepts `_owner_company_id` and returns `owner_company_ids` + `owner_company_names` arrays (distinct owners visible per item in the current location scope). The Inventory tab has a "Stock Owner" filter and a dedicated badge column; the Bulk Update dialog accepts a Stock Owner filter that limits processed rows to those holding stock for the chosen owner. Ownership itself is never changed by bulk update — it is filter/read only.
