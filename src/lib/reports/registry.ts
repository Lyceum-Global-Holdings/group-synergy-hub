import { ReportColumn } from "./types";

/**
 * Static catalogue of available reports.
 * Hooks (one per report) implement the data fetch and convert RPC rows into
 * a ReportEnvelope using these column definitions.
 */
export interface ReportDefinition {
  code: string;
  title: string;
  description: string;
  moduleKey: string;
  standard?: string;
  /** Parameters the user must / can fill in */
  parameters: ReportParameter[];
  columns: ReportColumn[];
  /** Hook id used by the page to look up the matching data hook */
  hookId: string;
}

export type ReportParameter =
  | {
      key: string;
      label: string;
      type: "date";
      required?: boolean;
      defaultValue?: string;
    }
  | {
      key: string;
      label: string;
      type: "location" | "category";
      required?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      defaultValue?: boolean;
    };

export const REPORT_REGISTRY: ReportDefinition[] = [
  // ---------- WAREHOUSE ----------
  {
    code: "WH-STK-OH-001",
    title: "Stock on Hand",
    description: "Current stock per item with location, category and value at unit cost.",
    moduleKey: "warehouse",
    standard: "ISO / IAS 2",
    hookId: "warehouse.stockOnHand",
    parameters: [
      { key: "locationId", label: "Location", type: "location" },
      { key: "categoryId", label: "Category", type: "category" },
      { key: "includeZero", label: "Include zero-stock items", type: "boolean", defaultValue: false },
    ],
    columns: [
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 36 },
      { key: "category_name", label: "Category", type: "string", width: 22 },
      { key: "location_name", label: "Location", type: "string", width: 22 },
      { key: "unit_name", label: "UoM", type: "string", width: 10 },
      { key: "current_stock", label: "On Hand", type: "number", width: 12, align: "right" },
      { key: "reserved_quantity", label: "Reserved", type: "number", width: 12, align: "right" },
      { key: "available_quantity", label: "Available", type: "number", width: 12, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "stock_value", label: "Stock Value", type: "currency", width: 16, align: "right" },
      { key: "min_stock_level", label: "Min", type: "number", width: 10, align: "right" },
      { key: "reorder_level", label: "Reorder", type: "number", width: 10, align: "right" },
      { key: "status", label: "Status", type: "string", width: 12 },
    ],
  },
  {
    code: "WH-INV-VAL-001",
    title: "Inventory Valuation (FIFO & Weighted Avg)",
    description: "Side-by-side FIFO and Weighted-Average valuations with NRV adjustment per IAS 2.",
    moduleKey: "warehouse",
    standard: "IFRS / IAS 2",
    hookId: "warehouse.inventoryValuation",
    parameters: [
      { key: "asOfDate", label: "As of date", type: "date" },
      { key: "categoryId", label: "Category", type: "category" },
    ],
    columns: [
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 36 },
      { key: "category_name", label: "Category", type: "string", width: 22 },
      { key: "unit_name", label: "UoM", type: "string", width: 10 },
      { key: "current_stock", label: "On Hand", type: "number", width: 12, align: "right" },
      { key: "weighted_avg_cost", label: "WAvg Cost", type: "currency", width: 14, align: "right" },
      { key: "weighted_avg_value", label: "WAvg Value", type: "currency", width: 16, align: "right" },
      { key: "fifo_value", label: "FIFO Value", type: "currency", width: 16, align: "right" },
      { key: "last_unit_cost", label: "Last Cost", type: "currency", width: 14, align: "right" },
      { key: "selling_price", label: "Selling Price", type: "currency", width: 14, align: "right" },
      { key: "nrv_adjustment", label: "NRV Write-down", type: "currency", width: 16, align: "right" },
    ],
  },
  {
    code: "WH-AGE-001",
    title: "Inventory Aging & Dead Stock",
    description: "Aging buckets per item with last movement date and dead-stock flag (>365 days).",
    moduleKey: "warehouse",
    standard: "IAS 2 §28 (NRV)",
    hookId: "warehouse.inventoryAging",
    parameters: [{ key: "categoryId", label: "Category", type: "category" }],
    columns: [
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 36 },
      { key: "category_name", label: "Category", type: "string", width: 22 },
      { key: "current_stock", label: "On Hand", type: "number", width: 12, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "stock_value", label: "Stock Value", type: "currency", width: 16, align: "right" },
      { key: "last_movement_at", label: "Last Movement", type: "datetime", width: 22 },
      { key: "days_since_movement", label: "Days Idle", type: "integer", width: 12, align: "right" },
      { key: "aging_bucket", label: "Aging Bucket", type: "string", width: 22 },
    ],
  },
];

export function getReportsByModule(moduleKey: string): ReportDefinition[] {
  return REPORT_REGISTRY.filter((r) => r.moduleKey === moduleKey);
}

export function getReport(code: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((r) => r.code === code);
}
